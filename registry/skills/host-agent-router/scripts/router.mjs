#!/usr/bin/env node
/**
 * host-agent-router: pick the best (host, side) for a task and dispatch it headlessly on that host's CLI.
 *
 * Hosts: cline, antigravity, codex, claude.  Sides: windows and wsl on Windows (and from WSL), otherwise one `local` side.
 * Single file, Node built-ins only, written for Node >= 20 (WSL images often ship Node 20). Run with --help.
 *
 * Selection: hosts are tried in priority order. For one host the side with the most headroom wins (headroom = the smaller of
 * the 5-hour and weekly remaining), a tie keeps the side you are on. A host/side that is missing, logged out or below the
 * headroom floor is skipped. After a run that did no work because of a limit, login or model refusal, the next candidate runs; a model
 * refusal first tries the next model of the same tier on the same host (see "the model pool" below).
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A usage error: the command line was wrong and nothing ran. Exit code 64 (EX_USAGE), the code an unknown command already had; 1 stays for a run that failed. */
export class UsageError extends Error {}
export const EXIT_USAGE = 64;

const SELF = fileURLToPath(import.meta.url);
export const HOSTS = ['cline', 'antigravity', 'codex', 'claude'];
export const TIERS = ['simple', 'medium', 'high'];
export const ACCESS = ['read-only', 'edit'];
const MAX_OUTPUT = 200_000;
const MAX_SKILLS = 3;
const MAX_SKILL_CHARS = 20_000;

// ----------------------------------------------------------------------------- pure helpers

export function stripAnsi(text) {
  return String(text ?? '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

const VERSION_LINE = /^(?:[A-Za-z][\w.-]*\s+)?v?\d+\.\d+\.\d+(?:[\s(].*)?$/;
export function looksLikeVersion(line) {
  return VERSION_LINE.test(String(line).trim());
}

// The ClinePass phrases are Cline's own wording (3.0.74, @cline/llms): it has no usage readout, so a refusal is the only signal.
const FAIL_PATTERNS = [
  ['limit', /rate.?limit|usage limit|limit (?:reached|exceeded|hit)|reached your[\s\S]{0,160}?clinepass limit|quota (?:exceeded|exhausted|reached|used up)|exceeded (?:your |the )?(?:usage )?quota|resource.?exhausted|too many requests|\b429\b|credits? balance|insufficient (?:credits|quota|balance)|out of credits|over capacity/i],
  ['auth', /not logged in|please (?:run )?\/?log ?in|authenticat|unauthori[sz]ed|\b401\b|sign in|invalid api key|expired token|not subscribed to required model plan|no access to clinepass subscription|organization accounts cannot use clinepass/i],
  ['model', /unknown model|invalid model|model .{0,60}(?:not found|not available|not supported|does not exist)|no such model/i],
];

/**
 * 'limit' | 'auth' | 'model' | 'missing' | 'timeout' when the attempt looks like it did no work and another candidate may run;
 * null for success or a real task failure. For an edit run `runAttempts` still checks the tree before it believes that.
 */
export function classifyFailure(rc, out, err) {
  if (rc === 0) return null;
  if (rc === 126 || rc === 127) return 'missing';
  if (rc === 124) return 'timeout'; // runCmd's exit code for "killed by the router's own timeout"
  const text = `${out}\n${err}`;
  for (const [kind, re] of FAIL_PATTERNS) if (re.test(text)) return kind;
  return null;
}

export function winToWsl(p) {
  const m = /^([A-Za-z]):[\\/]*(.*)$/.exec(p);
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : p;
}

/** Windows path for a /mnt/<drive>/... path; null for a path that lives only inside WSL. */
export function wslToWin(p) {
  const m = /^\/mnt\/([a-zA-Z])(?:\/(.*))?$/.exec(p);
  return m ? `${m[1].toUpperCase()}:\\${(m[2] ?? '').replace(/\//g, '\\')}` : null;
}

export function translateCwd(cwd, here, target) {
  if (!cwd || here === target) return cwd;
  if (here === 'windows' && target === 'wsl') return winToWsl(cwd);
  if (here === 'wsl' && target === 'windows') return wslToWin(cwd);
  return null;
}

const epochIso = v => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
};
const round1 = n => Math.round(n * 10) / 10;

function modelFamily(model) {
  const m = String(model ?? '').toLowerCase();
  return ['opus', 'sonnet', 'haiku'].find(f => m.includes(f)) ?? '';
}

// ----------------------------------------------------------------------------- usage parsers (each returns windows: {name, remaining_pct, resets})

export function makeUsage(windows, extra = {}) {
  const vals = windows.map(w => w.remaining_pct).filter(v => v != null);
  // Windows of one name from several quota groups (an Orchestrator draws on two): the smaller figure is the one that counts.
  const pick = name => {
    const same = windows.filter(w => w.name === name && w.remaining_pct != null).map(w => w.remaining_pct);
    return same.length ? Math.min(...same) : null;
  };
  return { binding_pct: vals.length ? Math.min(...vals) : null, five_hour_pct: pick('five_hour'), weekly_pct: pick('weekly'), windows, ...extra };
}

const CLAUDE_ROW = /^Current\s+(session|week)(?:\s*\(([^)]*)\))?\s*:\s*(\d+(?:\.\d+)?)%\s*used(?:\s*[·•-]\s*resets\s+(.+?))?\s*$/i;

/** Claude `-p "/usage"`: percent USED. A model-specific weekly row only counts for that model's family. */
export function parseClaudeUsage(text, model = '') {
  const fam = modelFamily(model);
  const windows = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = CLAUDE_ROW.exec(raw.trim());
    if (!m) continue;
    const [, kind, label, used, resets] = m;
    const remaining = round1(100 - Number(used));
    let name;
    if (kind.toLowerCase() === 'session') name = 'five_hour';
    else if (['', 'all models'].includes((label ?? '').trim().toLowerCase())) name = 'weekly';
    else if (fam && label.toLowerCase().includes(fam)) name = `weekly:${label.trim()}`;
    else continue;
    windows.push({ name, remaining_pct: remaining, resets: resets ?? null });
  }
  return windows;
}

/**
 * The quota groups a model draws on. In this order: a rule of the USER's `quotaGroups` that matches the model (longest prefix; user config
 * beats shipped config, whatever the shipped rule says), else the entry's own list, else the longest matching prefix in the host's
 * `quotaGroups`. A rule gives a group name, or a list of names for a model that draws on several. An empty list means no group is known.
 */
function prefixGroups(model, rules) {
  let best = null;
  for (const [prefix, group] of Object.entries(rules ?? {})) {
    if (String(model ?? '').startsWith(prefix) && (best === null || prefix.length > best[0].length)) best = [prefix, group];
  }
  if (!best) return null;
  return Array.isArray(best[1]) ? [...best[1]] : [best[1]];
}

export function agyGroupsFor(model, groups, entryGroups, userGroups) {
  const user = prefixGroups(model, userGroups);
  if (user) return user;
  if (Array.isArray(entryGroups) && entryGroups.length) return [...entryGroups];
  return prefixGroups(model, groups) ?? [];
}

export function agyGroupFor(model, groups) {
  return agyGroupsFor(model, groups)[0] ?? null;
}

/** Antigravity `-p "/usage" --output-format json`: the 5h / weekly buckets (remaining_fraction) of the named groups, each window naming its group. */
export function parseAgyUsageGroups(text, names) {
  let data;
  try {
    data = JSON.parse(text)?.command?.data?.groups;
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const wanted = new Set(names);
  const windows = [];
  for (const g of data) {
    if (!wanted.has(g?.name)) continue;
    for (const b of g.buckets ?? []) {
      if (b?.remaining_fraction == null) continue;
      const name = { '5h': 'five_hour', weekly: 'weekly' }[b.window] ?? String(b.window);
      windows.push({ group: g.name, name, remaining_pct: round1(Number(b.remaining_fraction) * 100), resets: b.reset_time ?? null });
    }
  }
  return windows;
}

/** The same for the one group that owns `model` (the host's `quotaGroups`). */
export function parseAgyUsage(text, model, groups) {
  const target = agyGroupFor(model, groups);
  return target === null ? [] : parseAgyUsageGroups(text, [target]).map(({ group: _group, ...w }) => w);
}

/**
 * The usage of each model of the tier, from ONE /usage readout: { slug: usage }. `resolved` are the tier's entries as resolveEntry
 * returns them; an entry that names a display name takes its slug from the pool. An entry with no readable group is left out (unknown).
 */
export function agyUsageByModel(text, resolved, pool, groups, userGroups) {
  const out = {};
  const sameSet = (a, b) => a.length === b.length && a.every(g => b.includes(g));
  for (const r of resolved) {
    const model = r.model ?? slugByName(pool, r.displayName);
    if (!model || out[model]) continue;
    const names = agyGroupsFor(model, groups, r.quotaGroups, userGroups);
    // No rule, or a group the readout does not have: the headroom is unknown and the model runs (as in 1.1.2); the plan says so.
    if (!names.length) { out[model] = makeUsage([], { groups: [], unknown: `no quota rule matches ${model}` }); continue; }
    const windows = parseAgyUsageGroups(text, names);
    if (!windows.length) { out[model] = makeUsage([], { groups: names, unknown: `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} not in the /usage readout` }); continue; }
    // A group the readout does not have is named, not ignored silently: the figure then rests on the groups that were there.
    const missing = names.filter(g => !windows.some(w => w.group === g));
    // A rule of the user's that replaces the groups the model would otherwise draw on (an Orchestrator names two): their quota is not checked.
    const plain = userGroups ? agyGroupsFor(model, groups, r.quotaGroups) : [];
    const replaced = plain.length && !sameSet(plain, names) ? plain : [];
    out[model] = makeUsage(windows, { groups: names, ...(missing.length ? { missing_groups: missing } : {}), ...(replaced.length ? { replaced_groups: replaced } : {}) });
  }
  return out;
}

const codexWindowName = mins => ({ 300: 'five_hour', 10080: 'weekly' })[mins] ?? `window_${mins}m`;

/** Codex app-server `account/rateLimits/read`: windows are told apart by length, not by name. */
export function parseCodexRateLimits(result) {
  const rl = result?.rateLimits ?? {};
  const windows = [];
  for (const key of ['primary', 'secondary']) {
    const w = rl[key];
    if (!w || w.usedPercent == null) continue;
    windows.push({ name: codexWindowName(w.windowDurationMins), remaining_pct: round1(100 - Number(w.usedPercent)), resets: epochIso(w.resetsAt) });
  }
  if (result?.ordinaryUsageAllowed === false || rl.rateLimitReachedType) windows.push({ name: 'blocked', remaining_pct: 0, resets: null });
  return { windows, meta: { credits: rl.credits ?? null, plan: rl.planType ?? null } };
}

/** A snapshot saved in a Codex session log. A window whose reset time has passed is unused again. */
export function parseCodexRolloutRateLimits(rl, now) {
  const windows = [];
  for (const key of ['primary', 'secondary']) {
    const w = rl?.[key];
    if (!w || w.used_percent == null) continue;
    const used = w.resets_at != null && Number(w.resets_at) <= now ? 0 : Number(w.used_percent);
    windows.push({ name: codexWindowName(w.window_minutes), remaining_pct: round1(100 - used), resets: epochIso(w.resets_at) });
  }
  return windows;
}

// ----------------------------------------------------------------------------- the model pool (which models this account can use)
//
// A pool is { source: 'cli' | 'config' | 'unknown', models: [slug], names: { slug: display name }, efforts: { slug: [effort] }, reason? }.
// 'cli' was read from the host (Antigravity `agy models`, Codex app-server `model/list`), 'config' is the user's explicit list, 'unknown'
// means the list could not be read and the router then behaves as it did before pools: the first entry of a tier that has a model id.

/** `agy models` prints one `slug<TAB>display name` line per model (a progress line, if any, goes to stderr). null when no such line is found. */
export function parseAgyModels(stdout) {
  const rows = [];
  for (const raw of stripAnsi(stdout).split(/\r?\n/)) {
    if (!raw.includes('\t')) continue;
    const [slug, ...rest] = raw.split('\t');
    const name = rest.join('\t').trim();
    // A model id is lowercase (a header such as `ID<TAB>NAME` or an error line is not one); a line seen twice counts once.
    if (/^[a-z0-9][a-z0-9._-]*$/.test(slug.trim()) && name && !rows.some(r => r.slug === slug.trim())) rows.push({ slug: slug.trim(), name });
  }
  return rows.length ? rows : null;
}

export function agyPool(stdout) {
  const rows = parseAgyModels(stdout);
  return rows ? { source: 'cli', models: rows.map(r => r.slug), names: Object.fromEntries(rows.map(r => [r.slug, r.name])), efforts: {} } : null;
}

/** The app-server `model/list` answer (the whole response or its result). null for an error, an empty list or a list with a next page: a partial list would drop real models. */
export function codexPool(resp) {
  const result = isPlain(resp) && 'result' in resp ? resp.result : resp;
  if (!isPlain(result) || !Array.isArray(result.data) || result.nextCursor) return null;
  const slugOf = m => (isPlain(m) ? String(m.model ?? m.id ?? '').trim() : '');
  const rows = result.data.filter(m => slugOf(m) && m.hidden !== true);
  if (!rows.length) return null;
  const effortsOf = m => (Array.isArray(m.supportedReasoningEfforts) ? m.supportedReasoningEfforts.map(e => (typeof e === 'string' ? e : e?.reasoningEffort)).filter(e => typeof e === 'string') : []);
  return {
    source: 'cli',
    models: rows.map(slugOf),
    names: Object.fromEntries(rows.filter(m => typeof m.displayName === 'string').map(m => [slugOf(m), m.displayName])),
    efforts: Object.fromEntries(rows.map(m => [slugOf(m), effortsOf(m)]).filter(([, e]) => e.length)),
  };
}

export const configPool = list => ({ source: 'config', models: [...list], names: {}, efforts: {} });
export const unknownPool = reason => ({ source: 'unknown', models: [], names: {}, efforts: {}, ...(reason ? { reason } : {}) });

/** True when the pool is a real list (read from the host or configured) that entries are checked against. */
const poolKnown = pool => Boolean(pool) && pool.source !== 'unknown';

/** The slug the pool lists under this display name (case-insensitive), or null. */
export function slugByName(pool, name) {
  if (!poolKnown(pool) || typeof name !== 'string') return null;
  const want = name.trim().toLowerCase();
  const hit = Object.entries(pool.names ?? {}).find(([, n]) => String(n).trim().toLowerCase() === want);
  return hit ? hit[0] : null;
}

/**
 * A pool read from the host is trusted only if it names at least one model id (or display name) that the host's config names in some tier.
 * A header or an error line printed with exit 0 parses as a list too; every real model would then be "not in the list" and the host would be
 * skipped. A list that fails the check is reported as unknown (the router then behaves as with an unreadable list). A configured pool is the
 * user's word and is not second-guessed.
 */
export function trustedPool(pool, cfg, host) {
  if (!poolKnown(pool) || pool.source === 'config') return pool;
  const names = configuredModels(cfg, host);
  const have = new Set([...pool.models, ...Object.values(pool.names ?? {})].map(s => String(s).toLowerCase()));
  if (names.some(n => have.has(String(n).toLowerCase()))) return pool;
  return unknownPool(`the list has none of the ${names.length} models this config names for ${host} (${pool.models.length} read), so it is not trusted`);
}

// ----------------------------------------------------------------------------- config

const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge in place: objects merge key by key, arrays and scalars in `src` replace. */
function deepMergeInto(dst, src) {
  for (const [k, v] of Object.entries(src ?? {})) {
    if (isPlain(v) && isPlain(dst[k])) deepMergeInto(dst[k], v);
    else dst[k] = structuredClone(v);
  }
  return dst;
}

/**
 * A user's tier over the shipped one (what a config written for 1.1.2 means now).
 * - `models` (a list), or a `model` (the 1.1.2 shape), defines the tier completely and inherits NOTHING from the shipped entries: with a
 *   `model` the effort is the user's `effort` or 'medium' (the 1.1.2 default of every tier, never 'fixed'), the efforts are only the ones the
 *   user gives, and the quota groups come from the host-level rules. Everything the user wrote stays in the result, so the config check can
 *   refuse a mixed shape instead of the merge dropping a key. mergeConfig lists such a tier in the host's `userTiers`: the model pool filters
 *   shipped entries only, never a model the user named.
 * - Neither: `effort` goes to every shipped entry that takes one (a fixed entry records that the effort was not applied), `label` to the
 *   first entry, and `efforts` becomes the tier's own map: it answers `--effort` before the per-entry maps of the shipped list (resolveTier).
 * - A shipped tier that is itself in the old shape (one model) merges key by key as it always did.
 */
function mergeTier(base, over) {
  if (!isPlain(over)) return structuredClone(over);
  if ('models' in over) return structuredClone(over);
  if (over.model !== undefined) return { ...structuredClone(over), effort: over.effort === undefined ? 'medium' : over.effort };
  if (!isPlain(base)) return structuredClone(over);
  // Keys a tier override without a model does not read are kept, under badKeys, so the config check can name them instead of the merge dropping them.
  const badKeys = Object.keys(over).filter(k => !['effort', 'label', 'efforts'].includes(k));
  if (!Array.isArray(base.models)) return { ...deepMergeInto(structuredClone(base), over), ...(badKeys.length ? { badKeys } : {}) };
  const out = structuredClone(base);
  if (badKeys.length) out.badKeys = badKeys;
  const entries = out.models.map(e => (isPlain(e) ? e : { model: e }));
  if (over.effort !== undefined) {
    for (const e of entries) {
      if (e.fixedEffort === true) e.configEffort = over.effort;
      else e.effort = over.effort;
    }
  }
  if (over.label !== undefined && entries[0]) entries[0].label = over.label;
  out.models = entries;
  if (over.efforts !== undefined) out.efforts = structuredClone(over.efforts);
  return out;
}

/** Deep merge: objects merge key by key, arrays and scalars in `over` replace (a host's tiers merge as mergeTier says). Neither input is mutated. */
export function mergeConfig(base, over) {
  const out = structuredClone(base);
  const walk = (dst, src, trail) => {
    for (const [k, v] of Object.entries(src ?? {})) {
      if (trail.length === 3 && trail[0] === 'hosts' && trail[2] === 'tiers') {
        dst[k] = mergeTier(dst[k], v);
        if (isPlain(v) && ('models' in v || v.model !== undefined)) {
          const host = out.hosts[trail[1]];
          host.userTiers = [...new Set([...(host.userTiers ?? []), k])];
        }
      }
      else if (isPlain(v) && isPlain(dst[k])) walk(dst[k], v, [...trail, k]);
      else {
        dst[k] = structuredClone(v);
        // A host the user adds whole: every tier of it is the user's.
        if (trail.length === 1 && trail[0] === 'hosts' && isPlain(v?.tiers)) dst[k].userTiers = Object.keys(v.tiers);
      }
      // The user's own quota rules are remembered: they beat the shipped entries' groups (agyGroupsFor).
      if (trail.length === 2 && trail[0] === 'hosts' && k === 'quotaGroups' && isPlain(v)) dst.userQuotaGroups = structuredClone(v);
    }
  };
  walk(out, over, []);
  return out;
}

const WORD = /^[a-z]+$/;
const nonEmpty = v => typeof v === 'string' && v.trim() !== '';

/**
 * The entries of a tier, normalised: `models` (a model name or an object each), or the old shape (the tier itself is the one entry).
 * An entry: { model?, displayName?, label, effort, efforts?, fixedEffort?, quotaGroups? }. `effort` defaults to the tier's `effort`, else
 * 'medium'; a fixed-configuration entry (an Orchestrator) takes the effort 'fixed' and no `--effort` changes it. `displayName` names a
 * model whose id is not in the config: the id is then taken from the account's own list by that name.
 */
export function tierEntries(tier) {
  if (!isPlain(tier)) return [];
  const make = e => {
    const fixed = e.fixedEffort === true;
    const out = { ...e, effort: e.effort ?? (fixed ? 'fixed' : (tier.effort ?? 'medium')) };
    delete out.models;
    out.label = e.label ?? e.model ?? e.displayName;
    return out;
  };
  if (!('models' in tier)) return [make(tier)];
  return Array.isArray(tier.models) ? tier.models.map(e => make(isPlain(e) ? e : { model: e })) : [];
}

const FIXED_MESSAGE = '"fixed" is only for a host whose effort is part of the model name (Antigravity); on a host that takes its effort as a command-line flag, name a real effort';
const orchestratorMessage = model => `${model} is an Orchestrator (fixed configuration); only a host whose effort is part of the model name (Antigravity) can run it`;
const badKeyProblems = (where, keys) => keys.map(k => `${where}: ${k} is not read in a tier override without a model; a tier override takes effort, label and efforts; write "model" or "models" to define the tier`);
const ULTRA_MESSAGE = '"ultra" is not offered by the router (it runs parallel subagents and spends much more)';

/** Problems with one tier of a host: the old shape (one model, an effort) or a list of entries. */
function validateTier(where, t, effortInModel) {
  if (!isPlain(t)) return [`${where}: needs a model and an effort`];
  if (!('models' in t)) {
    const errs = [];
    for (const key of ['fixedEffort', 'displayName', 'quotaGroups']) {
      if (key in t) errs.push(`${where}: ${key} beside model is not read; write { "models": [ { "model": "...", "${key}": ... } ] } instead`);
    }
    if (t.badKeys) errs.push(...badKeyProblems(where, t.badKeys));
    if (!t.model || !WORD.test(t.effort ?? '')) errs.push(`${where}: needs a model and an effort`);
    else if (t.effort === 'ultra') errs.push(`${where}: effort: ${ULTRA_MESSAGE}`);
    else if (t.effort === 'fixed' && !effortInModel) errs.push(`${where}: effort: ${FIXED_MESSAGE}`);
    if (!effortInModel && shippedFixedModels().has(t.model)) errs.push(`${where}: ${orchestratorMessage(t.model)}`);
    if (t.efforts !== undefined) errs.push(...validateEfforts(where, t.efforts, effortInModel));
    return errs;
  }
  const errs = [];
  if (t.badKeys) errs.push(...badKeyProblems(where, t.badKeys));
  if ('model' in t) errs.push(`${where}: model and models are both given; write one: "model" for a single model, or "models" for an ordered list`);
  if ('label' in t) errs.push(`${where}: label beside models belongs to an entry; write { "models": [ { "model": "...", "label": "..." } ] }`);
  if (!Array.isArray(t.models) || t.models.length === 0) return [...errs, `${where}: models must be a non-empty list of model names or entries`];
  if (t.efforts !== undefined) errs.push(...validateEfforts(where, t.efforts, effortInModel));
  if (t.effort === 'ultra') errs.push(`${where}: effort: ${ULTRA_MESSAGE}`);
  const seen = new Map();
  t.models.forEach((raw, i) => {
    const n = i + 1;
    if (typeof raw !== 'string' && !isPlain(raw)) { errs.push(`${where}: entry ${n} must be a model name or an object`); return; }
    const e = typeof raw === 'string' ? { model: raw } : raw;
    if (!nonEmpty(e.model) && !nonEmpty(e.displayName)) errs.push(`${where}: entry ${n} needs a model or a displayName`);
    const key = nonEmpty(e.model) ? e.model.trim() : nonEmpty(e.displayName) ? e.displayName.trim().toLowerCase() : null;
    if (key !== null) {
      if (seen.has(key)) errs.push(`${where}: entry ${n} repeats ${nonEmpty(e.model) ? e.model.trim() : e.displayName.trim().toLowerCase()} (entry ${seen.get(key)}); list each model once`);
      else seen.set(key, n);
    }
    if (e.model !== undefined && !nonEmpty(e.model) && nonEmpty(e.displayName)) errs.push(`${where}: entry ${n}: model must be a non-empty string`);
    if (e.fixedEffort !== undefined && typeof e.fixedEffort !== 'boolean') errs.push(`${where}: entry ${n}: fixedEffort must be true or false`);
    else if (e.fixedEffort === true && !effortInModel) errs.push(`${where}: entry ${n}: fixedEffort is only for a host whose effort is part of the model name (${where.split('/')[0]} takes its effort as a command-line flag); give the entry an effort instead`);
    const eff = e.effort === undefined ? (e.fixedEffort === true ? 'fixed' : (t.effort ?? 'medium')) : e.effort;
    if (!(typeof eff === 'string' && WORD.test(eff))) errs.push(`${where}: entry ${n} needs an effort (lowercase letters)`);
    else if (eff === 'ultra') errs.push(`${where}: entry ${n}: ${ULTRA_MESSAGE}`);
    else if (eff === 'fixed' && e.fixedEffort !== true && !effortInModel) errs.push(`${where}: entry ${n}: ${FIXED_MESSAGE}`);
    if (e.configEffort !== undefined && !(typeof e.configEffort === 'string' && WORD.test(e.configEffort))) errs.push(`${where}: entry ${n} needs an effort (lowercase letters)`);
    if (!effortInModel && nonEmpty(e.model) && shippedFixedModels().has(e.model)) errs.push(`${where}: entry ${n}: ${orchestratorMessage(e.model)}`);
    if (e.quotaGroups !== undefined && !(Array.isArray(e.quotaGroups) && e.quotaGroups.length > 0 && e.quotaGroups.every(nonEmpty))) errs.push(`${where}: entry ${n}: quotaGroups must be a list of group names`);
    if (e.efforts !== undefined) errs.push(...validateEfforts(`${where}[${n}]`, e.efforts, effortInModel));
  });
  return errs;
}

export function validateConfig(cfg, { home = os.homedir(), platform = process.platform } = {}) {
  const errs = [];
  if (!Array.isArray(cfg?.priority) || cfg.priority.length === 0) return ['priority must be a non-empty list of hosts'];
  for (const host of cfg.priority) {
    if (!HOSTS.includes(host)) errs.push(`priority lists an unknown host: ${host}`);
    else if (!cfg.hosts?.[host]) errs.push(`${host}: no entry under hosts`);
  }
  for (const host of cfg.priority) {
    if (!HOSTS.includes(host) || !cfg.hosts?.[host]) continue;
    const h = cfg.hosts[host];
    for (const tier of TIERS) errs.push(...validateTier(`${host}/${tier}`, h.tiers?.[tier], Boolean(h.effortInModel)));
    if (h.pool !== undefined && h.pool !== null && !(Array.isArray(h.pool) && h.pool.length > 0 && h.pool.every(nonEmpty))) {
      errs.push(`${host}: pool must be a non-empty list of model names (or null to read the list from the host)`);
    }
    for (const [prefix, g] of Object.entries(h.quotaGroups ?? {})) {
      if (!(nonEmpty(g) || (Array.isArray(g) && g.length > 0 && g.every(nonEmpty)))) errs.push(`${host}: quotaGroups.${prefix} must be a group name or a list of group names`);
    }
  }
  if (!Number.isFinite(Number(cfg.minHeadroomPct))) errs.push('minHeadroomPct must be a number');
  for (const k of ['allow', 'deny']) {
    const list = cfg.workerCommands?.[k];
    if (list !== undefined && !Array.isArray(list)) errs.push(`workerCommands.${k} must be a list`);
    else for (const e of validateAllowCmd(list ?? [])) errs.push(e.replace('--allow-cmd', `workerCommands.${k}`));
  }
  const ts = cfg.timeoutSeconds;
  const positive = v => Number.isFinite(Number(v)) && Number(v) > 0;
  if (ts !== undefined && (isPlain(ts) ? Object.values(ts).some(v => !positive(v)) : !positive(ts))) {
    errs.push('timeoutSeconds must be a positive number, or an object of positive numbers per tier (simple, medium, high)');
  }
  if (cfg.workerTemp !== undefined && cfg.workerTemp !== null) {
    const bad = configWorkerTempProblem(cfg.workerTemp, { home, platform });
    if (bad) errs.push(bad);
  }
  if (cfg.maxBudgetUsd !== undefined && cfg.maxBudgetUsd !== null) {
    const bad = typeof cfg.maxBudgetUsd === 'number' ? budgetProblem(cfg.maxBudgetUsd) : 'must be a positive number of US dollars with at most two decimals, or null';
    if (bad) errs.push(`maxBudgetUsd ${bad}`);
  }
  if (cfg.wslNode !== undefined && cfg.wslNode !== null) {
    const bad = configWslNodeProblem(cfg.wslNode);
    if (bad) errs.push(bad);
  }
  return errs;
}

/** The hosts whose CLI has a spend cap flag (read from their own help on 2026-11-16): today only Claude (`--max-budget-usd`). */
const BUDGET_FLAG = { claude: '--max-budget-usd' };

/** What is wrong with a budget cap (the flag's text or the config's number), or null: a positive amount with at most two decimals. */
export function budgetProblem(value) {
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : typeof value === 'string' ? value : '';
  if (!/^\d+(\.\d{1,2})?$/.test(text) || !(Number(text) > 0)) return 'must be a positive number of US dollars with at most two decimals (for example 5 or 2.50)';
  return null;
}

/** The `budget` field of an attempt or a dry-run entry for a host, or undefined when no cap was asked. */
export function budgetOf(host, usd) {
  if (usd === null || usd === undefined) return undefined;
  if (BUDGET_FLAG[host]) return { usd, applied: true, flag: BUDGET_FLAG[host] };
  return { usd, applied: false, reason: `${host} has no budget flag; the run is bounded by --timeout only` };
}

/** The payload for `local-exec` on the side that runs the host. The command line (the budget flag for Claude included) is built here and travels in `args`; the far side adds nothing. */
export function execPayload(spec, { host, cwd, timeout, workerTemp }) {
  return { host, args: spec.args, stdin: spec.stdin, env: spec.env, cwd, timeout, ...(workerTemp ? { workerTemp } : {}) };
}

/** What is wrong with a configured wslNode (the Linux path of node inside WSL), or null. */
export function configWslNodeProblem(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(value)) {
    return 'wslNode must be an absolute Linux path (a string that starts with /, with no control characters or backslashes)';
  }
  return null;
}

/**
 * Problems with a tier's optional `efforts` map. An entry is either a plain effort value (for a host whose effort is a flag; the tier's
 * model stays) or `{ label?, model?, effort? }` (for a host whose effort is part of the model name, `model` is required).
 */
export function validateEfforts(where, efforts, effortInModel = false) {
  if (!isPlain(efforts)) return [`${where}: efforts must be an object of effort names`];
  const word = v => typeof v === 'string' && /^[a-z]+$/.test(v);
  const errs = [];
  for (const [name, e] of Object.entries(efforts)) {
    const at = `${where}: efforts.${name}`;
    if (!word(name)) errs.push(`${at}: an effort name is lowercase letters only`);
    if (name === 'ultra' || e === 'ultra' || (isPlain(e) && e.effort === 'ultra')) errs.push(`${at}: ${ULTRA_MESSAGE}`);
    if (!effortInModel && (e === 'fixed' || (isPlain(e) && e.effort === 'fixed'))) errs.push(`${at}: ${FIXED_MESSAGE}`);
    if (!effortInModel && isPlain(e) && typeof e.model === 'string' && shippedFixedModels().has(e.model)) errs.push(`${at}: ${orchestratorMessage(e.model)}`);
    if (typeof e === 'string') {
      if (!word(e)) errs.push(`${at}: needs an effort value (lowercase letters)`);
      else if (effortInModel) errs.push(`${at}: this host carries the effort in the model name, so the entry needs a model`);
    } else if (isPlain(e)) {
      if (e.model === undefined && e.effort === undefined) errs.push(`${at}: needs a model or an effort`);
      if (e.model !== undefined && (typeof e.model !== 'string' || !e.model.trim())) errs.push(`${at}: model must be a non-empty string`);
      else if (effortInModel && e.model === undefined) errs.push(`${at}: this host carries the effort in the model name, so the entry needs a model`);
      if (e.effort !== undefined && !word(e.effort)) errs.push(`${at}: effort must be lowercase letters`);
      if (e.label !== undefined && typeof e.label !== 'string') errs.push(`${at}: label must be a string`);
    } else errs.push(`${at}: must be an effort value or an object with a model and/or an effort`);
  }
  return errs;
}

/**
 * The model, effort and label one entry runs at when the lead asks for `effort`. No effort, or the entry's own default, keeps the entry.
 * The tier's own `efforts` map (`selector`, the user's) answers first with a plain value or an object without a model; then the entry's map;
 * an entry with no such name keeps its default and says so in `note` (never an error). An object in the selector that names a model is
 * the choice itself and is placed by `resolveTier`.
 */
export function resolveEntry(entry, host, tier, effort, selector) {
  const name = entry.model ?? entry.displayName;
  const base = {
    model: entry.model, effort: entry.effort, label: entry.label, note: null,
    ...(entry.displayName ? { displayName: entry.displayName } : {}),
    ...(entry.quotaGroups ? { quotaGroups: entry.quotaGroups } : {}),
    ...(entry.fixedEffort ? { fixed: true } : {}),
  };
  // An Orchestrator has a fixed configuration: no effort changes it, and the plan says so (for `--effort` and for an `effort` in the user's config).
  if (entry.fixedEffort) {
    const notes = [];
    if (effort) notes.push(`${host}: --effort ${JSON.stringify(effort)} was not applied: ${entry.label} has a fixed configuration, so the ${tier} tier keeps ${name}`);
    if (entry.configEffort) notes.push(`${host}: effort ${JSON.stringify(entry.configEffort)} from your config was not applied: ${entry.label} has a fixed configuration`);
    return notes.length ? { ...base, note: notes.join('; ') } : base;
  }
  if (!effort) return base;
  const u = selector?.[effort];
  const userModel = isPlain(u) && nonEmpty(u.model);
  const e = u !== undefined && !userModel ? u : entry.efforts?.[effort];
  if (typeof e === 'string') return { ...base, effort: e };
  if (isPlain(e)) return { ...base, model: e.model ?? entry.model, effort: e.effort ?? effort, label: e.label ?? e.model ?? base.label };
  if (effort === entry.effort) return base;
  return { ...base, note: `${host}: no "${effort}" effort in the ${tier} tier; kept ${name} (${entry.effort}); add hosts.${host}.tiers.${tier}.efforts.${effort} to your config to choose one` };
}

/** The user's own `efforts` map of a tier that is a list (it answers `--effort` before the per-entry maps), or undefined. */
const tierSelector = tier => (isPlain(tier) && Array.isArray(tier.models) && isPlain(tier.efforts) ? tier.efforts : undefined);

let shippedFixed = null;
/** The models the SHIPPED config gives a fixed configuration (the Orchestrators): fixed wherever a config names them. */
function shippedFixedModels() {
  if (shippedFixed === null) {
    shippedFixed = new Set();
    try {
      const base = JSON.parse(fs.readFileSync(path.join(path.dirname(SELF), '..', 'assets', 'config.default.json'), 'utf8'));
      for (const h of Object.values(base.hosts ?? {})) for (const tier of Object.values(h.tiers ?? {})) for (const e of tierEntries(tier)) if (e.fixedEffort && e.model) shippedFixed.add(e.model);
    } catch { /* no shipped file beside this script (a staged copy): the host's own entries still count */ }
  }
  return shippedFixed;
}

const fixedModelsFor = hostCfg => new Set([...shippedFixedModels(), ...Object.values(hostCfg?.tiers ?? {}).flatMap(tr => tierEntries(tr).filter(e => e.fixedEffort && e.model).map(e => e.model))]);

/**
 * Every entry of a tier resolved for the asked effort, as { r: resolved, defaultEffort }, in the order they are tried. When the user's map
 * for that effort names a model, that model comes first (subject to the pool and headroom like any entry, also when the shipped head of the
 * tier is an Orchestrator). It is a model the user named, so the pool keeps it (`user`); a model that the shipped config gives a fixed
 * configuration stays fixed there. Two entries that resolve to the same model are one: the first stays.
 */
export function resolveTier(tier, host, tierName, effort, hostCfg) {
  const selector = tierSelector(tier);
  const userTier = Array.isArray(hostCfg?.userTiers) && hostCfg.userTiers.includes(tierName);
  const fixedSet = hostCfg?.effortInModel ? fixedModelsFor(hostCfg) : null;
  const asFixed = r => (fixedSet && r.model && fixedSet.has(r.model) && !r.fixed
    ? { ...r, effort: 'fixed', fixed: true, note: effort ? `${host}: --effort ${JSON.stringify(effort)} was not applied: ${r.label} has a fixed configuration, so the ${tierName} tier keeps ${r.model}` : null }
    : r);
  const all = tierEntries(tier).map(e => ({ r: asFixed({ ...resolveEntry(e, host, tierName, effort, selector), ...(userTier ? { user: true } : {}) }), defaultEffort: e.effort }));
  const u = effort ? selector?.[effort] : undefined;
  if (isPlain(u) && nonEmpty(u.model)) {
    const label = u.label ?? u.model;
    const head = fixedModelsFor(hostCfg).has(u.model)
      ? { r: { model: u.model, effort: 'fixed', label, fixed: true, user: true, note: `${host}: --effort ${JSON.stringify(effort)} was not applied: ${label} has a fixed configuration, so the ${tierName} tier keeps ${u.model}` }, defaultEffort: 'fixed' }
      : { r: { model: u.model, effort: u.effort ?? effort, label, user: true, note: null }, defaultEffort: 'medium' };
    all.unshift(head);
  }
  const seen = new Set();
  return all.filter(({ r }) => {
    if (!r.model) return true;
    if (seen.has(r.model)) return false;
    seen.add(r.model);
    return true;
  });
}

/** The first resolved entry of a tier (or the `index`th): the model, effort, label and note a host/tier runs at. */
export function resolveEffort(cfg, host, tier, effort, index = 0) {
  const all = resolveTier(cfg.hosts[host].tiers[tier], host, tier, effort, cfg.hosts[host]);
  return (all[index] ?? all[0]).r;
}

/** Every effort name some host in scope offers for `tier`: the default effort and the keys of the `efforts` maps (of each entry, and the tier's own); a fixed-configuration entry offers none. */
export function knownEfforts(cfg, tier, only) {
  const names = new Set();
  for (const host of cfg.priority) {
    if (only?.length && !only.includes(host)) continue;
    const tt = cfg.hosts[host]?.tiers?.[tier];
    for (const n of Object.keys(tierSelector(tt) ?? {})) names.add(n);
    for (const e of tierEntries(tt)) {
      if (e.fixedEffort) continue;
      names.add(e.effort);
      for (const n of Object.keys(e.efforts ?? {})) names.add(n);
    }
  }
  return [...names].sort();
}

/** A usage-error message when no host in scope knows `effort` for `tier`, else null. */
export function checkEffort(cfg, tier, effort, only) {
  if (effort === 'ultra') return `--effort "ultra" is not offered by the router (it runs parallel subagents and spends much more)`;
  const known = knownEfforts(cfg, tier, only);
  if (known.includes(effort)) return null;
  const hosts = cfg.priority.filter(h => !only?.length || only.includes(h));
  return `--effort ${JSON.stringify(effort)} is not an effort of the ${tier} tier on ${hosts.join(', ')}; known: ${known.join(', ')} (an efforts map in hosts.<host>.tiers.${tier}.efforts of your config adds one)`;
}

/** The model names a host is configured with, tiers and efforts, once each: what `models` checks against the host's own list. */
export function configuredModels(cfg, host) {
  const out = [];
  const add = m => { if (m && !out.includes(m)) out.push(m); };
  for (const tier of TIERS) {
    const tt = cfg.hosts[host].tiers[tier];
    for (const t of tierEntries(tt)) {
      add(t.model ?? t.displayName);
      for (const e of Object.values(t.efforts ?? {})) add(isPlain(e) ? e.model : null);
    }
    for (const e of Object.values(tierSelector(tt) ?? {})) add(isPlain(e) ? e.model : null);
  }
  return out;
}

/** The `ran` part of a run result: the host, side, model and effort actually used, and the note when a requested effort was not available. */
export function ranOf(c) {
  return { host: c.host, side: c.side, model: c.model, effort: c.effort, label: c.label, ...(c.effort_note ? { effort_note: c.effort_note } : {}) };
}

const PLAIN_WORD = /^[\w@./=-]+$/;
const DRIVE_WORD = /^[A-Za-z]:[\\/][\w@./=\\-]*$/; // a Windows drive path: one letter, a colon, then / or \ ; the colon appears nowhere else

/**
 * Problems with a list of command lines for --allow-cmd, --allow-cmd-file or `workerCommands`. Each is the exact line a worker may run:
 * Antigravity matches an allowed command as a WHOLE line (seen live 2026-11-15: a shorter allowed line did not cover the longer one), so
 * this is not a prefix. Plain words only, so a line cannot break out of a host's rule syntax: Antigravity `command(<line>)`, Claude
 * `Bash(<line>:*)`. The one exception is a drive path (`C:/work/x`, `D:\work\y`) at the start of a word, the only place a colon or a
 * backslash is accepted; `\\` (a UNC path) stays refused, since Claude's rule parser reads `\\` as one backslash. The Cline hook and Codex
 * take no allowed lines, so nothing of this reaches them.
 */
export function validateAllowCmd(list) {
  const errs = [];
  for (const c of Array.isArray(list) ? list : [list]) {
    const words = typeof c === 'string' ? c.split(' ').filter(Boolean) : [];
    if (typeof c !== 'string' || !c.trim() || c.includes('\\\\') || !words.every(w => PLAIN_WORD.test(w) || DRIVE_WORD.test(w))) {
      errs.push(`--allow-cmd ${JSON.stringify(c)} is not a plain command line (letters, digits, spaces and _ @ . / = - only; a colon or backslash only in a drive path such as C:/work/x or D:\\work\\y at the start of a word). Antigravity matches the whole line, so give the exact line the worker will run`);
    }
  }
  return errs;
}

/** Command lines from a --allow-cmd-file: UTF-8, one per line; blank lines, lines starting with # and a BOM are ignored. Throws a UsageError for a file that cannot be read or a line that is not plain. */
export function readAllowCmdFile(file) {
  if (file === undefined) return [];
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new UsageError(`--allow-cmd-file ${JSON.stringify(file)} cannot be read (${e?.code ?? e?.message ?? e})`); }
  const out = [];
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const bad = validateAllowCmd([line]);
    if (bad.length) throw new UsageError(`${bad.join('')} (line ${i + 1} of ${file})`);
    out.push(line);
  });
  return out;
}

/**
 * Lines the brief gives the worker that extend an allowed line: [{ allowed, longer }] for each of `allowed` that some line of `brief` starts
 * with, followed by a space and more text. A HEURISTIC, not a shell parser: a "line" here is the text inside a backtick span or the start of a
 * line of the brief (after a list marker or "$ "). A longer line that is itself in `known` is fine. Antigravity matches whole lines, so the
 * short allowed line would not cover the long one the brief tells the worker to run. A one-word value is a bare program name, which that host
 * matches whatever follows it, so it is never reported.
 */
export function longerCommandLines(brief, allowed, known = allowed) {
  const spans = [];
  for (const raw of String(brief ?? '').split(/\r?\n/)) {
    spans.push(raw.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, '').replace(/^\$\s+/, ''));
    for (const m of raw.matchAll(/`([^`]+)`/g)) spans.push(m[1].trim());
  }
  const out = [];
  for (const a of allowed) {
    const v = a.trim();
    const longer = v.includes(' ') && spans.find(s => s.startsWith(`${v} `) && s.slice(v.length).trim() && !known.includes(s));
    if (longer) out.push({ allowed: v, longer });
  }
  return out;
}

/**
 * Seconds before a run is killed. A hang is bounded by the size of the work, not by one number for everything:
 * `--timeout` wins, then the tier's entry in `timeoutSeconds`, then a plain number there, then 1800.
 */
export function timeoutFor(cfg, tier, override) {
  const positive = v => Number.isFinite(Number(v)) && Number(v) > 0;
  if (override !== undefined && override !== null && override !== '' && positive(override)) return Number(override);
  const ts = cfg?.timeoutSeconds;
  if (isPlain(ts)) { if (positive(ts[tier])) return Number(ts[tier]); }
  else if (positive(ts)) return Number(ts);
  return 1800;
}

/** The user's config file: `$HOST_AGENT_ROUTER_CONFIG`, else `~/.agents/host-agent-router/config.json`. */
const userConfigFile = (env = process.env, home = os.homedir()) => env.HOST_AGENT_ROUTER_CONFIG || path.join(home, '.agents', 'host-agent-router', 'config.json');

export function loadConfig(env = process.env) {
  const base = JSON.parse(fs.readFileSync(path.join(path.dirname(SELF), '..', 'assets', 'config.default.json'), 'utf8'));
  const userFile = userConfigFile(env);
  let cfg = base;
  if (fs.existsSync(userFile)) {
    let user;
    try { user = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch (e) { throw new UsageError(`invalid config (${userFile}): not valid JSON (${e?.message ?? e})`); }
    cfg = mergeConfig(base, user);
  }
  const errs = validateConfig(cfg);
  // A wrong config is the operator's to fix and nothing ran: a usage error (64), not a failed run (1).
  if (errs.length) throw new UsageError(`invalid config (${fs.existsSync(userFile) ? userFile : 'defaults'}):\n- ${errs.join('\n- ')}`);
  return cfg;
}

/** Why a side was skipped, with no file path in it (a path names the user): a WSL that has no node says only that. */
export function skipNote(error) {
  const s = String(error?.message ?? error ?? '');
  if (/wsl bridge returned no JSON/.test(s) && /node: (?:command )?not found/.test(s)) return 'WSL has no node (the config key "wslNode" can name it)';
  return cleanNote(s);
}

// ----------------------------------------------------------------------------- selection

function orderSides(usable, here, tiePct) {
  const known = usable.filter(u => u[1] != null).sort((a, b) => b[1] - a[1]);
  const unknown = usable.filter(u => u[1] == null).sort((a, b) => Number(a[0] !== here) - Number(b[0] !== here));
  if (known.length) {
    const best = known[0][1];
    const i = known.findIndex(u => u[0] === here && best - u[1] <= tiePct);
    if (i > 0) known.unshift(...known.splice(i, 1));
  }
  return [...known, ...unknown].map(u => u[0]);
}

/** What `pools` says of one side: the source and how many models, or that the list is unknown. null when there is nothing worth saying (a host with one model per tier and no pool). */
function poolInfo(pool, entryCount) {
  if (poolKnown(pool)) return { source: pool.source, models: pool.models.length };
  if (pool) return { source: 'unknown', ...(pool.reason ? { reason: pool.reason } : {}) };
  return entryCount > 1 ? { source: 'unknown' } : null;
}

/**
 * Which model of the tier a host/side runs. `pairs` are the tier's entries resolved for the asked effort (resolveTier). Entries are tried in order: one the
 * account does not have (not in a known pool), one with no model id (Carbon, when the list does not give it), and one whose quota group is
 * below the floor are skipped, each with its reason. The first left is `chosen`, the rest are `alternates` (a refused model moves to the next).
 * With an unknown pool nothing is checked against it: the first entry that has a model id is used.
 */
const CODEX_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

function pickModels({ host, tier, pairs, pool, st, min, flagEffort, asked }) {
  const known = poolKnown(pool);
  const seen = new Set();
  const where = pool?.source === 'config' ? 'the configured pool' : "the account's model list";
  const accepted = [];
  const skipped = [];
  const lowest = [];
  for (const { r: r0, defaultEffort } of pairs) {
    let r = r0;
    const name = r.model ?? r.displayName;
    const model = r.model ?? slugByName(pool, r.displayName);
    if (!model) {
      skipped.push({ model: name, reason: known ? `not in ${where}` : "no model id is configured for it and the account's model list is unknown" });
      continue;
    }
    // Two entries that name the same model (one by display name, one by slug) are one: the first stays, the refused model is not tried again.
    if (seen.has(model)) continue;
    seen.add(model);
    // The pool filters SHIPPED entries only: a model the user's config names runs even when the list does not show it (the list hides some
    // models, and aliases exist). The plan says so; a refusal then follows the normal retry and fall-through.
    let poolNote = null;
    if (known && !pool.models.includes(model)) {
      if (!r.user) {
        skipped.push({ model: name, reason: `not in ${where}` });
        continue;
      }
      poolNote = `${model} is not in ${where}; kept because your config names it`;
    }
    // A model that does not offer the asked effort keeps the entry's own (Codex: the pool lists the efforts of each model).
    const offered = known ? pool.efforts?.[model] : undefined;
    if (flagEffort && !r.fixed && asked && offered?.length && !offered.includes(r.effort) && r.effort !== defaultEffort) {
      r = { ...r, effort: defaultEffort, note: `${host}: ${model} does not offer "${r.effort}" on this account; kept ${defaultEffort}` };
    } else if (host === 'codex' && flagEffort && !r.fixed && asked && !offered?.length && r.effort !== defaultEffort && !CODEX_EFFORTS.includes(r.effort)) {
      // No effort list for the model (the pool is unknown): a word the router does not offer never reaches the CLI.
      r = { ...r, effort: defaultEffort, note: `${host}: effort "${r.effort}" is not one the router offers for codex (${CODEX_EFFORTS.join(', ')}); kept ${defaultEffort}` };
    }
    const usage = st.usage_by_model ? (st.usage_by_model[model] ?? null) : (st.usage ?? null);
    const b = usage?.binding_pct ?? null;
    if (b !== null && b < min) {
      skipped.push({ model: name, reason: `headroom ${b}% below minimum ${min}%` });
      lowest.push(b);
      continue;
    }
    // A model that draws on several quota groups, with one of them missing from the readout: say so, the figure is not the whole picture.
    const missing = usage?.missing_groups ?? [];
    const notes = [];
    if (missing.length) notes.push(`headroom judged on ${(usage.groups ?? []).filter(g => !missing.includes(g)).join(' and ')} only: ${missing.join(' and ')} ${missing.length > 1 ? 'were' : 'was'} not in the /usage readout`);
    if (usage?.replaced_groups?.length) notes.push(`your quotaGroups rule replaces this model's groups (${usage.replaced_groups.join(' and ')}); headroom is read from ${(usage.groups ?? []).join(' and ')} only, so their quota is not checked`);
    if (usage?.unknown) notes.push(`headroom unknown (${usage.unknown}); the model runs`);
    const quota = notes.length ? { quota_note: notes.join('; ') } : {};
    accepted.push({ model, effort: r.effort, label: r.label ?? model, ...(r.note ? { effort_note: r.note } : {}), ...(poolNote ? { pool_note: poolNote } : {}), ...quota, usage, binding: b });
  }
  if (accepted.length) {
    const [chosen, ...rest] = accepted;
    return { chosen, alternates: rest.map(({ usage: u, binding: _b, ...a }) => ({ ...a, binding_pct: u?.binding_pct ?? null, five_hour_pct: u?.five_hour_pct ?? null, weekly_pct: u?.weekly_pct ?? null })), skipped, usage: chosen.usage, binding: chosen.binding };
  }
  const names = skipped.map(s => s.model).join(', ');
  const reason = skipped.length === lowest.length && lowest.length ? `headroom ${Math.max(...lowest)}% below minimum ${min}%`
    : lowest.length === 0 && known ? `no model of the ${tier} tier is in ${where} (${names})`
      : lowest.length === 0 ? `no model of the ${tier} tier has a model id (${names})`
        : `no usable model in the ${tier} tier: ${skipped.map(s => `${s.model} (${s.reason})`).join('; ')}`;
  return { chosen: null, alternates: [], skipped, reason };
}

/**
 * statuses: { host: { side: { installed, logged_in, usage, usage_by_model?, pool? } } }. Returns the ordered candidates and why others were skipped.
 * A candidate is the first model of the tier that the account has and has headroom (`alternates`: the models after it, `skipped_models`: the
 * ones before it that were passed over, with the reason); `pools` says where each side's model list came from.
 */
export function buildPlan(cfg, tier, statuses, here, onlyHosts, access, effort) {
  const min = Number(cfg.minHeadroomPct ?? 10);
  const tie = Number(cfg.tiePct ?? 2);
  const candidates = [];
  const skipped = [];
  const pools = {};
  for (const host of cfg.priority) {
    if (onlyHosts?.length && !onlyHosts.includes(host)) continue;
    const sides = statuses[host] ?? {};
    const hostCfg = cfg.hosts[host];
    const pairs = resolveTier(hostCfg.tiers[tier], host, tier, effort, hostCfg);
    const usable = [];
    const picks = new Map();
    for (const [side, st] of Object.entries(sides)) {
      if (!st.installed) skipped.push({ host, side, reason: `not installed or not runnable${st.error ? ` (${skipNote(st.error)})` : ''}` });
      else if (st.logged_in === false) skipped.push({ host, side, reason: 'not logged in' });
      else {
        const pool = hostCfg.pool ? configPool(hostCfg.pool) : trustedPool(st.pool ?? null, cfg, host);
        const info = poolInfo(pool, pairs.length);
        if (info) pools[`${host}/${side}`] = info;
        const pick = pickModels({ host, tier, pairs, pool, st, min, flagEffort: !hostCfg.effortInModel, asked: effort });
        if (!pick.chosen) skipped.push({ host, side, reason: pick.reason });
        else { picks.set(side, pick); usable.push([side, pick.binding]); }
      }
    }
    let ordered = orderSides(usable, here, tie);
    // Some hosts only work as an editor on one side (Codex's Windows sandbox lost its working directory and PATH; its WSL sandbox is sound).
    const editSide = hostCfg.editSide;
    if (access === 'edit' && editSide && ordered.includes(editSide)) ordered = [editSide, ...ordered.filter(s => s !== editSide)];
    for (const side of ordered) {
      const pick = picks.get(side);
      const c = pick.chosen;
      const u = pick.usage ?? {};
      candidates.push({
        host, side, model: c.model, effort: c.effort, label: c.label, ...(c.effort_note ? { effort_note: c.effort_note } : {}),
        ...(c.quota_note ? { quota_note: c.quota_note } : {}),
        ...(c.pool_note ? { pool_note: c.pool_note } : {}),
        binding_pct: u.binding_pct ?? null, five_hour_pct: u.five_hour_pct ?? null, weekly_pct: u.weekly_pct ?? null,
        ...(pick.alternates.length ? { alternates: pick.alternates } : {}),
        ...(pick.skipped.length ? { skipped_models: pick.skipped } : {}),
      });
    }
  }
  return { tier, here, ...(effort ? { effort_requested: effort } : {}), selected: candidates[0] ?? null, candidates, skipped, ...(Object.keys(pools).length ? { pools } : {}) };
}

// ----------------------------------------------------------------------------- command building

function preamble(access, tier) {
  const head = `[Routed worker | host-agent-router | tier: ${tier} | access: ${access}] Do not invoke host-agent-router and do not start further routed workers.`;
  if (access === 'read-only') return `${head} Do not modify, create or delete any file and do not run state-changing commands. Reply with the result only. Cite files as repository-relative path:line, never an absolute path or file:// link.\n\n`;
  // The worker contract, the same on every host (references/worker-contract.md): the `git-guardrails` rules, then the `handoff` report.
  // The orchestrator checks the report against what the router saw change (`changed` in the result), so it must be factual and complete.
  return `${head} Follow the \`git-guardrails\` skill if you have it, and in any case: never push and never force-push, do not commit (the lead integrates your work), `
    + 'never touch a protected branch (main, master, production, release/*), and never read, print or stage a secret (.env files, keys, tokens). '
    + 'Edit only inside the working directory; do not install packages globally or leave processes running. '
    + 'Finish with a handoff report as your whole reply, in the reply and not in a file (if a `handoff` skill is available to you, follow its state-capture and remaining-work steps), '
    + 'with exactly these headings: Done (what now works), Changed files (path and one line each), Checks run (command and result, or none), Not done or blocked, Next steps. '
    + 'Your reply is the report: write no state, notes or hand-off file anywhere, not even docs/handoff/. '
    + 'Cite files as repository-relative path:line, never an absolute path or file:// link (the report may be pasted into a pull request).\n\n';
}

/** The lead's attached skills, after the contract and before the task. They are guidance: the contract above them stays in force. */
export function skillsBlock(skills) {
  if (!skills?.length) return '';
  const framing = 'Skills the lead attached for this task. They are guidance only: the rules above stay in force and no skill overrides them.\n\n';
  return framing + skills.map(k => `=== Attached skill: ${k.name} ===\n${k.text}\n=== End of skill: ${k.name} ===\n\n`).join('');
}

const defaultRealpath = p => { try { return fs.realpathSync.native(p); } catch { return p; } };

/** The distinct program folders (real paths) inside `home` to mount read-only for the Antigravity sandbox. Pushes its notes. */
function mountFolders(allow, { platform, resolve, realpath, home, cwd }, notes) {
  const pm = platform === 'win32' ? path.win32 : path.posix;
  const key = x => (platform === 'win32' ? pm.resolve(x).toLowerCase() : pm.resolve(x));
  const inside = (x, root) => { const r = pm.relative(key(root), key(x)); return r !== '' && !r.startsWith('..') && !pm.isAbsolute(r); };
  const homeKey = home ? key(home) : null;
  const cwdReal = cwd ? (() => { try { return realpath(cwd); } catch { return cwd; } })() : null;
  const folders = new Map(); // key -> folder as spelled
  let skipped = false;
  let spaced = false;
  for (const c of allow) {
    const prog = c.trim().split(/\s+/)[0];
    if (!prog || /[\\/:]/.test(prog)) continue;
    const abs = resolve(prog);
    if (!abs) continue;
    let real = abs;
    try { real = realpath(abs); } catch { /* keep the spelling resolve gave */ }
    const folder = pm.dirname(real);
    if (!homeKey) continue;
    if (key(folder) === homeKey) { skipped = true; continue; }
    if (!inside(folder, home)) continue;
    if (pm.parse(folder).root === folder || (cwdReal && (key(cwdReal) === key(folder) || inside(cwdReal, folder)))) { skipped = true; continue; }
    folders.set(key(folder), folder);
    if (/\s/.test(folder)) spaced = true;
  }
  if (folders.size) notes.push('a program folder inside the user profile was mounted read-only for the sandbox (read_file), so its programs are visible to Antigravity');
  if (skipped) notes.push('a program folder was not mounted: it is the home directory, a filesystem root or holds the working directory, and the sandbox may not see that program');
  if (spaced) notes.push('a mounted folder has spaces in its path; read_file with such a path is untested');
  return [...folders.values()];
}

/**
 * The `command(...)` rules Antigravity gets for an edit run. On Windows its sandbox may lack the directory of the `node` the lead's shell finds
 * (seen live, 2026-11-13), so each allowed line whose first word is a bare program that the router's own lookup resolves to a real `.exe` also gets
 * the same line with that absolute path. The path comes only from `resolve` on this machine, never from the brief or `--allow-cmd`. A `.cmd` or
 * script shim is not rewritten, and neither is a path with whitespace (an exact-line match was only seen for a path without spaces): a note says so.
 * Every platform: the sandbox does not expose folders inside the user profile unless a `read_file` rule mounts them read-only (host-library
 * antigravity permissions/sandbox.md; a Node under nvm lives there: seen 2026-11-14, "not recognized" without the rule, v24.19.0 with it). So the
 * REAL folder (links followed) of each resolved allowed program gets `read_file(<folder>)` when it is inside `home`: never home itself, a
 * filesystem root, or a folder that contains the working directory (a note says so instead). Notes never carry a path.
 * `omit` (a Set of allowed lines) are given no full-path rule: buildSpec uses it when the rules would make the command line too long.
 * Returns { rules, full (the added command lines, for the worker's note), fullFor (allowed line -> its full-path line), notes }.
 */
export function antigravityAllowRules(allow, { platform = process.platform, resolve: lookupRaw = which, realpath = defaultRealpath, home = os.homedir(), cwd, omit = new Set() } = {}) {
  const seen = new Map(); // one lookup per program name
  const resolve = n => { if (!seen.has(n)) seen.set(n, lookupRaw(n)); return seen.get(n); };
  const rules = allow.map(c => `command(${c})`);
  const full = [];
  const fullFor = new Map();
  const notes = [];
  const mounts = mountFolders(allow, { platform, resolve, realpath, home, cwd }, notes);
  if (platform === 'win32') {
    const spaced = new Set();
    for (const c of allow) {
      const line = c.trim();
      const prog = line.split(/\s+/)[0];
      if (!prog || /[\\/:]/.test(prog)) continue;
      const abs = resolve(prog);
      if (!abs || !/\.exe$/i.test(abs)) continue;
      if (/\s/.test(abs)) {
        if (!spaced.has(prog)) { spaced.add(prog); notes.push(`no full-path rule for "${prog}": its path has spaces, so only the bare-name rule is given`); }
        continue;
      }
      const fullLine = abs.replace(/\.exe$/i, '.exe') + line.slice(prog.length); // PATHEXT yields `.EXE`; the rule seen live used `.exe`
      fullFor.set(line, fullLine);
      if (!omit.has(line)) full.push(fullLine);
    }
  }
  const all = [...new Set([...rules, ...full.map(c => `command(${c})`), ...mounts.map(f => `read_file(${f})`)])];
  return { rules: all, full: [...new Set(full)], fullFor, notes };
}

/** Arguments (without the binary) for one headless run. `cwd` must already be valid on the target side. Never a full-access flag. `t` is { model, effort }. */
export function buildSpec(cfg, host, t, prompt, access, cwd, tier, extra = {}) {
  if (t.effort === 'fixed' && !cfg.hosts[host]?.effortInModel) throw new Error(`${host}: the effort "fixed" is only for a host whose effort is part of the model name; it must never reach a command line`);
  const attached = skillsBlock(extra.skills);
  const full = preamble(access, tier) + attached + prompt;
  const ro = access === 'read-only';
  const env = { HOST_AGENT_ROUTER_DEPTH: '1' };
  // Commands a worker may run (the lead's --allow-cmd on top of the defaults) and the ones it never may. Claude and Antigravity deny every
  // other command in headless mode, so the list is what lets a worker run its tests; Codex has its sandbox and Cline its hook guard.
  const allow = [...new Set([...(cfg.workerCommands?.allow ?? []), ...(extra.allowCmd ?? [])])];
  const deny = cfg.workerCommands?.deny ?? [];
  switch (host) {
    case 'claude': {
      const guard = ro ? [] : ['--allowedTools', ...allow.map(c => `Bash(${c}:*)`), '--disallowedTools', ...deny.map(c => `Bash(${c}:*)`)];
      const cap = extra.maxBudgetUsd == null ? [] : [BUDGET_FLAG.claude, String(extra.maxBudgetUsd)];
      return { args: ['-p', '--model', t.model, '--effort', t.effort, '--permission-mode', ro ? 'plan' : 'acceptEdits', ...guard, ...cap, '--output-format', 'text'], stdin: full, env, chars: full.length };
    }
    case 'codex': {
      const args = ['exec', '-m', t.model, '-c', `model_reasoning_effort="${t.effort}"`, '-s', ro ? 'read-only' : 'workspace-write', '--skip-git-repo-check', '--color', 'never'];
      if (cwd) args.push('-C', cwd);
      return { args: [...args, '-'], stdin: full, env, chars: full.length };
    }
    case 'antigravity': {
      // Headless Antigravity denies every command that is not allowed, and one denial ends the run with exit 0. Its rules match an exact
      // command line or a bare program name and ignore wildcards (checked live), so the allow list is exact and the worker is told so.
      const make = omit => {
        const rules = ro ? { rules: [], full: [], fullFor: new Map(), notes: [] } : antigravityAllowRules(allow, { platform: extra.platform, resolve: extra.resolve, realpath: extra.realpath, home: extra.home, cwd, omit });
        const fullSentence = rules.full.length ? ` If a program name is not recognised, you may run the listed full-path form of the same command (${rules.full.join('; ')}) and nothing else.` : '';
        const note = ro ? 'Shell commands: none are available in this read-only run, and any shell command at all stops the run with no result. You can read a file only by its path: there is no tool here to list a folder or to search file contents. Read the files the brief names; if you would need to find a file or a line you were not given, say what you could not look up instead of guessing.\n\n' : `Shell commands: only these exact command lines are allowed here, and any other command stops the run with no result: ${[...allow, ...rules.full].join('; ')}. Run them exactly as written, with no cd, flags or pipes added.${fullSentence}\n\n`;
        const text = preamble(access, tier) + note + attached + prompt;
        const args = ['-p', text, '--model', t.model, '--mode', ro ? 'plan' : 'accept-edits', '--output-format', 'json'];
        if (!ro) args.push('--sandbox', '--settings', JSON.stringify({ permissions: { allow: rules.rules } }));
        if (!cfg.hosts.antigravity.effortInModel) args.push('--effort', t.effort);
        return { rules, spec: { args, stdin: null, env, chars: text.length, ...(rules.notes.length ? { notes: rules.notes } : {}) } };
      };
      let built = make(new Set());
      // Each full-path duplicate of a long allowed line is carried three times (the rule, the list of lines, the full-path sentence). On
      // Windows the whole command line may not pass ~30,000 characters, so the duplicates of the LONG lines (over 120 characters) go, longest
      // first, only as far as needed; when even none of them would make it fit, nothing is left out (the length check reports it).
      if (!ro && (extra.platform ?? process.platform) === 'win32') {
        const longFirst = [...built.rules.fullFor.keys()].filter(l => l.length > 120).sort((a, b) => b.length - a.length);
        if (longFirst.length && argvSize(built.spec.args, true) > ARGV_LIMIT_WINDOWS && argvSize(make(new Set(longFirst)).spec.args, true) <= ARGV_LIMIT_WINDOWS) {
          const left = new Set();
          for (const line of longFirst) {
            if (argvSize(built.spec.args, true) <= ARGV_LIMIT_WINDOWS) break;
            left.add(line);
            built = make(left);
          }
          built.spec.notes = [...(built.spec.notes ?? []), `${left.size} full-path rule${left.size === 1 ? '' : 's'} left out for long allowed lines, so the command line stays under the Windows limit; if that program is not recognised in the sandbox, the bare line is all the worker has`];
        }
      }
      return built.spec;
    }
    case 'cline': {
      // --json: plain text mode prints the whole activity log before the answer; JSON ends in one run_result line (see parseClineJson).
      const args = ['-P', cfg.hosts.cline.provider, '-m', t.model, '--thinking', t.effort, '--json'];
      if (ro) args.push('--plan');
      if (cwd) args.push('-c', cwd);
      return { args: [...args, '--', full], stdin: null, env, chars: full.length };
    }
    default:
      throw new Error(`unknown host ${host}`);
  }
}

const ARGV_LIMIT_WINDOWS = 30_000;
/** Windows counts every argument and its separator; Linux limits each argument alone. */
const argvSize = (args, win) => (win ? args.reduce((n, a) => n + a.length + 1, 0) : Math.max(0, ...args.map(a => a.length)));

/**
 * The command line a Windows process may have is about 32,000 characters in all; Linux limits one argument to 128 KiB. The two hosts whose
 * prompt travels as an argument (Antigravity, Cline) cannot take a longer one, so the router skips them rather than let the start fail.
 * `spec.stdin` set means the prompt travels on stdin and the length does not matter. Returns a reason, or null.
 */
export function argvTooLong(spec, side) {
  if (spec.stdin != null) return null;
  const win = side === 'windows';
  const size = argvSize(spec.args, win);
  const limit = win ? ARGV_LIMIT_WINDOWS : 120_000;
  return size > limit ? `the command line would be ${size} characters, too long for this host on ${side} (limit about ${limit}): attach fewer or smaller skills, or shorten the brief` : null;
}

// ----------------------------------------------------------------------------- skills for the worker (--skill)

/** The skills folder the router sits in: `registry/skills/` in this repository, the installed skills folder elsewhere. */
export function skillsRoot() {
  return path.resolve(path.dirname(SELF), '..', '..');
}

/** A skill's text without its front matter, with LF line endings and no blank edges. */
export function stripFrontMatter(raw) {
  const lf = String(raw ?? '').replace(/\r\n?/g, '\n');
  const m = /^---\n[\s\S]*?\n---[ \t]*(?:\n|$)/.exec(lf);
  return (m ? lf.slice(m[0].length) : lf).replace(/^\s+/, '').trimEnd();
}

/**
 * The SKILL.md text of each named skill folder beside the router. Only that file is read: a skill's references/ and scripts/ are never
 * sent. Every problem is a usage error (it throws), so nothing has started when one is found.
 */
export function resolveSkills(names, root = skillsRoot()) {
  if (names === undefined) return [];
  if (!Array.isArray(names)) throw new UsageError('--skill takes a skill name; repeat the flag for more than one');
  if (names.length > MAX_SKILLS) throw new UsageError(`at most ${MAX_SKILLS} --skill flags are allowed (got ${names.length})`);
  const seen = new Set();
  return names.map(name => {
    if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
      throw new UsageError(`--skill ${JSON.stringify(name)} is not a plain skill name (lowercase letters, digits, - and _; no path)`);
    }
    if (seen.has(name)) throw new UsageError(`--skill ${JSON.stringify(name)} is named twice`);
    seen.add(name);
    const dir = path.join(root, name);
    let isDir = false;
    try { isDir = fs.statSync(dir).isDirectory(); } catch { /* not there */ }
    if (!isDir) throw new UsageError(`--skill ${JSON.stringify(name)} is not a skill folder next to host-agent-router (looked in ${root})`);
    const file = path.join(dir, 'SKILL.md');
    if (!isFile(file)) throw new UsageError(`--skill ${JSON.stringify(name)}: the folder has no SKILL.md`);
    const text = stripFrontMatter(fs.readFileSync(file, 'utf8'));
    if (text.length > MAX_SKILL_CHARS) {
      throw new UsageError(`--skill ${JSON.stringify(name)} is ${text.length.toLocaleString('en-US')} characters, over the ${MAX_SKILL_CHARS.toLocaleString('en-US')} limit`);
    }
    return { name, chars: text.length, text };
  });
}

/** ClinePass model ids in a Cline `models.js` catalog (entries look like `"cline-pass/glm-5.3":{name:"GLM-5.3",id:"cline-pass/glm-5.3",...}`). */
export function extractClineCatalog(text) {
  const ids = new Set();
  for (const m of String(text ?? '').matchAll(/\bid:"(cline-pass\/[A-Za-z0-9._-]+)"/g)) ids.add(m[1]);
  return [...ids];
}

/**
 * A message when `model` is a ClinePass id that the installed Cline does not list, else null. An unreadable catalog (no ids) or a
 * model of another provider is "unknown", never "invalid": the run proceeds and the timeout bounds it. The wording matches
 * classifyFailure's 'model' pattern, so the next host runs. (A wrong id once left Cline silent for five minutes, ignoring -t.)
 */
export function checkClineModel(model, ids) {
  if (typeof model !== 'string' || !model.startsWith('cline-pass/') || !ids?.length || ids.includes(model)) return null;
  return `unknown model ${model}: not in the installed Cline's ClinePass catalog (${ids.length} models, for example ${ids.slice(0, 6).join(', ')})`;
}

/** ClinePass ids from the Cline package that `cmd` starts, or [] when its catalog file cannot be found or read. */
function clineCatalogIds(cmd) {
  try {
    const pkg = path.dirname(path.dirname(fs.realpathSync(cmd[cmd.length - 1])));
    for (const f of [path.join(pkg, 'node_modules', '@cline', 'llms', 'dist', 'models.js'), path.join(pkg, '..', '@cline', 'llms', 'dist', 'models.js')]) {
      if (isFile(f)) { const ids = extractClineCatalog(fs.readFileSync(f, 'utf8')); if (ids.length) return ids; }
    }
  } catch { /* unreadable: unknown */ }
  return [];
}

/**
 * The result of a `cline --json` run: one JSON object per line, ending in a `run_result` with the final text and the measured usage.
 * Returns null when the stream is not that (plain text, or killed before the end), so the caller keeps the raw output.
 */
export function parseClineJson(stdout) {
  let result = null;
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    let o;
    try { o = JSON.parse(s); } catch { continue; }
    if (o?.type === 'run_result' && typeof o.text === 'string') result = o;
  }
  if (!result) return null;
  return {
    text: result.text,
    finish_reason: result.finishReason ?? null,
    usage: result.usage ?? null,
    model: result.model?.id ?? null,
    duration_ms: result.durationMs ?? null,
  };
}

/**
 * Did this run really finish? An exit code is not enough: when Cline's guard cancelled a tool call the CLI exited 0 with
 * finishReason "aborted". `problem` is 'guard' (a tool call was blocked), 'unfinished' (Cline stopped without completing), or null.
 */
export function judgeRun(host, res) {
  if (res.rc !== 0) return { ok: false, problem: null };
  if (res.blocked?.length) return { ok: false, problem: 'guard' };
  if (host === 'cline') {
    const cl = parseClineJson(res.stdout);
    if (cl?.finish_reason && cl.finish_reason !== 'completed') return { ok: false, problem: 'unfinished', finish_reason: cl.finish_reason };
    if (cl) return cl.text.trim() ? { ok: true, problem: null } : { ok: false, problem: 'empty' };
  }
  if (host === 'antigravity') {
    // Seen live: a command that was not allowed ended the run with exit 0, status SUCCESS and an empty response.
    const ag = parseAgyRun(res.stdout);
    if (ag) {
      if (ag.denied.length) return { ok: false, problem: 'denied', denied: ag.denied };
      if (ag.status && ag.status !== 'SUCCESS') return { ok: false, problem: 'unfinished', finish_reason: ag.status };
      return ag.text.trim() ? { ok: true, problem: null } : { ok: false, problem: 'empty' };
    }
  }
  if (!stripAnsi(res.stdout).trim()) return { ok: false, problem: 'empty' }; // exit 0 and nothing said: no report to review
  return { ok: true, problem: null };
}

/** The JSON result of `agy -p ... --output-format json`: {status, response, usage, denied_actions?}. null when stdout is not that. */
export function parseAgyRun(stdout) {
  let found = null;
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    try { const o = JSON.parse(s); if (o && typeof o.response === 'string') found = o; } catch { /* not a result line */ }
  }
  if (!found) return null;
  return { text: found.response, status: found.status ?? null, usage: found.usage ?? null, denied: Array.isArray(found.denied_actions) ? found.denied_actions : [] };
}

/** For a `cline --json` stream that never reached its run_result (killed, crashed): a few facts instead of thousands of reasoning chunks. */
export function summarizeClineStream(stdout) {
  let events = 0;
  let iterations = 0;
  let last_text = '';
  const tools = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    let o;
    try { o = JSON.parse(s); } catch { continue; }
    if (!o || typeof o !== 'object' || !o.type) continue;
    events++;
    const e = o.event;
    if (e?.type === 'iteration_start') iterations = Math.max(iterations, Number(e.iteration) || iterations + 1);
    else if (e?.type === 'content_start' && e.contentType === 'tool' && e.toolName) tools.push(e.toolName);
    else if (e?.type === 'content_end' && e.contentType === 'text' && typeof e.text === 'string') last_text = e.text;
  }
  return events ? { events, iterations, tools, last_text: last_text.slice(-500) } : null;
}

// ----------------------------------------------------------------------------- process helpers

function treeKill(child) {
  try {
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGKILL');
  } catch { /* already gone */ }
}

/** Run argv, always closing stdin. Resolves {rc, stdout, stderr}; 124 on timeout, 127 when the binary is missing, 126 when it cannot start. */
export function runCmd(argv, { timeout = 60_000, input = '', cwd, env } = {}) {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), { cwd, env: envWithNodeDir(env ?? process.env), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ rc: 126, stdout: '', stderr: String(e) });
      return;
    }
    let out = '';
    let err = '';
    let done = false;
    let timedOut = false;
    const finish = r => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { timedOut = true; treeKill(child); }, timeout);
    child.stdout.setEncoding('utf8').on('data', d => { out += d; });
    child.stderr.setEncoding('utf8').on('data', d => { err += d; });
    child.on('error', e => finish({ rc: e.code === 'ENOENT' ? 127 : 126, stdout: out, stderr: e.message }));
    child.on('close', code => finish({ rc: timedOut ? 124 : (code ?? 1), stdout: out, stderr: timedOut ? `${err}\n[timed out]` : err }));
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/**
 * Where a program is looked for: PATH and, off Windows, the folder of the node that runs this script (the npm globals of an nvm, Volta
 * or fnm node live beside it, and a WSL login shell does not put it on PATH) and ~/.local/bin. Windows resolution is PATH only.
 */
export function searchDirs({ pathVar = process.env.PATH || '', platform = process.platform, execPath = process.execPath, home = os.homedir() } = {}) {
  const dirs = pathVar.split(path.delimiter).filter(Boolean);
  return platform === 'win32' ? dirs : [...dirs, path.dirname(execPath), path.join(home, '.local', 'bin')];
}

/** `env` with the folder of the running node appended to PATH when it is missing (a host's script may start with `#!/usr/bin/env node`). Windows: unchanged. */
export function envWithNodeDir(env = process.env, { platform = process.platform, execPath = process.execPath } = {}) {
  if (platform === 'win32') return env;
  const dir = path.dirname(execPath);
  if ((env.PATH ?? '').split(path.delimiter).includes(dir)) return env;
  return { ...env, PATH: [env.PATH, dir].filter(Boolean).join(path.delimiter) };
}

export function which(name, { dirs = searchDirs() } = {}) {
  const win = process.platform === 'win32';
  const exts = win ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean) : [''];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, win && name.toLowerCase().endsWith(ext.toLowerCase()) ? name : name + ext);
      if (!isFile(p)) continue;
      if (win) return p;
      try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* not executable */ }
    }
  }
  return null;
}

const firstFile = cands => cands.find(c => c && isFile(c)) ?? null;

/**
 * argv that starts a CLI npm installed. On Windows neither npm shim can be spawned directly (`.cmd` needs a shell, which would reparse
 * prompt text; the extensionless one is a shell script), so the package entry is run with node. Elsewhere, or when the shim is not an
 * npm install, the shim itself.
 */
export function npmShimCommand(shim, pkg, bin, { platform = process.platform, execPath = process.execPath } = {}) {
  if (platform !== 'win32') return [shim];
  try {
    const dir = path.dirname(fs.realpathSync(shim));
    const pkgDir = path.join(dir, 'node_modules', ...pkg.split('/'));
    const meta = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const rel = typeof meta.bin === 'string' ? meta.bin : meta.bin?.[bin];
    const entry = rel ? path.join(pkgDir, rel) : null;
    if (entry && isFile(entry)) return [firstFile([path.join(dir, 'node.exe')]) ?? execPath, entry];
  } catch { /* not an npm install: fall through to the shim */ }
  return [shim];
}

function resolveCline() {
  const shim = which('cline');
  return shim ? npmShimCommand(shim, 'cline', 'cline') : null;
}

/** argv prefix that starts `host` on this machine, or null. */
export function resolveCmd(host) {
  const home = os.homedir();
  const win = process.platform === 'win32';
  const ext = win ? '.exe' : '';
  let p = null;
  if (host === 'claude') p = firstFile([which('claude'), path.join(home, '.local', 'bin', `claude${ext}`)]);
  else if (host === 'antigravity') p = firstFile([which('agy'), path.join(home, '.local', 'bin', `agy${ext}`)]);
  else if (host === 'codex') {
    const onPath = which('codex');
    // An npm install (codex.cmd beside node_modules/@openai/codex) starts through its package entry, like Cline.
    if (win && onPath) { const viaNode = npmShimCommand(onPath, '@openai/codex', 'codex'); if (viaNode.length > 1) return viaNode; }
    const cands = [onPath, path.join(home, '.local', 'bin', `codex${ext}`)];
    if (win) cands.push(path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'));
    else {
      const rel = path.join(home, '.codex', 'packages', 'standalone', 'releases');
      try { for (const v of fs.readdirSync(rel).sort().reverse()) cands.push(path.join(rel, v, 'bin', 'codex')); } catch { /* none */ }
    }
    p = firstFile(cands);
  } else if (host === 'cline') return resolveCline();
  return p ? [p] : null;
}

/** Credit-free JSON-RPC over stdio. wanted: { id: method }. Resolves { id: response }. */
function codexAppServer(cmd, wanted, timeout = 30_000) {
  return new Promise(resolve => {
    const responses = {};
    let child;
    try {
      child = spawn(cmd[0], [...cmd.slice(1), 'app-server'], { env: envWithNodeDir(process.env), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    } catch {
      resolve(responses);
      return;
    }
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); treeKill(child); resolve(responses); } };
    const timer = setTimeout(finish, timeout);
    child.on('error', finish);
    child.on('close', finish);
    child.stdin.on('error', () => {});
    const send = o => child.stdin.write(`${JSON.stringify(o)}\n`);
    let ready = false;
    readline.createInterface({ input: child.stdout }).on('line', line => {
      let o;
      try { o = JSON.parse(line); } catch { return; }
      if (!isPlain(o) || !('id' in o) || !('result' in o || 'error' in o)) return;
      responses[o.id] = o;
      if (o.id === 0 && !ready) {
        ready = true;
        send({ method: 'initialized' });
        const params = { 'account/read': { refreshToken: false }, 'model/list': { limit: 200, includeHidden: false } };
        for (const [id, method] of Object.entries(wanted)) send({ method, id: Number(id), ...(params[method] ? { params: params[method] } : {}) });
      } else if (Object.keys(wanted).every(id => id in responses)) finish();
    });
    send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'host-agent-router', title: 'host-agent-router', version: '1.0.0' } } });
  });
}

function codexRolloutWindows() {
  const files = [];
  const walk = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^rollout-.*\.jsonl$/.test(e.name)) files.push([p, fs.statSync(p).mtimeMs]);
    }
  };
  walk(path.join(os.homedir(), '.codex', 'sessions'));
  for (const [f] of files.sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    let last = null;
    try { for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (line.includes('"rate_limits"')) last = line; } catch { continue; }
    if (!last) continue;
    try {
      const o = JSON.parse(last);
      const rl = (o.payload ?? o).rate_limits;
      if (rl) return parseCodexRolloutRateLimits(rl, Date.now() / 1000);
    } catch { /* next file */ }
  }
  return [];
}

// ----------------------------------------------------------------------------- local probes / exec / models (run on the side that owns the host)

async function probeClaude(cmd, model, _cfgHost, st) {
  const home = os.homedir();
  const a = await runCmd([...cmd, 'auth', 'status'], { timeout: 40_000, cwd: home });
  try { st.logged_in = Boolean(JSON.parse(a.stdout).loggedIn); } catch { /* unknown */ }
  if (st.logged_in === false) return;
  const u = await runCmd([...cmd, '-p', '/usage'], { timeout: 75_000, cwd: home });
  const windows = parseClaudeUsage(u.stdout, model);
  if (windows.length) st.usage = makeUsage(windows);
  else st.notes.push('could not read /usage (API-key billing or unexpected output)');
}

/** What the two Antigravity readouts (`agy -p /usage`, `agy models`) say about a side: its pool and the usage of each model of the tier. Pure; no host is started. */
export function applyAgyProbe(st, { usageOut, usageErr, models }, cfgHost, payload = {}) {
  if (!cfgHost.pool) {
    st.pool = (models?.rc === 0 ? agyPool(models.stdout) : null) ?? unknownPool(models?.rc === 0 ? 'agy models printed a list the router could not read' : `agy models failed (rc=${models?.rc})`);
    if (st.pool.source === 'unknown') st.notes.push(`model pool unknown (${st.pool.reason}); the first configured model of the tier is used`);
  }
  const resolved = payload.entries ?? [{ model: payload.model }];
  const byModel = agyUsageByModel(usageOut, resolved, cfgHost.pool ? configPool(cfgHost.pool) : st.pool, cfgHost.quotaGroups ?? {}, cfgHost.userQuotaGroups);
  const first = resolved.map(r => r.model ?? slugByName(st.pool, r.displayName)).find(s => s && byModel[s]?.windows?.length);
  if (first) { st.logged_in = true; st.usage = byModel[first]; st.usage_by_model = byModel; }
  else st.notes.push(`could not read quota for this model group: ${(usageOut || usageErr).trim().slice(0, 160).replace(/\n/g, ' ')}`);
}

async function probeAntigravity(cmd, model, cfgHost, st, payload = {}) {
  // `agy models` lists the models of the logged-in account and starts no model; a configured pool replaces it, so it is not asked for then.
  const [u, m] = await Promise.all([
    runCmd([...cmd, '-p', '/usage', '--output-format', 'json'], { timeout: 75_000, cwd: os.homedir() }),
    cfgHost.pool ? Promise.resolve(null) : runCmd([...cmd, 'models'], { timeout: 60_000, cwd: os.homedir() }),
  ]);
  applyAgyProbe(st, { usageOut: u.stdout, usageErr: u.stderr, models: m }, cfgHost, { ...payload, model });
}

async function probeCodex(cmd, _model, cfgHost, st) {
  // `model/list` answers from the account without starting a model. A configured pool replaces it.
  const wanted = { 1: 'account/read', 2: 'account/rateLimits/read', ...(cfgHost.pool ? {} : { 3: 'model/list' }) };
  const resp = await codexAppServer(cmd, wanted);
  if (!cfgHost.pool) {
    st.pool = codexPool(resp[3]) ?? unknownPool(resp[3]?.error ? 'the app-server refused model/list' : 'the app-server gave no readable model/list');
    if (st.pool.source === 'unknown') st.notes.push(`model pool unknown (${st.pool.reason}); the first configured model of the tier is used`);
  }
  if (resp[1]) st.logged_in = Boolean(resp[1].result?.account);
  if (resp[2]?.result) {
    const { windows, meta } = parseCodexRateLimits(resp[2].result);
    st.usage = makeUsage(windows, { credits: meta.credits, plan: meta.plan });
  } else {
    const windows = codexRolloutWindows();
    if (windows.length) {
      st.usage = makeUsage(windows, { source: 'last session log (may be stale)' });
      st.notes.push('live limits unavailable; used the last session-log snapshot');
    }
  }
}

async function probeCline(_cmd, _model, cfgHost, st) {
  const root = process.env.CLINE_DIR || path.join(os.homedir(), '.cline');
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'settings', 'providers.json'), 'utf8'));
    const prov = data.providers?.[cfgHost.provider ?? 'cline-pass'] ?? {};
    st.logged_in = Boolean(prov.settings?.auth || prov.tokenSource);
  } catch { /* unknown */ }
  st.notes.push('Cline Pass has no local 5-hour/weekly readout; headroom unknown (a refused request falls through)');
}

const PROBES = { claude: probeClaude, antigravity: probeAntigravity, codex: probeCodex, cline: probeCline };

export async function probeLocal(payload) {
  const { host, model = '', side = '' } = payload;
  const st = { host, side, installed: false, version: null, logged_in: null, usage: null, error: null, notes: [] };
  const cmd = resolveCmd(host);
  if (!cmd) { st.error = 'binary not found'; return st; }
  const v = await runCmd([...cmd, '--version'], { timeout: 40_000, cwd: os.homedir() });
  const ver = `${v.stdout}\n${v.stderr}`.split(/\r?\n/).map(s => s.trim()).find(looksLikeVersion);
  if (v.rc !== 0 || !ver) { st.error = `--version failed (rc=${v.rc})`; return st; }
  st.installed = true;
  st.version = ver;
  try {
    await PROBES[host](cmd, model, payload.host_cfg ?? {}, st, payload);
  } catch (e) { // a failed readout must never break routing
    st.notes.push(`usage probe failed: ${e?.name}: ${e?.message}`);
  }
  return st;
}

// ----------------------------------------------------------------------------- a temp folder the Antigravity sandbox can use
//
// Seen live 2026-11-15: the Antigravity sandbox hides the user profile. A worker can write into its temp folder (inside the profile on
// Windows) but cannot list or resolve its ancestors, so tests that call realpath on, or walk up from, the temp path fail on EPERM. The
// environment of the process that starts the host reaches the commands the worker runs, so an edit run gets another temp folder through it.

export const WORKER_TEMP_DIR = '.host-agent-router-tmp';
const pathFor = platform => (platform === 'win32' ? path.win32 : path.posix);

/** True when `p` is `base` or lies inside it, compared as the platform does (case-insensitive on Windows). */
function insideOf(P, base, p) {
  const rel = P.relative(P.resolve(base), P.resolve(p));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${P.sep}`) && !P.isAbsolute(rel));
}

/** The variables that name the temp folder: TEMP and TMP on Windows (TMPDIR as well, harmless there), TMPDIR elsewhere. */
export function workerTempEnv(dir, platform = process.platform) {
  return platform === 'win32' ? { TEMP: dir, TMP: dir, TMPDIR: dir } : { TMPDIR: dir };
}

/** `env` with `vars` set. On Windows a variable is the same under any letter case, so a differently cased copy is dropped, not left beside it. */
export function applyTempEnv(env, vars, platform = process.platform) {
  const out = { ...env };
  for (const [k, v] of Object.entries(vars)) {
    if (platform === 'win32') for (const e of Object.keys(out)) if (e.toUpperCase() === k) delete out[e];
    out[k] = v;
  }
  return out;
}

export function workerTempNote(place) {
  const where = { config: 'from the config', beside: 'beside the working directory', inside: 'inside the working directory' }[place];
  return `the worker got a temp folder outside the user profile (${where})`;
}

/** What is wrong with a configured workerTemp, or null. */
function configWorkerTempProblem(value, { home, platform }) {
  const P = pathFor(platform);
  if (typeof value !== 'string' || !value) return 'workerTemp must be an absolute folder path (a string)';
  if (!P.isAbsolute(value)) return 'workerTemp must be an absolute path';
  if (insideOf(P, home, value)) return "workerTemp must not be inside the user's home folder: the Antigravity sandbox hides the home folder, which is what this setting works around";
  return null;
}

/**
 * Where an Antigravity edit worker's temp folder would go, or null when the temp folder it would get anyway (TEMP/TMP on Windows, TMPDIR
 * or /tmp elsewhere) is outside the home folder. In this order: `configured` (the config's workerTemp), a new folder beside the working
 * directory (when that is outside the home folder), a new folder inside the working directory. Returns { place, dir, parent, vars, fallback? }:
 * `fallback` is the in-directory choice tried when the beside folder cannot be made. Pure: nothing is created. Throws on a configured
 * folder that is not absolute or lies inside the home folder.
 */
export function planWorkerTemp({ cwd, configured = null, platform = process.platform, env = process.env, home = os.homedir(), name = () => crypto.randomBytes(4).toString('hex') }) {
  const P = pathFor(platform);
  const current = platform === 'win32' ? (env.TEMP || env.TMP || env.TMPDIR) : (env.TMPDIR || '/tmp');
  if (!current || !insideOf(P, home, current)) return null;
  const id = name();
  const make = (place, parent) => {
    const dir = P.join(parent, id);
    return { place, dir, parent, vars: workerTempEnv(dir, platform) };
  };
  if (configured) {
    const bad = configWorkerTempProblem(configured, { home, platform });
    if (bad) throw new Error(bad);
    return make('config', configured);
  }
  const inner = make('inside', P.join(cwd, WORKER_TEMP_DIR));
  if (insideOf(P, home, cwd)) return inner;
  return { ...make('beside', P.join(P.dirname(P.resolve(cwd)), WORKER_TEMP_DIR)), fallback: inner };
}

function acquireWorkerTemp(opt) {
  const existed = fs.existsSync(opt.parent);
  fs.mkdirSync(opt.parent, { recursive: true });
  try {
    fs.mkdirSync(opt.dir);
  } catch (e) {
    if (!existed && opt.place !== 'config') { try { fs.rmdirSync(opt.parent); } catch { /* not empty */ } }
    throw e;
  }
  return opt;
}

function releaseWorkerTemp(opt) {
  try { fs.rmSync(opt.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  // The shared parent goes when empty (rmdir fails on a folder another run still uses); a configured folder stays.
  if (opt.place !== 'config') { try { fs.rmdirSync(opt.parent); } catch { /* in use, or already gone */ } }
}

/**
 * Create the planned folder (or its fallback), run `fn(vars)` with the variables to set, and remove the folder whatever happens: a result,
 * a timeout result or a thrown error. Resolves to { value, note }: `note` says what was done without naming a path, null for no plan.
 * When no folder can be made the run still goes ahead with the default temp folder, and the note says so.
 */
export async function withWorkerTemp(plan, fn) {
  if (!plan) return { value: await fn({}), note: null };
  let got = null;
  for (const opt of [plan, plan.fallback]) {
    if (!opt) continue;
    try { got = acquireWorkerTemp(opt); break; } catch { /* try the next place */ }
  }
  if (!got) return { value: await fn({}), note: 'could not make a temp folder outside the user profile; the worker kept the default temp folder' };
  try {
    return { value: await fn(got.vars), note: workerTempNote(got.place) };
  } finally {
    releaseWorkerTemp(got);
  }
}

export async function execLocal(payload) {
  const cmd = resolveCmd(payload.host);
  if (!cmd) return { rc: 127, stdout: '', stderr: `${payload.host}: binary not found`, seconds: 0 };
  if (/\.(cmd|bat)$/i.test(cmd[0]) && payload.args.some(a => /[&|<>^%"\r\n]/.test(a))) {
    return { rc: 126, stdout: '', stderr: 'refusing to pass unsafe characters through a .cmd shim', seconds: 0 };
  }
  let args = payload.args;
  let env = { ...process.env, ...(payload.env ?? {}) };
  let guard = null;
  if (payload.host === 'cline') {
    // Before anything is started: a ClinePass id the installed Cline does not list would leave it silent until the timeout.
    const bad = checkClineModel(payload.args[payload.args.indexOf('-m') + 1], clineCatalogIds(cmd));
    if (bad) return { rc: 2, stdout: '', stderr: bad, seconds: 0 };
    // The worker contract, enforced: Cline's act mode has no sandbox, so its PreToolUse hook is the guard (see guardDecision).
    guard = prepareClineGuard({ cwd: payload.cwd || process.cwd(), dataDir: clineDataDir(process.env) });
    if (guard) { args = [...guard.args, ...args]; env = { ...env, ...guard.env }; }
  }
  // An Antigravity edit run gets a temp folder outside the user profile, through this process's environment, on the side where the host runs.
  let tempPlan = null;
  if (payload.host === 'antigravity' && payload.workerTemp) {
    try { tempPlan = planWorkerTemp({ cwd: payload.cwd || process.cwd(), configured: payload.workerTemp.configured }); } catch (e) { return { rc: 126, stdout: '', stderr: e.message, seconds: 0 }; }
  }
  const t0 = Date.now();
  try {
    const { value: r, note } = await withWorkerTemp(tempPlan, vars => runCmd([...cmd, ...args], { timeout: (payload.timeout ?? 1800) * 1000, input: payload.stdin ?? '', cwd: payload.cwd || undefined, env: applyTempEnv(env, vars) }));
    const out = { rc: r.rc, stdout: r.stdout, stderr: r.stderr, seconds: Math.round((Date.now() - t0) / 100) / 10 };
    if (note) out.tempNote = note;
    if (guard) { out.guarded = true; out.blocked = guard.readBlocked(); }
    return out;
  } finally {
    guard?.cleanup();
  }
}

/** Check configured model names against what the installed host itself lists. */
export async function modelsLocal(payload) {
  const out = {};
  for (const [host, models] of Object.entries(payload.models)) {
    let known = null;
    if (host === 'codex') {
      try { known = new Set(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex', 'models_cache.json'), 'utf8')).models.map(m => m.slug)); } catch { /* none */ }
    } else if (host === 'antigravity') {
      const cmd = resolveCmd('antigravity');
      if (cmd) {
        // `agy models` lists the account's models and starts none. A configured name is "ok" as a slug or as a display name.
        const r = await runCmd([...cmd, 'models'], { timeout: 60_000, cwd: os.homedir() });
        const rows = r.rc === 0 ? parseAgyModels(r.stdout) : null;
        if (rows) known = new Set(rows.flatMap(x => [x.slug, x.name]));
      }
    }
    const note = known ? null : resolveCmd(host) ? 'unverified (host has no offline model list)' : 'not checked (host not installed on this side)';
    out[host] = Object.fromEntries(models.map(m => [m, known ? (known.has(m) ? 'ok' : 'NOT LISTED') : note]));
  }
  return out;
}

// ----------------------------------------------------------------------------- the machine record (`machine [--save]`)
//
// What this machine has, per host and side, and HOW each host is started. Plain facts only: no path, no argument, no environment value.
// It runs `--version` on each host and nothing else, so it starts no model.

const looksLikeScript = p => {
  try {
    const fd = fs.openSync(p, 'r');
    try { const b = Buffer.alloc(2); fs.readSync(fd, b, 0, 2, 0); return b.toString('latin1') === '#!'; } finally { fs.closeSync(fd); }
  } catch { return false; }
};

/** 'npm-entry' (node plus a package entry), 'exe', 'shim' (a .cmd or script launcher) or 'missing', from the argv resolveCmd found. */
export function startKind(cmd, { platform = process.platform, isScript = looksLikeScript } = {}) {
  if (!cmd?.length) return 'missing';
  if (cmd.length > 1) return 'npm-entry';
  if (platform === 'win32') return /\.exe$/i.test(cmd[0]) ? 'exe' : 'shim';
  return isScript(cmd[0]) ? 'shim' : 'exe';
}

/** A short single-line note with no file path in it (a path names the user): control characters and runs of spaces collapsed, at most 160 characters. */
export function cleanNote(s) {
  return String(s ?? '').replace(/(?:[A-Za-z]:[\\/]|\/(?:mnt|home|Users|tmp|var|usr|root)\/)\S*?(?=:?(?:\s|$))/g, '<path>')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function machineFileName(hostname) {
  const base = String(hostname ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '');
  return `${base || 'machine'}.json`;
}

/** Where machine records live: beside the user config (`~/.agents/host-agent-router/`), in a `machines` folder. */
export function machinesDir(env = process.env, home = os.homedir()) {
  return path.join(path.dirname(userConfigFile(env, home)), 'machines');
}

/** A host on the other side of the Windows/WSL bridge: if it is there, the router starts it through the bridge. */
export function viaBridge(hosts) {
  return Object.fromEntries(Object.entries(hosts).map(([host, h]) => [host,
    h.installed ? { installed: true, version: h.version, kind: 'wsl-bridge', via: h.kind } : { installed: false, version: null, kind: 'missing', ...(h.note ? { note: h.note } : {}) }]));
}

/** Every host on a side whose bridge could not be used (WSL without node, for example): missing, with why. */
export function bridgeFailed(message, hosts) {
  return Object.fromEntries(hosts.map(host => [host, { installed: false, version: null, kind: 'missing', note: cleanNote(message) }]));
}

export function machineRecord({ hostname, platform, here, node, now, sides }) {
  return { schema: 1, hostname, platform, here, node, recorded_at: now.toISOString(), sides };
}

/** Writes the record to `<dir>/<hostname>.json` (creating the folder) and nowhere else. Returns the file. */
export function saveMachineRecord(record, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, machineFileName(record.hostname));
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

/** On this side: which hosts are installed, their version line, and how each is started. */
export async function machineLocal() {
  const found = {};
  await Promise.all(HOSTS.map(async host => {
    const cmd = resolveCmd(host);
    if (!cmd) { found[host] = { installed: false, version: null, kind: 'missing' }; return; }
    const v = await runCmd([...cmd, '--version'], { timeout: 40_000, cwd: os.homedir() });
    const ver = `${v.stdout}\n${v.stderr}`.split(/\r?\n/).map(s => s.trim()).find(looksLikeVersion);
    found[host] = v.rc === 0 && ver ? { installed: true, version: ver, kind: startKind(cmd) } : { installed: false, version: null, kind: 'missing', note: `found, but --version failed (rc=${v.rc})` };
  }));
  return { hosts: Object.fromEntries(HOSTS.map(h => [h, found[h]])) };
}

const LOCAL = { 'local-probe': probeLocal, 'local-exec': execLocal, 'local-models': modelsLocal, 'local-machine': machineLocal };

// ----------------------------------------------------------------------------- sides and the Windows <-> WSL bridge

export function detectHere() {
  if (process.platform === 'win32') return 'windows';
  try { if (fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')) return 'wsl'; } catch { /* not Linux */ }
  return 'local';
}

function wslDistro(cfg) {
  if (cfg.wslDistro) return cfg.wslDistro;
  const r = spawnSync('wsl.exe', ['-l', '-q'], { windowsHide: true });
  if (r.status !== 0 || !r.stdout) return null;
  const names = new TextDecoder('utf-16le').decode(r.stdout).split(/\r?\n/).map(s => s.replace(/\0/g, '').trim()).filter(Boolean);
  return names.find(n => !/^docker-desktop/i.test(n)) ?? null;
}

const hasWindowsInterop = () => Boolean(which('cmd.exe')) || isFile('/mnt/c/Windows/System32/cmd.exe');

export function discoverSides(here, cfg) {
  if (here === 'windows') return wslDistro(cfg) ? ['windows', 'wsl'] : ['windows'];
  if (here === 'wsl') return hasWindowsInterop() ? ['wsl', 'windows'] : ['wsl'];
  return ['local'];
}

function windowsTempFromWsl() {
  const r = spawnSync('cmd.exe', ['/c', 'echo %TEMP%'], { cwd: '/mnt/c', encoding: 'utf8', windowsHide: true });
  const dir = (r.stdout ?? '').trim().split(/\r?\n/).pop()?.trim();
  if (r.status !== 0 || !dir) throw new Error('cannot find the Windows temp dir from WSL (cmd.exe interop is off?)');
  return winToWsl(dir);
}

function findWindowsNode() {
  const globbed = [];
  try { for (const u of fs.readdirSync('/mnt/c/Users')) globbed.push(`/mnt/c/Users/${u}/AppData/Local/Programs/nodejs/node.exe`); } catch { /* none */ }
  const node = firstFile([which('node.exe'), '/mnt/c/Program Files/nodejs/node.exe', ...globbed]);
  if (!node) throw new Error('no Windows node.exe reachable from WSL');
  return node;
}

/** Per-user places a node can be, after the login PATH and nvm, checked by file test only (no globbing of the home folder). */
export const WSL_NODE_PLACES = ['$HOME/.volta/bin/node', '$HOME/.local/share/fnm/aliases/default/bin/node', '$HOME/.asdf/shims/node', '$HOME/.local/bin/node'];

/**
 * The bash line that finds node inside WSL and runs the staged script with it (`$0` is the script, `$@` the rest). Order: the
 * configured `wslNode`; `node` on the login PATH; nvm (`${NVM_DIR:-$HOME/.nvm}/nvm.sh`, silenced so it cannot print into the JSON line);
 * WSL_NODE_PLACES. Nothing found: a message the skip note recognises, status 127. One line, no carriage return, no interactive shell.
 */
export function wslNodeLine(wslNode) {
  const quoted = wslNode ? `'${wslNode.replace(/'/g, "'\\''")}'` : "''";
  const places = WSL_NODE_PLACES.map(p => `"${p}"`).join(' ');
  return [
    `N=${quoted}`,
    '[ -f "$N" ] && [ -x "$N" ] || N=$(command -v node 2>/dev/null)',
    '[ -n "$N" ] || { D=${NVM_DIR:-$HOME/.nvm}; [ -s "$D/nvm.sh" ] && { . "$D/nvm.sh" >/dev/null 2>&1; N=$(command -v node 2>/dev/null); }; }',
    `[ -n "$N" ] || for C in ${places}; do [ -f "$C" ] && [ -x "$C" ] && { N=$C; break; }; done`,
    '[ -n "$N" ] || { echo "node: not found (not on the login PATH, not in nvm, not in the usual per-user folders)" >&2; exit 127; }',
    'exec "$N" "$0" "$@"',
  ].join('; ');
}

/** The argv that runs the staged script inside WSL from Windows. --exec hands argv over as is: with `--`, wsl.exe runs the line through the outer shell, which would expand $0 and $@ itself. */
export function wslBridgeArgv({ distro, script, command, payloadFile, wslNode }) {
  return ['wsl.exe', '-d', distro, '--exec', 'bash', '-lc', wslNodeLine(wslNode), script, command, '--payload', payloadFile];
}

/** Run a local-* command on the other side: stage this file and the payload in the Windows temp dir (visible to both), run, parse the JSON line. */
async function crossCall(cfg, here, target, command, payload, timeoutMs) {
  const base = here === 'windows' ? os.tmpdir() : windowsTempFromWsl();
  const stage = fs.mkdtempSync(path.join(base, `har-${crypto.randomBytes(3).toString('hex')}-`));
  try {
    const script = path.join(stage, 'router.mjs');
    const pfile = path.join(stage, 'payload.json');
    fs.copyFileSync(SELF, script);
    fs.writeFileSync(pfile, JSON.stringify(payload));
    let argv;
    if (here === 'windows' && target === 'wsl') {
      const distro = wslDistro(cfg);
      if (!distro) throw new Error('no WSL distro found');
      argv = wslBridgeArgv({ distro, script: winToWsl(script), command, payloadFile: winToWsl(pfile), wslNode: cfg.wslNode });
    } else if (here === 'wsl' && target === 'windows') {
      argv = [findWindowsNode(), wslToWin(script), command, '--payload', wslToWin(pfile)];
    } else {
      throw new Error(`no bridge from ${here} to ${target}`);
    }
    const r = await runCmd(argv, { timeout: timeoutMs, cwd: here === 'wsl' ? '/mnt/c' : undefined });
    const line = r.stdout.trim().split(/\r?\n/).reverse().find(l => l.startsWith('{') || l.startsWith('['));
    if (!line) throw new Error(`${target} bridge returned no JSON (rc=${r.rc}): ${(r.stderr || r.stdout).trim().slice(0, 200)}`);
    return JSON.parse(line);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

const callSide = (cfg, here, side, command, payload, timeoutMs = 120_000) =>
  side === here || here === 'local' ? LOCAL[command](payload) : crossCall(cfg, here, side, command, payload, timeoutMs);

async function probeAll(cfg, tier, here, sides, onlyHosts, effort) {
  const jobs = cfg.priority.filter(h => !onlyHosts?.length || onlyHosts.includes(h)).flatMap(h => sides.map(s => [h, s]));
  const results = await Promise.all(jobs.map(async ([host, side]) => {
    // `entries`: every model of the tier, resolved for the asked effort, so the probe can read the quota of each (an Orchestrator draws on two groups).
    const entries = resolveTier(cfg.hosts[host].tiers[tier], host, tier, effort, cfg.hosts[host]).map(p => p.r);
    const payload = { host, side, model: entries.find(r => r.model)?.model ?? '', entries, host_cfg: cfg.hosts[host] };
    try {
      return await callSide(cfg, here, side, 'local-probe', payload, 150_000);
    } catch (e) {
      return { host, side, installed: false, logged_in: null, usage: null, error: `${e?.name}: ${e?.message}`, notes: [] };
    }
  }));
  const statuses = {};
  jobs.forEach(([host, side], i) => { (statuses[host] ??= {})[side] = results[i]; });
  return statuses;
}

// ----------------------------------------------------------------------------- CLI

const print = obj => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
const fmt = v => (v == null ? '?' : `${v}%`);

async function gather(cfg, opts, tier, only, effort) {
  const here = opts.here ?? detectHere();
  if (opts['statuses-file']) {
    const statuses = JSON.parse(fs.readFileSync(opts['statuses-file'], 'utf8'));
    return { here, sides: [...new Set(Object.values(statuses).flatMap(s => Object.keys(s)))], statuses };
  }
  const sides = discoverSides(here, cfg);
  return { here, sides, statuses: await probeAll(cfg, tier, here, sides, only, effort) };
}

async function cmdStatus(opts, cfg) {
  const tier = opts.tier ?? 'medium';
  const { here, statuses } = await gather(cfg, opts, tier, opts.host, opts.effort);
  const plan = buildPlan(cfg, tier, statuses, here, opts.host, undefined, opts.effort);
  if (opts.json) { print({ plan, statuses }); return 0; }
  console.log(`tier=${tier}  here=${here}  floor=${cfg.minHeadroomPct}%  (binding = smaller of 5h / weekly remaining)`);
  console.log(`${'HOST'.padEnd(12)}${'SIDE'.padEnd(9)}${'STATE'.padEnd(22)}${'5H LEFT'.padEnd(9)}${'WEEK LEFT'.padEnd(11)}MODEL`);
  for (const host of cfg.priority) {
    const first = resolveTier(cfg.hosts[host].tiers[tier], host, tier, opts.effort, cfg.hosts[host]).map(p => p.r).find(r => r.model);
    for (const [side, st] of Object.entries(statuses[host] ?? {})) {
      const u = st.usage ?? {};
      const state = !st.installed ? 'not runnable' : st.logged_in === false ? 'logged out' : 'ready';
      const chosen = plan.candidates.find(c => c.host === host && c.side === side);
      console.log(`${host.padEnd(12)}${side.padEnd(9)}${state.padEnd(22)}${fmt(u.five_hour_pct).padEnd(9)}${fmt(u.weekly_pct).padEnd(11)}${chosen?.model ?? first?.model ?? '-'}`);
    }
  }
  const sel = plan.selected;
  console.log(`\nselected: ${sel ? `${sel.host} on ${sel.side} -> ${sel.model} (${sel.effort})` : 'none'}`);
  for (const s of plan.skipped) console.log(`  skipped ${s.host}/${s.side}: ${s.reason}`);
  const noted = new Set(); // one note per host, not one per side
  for (const c of plan.candidates) if (c.effort_note && !noted.has(c.host)) { noted.add(c.host); console.log(`  note ${c.effort_note}`); }
  for (const c of plan.candidates) if (c.quota_note) console.log(`  note ${c.host}/${c.side}: ${c.quota_note}`);
  for (const c of plan.candidates) if (c.pool_note) console.log(`  note ${c.host}/${c.side}: ${c.pool_note}`);
  for (const c of plan.candidates) for (const s of c.skipped_models ?? []) console.log(`  skipped model ${c.host}/${c.side}: ${s.model}: ${s.reason}`);
  for (const [host, sides] of Object.entries(statuses)) for (const [side, st] of Object.entries(sides)) for (const n of st.notes ?? []) console.log(`  note ${host}/${side}: ${n}`);
  return 0;
}

async function cmdPlan(opts, cfg) {
  const tier = opts.tier ?? 'medium';
  const { here, statuses } = await gather(cfg, opts, tier, opts.host, opts.effort);
  const plan = buildPlan(cfg, tier, statuses, here, opts.host, undefined, opts.effort);
  plan.notes = Object.fromEntries(Object.entries(statuses).flatMap(([h, ss]) => Object.entries(ss).filter(([, st]) => st.notes?.length).map(([s, st]) => [`${h}/${s}`, st.notes])));
  print(plan);
  return plan.selected ? 0 : 2;
}

function readPrompt(opts) {
  let text;
  if (opts['prompt-file'] !== undefined) text = fs.readFileSync(opts['prompt-file'], 'utf8');
  else if (opts.prompt !== undefined) text = opts.prompt;
  else if (!process.stdin.isTTY) text = fs.readFileSync(0, 'utf8');
  else throw new UsageError('no prompt: use --prompt, --prompt-file or pipe it on stdin');
  // An empty prompt is never a valid run (seen: an empty piped stdin started a real worker). Checked before any status is read, dry run included.
  if (!text.trim()) throw new UsageError('the prompt is empty: give --prompt, --prompt-file or stdin some text');
  return text;
}

// ----------------------------------------------------------------------------- working-tree guard (edit runs)
//
// A host that stops on a limit or a timeout may already have changed files; the router only sees the error text. So for an edit run it
// looks at the tree: a failed attempt hands over to the next host only if it left the directory exactly as it found it.

const GUARD_SKIP = new Set(['.git', 'node_modules', WORKER_TEMP_DIR]); // the router's own temp folder for a worker is never a change the worker made

function gitHead(dir) {
  try {
    const r = spawnSync('git', ['-C', dir, 'rev-parse', '--verify', '-q', 'HEAD'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 });
    return r.status === 0 ? r.stdout.trim() : null;
  } catch { return null; }
}

/** Fingerprint a directory: relative path -> `size:mtime`, plus the git HEAD (a commit moves it without changing any file). */
export function snapshotTree(dir, { maxEntries = 50_000 } = {}) {
  const files = {};
  let n = 0;
  let truncated = false;
  const walk = rel => {
    let entries;
    try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (truncated) return;
      if (GUARD_SKIP.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) {
        if (++n > maxEntries) { truncated = true; return; }
        try { const s = fs.statSync(path.join(dir, r)); files[r] = `${s.size}:${Math.round(s.mtimeMs)}`; } catch { /* vanished meanwhile */ }
      }
    }
  };
  walk('');
  return { files, head: gitHead(dir), truncated };
}

/**
 * Paths git ignores, out of `paths` (relative to `dir`), or null when that cannot be told: not a git work tree, no git, a failed or slow call,
 * or too many paths. One `git check-ignore --stdin -z` call, no shell, bounded input and time. A tracked file is never reported as ignored.
 */
export function gitIgnoredPaths(dir, paths, { maxPaths = 60_000, maxBytes = 8_000_000, timeout = 20_000 } = {}) {
  if (!paths.length || paths.length > maxPaths) return null;
  const input = `${paths.join('\0')}\0`;
  if (input.length > maxBytes) return null;
  try {
    const r = spawnSync('git', ['-C', dir, 'check-ignore', '--stdin', '-z'], { input, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 16_000_000 });
    if (r.error || (r.status !== 0 && r.status !== 1)) return null; // 128: not a work tree, or git failed
    return new Set(r.stdout.split('\0').filter(Boolean));
  } catch { return null; }
}

/** The top-level folder (or file) of each ignored path, counted, biggest first, at most ten: the short summary that replaces thousands of lines. */
function ignoredSummary(paths) {
  const by = new Map();
  for (const p of paths) { const top = p.split('/')[0]; by.set(top, (by.get(top) ?? 0) + 1); }
  const folders = [...by].map(([folder, count]) => ({ folder, count })).sort((x, y) => y.count - x.count || (x.folder < y.folder ? -1 : 1));
  return { count: paths.length, folders: folders.slice(0, 10) };
}

/**
 * What differs between two snapshots. `unknown` when either was cut short: "cannot compare" is never reported as "unchanged".
 * `ignoredOf(paths)` may return the subset git ignores: those paths leave the three lists and are summarised in `ignored` instead, but `count`
 * still includes them, because the decision to stop a fall-through reads `count`: a failed attempt that changed anything, ignored or not, stops.
 */
export function diffSnapshots(a, b, ignoredOf = null) {
  let created = [];
  let modified = [];
  let deleted = [];
  for (const [f, sig] of Object.entries(b.files)) {
    if (!(f in a.files)) created.push(f);
    else if (a.files[f] !== sig) modified.push(f);
  }
  for (const f of Object.keys(a.files)) if (!(f in b.files)) deleted.push(f);
  const head_moved = (a.head ?? null) !== (b.head ?? null);
  const count = created.length + modified.length + deleted.length + (head_moved ? 1 : 0);
  let ignored = null;
  const every = [...created, ...modified, ...deleted];
  const hidden = ignoredOf && every.length ? ignoredOf(every) : null;
  if (hidden?.size) {
    const gone = every.filter(p => hidden.has(p));
    ignored = ignoredSummary(gone);
    created = created.filter(p => !hidden.has(p));
    modified = modified.filter(p => !hidden.has(p));
    deleted = deleted.filter(p => !hidden.has(p));
  }
  return {
    created: created.sort(), modified: modified.sort(), deleted: deleted.sort(), head_moved,
    unknown: Boolean(a.truncated || b.truncated),
    count,
    ...(ignored ? { ignored } : {}),
  };
}

/**
 * Try the candidates in order. `tryOne(c)` resolves to {rc, stdout, stderr, seconds} or {skipped: reason}.
 * Stops at the first success or genuine task failure. After a failure that did no work (limit, login, model, missing, timeout) it moves on,
 * except in an edit run where the attempt changed the tree (or the tree could not be compared): then it stops and says what changed.
 */
export async function runAttempts({ cands, access, cwd, tryOne, snap = snapshotTree, ignoredOf = gitIgnoredPaths }) {
  const guard = access === 'edit';
  const classify = paths => ignoredOf(cwd, paths);
  const attempts = [];
  let last = null;
  let stopped = null;
  const start = guard ? snap(cwd) : null;
  let before = start;
  let end = start;
  // A refused model moves to the next model of the same tier on the same host and side (`alternates`) before any other host or side runs.
  const queue = [...cands];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const out = await tryOne(c);
    if (out.skipped) { attempts.push({ host: c.host, side: c.side, skipped: out.skipped }); continue; }
    // A run that exited 0 but did nothing (empty, or a command denied) is a failure that did no work, like a limit; a guard block or an
    // unfinished Cline run is a real failure and stops the route.
    const verdict = judgeRun(c.host, out);
    const failure = out.rc !== 0 ? classifyFailure(out.rc, out.stdout, out.stderr) : (verdict.problem === 'denied' || verdict.problem === 'empty' ? verdict.problem : null);
    const att = { host: c.host, side: c.side, model: c.model, rc: out.rc, seconds: out.seconds, failure };
    last = [c, out];
    if (out.blocked?.length) att.blocked = out.blocked;
    if (c.skipped_models?.length) att.skipped_models = c.skipped_models; // the models passed over before this one, as the plan shows them
    if (c.quota_note) att.quota_note = c.quota_note;
    if (c.pool_note) att.pool_note = c.pool_note;
    if (c.binding_pct !== undefined) att.binding_pct = c.binding_pct;
    if (guard) {
      end = snap(cwd);
      if (!verdict.ok) {
        const ch = diffSnapshots(before, end, classify);
        if (ch.count > 0 || ch.unknown) att.changed = ch;
      }
    }
    attempts.push(att);
    if (verdict.ok || failure === null) break;
    if (att.changed) {
      stopped = {
        host: c.host, side: c.side, failure,
        reason: att.changed.unknown
          ? 'the directory was too large to compare, so it cannot be shown that this attempt changed nothing; no other host was started'
          : 'this attempt changed files before it failed; no other host was started, so nothing is built on a half-finished tree',
      };
      break;
    }
    before = end;
    if (failure === 'model' && c.alternates?.length) {
      const { alternates, effort_note: _note, quota_note: _quota, pool_note: _pool, binding_pct: _b, five_hour_pct: _f, weekly_pct: _w, ...same } = c;
      const [next, ...rest] = alternates;
      queue.splice(i + 1, 0, { ...same, ...next, alternates: rest });
    }
  }
  return { attempts, last, stopped, changed: guard ? diffSnapshots(start, end, classify) : null };
}

// ----------------------------------------------------------------------------- Cline guard (the worker contract, enforced)
//
// Cline's act mode runs every tool, shell commands included, with no sandbox. Its PreToolUse hook sees each tool call as JSON and can
// cancel it (which ends the run). `guardDecision` is that decision, built from the rules in the `git-guardrails` skill plus "stay in the
// working directory". The shell check is a conservative token check, not a shell parser: a creative command can slip through, which is why
// editing belongs in a throwaway worktree and why the router also compares the directory before and after (`changed`).

/** Slash-normalised absolute path ("C:/a/b" or "/a/b"), `~` and $HOME expanded, `.` and `..` collapsed. Works for either OS's paths. */
function guardPath(p, base, home) {
  let s = String(p ?? '').trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');
  if (s === '~' || s.startsWith('~/')) s = `${home}${s.slice(1)}`;
  s = s.replace(/^\$\{?HOME\}?(?=\/|$)/, home).replace(/^%USERPROFILE%/i, home).replace(/^\$env:USERPROFILE/i, home);
  if (!/^([A-Za-z]:)?\//.test(s) && !/^[A-Za-z]:$/.test(s)) s = `${base}/${s}`;
  const drive = /^[A-Za-z]:/.test(s) ? s.slice(0, 2) : '';
  const stack = [];
  for (const seg of s.slice(drive.length).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') stack.pop(); else stack.push(seg);
  }
  return `${drive}/${stack.join('/')}`;
}
const gkey = p => (/^[A-Za-z]:/.test(p) ? p.toLowerCase() : p);
const gInside = (p, root) => { const a = gkey(p); const r = gkey(root).replace(/\/+$/, ''); return a === r || a.startsWith(`${r}/`); };

const SECRET_DIR = /(^|\/)\.(ssh|aws|gnupg|kube|docker)(\/|$)|(^|\/)\.cline\/data(\/|$)/i;
const SECRET_FILE = /(^|\/)(\.env(\.[^/]*)?|\.netrc|\.npmrc|\.git-credentials|id_rsa[^/]*|id_ed25519[^/]*|[^/]*\.(pem|key|p12|pfx)|credentials(\.json)?|auth\.json|oauth_creds\.json|\.credentials\.json|providers\.json)$/i;
const ENV_TEMPLATE = /(^|\/)\.env\.(example|sample|template|dist)$/i;
const isSecretPath = p => !ENV_TEMPLATE.test(p) && (SECRET_DIR.test(p) || SECRET_FILE.test(p));

const WRITE_VERBS = new Set(['rm', 'rmdir', 'rd', 'del', 'erase', 'remove-item', 'ri', 'mv', 'move', 'move-item', 'mi', 'cp', 'copy', 'copy-item', 'cpi', 'xcopy', 'robocopy',
  'ren', 'rename', 'rename-item', 'rni', 'set-content', 'add-content', 'out-file', 'tee', 'tee-object', 'new-item', 'ni', 'mkdir', 'md', 'touch', 'chmod', 'chown', 'icacls',
  'takeown', 'ln', 'mklink', 'truncate', 'dd', 'install']);
const PRIV_VERBS = new Set(['sudo', 'doas', 'su', 'runas', 'shutdown', 'reboot', 'mkfs', 'format-volume', 'diskpart', 'setx', 'schtasks', 'reg',
  'kill', 'pkill', 'killall', 'taskkill', 'stop-process', 'spps']); // killing: a worker cannot know which processes are its own; the rest run the harness
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'cmd', 'powershell', 'pwsh']);
// Verbs whose string arguments are run as a command: judged like a shell wrapper (same recursion, same depth limit). Evaluators take a string;
// runners take a command line. `source` and `.` take a file, not inline text, so they are not here.
const EVALUATORS = new Set(['iex', 'invoke-expression', 'eval']);
const RUNNERS = new Set(['exec', 'env', 'time', 'nohup', 'command', 'xargs', 'start', 'call', 'invoke-command', 'icm', '&']);
// Interpreters with inline code: the code is not shell, but it may name a shell command, and the old guard refused such text by accident of its split.
const INLINE_CODE = { node: ['-e', '-p', '--eval', '--print'], python: ['-c'], python3: ['-c'], ruby: ['-e'], perl: ['-e'] };
const GIT_HISTORY = new Set(['push', 'commit', 'rebase', 'cherry-pick', 'merge', 'am', 'revert']);

/** One decision for one hook payload. policy: { workspace, home, tmp: [writable roots besides the workspace] }. */
export function guardDecision(payload, policy) {
  const allow = { cancel: false };
  const tool = payload?.tool_call?.name ?? payload?.preToolUse?.toolName ?? '';
  const dejson = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
  let input = dejson(payload?.tool_call?.input ?? payload?.preToolUse?.parameters ?? {});
  if (isPlain(input)) input = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, dejson(v)]));
  const home = guardPath(policy?.home || os.homedir(), '/', '/');
  const rootRaw = policy?.workspace || payload?.workspaceRoots?.[0];
  const block = why => ({ cancel: true, errorMessage: `Blocked ${tool}: ${why}` });
  if (!['read_files', 'editor', 'apply_patch', 'run_commands'].includes(tool)) return allow;
  if (!rootRaw) return block('the guard has no workspace to judge against, so it refuses to guess');
  const ws = guardPath(rootRaw, '/', home);
  const abs = p => guardPath(p, ws, home);
  const writable = p => gInside(p, ws) || (policy?.tmp ?? []).some(t => gInside(p, guardPath(t, '/', home)));
  const strings = v => (Array.isArray(v) ? v.flatMap(strings) : typeof v === 'string' ? [v] : isPlain(v) ? [v.path ?? v.file_path ?? v.filePath].filter(x => typeof x === 'string') : []);

  const writeProblem = p => {
    const a = abs(p);
    if (!writable(a)) return `${a} is outside the working directory`;
    if (/(^|\/)\.git(\/|$)/i.test(a.slice(ws.length))) return `${a} is inside .git`;
    if (/\/har-guard-[^/]*(\/|$)/i.test(a)) return 'that is the guard itself';
    if (isSecretPath(a)) return `${a} looks like a secret file (guardrail: never stage or write secrets)`;
    return null;
  };

  if (tool === 'read_files') {
    const paths = [...strings(input.files), ...strings(input.paths), ...strings(input.path), ...strings(input.file_path)];
    for (const p of paths) if (isSecretPath(abs(p))) return block(`${abs(p)} looks like a secret or credential file (guardrail: never read or expose secrets)`);
    return allow;
  }
  if (tool === 'editor') {
    const p = [input.path, input.file_path, input.filePath].find(x => typeof x === 'string' && x);
    if (!p) return block('the guard could not read the target path of this edit');
    const why = writeProblem(p);
    return why ? block(why) : allow;
  }
  if (tool === 'apply_patch') {
    const body = typeof input === 'string' ? input : String(input?.input ?? input?.patch ?? '');
    const targets = [...body.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)].map(m => m[1].trim());
    if (!targets.length) return block('the guard could not read which files this patch touches');
    for (const t of targets) { const why = writeProblem(t); if (why) return block(why); }
    return allow;
  }

  // run_commands: {commands: [string | {command, args}]} | string | {command}
  const raw = isPlain(input) ? (input.commands ?? input.command ?? input.cmd ?? []) : input;
  const commands = (Array.isArray(raw) ? raw : [raw]).map(c => (isPlain(c) ? [c.command, ...(Array.isArray(c.args) ? c.args : [])].filter(Boolean).join(' ') : String(c ?? ''))).filter(Boolean);
  if (!commands.length) return block('the guard could not read the commands');
  for (const cmd of commands) {
    const why = commandProblem(cmd, { ws, home, abs, writable });
    if (why) return block(`"${cmd.length > 140 ? `${cmd.slice(0, 137)}...` : cmd}": ${why}`);
  }
  return allow;
}

/**
 * Split a command on && || ; | and newlines, but not inside a single-quoted literal (single quotes are literal in PowerShell and in POSIX shells).
 * Double-quoted text can expand, so a separator inside it still splits, exactly as before. A single quote never closed means the quoting cannot be
 * trusted: the whole command is then split everywhere, the old way. `literalSingle` false (the inside of a cmd.exe wrapper, where ' is no quote) does the same.
 */
export function splitCommand(cmd, literalSingle = true) {
  const everywhere = () => cmd.split(/&&|\|\||;|\||\r?\n/);
  if (!literalSingle) return everywhere();
  const parts = [];
  let cur = '';
  let single = false;
  let double = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (!single && ch === '"') double = !double;
    else if (!double && ch === "'") single = !single;
    if (!single && !(ch === "'")) {
      const two = cmd.slice(i, i + 2);
      if (two === '&&' || two === '||') { parts.push(cur); cur = ''; i++; continue; }
      if (ch === ';' || ch === '|' || ch === '\n') { parts.push(cur); cur = ''; continue; }
      if (ch === '\r' && cmd[i + 1] === '\n') continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return single ? everywhere() : parts;
}

/** Verbs whose arguments are a write target plus content: the content is not a path to judge. Names of parameters that name the target, carry the content, or take another value. */
const CONTENT_VERBS = new Set(['set-content', 'add-content', 'out-file']);
const TARGET_PARAMS = ['path', 'literalpath', 'filepath', 'pspath'];
const CONTENT_PARAMS = ['value', 'inputobject'];
const VALUED_PARAMS = ['encoding', 'width', 'stream', 'delimiter', 'filter', 'include', 'exclude', 'credential', 'readcount', 'totalcount', 'tail'];
const paramIs = (name, list, min) => list.some(p => name.length >= min && p.startsWith(name));

/**
 * The arguments of a content verb that are judged as write targets. A target is the value of -Path/-LiteralPath/-FilePath, else the first positional
 * argument. Not judged: the value of -Value/-InputObject (and of other valued parameters such as -Encoding), and any positional after the target
 * that was quoted (it is content). A later unquoted positional is still judged, as before. `args` and `quoted` run in parallel.
 */
function contentVerbArgs(args, quoted) {
  const judged = [];
  const positional = [];
  let named = false;
  for (let i = 0; i < args.length; i++) {
    const m = !quoted[i] && /^-+([A-Za-z]+)(?::(.*))?$/.exec(args[i]);
    if (!m) { positional.push(i); continue; }
    const name = m[1].toLowerCase();
    const isTarget = paramIs(name, TARGET_PARAMS, 1);
    const valued = isTarget || paramIs(name, CONTENT_PARAMS, 3) || paramIs(name, VALUED_PARAMS, 3);
    if (!valued) continue;
    const val = m[2] !== undefined ? m[2] : i + 1 < args.length ? args[++i] : undefined;
    if (isTarget && val !== undefined) { judged.push(val); named = true; }
  }
  positional.forEach((i, n) => { if ((n === 0 && !named) || !quoted[i]) judged.push(args[i]); });
  return judged;
}

function commandProblem(cmd, ctx, depth = 0, literalSingle = true) {
  const { ws, abs, writable } = ctx;
  if (/\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^|]*\|\s*(sh|bash|zsh|iex|invoke-expression|powershell|pwsh|node|python3?)\b/i.test(cmd)) return 'piping a download into a shell is not allowed';
  const pathLike = t => /[\\/]/.test(t) || t.startsWith('.') || t.startsWith('~') || /^[A-Za-z]:/.test(t);
  for (const sub of splitCommand(cmd, literalSingle)) {
    const raw = sub.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const tokens = raw.map(t => t.replace(/^["']|["']$/g, ''));
    const quoted = raw.slice(1).map(t => /^["']/.test(t));
    if (!tokens.length) continue;
    const verb = tokens[0].replace(/^.*[\\/]/, '').replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase();
    const args = tokens.slice(1);
    if (PRIV_VERBS.has(verb)) return `${verb} is not allowed for a routed worker`;
    if (SHELLS.has(verb) && depth < 2) { // judge what the wrapper runs, not the wrapper's name
      const i = args.findIndex(a => /^(-c|-command|\/c)$/i.test(a));
      if (i >= 0) { const inner = commandProblem(args.slice(i + 1).join(' '), ctx, depth + 1, verb !== 'cmd'); if (inner) return inner; }
    }
    if ((EVALUATORS.has(verb) || RUNNERS.has(verb)) && depth < 2 && args.length) {
      const inner = commandProblem(args.join(' '), ctx, depth + 1);
      if (inner) return inner;
    }
    if (INLINE_CODE[verb] && depth < 2) {
      const i = args.findIndex(a => INLINE_CODE[verb].includes(a));
      if (i >= 0 && args[i + 1]) { const inner = commandProblem(args.slice(i + 1).join(' '), ctx, depth + 1); if (inner) return inner; }
    }
    if (/^(npm|pnpm|yarn)$/.test(verb) && args.includes('publish')) return 'publishing is not allowed for a routed worker';
    if (/^(npm|pnpm|yarn)$/.test(verb) && /^(i|install|add|global)$/.test(args[0] ?? '') && args.some(a => a === '-g' || a === '--global' || a === 'global')) return 'global installs are not allowed for a routed worker';
    if (verb === 'git') {
      let i = 0;
      while (i < args.length && args[i].startsWith('-')) i += /^-[Cc]$/.test(args[i]) ? 2 : 1;
      const sub1 = (args[i] ?? '').toLowerCase();
      const rest = args.slice(i + 1);
      if (sub1 === 'push') return 'never push (git-guardrails: no push, no force-push; the lead integrates)';
      if (GIT_HISTORY.has(sub1)) return `git ${sub1} is not allowed: a routed worker does not commit or rewrite history (git-guardrails; the lead integrates)`;
      if (sub1 === 'reset' && rest.includes('--hard')) return 'git reset --hard is not allowed';
      if (sub1 === 'clean' && rest.some(a => /^-[a-z]*f|^--force$/.test(a))) return 'git clean -f is not allowed';
      if (sub1 === 'branch' && rest.some(a => a === '-D' || a === '--force')) return 'deleting branches is not allowed';
      if (sub1 === 'config' && rest.includes('--global')) return 'changing global git config is not allowed';
    }
    for (const t of args) {
      if (!pathLike(t) || t.startsWith('-') || /^\/[A-Za-z]$/.test(t) || t.startsWith('&')) continue;
      if (isSecretPath(abs(t))) return `${t} looks like a secret or credential file (guardrail: never read, print or stage secrets)`;
    }
    if (WRITE_VERBS.has(verb) || (verb === 'sed' && args.includes('-i'))) {
      const cv = CONTENT_VERBS.has(verb) ? contentVerbArgs(args, quoted) : null;
      // a content verb is judged on its write target only; every other write verb on all of its arguments, as before
      for (const t of cv ?? args) {
        if (t.startsWith('-') || /^\/[A-Za-z]$/.test(t)) continue;
        if (!(pathLike(t) || t === '..' || t === '~')) continue;
        const a = abs(t);
        if (!writable(a)) return `${verb} would touch ${a}, outside the working directory`;
        if (/(^|\/)\.git(\/|$)/i.test(a.slice(ws.length)) && verb !== 'touch') return `${verb} would touch ${a}, inside .git`;
      }
    }
    for (const m of sub.matchAll(/(?:^|[\s\d])>>?\s*("[^"]+"|'[^']+'|[^\s;&|<>]+)/g)) {
      const target = m[1].replace(/^["']|["']$/g, '');
      if (target.startsWith('&') || /^(\/dev\/null|nul|\$null)$/i.test(target)) continue;
      const a = abs(target);
      if (!writable(a)) return `redirecting output to ${a}, outside the working directory`;
      if (/(^|\/)\.git(\/|$)/i.test(a.slice(ws.length))) return `redirecting output into .git (${a})`;
    }
  }
  return null;
}

/**
 * Entry point of the hook file Cline runs: payload on stdin, policy in the environment, answer on stdout. The block record is written
 * to `logFile`, which the generated hook file passes in (writeGuardHook); it is never read from the environment. A worker's own commands
 * inherit the environment, and a hook started by them (the repository's tests start one, with no policy) must not be able to write into
 * the record of the run that is being routed: seen live on 2026-11-13, where it turned correct work into `failure: "guard"`.
 */
export async function guardMain({ logFile } = {}) {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  let payload = {};
  try { payload = JSON.parse(text); } catch { /* judged below as an empty payload */ }
  let policy = null;
  try { policy = JSON.parse(process.env.HOST_AGENT_ROUTER_GUARD || 'null'); } catch { /* none */ }
  let decision;
  const tool = payload?.tool_call?.name ?? payload?.preToolUse?.toolName ?? '';
  if (!policy?.workspace) {
    decision = ['editor', 'apply_patch', 'run_commands'].includes(tool)
      ? { cancel: true, errorMessage: `Blocked ${tool}: no guard policy was provided, so this worker may not write or run commands` }
      : { cancel: false };
  } else decision = guardDecision(payload, policy);
  if (decision.cancel && logFile) {
    try { fs.appendFileSync(logFile, `${JSON.stringify({ tool, reason: decision.errorMessage?.replace(/^Blocked [a-z_]+: /, ''), at: new Date().toISOString() })}\n`); } catch { /* the answer matters more */ }
  }
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}

/** Write the hook file Cline discovers (`<dir>/PreToolUse.mjs`): it imports this script and runs guardMain, with the block record's path inside the file. Returns its path. */
export function writeGuardHook(dir, logFile = null) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'PreToolUse.mjs');
  const arg = logFile ? `{ logFile: ${JSON.stringify(logFile)} }` : '';
  fs.writeFileSync(file, `import { guardMain } from ${JSON.stringify(pathToFileURL(SELF).href)};\nawait guardMain(${arg});\n`);
  return file;
}

/**
 * Everything Cline needs to run with the guard: an isolated --config directory holding only the hook (Cline reads hooks from
 * <config>/hooks), the real --data-dir (the login lives there; with --config alone Cline answers "Unauthorized"), and the policy in the
 * environment; the log path is inside the hook file. null when there is no data directory to keep the login in. Call cleanup() when the run is over.
 */
export function prepareClineGuard({ cwd, dataDir, tmpBase = os.tmpdir() }) {
  try { if (!dataDir || !fs.statSync(dataDir).isDirectory()) return null; } catch { return null; }
  const configDir = fs.mkdtempSync(path.join(tmpBase, 'har-guard-'));
  const logFile = path.join(configDir, 'blocked.jsonl');
  writeGuardHook(path.join(configDir, 'hooks'), logFile);
  const slash = p => String(p).replace(/\\/g, '/');
  const policy = { workspace: slash(cwd), home: slash(os.homedir()), tmp: [slash(os.tmpdir())] };
  return {
    args: ['--config', configDir, '--data-dir', dataDir],
    env: { HOST_AGENT_ROUTER_GUARD: JSON.stringify(policy) }, // the record's path is NOT exported: see guardMain
    configDir, logFile,
    cleanup: () => { try { fs.rmSync(configDir, { recursive: true, force: true }); } catch { /* best effort */ } },
    readBlocked: () => {
      try {
        return fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(o => ({ tool: o.tool, reason: o.reason }));
      } catch { return []; }
    },
  };
}

/** Where Cline keeps its login and sessions on this machine. */
function clineDataDir(env = process.env) {
  return env.CLINE_DATA_DIR || (env.CLINE_DIR ? path.join(env.CLINE_DIR, 'data') : path.join(os.homedir(), '.cline', 'data'));
}

const capList = l => (l.length > 200 ? [...l.slice(0, 200), `... and ${l.length - 200} more`] : l);
const capChange = ch => (ch ? { ...ch, created: capList(ch.created), modified: capList(ch.modified), deleted: capList(ch.deleted) } : ch);

/** The parsed `--settings` JSON of a spec (Antigravity edit runs), so a dry run can show the allow rules the 120-character argument cut hides. */
const settingsOf = spec => { const i = spec.args.indexOf('--settings'); try { return i >= 0 ? JSON.parse(spec.args[i + 1]) : null; } catch { return null; } };

async function cmdRun(opts, cfg) {
  const depth = Number(process.env.HOST_AGENT_ROUTER_DEPTH || 0);
  if (depth >= Number(cfg.maxDepth ?? 1)) {
    print({ ok: false, error: 'refusing to route from inside a routed worker (HOST_AGENT_ROUTER_DEPTH is set)' });
    return 3;
  }
  const tier = opts.tier;
  if (!TIERS.includes(tier)) throw new UsageError(`--tier must be one of ${TIERS.join(', ')}`);
  const access = opts.access ?? cfg.defaultAccess ?? 'read-only';
  if (!ACCESS.includes(access)) throw new UsageError(`--access must be one of ${ACCESS.join(', ')} (there is no full-access mode)`);
  // The spend cap: the flag wins over the config; --require-budget needs one. Checked before any status is read.
  const budgetUsd = opts['max-budget-usd'] !== undefined ? Number(opts['max-budget-usd']) : (cfg.maxBudgetUsd ?? null);
  const requireBudget = Boolean(opts['require-budget']);
  if (requireBudget && budgetUsd === null) throw new UsageError('--require-budget needs a cap: pass --max-budget-usd N or set maxBudgetUsd in the config');
  const skills = resolveSkills(opts.skill); // a usage error here means no status was read and no host started
  const prompt = readPrompt(opts);
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const only = opts['pin-host'] ? [opts['pin-host']] : opts.host?.length ? opts.host : undefined; // --pin-host and --host never arrive together (main refuses it)
  const badCmd = validateAllowCmd(opts['allow-cmd'] ?? []);
  if (badCmd.length) throw new UsageError(badCmd.join('\n'));
  const allowCmd = [...new Set([...(opts['allow-cmd'] ?? []), ...readAllowCmdFile(opts['allow-cmd-file'])])];
  const { here, statuses } = await gather(cfg, opts, tier, only, opts.effort);
  let plan = buildPlan(cfg, tier, statuses, here, only, access, opts.effort);
  if (requireBudget) {
    const kept = plan.candidates.filter(c => BUDGET_FLAG[c.host]);
    const dropped = plan.candidates.filter(c => !BUDGET_FLAG[c.host]).map(c => ({ host: c.host, side: c.side, reason: 'no budget flag (--require-budget)' }));
    plan = { ...plan, selected: kept[0] ?? null, candidates: kept, skipped: [...plan.skipped, ...dropped] };
  }
  const cands = plan.candidates.filter(c => !opts['pin-side'] || c.side === opts['pin-side']);
  const attached = skills.map(({ name, chars }) => ({ name, chars }));
  const specFor = (c, text, tcwd) => buildSpec(cfg, c.host, c, text, access, tcwd, tier, { allowCmd, skills, maxBudgetUsd: budgetUsd });
  // The temp folder decision, shown by a dry run without creating anything; only for a side this process runs on (the other side decides it
  // with its own home folder and environment when the run starts).
  const tempNoteFor = (c, tcwd) => {
    if (access !== 'edit' || c.host !== 'antigravity' || !(c.side === here || here === 'local')) return null;
    try {
      const p = planWorkerTemp({ cwd: tcwd, configured: cfg.workerTemp ?? null });
      return p ? workerTempNote(p.place) : null;
    } catch (e) { return e.message; }
  };

  // Antigravity edit runs match an allowed command as a whole line: a brief that tells the worker to run a longer line than the one allowed
  // would end the run at once with nothing done (seen live 2026-11-15). Only the lines the operator passed are checked, not the defaults.
  const routerNotes = [];
  if (access === 'edit' && cands.some(c => c.host === 'antigravity')) {
    const known = [...(cfg.workerCommands?.allow ?? []), ...allowCmd];
    const found = longerCommandLines(prompt, allowCmd, known);
    if (found.length) {
      const shorten = s => (s.length > 200 ? `${s.slice(0, 197)}...` : s);
      const lines = found.map(f => `--allow-cmd ${JSON.stringify(f.allowed)} is shorter than the line the brief tells the worker to run: ${JSON.stringify(shorten(f.longer))}. This host allows exact lines only, so the longer line would be denied and the run would end with nothing done`);
      if (!opts['allow-prefix-ok']) throw new UsageError(`${lines.join('\n')}\nAllow the exact line the worker will run (--allow-cmd or --allow-cmd-file), or pass --allow-prefix-ok if the worker will run the short line.`);
      routerNotes.push(...lines.map(l => `${l} (--allow-prefix-ok was given)`));
    }
  }

  if (opts['dry-run']) {
    const would_try = cands.map(c => {
      const tcwd = translateCwd(cwd, here, c.side);
      const spec = specFor(c, prompt, tcwd);
      const skip = argvTooLong(spec, c.side);
      const tempNote = tempNoteFor(c, tcwd);
      if (tempNote) spec.notes = [...(spec.notes ?? []), tempNote];
      return { ...c, cwd: tcwd, prompt_chars: spec.chars, args: spec.args.map(a => (a.length < 120 ? a : `${a.slice(0, 117)}...`)), prompt_via: spec.stdin ? 'stdin' : 'argv', ...(settingsOf(spec) ? { allow_rules: settingsOf(spec).permissions.allow } : {}), ...(spec.notes ? { notes: spec.notes } : {}), ...(skip ? { skip } : {}), ...(budgetUsd !== null ? { budget: budgetOf(c.host, budgetUsd) } : {}) };
    });
    // A dry run is where the length is cheap to find out: each attempt carries `skip` (the reason the real run would skip it).
    if (would_try.length && would_try.every(t => t.skip)) routerNotes.push('every listed attempt would be skipped: its command line is too long for the host (see skip on each); a real run would end with failure "too_long"');
    print({ dry_run: true, access, ...(opts.effort ? { effort_requested: opts.effort } : {}), skills: attached, plan, would_try, ...(routerNotes.length ? { notes: routerNotes } : {}) });
    return cands.length ? 0 : 2;
  }

  let lengthSkips = 0;
  const tryOne = async c => {
    const tcwd = translateCwd(cwd, here, c.side);
    if (tcwd == null) return { skipped: `working directory ${cwd} is not reachable from ${c.side}` };
    const spec = specFor(c, prompt, tcwd);
    const tooLong = argvTooLong(spec, c.side);
    if (tooLong) { lengthSkips += 1; return { skipped: tooLong }; }
    const payload = execPayload(spec, { host: c.host, cwd: tcwd, timeout: timeoutFor(cfg, tier, opts.timeout), workerTemp: access === 'edit' && c.host === 'antigravity' ? { configured: cfg.workerTemp ?? null } : null });
    try {
      return await callSide(cfg, here, c.side, 'local-exec', payload, payload.timeout * 1000 + 60_000);
    } catch (e) {
      return { rc: 126, stdout: '', stderr: `${e?.name}: ${e?.message}`, seconds: 0 };
    }
  };
  const { attempts, last, stopped, changed } = await runAttempts({ cands, access, cwd, tryOne });
  if (budgetUsd !== null) for (const a of attempts) a.budget = budgetOf(a.host, budgetUsd);
  const verdict = last ? judgeRun(last[0].host, last[1]) : { ok: false, problem: null };
  const ok = verdict.ok;
  const env = { ok, tier, access, ...(opts.effort ? { effort_requested: opts.effort } : {}), skills: attached, attempts, skipped: plan.skipped, ...(plan.pools ? { pools: plan.pools } : {}) };
  // A run the guard stopped, or that Cline did not complete, exited 0 but is not a success; say why, and never hand it to another host.
  if (verdict.problem) env.failure = verdict.problem;
  // Every candidate skipped because its command line was too long: nothing ran, and the cause has a code of its own.
  if (!last && attempts.length > 0 && lengthSkips === attempts.length) env.failure = 'too_long';
  if (routerNotes.length) env.notes = [...routerNotes];
  if (verdict.finish_reason) env.finish_reason = verdict.finish_reason;
  if (last?.[1].blocked?.length) env.guard = { blocked: last[1].blocked };
  // What the router saw change in the working directory, independent of what the worker's report claims.
  if (changed) env.changed = capChange(changed);
  if (stopped) env.stopped = stopped;
  for (const a of attempts) if (a.changed) a.changed = capChange(a.changed);
  if (last) {
    const [c, res] = last;
    env.ran = ranOf(c);
    if (budgetUsd !== null && !BUDGET_FLAG[c.host]) env.notes = [...(env.notes ?? []), `no budget cap applied: ${c.host} has no budget flag`];
    const specNotes = specFor(c, prompt, translateCwd(cwd, here, c.side)).notes;
    if (specNotes) env.notes = [...(env.notes ?? []), ...specNotes];
    if (res.tempNote) env.notes = [...(env.notes ?? []), res.tempNote];
    const cl = c.host === 'cline' ? parseClineJson(res.stdout) : null;
    const ag = c.host === 'antigravity' ? parseAgyRun(res.stdout) : null;
    if (ag) {
      env.output = ag.text.trim().slice(0, MAX_OUTPUT);
      env.usage = ag.usage;
      if (ag.denied.length) env.denied_actions = ag.denied;
    } else if (cl) {
      // The answer alone, plus what Cline measured (ClinePass has no remaining-quota readout, but it does count tokens).
      env.output = cl.text.trim().slice(0, MAX_OUTPUT);
      env.finish_reason = cl.finish_reason;
      env.usage = cl.usage;
      env.duration_ms = cl.duration_ms;
    } else if (c.host === 'cline' && (env.partial = summarizeClineStream(res.stdout))) {
      env.output = '';
      env.partial.note = 'the Cline run did not finish; its event stream is summarised here, not returned';
    } else {
      delete env.partial;
      env.output = stripAnsi(res.stdout).trim().slice(0, MAX_OUTPUT);
    }
    if (!ok) env.stderr_tail = stripAnsi(res.stderr).trim().slice(-2000);
  } else {
    env.error = cands.length ? 'every candidate was skipped' : 'no usable host/side';
  }
  print(env);
  return ok ? 0 : 1;
}

async function cmdModels(opts, cfg) {
  const here = opts.here ?? detectHere();
  const wanted = Object.fromEntries(cfg.priority.map(h => [h, configuredModels(cfg, h)]));
  const out = {};
  for (const side of discoverSides(here, cfg)) {
    try { out[side] = await callSide(cfg, here, side, 'local-models', { models: wanted }); } catch (e) { out[side] = { error: e.message }; }
  }
  print(out);
  return 0;
}

async function cmdMachine(opts, cfg) {
  const here = opts.here ?? detectHere();
  const sides = {};
  for (const side of discoverSides(here, cfg)) {
    try {
      const { hosts } = await callSide(cfg, here, side, 'local-machine', {}, 120_000);
      sides[side] = side === here || here === 'local' ? hosts : viaBridge(hosts);
    } catch (e) {
      sides[side] = bridgeFailed(e?.message ?? e, HOSTS);
    }
  }
  const record = machineRecord({ hostname: os.hostname(), platform: process.platform, here, node: process.version, now: new Date(), sides });
  if (opts.save) {
    const file = saveMachineRecord(record, machinesDir());
    print({ ...record, saved: file });
  } else print(record);
  return 0;
}

const USAGE = `host-agent-router: route a task to the best agent CLI and side, then run it headlessly.

Commands:
  status [--tier T] [--effort E] [--host H...] [--json]   table of every host x side with 5-hour / weekly headroom
  plan   [--tier T] [--effort E] [--host H...]            the routing decision as JSON (starts no model)
  run    --tier T (--prompt S | --prompt-file F | stdin) [--access read-only|edit] [--cwd D] [--effort E]
         [--skill NAME ...] [--timeout SEC] [--allow-cmd LINE ...] [--allow-cmd-file FILE] [--allow-prefix-ok] [--host H...] [--pin-host H] [--pin-side S] [--dry-run]
         [--max-budget-usd N] [--require-budget]
         --host H (repeat it) limits the candidates to those hosts, still in priority order, and a fall-through stays inside them; --pin-host H is one host
         with no fall-through; the two cannot be combined. A flag that does not belong to the command given is a usage error.
         --timeout defaults per tier (config timeoutSeconds); --allow-cmd adds a command line the worker may run (its acceptance command).
         Antigravity matches exact command lines only: give the whole line the brief tells the worker to run. A run is refused (exit 64) when the
         brief holds a longer line that starts with an --allow-cmd value; --allow-prefix-ok turns that into a note. --allow-cmd-file FILE reads
         one line per line (blank lines and # comments ignored). A colon or backslash is accepted only in a drive path such as C:/work/x.
         --dry-run shows, for each attempt, whether its command line would be too long (skip), and a real run that skips every candidate for
         length ends with failure "too_long".
         --max-budget-usd N (config maxBudgetUsd) caps the spend of a run on a host that has a budget flag (today Claude only); for any other host
         the result and the dry run say the cap did not apply, and the run is bounded by --timeout only. --require-budget skips the hosts that
         have no budget flag (and needs a cap).
         --effort E picks a setting inside the tier where a host has one (config tiers.<tier>.efforts); a host without it keeps its
         default and the result says so. An effort no candidate host knows is a usage error. An Orchestrator model has a fixed
         configuration: --effort does not change it, and the plan says so.
         Each tier is an ordered list of models (config tiers.<tier>.models). The router reads the models the logged-in account can use
         (Antigravity: agy models; Codex: model/list; hosts.<host>.pool in the config replaces that list) and runs the first entry that is
         in it; a model the host refuses runs the next entry of the tier on the same host before another host or side. If the list cannot
         be read, the first entry that has a model id is used and the plan says the pool is unknown.
         --skill NAME (up to 3) puts the SKILL.md text of a sibling skill into the worker's prompt, after the contract; --dry-run lists them.
  models                                     check configured model names (tiers and efforts) against each host's own list (agy models, a Codex cache file; starts no model)
  machine [--save]                           what this machine has per host and side and how each is started (starts no model);
                                             --save writes it to ~/.agents/host-agent-router/machines/<hostname>.json

Tiers: simple, medium, high.   Hosts: cline, antigravity, codex, claude.   Access defaults to read-only.
Replay aids: --here windows|wsl|local, --statuses-file FILE (use captured statuses instead of probing).
Config: assets/config.default.json, overridden by ~/.agents/host-agent-router/config.json or $HOST_AGENT_ROUTER_CONFIG.
Exit codes: 0 ok, 1 the run failed, 2 no usable host/side, 3 refused (inside a routed worker), 64 usage error or invalid config (nothing ran).
`;

const OPTIONS = {
  tier: { type: 'string' }, host: { type: 'string', multiple: true }, json: { type: 'boolean' }, here: { type: 'string' },
  'statuses-file': { type: 'string' }, prompt: { type: 'string' }, 'prompt-file': { type: 'string' }, access: { type: 'string' },
  cwd: { type: 'string' }, timeout: { type: 'string' }, 'allow-cmd': { type: 'string', multiple: true }, 'allow-cmd-file': { type: 'string' }, 'allow-prefix-ok': { type: 'boolean' },
  'max-budget-usd': { type: 'string' }, 'require-budget': { type: 'boolean' },
  'pin-host': { type: 'string' }, 'pin-side': { type: 'string' },
  'dry-run': { type: 'boolean' }, payload: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  effort: { type: 'string' }, skill: { type: 'string', multiple: true }, save: { type: 'boolean' },
};

/** The options each command accepts (besides --help). Anything else is a usage error: a flag that does nothing is how a safe-looking run goes wrong. */
const COMMAND_OPTIONS = {
  status: ['tier', 'effort', 'host', 'json', 'here', 'statuses-file'],
  plan: ['tier', 'effort', 'host', 'here', 'statuses-file'],
  run: ['tier', 'effort', 'host', 'prompt', 'prompt-file', 'access', 'cwd', 'timeout', 'allow-cmd', 'allow-cmd-file', 'allow-prefix-ok', 'max-budget-usd', 'require-budget', 'pin-host', 'pin-side', 'skill', 'dry-run', 'here', 'statuses-file'],
  models: ['here'],
  machine: ['here', 'save'],
};

export async function main(argv) {
  let parsed;
  try { parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true }); } catch (e) { throw new UsageError(e.message); }
  const { values: opts, positionals } = parsed;
  const cmd = positionals[0];
  if (!cmd || opts.help) { process.stdout.write(USAGE); return 0; }
  if (cmd in LOCAL) { // internal re-entry used for the other side: one JSON line, no pretty printing
    process.stdout.write(`${JSON.stringify(await LOCAL[cmd](JSON.parse(fs.readFileSync(opts.payload, 'utf8'))))}\n`);
    return 0;
  }
  const handler = { status: cmdStatus, plan: cmdPlan, run: cmdRun, models: cmdModels, machine: cmdMachine }[cmd];
  if (!handler) { process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`); return 64; }
  const SIDES = ['windows', 'wsl', 'local'];
  const oneOf = (flag, value, allowed, note = '') => {
    if (value !== undefined && !allowed.includes(value)) throw new UsageError(`${flag} must be one of ${allowed.join(', ')}${note}`);
  };
  if (opts['pin-host'] && opts.host?.length) throw new UsageError('--pin-host and --host cannot be combined: --pin-host is one host with no fall-through, --host lists the hosts a fall-through may use');
  oneOf('--tier', opts.tier, TIERS);
  for (const h of opts.host ?? []) oneOf('--host', h, HOSTS);
  oneOf('--pin-host', opts['pin-host'], HOSTS);
  oneOf('--pin-side', opts['pin-side'], SIDES);
  oneOf('--here', opts.here, SIDES);
  oneOf('--access', opts.access, ACCESS, ' (there is no full-access mode)');
  if (opts.skill && cmd !== 'run') throw new UsageError('--skill belongs to run');
  if (opts.effort !== undefined && !['status', 'plan', 'run'].includes(cmd)) throw new UsageError('--effort belongs to run, plan and status');
  for (const flag of Object.keys(opts)) {
    if (flag === 'help') continue;
    if (!COMMAND_OPTIONS[cmd].includes(flag)) throw new UsageError(`--${flag} does not apply to ${cmd} (${cmd} takes: ${COMMAND_OPTIONS[cmd].map(f => `--${f}`).join(', ')})`);
  }
  if (opts['max-budget-usd'] !== undefined) {
    const bad = budgetProblem(opts['max-budget-usd']);
    if (bad) throw new UsageError(`--max-budget-usd ${bad}`);
  }
  const cfg = loadConfig();
  if (opts.effort !== undefined) {
    const bad = checkEffort(cfg, opts.tier ?? 'medium', opts.effort, cmd === 'run' && opts['pin-host'] ? [opts['pin-host']] : opts.host);
    if (bad) throw new UsageError(bad);
  }
  return handler(opts, cfg);
}

let invokedDirectly = false;
try { invokedDirectly = Boolean(process.argv[1]) && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url; } catch { /* imported */ }
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    code => { process.exitCode = code; },
    e => { process.stderr.write(`${e?.message ?? e}\n`); process.exitCode = e instanceof UsageError ? EXIT_USAGE : 1; },
  );
}
