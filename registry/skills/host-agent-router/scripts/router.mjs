#!/usr/bin/env node
/**
 * host-agent-router: pick the best (host, side) for a task and dispatch it headlessly on that host's CLI.
 *
 * Hosts: cline, antigravity, codex, claude.  Sides: windows and wsl on Windows (and from WSL), otherwise one `local` side.
 * Single file, Node built-ins only, written for Node >= 20 (WSL images often ship Node 20). Run with --help.
 *
 * Selection: hosts are tried in priority order. For one host the side with the most headroom wins (headroom = the smaller of
 * the 5-hour and weekly remaining), a tie keeps the side you are on. A host/side that is missing, logged out or below the
 * headroom floor is skipped. After a run that did no work because of a limit, login or model refusal, the next candidate runs.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
export const HOSTS = ['cline', 'antigravity', 'codex', 'claude'];
export const TIERS = ['simple', 'medium', 'high'];
export const ACCESS = ['read-only', 'edit'];
const MAX_OUTPUT = 200_000;

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
  const pick = name => windows.find(w => w.name === name)?.remaining_pct ?? null;
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

export function agyGroupFor(model, groups) {
  let best = null;
  for (const [prefix, group] of Object.entries(groups ?? {})) {
    if (String(model).startsWith(prefix) && (best === null || prefix.length > best[0].length)) best = [prefix, group];
  }
  return best ? best[1] : null;
}

/** Antigravity `-p "/usage" --output-format json`: groups with 5h / weekly buckets (remaining_fraction). */
export function parseAgyUsage(text, model, groups) {
  let data;
  try {
    data = JSON.parse(text)?.command?.data?.groups;
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const target = agyGroupFor(model, groups);
  const windows = [];
  for (const g of data) {
    if (g?.name !== target) continue;
    for (const b of g.buckets ?? []) {
      if (b?.remaining_fraction == null) continue;
      const name = { '5h': 'five_hour', weekly: 'weekly' }[b.window] ?? String(b.window);
      windows.push({ name, remaining_pct: round1(Number(b.remaining_fraction) * 100), resets: b.reset_time ?? null });
    }
  }
  return windows;
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

// ----------------------------------------------------------------------------- config

const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: objects merge key by key, arrays and scalars in `over` replace. Neither input is mutated. */
export function mergeConfig(base, over) {
  const out = structuredClone(base);
  const walk = (dst, src) => {
    for (const [k, v] of Object.entries(src ?? {})) {
      if (isPlain(v) && isPlain(dst[k])) walk(dst[k], v);
      else dst[k] = structuredClone(v);
    }
  };
  walk(out, over);
  return out;
}

export function validateConfig(cfg) {
  const errs = [];
  if (!Array.isArray(cfg?.priority) || cfg.priority.length === 0) return ['priority must be a non-empty list of hosts'];
  for (const host of cfg.priority) {
    if (!HOSTS.includes(host)) errs.push(`priority lists an unknown host: ${host}`);
    else if (!cfg.hosts?.[host]) errs.push(`${host}: no entry under hosts`);
  }
  for (const host of cfg.priority) {
    if (!HOSTS.includes(host) || !cfg.hosts?.[host]) continue;
    for (const tier of TIERS) {
      const t = cfg.hosts[host].tiers?.[tier];
      if (!t?.model || !/^[a-z]+$/.test(t.effort ?? '')) errs.push(`${host}/${tier}: needs a model and an effort`);
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
  return errs;
}

/** Problems with a list of command prefixes for --allow-cmd or `workerCommands`: plain words only, so a prefix cannot break out of a host's rule syntax. */
export function validateAllowCmd(list) {
  const errs = [];
  for (const c of Array.isArray(list) ? list : [list]) {
    if (typeof c !== 'string' || !/^[\w@./= -]+$/.test(c) || !c.trim()) {
      errs.push(`--allow-cmd ${JSON.stringify(c)} is not a plain command prefix (letters, digits, spaces and _ @ . / = - only)`);
    }
  }
  return errs;
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

export function loadConfig(env = process.env) {
  const base = JSON.parse(fs.readFileSync(path.join(path.dirname(SELF), '..', 'assets', 'config.default.json'), 'utf8'));
  const userFile = env.HOST_AGENT_ROUTER_CONFIG || path.join(os.homedir(), '.agents', 'host-agent-router', 'config.json');
  let cfg = base;
  if (fs.existsSync(userFile)) cfg = mergeConfig(base, JSON.parse(fs.readFileSync(userFile, 'utf8')));
  const errs = validateConfig(cfg);
  if (errs.length) throw new Error(`invalid config (${fs.existsSync(userFile) ? userFile : 'defaults'}):\n- ${errs.join('\n- ')}`);
  return cfg;
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

/** statuses: { host: { side: { installed, logged_in, usage } } }. Returns the ordered candidates and why others were skipped. */
export function buildPlan(cfg, tier, statuses, here, onlyHosts, access) {
  const min = Number(cfg.minHeadroomPct ?? 10);
  const tie = Number(cfg.tiePct ?? 2);
  const candidates = [];
  const skipped = [];
  for (const host of cfg.priority) {
    if (onlyHosts?.length && !onlyHosts.includes(host)) continue;
    const sides = statuses[host] ?? {};
    const t = cfg.hosts[host].tiers[tier];
    const usable = [];
    for (const [side, st] of Object.entries(sides)) {
      if (!st.installed) skipped.push({ host, side, reason: `not installed or not runnable${st.error ? ` (${st.error})` : ''}` });
      else if (st.logged_in === false) skipped.push({ host, side, reason: 'not logged in' });
      else {
        const b = st.usage?.binding_pct ?? null;
        if (b !== null && b < min) skipped.push({ host, side, reason: `headroom ${b}% below minimum ${min}%` });
        else usable.push([side, b]);
      }
    }
    let ordered = orderSides(usable, here, tie);
    // Some hosts only work as an editor on one side (Codex's Windows sandbox lost its working directory and PATH; its WSL sandbox is sound).
    const editSide = cfg.hosts[host].editSide;
    if (access === 'edit' && editSide && ordered.includes(editSide)) ordered = [editSide, ...ordered.filter(s => s !== editSide)];
    for (const side of ordered) {
      const u = sides[side].usage ?? {};
      candidates.push({
        host, side, model: t.model, effort: t.effort, label: t.label ?? t.model,
        binding_pct: u.binding_pct ?? null, five_hour_pct: u.five_hour_pct ?? null, weekly_pct: u.weekly_pct ?? null,
      });
    }
  }
  return { tier, here, selected: candidates[0] ?? null, candidates, skipped };
}

// ----------------------------------------------------------------------------- command building

function preamble(access, tier) {
  const head = `[Routed worker | host-agent-router | tier: ${tier} | access: ${access}] Do not invoke host-agent-router and do not start further routed workers.`;
  if (access === 'read-only') return `${head} Do not modify, create or delete any file and do not run state-changing commands. Reply with the result only.\n\n`;
  // The worker contract, the same on every host (references/worker-contract.md): the `git-guardrails` rules, then the `handoff` report.
  // The orchestrator checks the report against what the router saw change (`changed` in the result), so it must be factual and complete.
  return `${head} Follow the \`git-guardrails\` skill if you have it, and in any case: never push and never force-push, do not commit (the lead integrates your work), `
    + 'never touch a protected branch (main, master, production, release/*), and never read, print or stage a secret (.env files, keys, tokens). '
    + 'Edit only inside the working directory; do not install packages globally or leave processes running. '
    + 'Finish with a handoff report as your whole reply, in the reply and not in a file (if a `handoff` skill is available to you, follow its state-capture and remaining-work steps), '
    + 'with exactly these headings: Done (what now works), Changed files (path and one line each), Checks run (command and result, or none), Not done or blocked, Next steps.\n\n';
}

/** Arguments (without the binary) for one headless run. `cwd` must already be valid on the target side. Never a full-access flag. */
export function buildSpec(cfg, host, t, prompt, access, cwd, tier, extra = {}) {
  const full = preamble(access, tier) + prompt;
  const ro = access === 'read-only';
  const env = { HOST_AGENT_ROUTER_DEPTH: '1' };
  // Commands a worker may run (the lead's --allow-cmd on top of the defaults) and the ones it never may. Claude and Antigravity deny every
  // other command in headless mode, so the list is what lets a worker run its tests; Codex has its sandbox and Cline its hook guard.
  const allow = [...new Set([...(cfg.workerCommands?.allow ?? []), ...(extra.allowCmd ?? [])])];
  const deny = cfg.workerCommands?.deny ?? [];
  switch (host) {
    case 'claude': {
      const guard = ro ? [] : ['--allowedTools', ...allow.map(c => `Bash(${c}:*)`), '--disallowedTools', ...deny.map(c => `Bash(${c}:*)`)];
      return { args: ['-p', '--model', t.model, '--effort', t.effort, '--permission-mode', ro ? 'plan' : 'acceptEdits', ...guard, '--output-format', 'text'], stdin: full, env };
    }
    case 'codex': {
      const args = ['exec', '-m', t.model, '-c', `model_reasoning_effort="${t.effort}"`, '-s', ro ? 'read-only' : 'workspace-write', '--skip-git-repo-check', '--color', 'never'];
      if (cwd) args.push('-C', cwd);
      return { args: [...args, '-'], stdin: full, env };
    }
    case 'antigravity': {
      // Headless Antigravity denies every command that is not allowed, and one denial ends the run with exit 0. Its rules match an exact
      // command line or a bare program name and ignore wildcards (checked live), so the allow list is exact and the worker is told so.
      const note = ro ? '' : `Shell commands: only these exact command lines are allowed here, and any other command stops the run with no result: ${allow.join('; ')}. Run them exactly as written, with no cd, flags or pipes added.\n\n`;
      const args = ['-p', preamble(access, tier) + note + prompt, '--model', t.model, '--mode', ro ? 'plan' : 'accept-edits', '--output-format', 'json'];
      if (!ro) args.push('--sandbox', '--settings', JSON.stringify({ permissions: { allow: allow.map(c => `command(${c})`) } }));
      if (!cfg.hosts.antigravity.effortInModel) args.push('--effort', t.effort);
      return { args, stdin: null, env };
    }
    case 'cline': {
      // --json: plain text mode prints the whole activity log before the answer; JSON ends in one run_result line (see parseClineJson).
      const args = ['-P', cfg.hosts.cline.provider, '-m', t.model, '--thinking', t.effort, '--json'];
      if (ro) args.push('--plan');
      if (cwd) args.push('-c', cwd);
      return { args: [...args, '--', full], stdin: null, env };
    }
    default:
      throw new Error(`unknown host ${host}`);
  }
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
      child = spawn(argv[0], argv.slice(1), { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
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

export function which(name) {
  const win = process.platform === 'win32';
  const exts = win ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean) : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
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

function resolveCline() {
  const shim = which('cline');
  if (!shim) return null;
  if (process.platform !== 'win32') return [shim];
  // Run the package entry with node directly so prompt text is never reparsed by cmd.exe.
  const dir = path.dirname(fs.realpathSync(shim));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', 'cline', 'package.json'), 'utf8'));
    const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.cline;
    const entry = rel ? path.join(dir, 'node_modules', 'cline', rel) : null;
    if (entry && isFile(entry)) return [firstFile([path.join(dir, 'node.exe')]) ?? process.execPath, entry];
  } catch { /* fall through to the shim */ }
  return [shim];
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
    const cands = [which('codex'), path.join(home, '.local', 'bin', `codex${ext}`)];
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
      child = spawn(cmd[0], [...cmd.slice(1), 'app-server'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
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
        for (const [id, method] of Object.entries(wanted)) send({ method, id: Number(id), ...(method === 'account/read' ? { params: { refreshToken: false } } : {}) });
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

async function probeAntigravity(cmd, model, cfgHost, st) {
  const u = await runCmd([...cmd, '-p', '/usage', '--output-format', 'json'], { timeout: 75_000, cwd: os.homedir() });
  const windows = parseAgyUsage(u.stdout, model, cfgHost.quotaGroups ?? {});
  if (windows.length) { st.logged_in = true; st.usage = makeUsage(windows); }
  else st.notes.push(`could not read quota for this model group: ${(u.stdout || u.stderr).trim().slice(0, 160).replace(/\n/g, ' ')}`);
}

async function probeCodex(cmd, _model, _cfgHost, st) {
  const resp = await codexAppServer(cmd, { 1: 'account/read', 2: 'account/rateLimits/read' });
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
    await PROBES[host](cmd, model, payload.host_cfg ?? {}, st);
  } catch (e) { // a failed readout must never break routing
    st.notes.push(`usage probe failed: ${e?.name}: ${e?.message}`);
  }
  return st;
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
  const t0 = Date.now();
  try {
    const r = await runCmd([...cmd, ...args], { timeout: (payload.timeout ?? 1800) * 1000, input: payload.stdin ?? '', cwd: payload.cwd || undefined, env });
    const out = { rc: r.rc, stdout: r.stdout, stderr: r.stderr, seconds: Math.round((Date.now() - t0) / 100) / 10 };
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
        const r = await runCmd([...cmd, 'models'], { timeout: 60_000, cwd: os.homedir() });
        if (r.rc === 0) known = new Set(r.stdout.split(/\r?\n/).filter(l => l.includes('\t')).map(l => l.split('\t')[0].trim()));
      }
    }
    const note = known ? null : resolveCmd(host) ? 'unverified (host has no offline model list)' : 'not checked (host not installed on this side)';
    out[host] = Object.fromEntries(models.map(m => [m, known ? (known.has(m) ? 'ok' : 'NOT LISTED') : note]));
  }
  return out;
}

const LOCAL = { 'local-probe': probeLocal, 'local-exec': execLocal, 'local-models': modelsLocal };

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
      // --exec hands argv over as is. With `--`, wsl.exe runs the line through the outer shell, which would expand $0 and $@ itself.
      argv = ['wsl.exe', '-d', distro, '--exec', 'bash', '-lc', 'exec node "$0" "$@"', winToWsl(script), command, '--payload', winToWsl(pfile)];
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

async function probeAll(cfg, tier, here, sides, onlyHosts) {
  const jobs = cfg.priority.filter(h => !onlyHosts?.length || onlyHosts.includes(h)).flatMap(h => sides.map(s => [h, s]));
  const results = await Promise.all(jobs.map(async ([host, side]) => {
    const payload = { host, side, model: cfg.hosts[host].tiers[tier].model, host_cfg: cfg.hosts[host] };
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

async function gather(cfg, opts, tier, only) {
  const here = opts.here ?? detectHere();
  if (opts['statuses-file']) {
    const statuses = JSON.parse(fs.readFileSync(opts['statuses-file'], 'utf8'));
    return { here, sides: [...new Set(Object.values(statuses).flatMap(s => Object.keys(s)))], statuses };
  }
  const sides = discoverSides(here, cfg);
  return { here, sides, statuses: await probeAll(cfg, tier, here, sides, only) };
}

async function cmdStatus(opts, cfg) {
  const tier = opts.tier ?? 'medium';
  const { here, statuses } = await gather(cfg, opts, tier, opts.host);
  const plan = buildPlan(cfg, tier, statuses, here, opts.host);
  if (opts.json) { print({ plan, statuses }); return 0; }
  console.log(`tier=${tier}  here=${here}  floor=${cfg.minHeadroomPct}%  (binding = smaller of 5h / weekly remaining)`);
  console.log(`${'HOST'.padEnd(12)}${'SIDE'.padEnd(9)}${'STATE'.padEnd(22)}${'5H LEFT'.padEnd(9)}${'WEEK LEFT'.padEnd(11)}MODEL`);
  for (const host of cfg.priority) {
    for (const [side, st] of Object.entries(statuses[host] ?? {})) {
      const u = st.usage ?? {};
      const state = !st.installed ? 'not runnable' : st.logged_in === false ? 'logged out' : 'ready';
      console.log(`${host.padEnd(12)}${side.padEnd(9)}${state.padEnd(22)}${fmt(u.five_hour_pct).padEnd(9)}${fmt(u.weekly_pct).padEnd(11)}${cfg.hosts[host].tiers[tier].model}`);
    }
  }
  const sel = plan.selected;
  console.log(`\nselected: ${sel ? `${sel.host} on ${sel.side} -> ${sel.model} (${sel.effort})` : 'none'}`);
  for (const s of plan.skipped) console.log(`  skipped ${s.host}/${s.side}: ${s.reason}`);
  for (const [host, sides] of Object.entries(statuses)) for (const [side, st] of Object.entries(sides)) for (const n of st.notes ?? []) console.log(`  note ${host}/${side}: ${n}`);
  return 0;
}

async function cmdPlan(opts, cfg) {
  const tier = opts.tier ?? 'medium';
  const { here, statuses } = await gather(cfg, opts, tier, opts.host);
  const plan = buildPlan(cfg, tier, statuses, here, opts.host);
  plan.notes = Object.fromEntries(Object.entries(statuses).flatMap(([h, ss]) => Object.entries(ss).filter(([, st]) => st.notes?.length).map(([s, st]) => [`${h}/${s}`, st.notes])));
  print(plan);
  return plan.selected ? 0 : 2;
}

function readPrompt(opts) {
  if (opts['prompt-file']) return fs.readFileSync(opts['prompt-file'], 'utf8');
  if (opts.prompt) return opts.prompt;
  if (!process.stdin.isTTY) return fs.readFileSync(0, 'utf8');
  throw new Error('no prompt: use --prompt, --prompt-file or pipe it on stdin');
}

// ----------------------------------------------------------------------------- working-tree guard (edit runs)
//
// A host that stops on a limit or a timeout may already have changed files; the router only sees the error text. So for an edit run it
// looks at the tree: a failed attempt hands over to the next host only if it left the directory exactly as it found it.

const GUARD_SKIP = new Set(['.git', 'node_modules']);

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

/** What differs between two snapshots. `unknown` when either was cut short: "cannot compare" is never reported as "unchanged". */
export function diffSnapshots(a, b) {
  const created = [];
  const modified = [];
  const deleted = [];
  for (const [f, sig] of Object.entries(b.files)) {
    if (!(f in a.files)) created.push(f);
    else if (a.files[f] !== sig) modified.push(f);
  }
  for (const f of Object.keys(a.files)) if (!(f in b.files)) deleted.push(f);
  const head_moved = (a.head ?? null) !== (b.head ?? null);
  return {
    created: created.sort(), modified: modified.sort(), deleted: deleted.sort(), head_moved,
    unknown: Boolean(a.truncated || b.truncated),
    count: created.length + modified.length + deleted.length + (head_moved ? 1 : 0),
  };
}

/**
 * Try the candidates in order. `tryOne(c)` resolves to {rc, stdout, stderr, seconds} or {skipped: reason}.
 * Stops at the first success or genuine task failure. After a failure that did no work (limit, login, model, missing, timeout) it moves on,
 * except in an edit run where the attempt changed the tree (or the tree could not be compared): then it stops and says what changed.
 */
export async function runAttempts({ cands, access, cwd, tryOne, snap = snapshotTree }) {
  const guard = access === 'edit';
  const attempts = [];
  let last = null;
  let stopped = null;
  const start = guard ? snap(cwd) : null;
  let before = start;
  let end = start;
  for (const c of cands) {
    const out = await tryOne(c);
    if (out.skipped) { attempts.push({ host: c.host, side: c.side, skipped: out.skipped }); continue; }
    // A run that exited 0 but did nothing (empty, or a command denied) is a failure that did no work, like a limit; a guard block or an
    // unfinished Cline run is a real failure and stops the route.
    const verdict = judgeRun(c.host, out);
    const failure = out.rc !== 0 ? classifyFailure(out.rc, out.stdout, out.stderr) : (verdict.problem === 'denied' || verdict.problem === 'empty' ? verdict.problem : null);
    const att = { host: c.host, side: c.side, model: c.model, rc: out.rc, seconds: out.seconds, failure };
    last = [c, out];
    if (out.blocked?.length) att.blocked = out.blocked;
    if (guard) {
      end = snap(cwd);
      if (!verdict.ok) {
        const ch = diffSnapshots(before, end);
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
  }
  return { attempts, last, stopped, changed: guard ? diffSnapshots(start, end) : null };
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

function commandProblem(cmd, ctx, depth = 0) {
  const { ws, abs, writable } = ctx;
  if (/\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^|]*\|\s*(sh|bash|zsh|iex|invoke-expression|powershell|pwsh|node|python3?)\b/i.test(cmd)) return 'piping a download into a shell is not allowed';
  const pathLike = t => /[\\/]/.test(t) || t.startsWith('.') || t.startsWith('~') || /^[A-Za-z]:/.test(t);
  for (const sub of cmd.split(/&&|\|\||;|\||\r?\n/)) {
    const tokens = (sub.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(t => t.replace(/^["']|["']$/g, ''));
    if (!tokens.length) continue;
    const verb = tokens[0].replace(/^.*[\\/]/, '').replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase();
    const args = tokens.slice(1);
    if (PRIV_VERBS.has(verb)) return `${verb} is not allowed for a routed worker`;
    if (SHELLS.has(verb) && depth < 2) { // judge what the wrapper runs, not the wrapper's name
      const i = args.findIndex(a => /^(-c|-command|\/c)$/i.test(a));
      if (i >= 0) { const inner = commandProblem(args.slice(i + 1).join(' '), ctx, depth + 1); if (inner) return inner; }
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
      for (const t of args) {
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

/** Entry point of the hook file Cline runs: payload on stdin, policy and log path in the environment, answer on stdout. */
export async function guardMain() {
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
  if (decision.cancel && process.env.HOST_AGENT_ROUTER_GUARD_LOG) {
    try { fs.appendFileSync(process.env.HOST_AGENT_ROUTER_GUARD_LOG, `${JSON.stringify({ tool, reason: decision.errorMessage?.replace(/^Blocked [a-z_]+: /, ''), at: new Date().toISOString() })}\n`); } catch { /* the answer matters more */ }
  }
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}

/** Write the hook file Cline discovers (`<dir>/PreToolUse.mjs`): it imports this script and runs guardMain. Returns its path. */
export function writeGuardHook(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'PreToolUse.mjs');
  fs.writeFileSync(file, `import { guardMain } from ${JSON.stringify(pathToFileURL(SELF).href)};\nawait guardMain();\n`);
  return file;
}

/**
 * Everything Cline needs to run with the guard: an isolated --config directory holding only the hook (Cline reads hooks from
 * <config>/hooks), the real --data-dir (the login lives there; with --config alone Cline answers "Unauthorized"), and the policy and
 * log path in the environment. null when there is no data directory to keep the login in. Call cleanup() when the run is over.
 */
export function prepareClineGuard({ cwd, dataDir, tmpBase = os.tmpdir() }) {
  try { if (!dataDir || !fs.statSync(dataDir).isDirectory()) return null; } catch { return null; }
  const configDir = fs.mkdtempSync(path.join(tmpBase, 'har-guard-'));
  writeGuardHook(path.join(configDir, 'hooks'));
  const logFile = path.join(configDir, 'blocked.jsonl');
  const slash = p => String(p).replace(/\\/g, '/');
  const policy = { workspace: slash(cwd), home: slash(os.homedir()), tmp: [slash(os.tmpdir())] };
  return {
    args: ['--config', configDir, '--data-dir', dataDir],
    env: { HOST_AGENT_ROUTER_GUARD: JSON.stringify(policy), HOST_AGENT_ROUTER_GUARD_LOG: logFile },
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

async function cmdRun(opts, cfg) {
  const depth = Number(process.env.HOST_AGENT_ROUTER_DEPTH || 0);
  if (depth >= Number(cfg.maxDepth ?? 1)) {
    print({ ok: false, error: 'refusing to route from inside a routed worker (HOST_AGENT_ROUTER_DEPTH is set)' });
    return 3;
  }
  const tier = opts.tier;
  if (!TIERS.includes(tier)) throw new Error(`--tier must be one of ${TIERS.join(', ')}`);
  const access = opts.access ?? cfg.defaultAccess ?? 'read-only';
  if (!ACCESS.includes(access)) throw new Error(`--access must be one of ${ACCESS.join(', ')} (there is no full-access mode)`);
  const prompt = readPrompt(opts);
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const only = opts['pin-host'] ? [opts['pin-host']] : undefined;
  const allowCmd = opts['allow-cmd'] ?? [];
  const badCmd = validateAllowCmd(allowCmd);
  if (badCmd.length) throw new Error(badCmd.join('\n'));
  const { here, statuses } = await gather(cfg, opts, tier, only);
  const plan = buildPlan(cfg, tier, statuses, here, only, access);
  const cands = plan.candidates.filter(c => !opts['pin-side'] || c.side === opts['pin-side']);
  const specFor = (c, text, tcwd) => buildSpec(cfg, c.host, cfg.hosts[c.host].tiers[tier], text, access, tcwd, tier, { allowCmd });

  if (opts['dry-run']) {
    const would_try = cands.map(c => {
      const tcwd = translateCwd(cwd, here, c.side);
      const spec = specFor(c, '<prompt>', tcwd);
      return { ...c, cwd: tcwd, args: spec.args.map(a => (a.length < 120 ? a : `${a.slice(0, 117)}...`)), prompt_via: spec.stdin ? 'stdin' : 'argv' };
    });
    print({ dry_run: true, access, plan, would_try });
    return cands.length ? 0 : 2;
  }

  const tryOne = async c => {
    const tcwd = translateCwd(cwd, here, c.side);
    if (tcwd == null) return { skipped: `working directory ${cwd} is not reachable from ${c.side}` };
    const spec = specFor(c, prompt, tcwd);
    const payload = { host: c.host, args: spec.args, stdin: spec.stdin, env: spec.env, cwd: tcwd, timeout: timeoutFor(cfg, tier, opts.timeout) };
    try {
      return await callSide(cfg, here, c.side, 'local-exec', payload, payload.timeout * 1000 + 60_000);
    } catch (e) {
      return { rc: 126, stdout: '', stderr: `${e?.name}: ${e?.message}`, seconds: 0 };
    }
  };
  const { attempts, last, stopped, changed } = await runAttempts({ cands, access, cwd, tryOne });
  const verdict = last ? judgeRun(last[0].host, last[1]) : { ok: false, problem: null };
  const ok = verdict.ok;
  const env = { ok, tier, access, attempts, skipped: plan.skipped };
  // A run the guard stopped, or that Cline did not complete, exited 0 but is not a success; say why, and never hand it to another host.
  if (verdict.problem) env.failure = verdict.problem;
  if (verdict.finish_reason) env.finish_reason = verdict.finish_reason;
  if (last?.[1].blocked?.length) env.guard = { blocked: last[1].blocked };
  // What the router saw change in the working directory, independent of what the worker's report claims.
  if (changed) env.changed = capChange(changed);
  if (stopped) env.stopped = stopped;
  for (const a of attempts) if (a.changed) a.changed = capChange(a.changed);
  if (last) {
    const [c, res] = last;
    env.ran = { host: c.host, side: c.side, model: c.model, effort: c.effort, label: c.label };
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
  const wanted = Object.fromEntries(cfg.priority.map(h => [h, TIERS.map(t => cfg.hosts[h].tiers[t].model)]));
  const out = {};
  for (const side of discoverSides(here, cfg)) {
    try { out[side] = await callSide(cfg, here, side, 'local-models', { models: wanted }); } catch (e) { out[side] = { error: e.message }; }
  }
  print(out);
  return 0;
}

const USAGE = `host-agent-router: route a task to the best agent CLI and side, then run it headlessly.

Commands:
  status [--tier T] [--host H...] [--json]   table of every host x side with 5-hour / weekly headroom
  plan   [--tier T] [--host H...]            the routing decision as JSON (starts no model)
  run    --tier T (--prompt S | --prompt-file F | stdin) [--access read-only|edit] [--cwd D]
         [--timeout SEC] [--allow-cmd PREFIX ...] [--pin-host H] [--pin-side S] [--dry-run]
         --timeout defaults per tier (config timeoutSeconds); --allow-cmd adds a command prefix the worker may run (its acceptance command).
  models                                     check configured model names against each host's own list

Tiers: simple, medium, high.   Hosts: cline, antigravity, codex, claude.   Access defaults to read-only.
Replay aids: --here windows|wsl|local, --statuses-file FILE (use captured statuses instead of probing).
Config: assets/config.default.json, overridden by ~/.agents/host-agent-router/config.json or $HOST_AGENT_ROUTER_CONFIG.
Exit codes: 0 ok, 1 the run failed, 2 no usable host/side, 3 refused (inside a routed worker).
`;

const OPTIONS = {
  tier: { type: 'string' }, host: { type: 'string', multiple: true }, json: { type: 'boolean' }, here: { type: 'string' },
  'statuses-file': { type: 'string' }, prompt: { type: 'string' }, 'prompt-file': { type: 'string' }, access: { type: 'string' },
  cwd: { type: 'string' }, timeout: { type: 'string' }, 'allow-cmd': { type: 'string', multiple: true }, 'pin-host': { type: 'string' }, 'pin-side': { type: 'string' },
  'dry-run': { type: 'boolean' }, payload: { type: 'string' }, help: { type: 'boolean', short: 'h' },
};

export async function main(argv) {
  const { values: opts, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  const cmd = positionals[0];
  if (!cmd || opts.help) { process.stdout.write(USAGE); return 0; }
  if (cmd in LOCAL) { // internal re-entry used for the other side: one JSON line, no pretty printing
    process.stdout.write(`${JSON.stringify(await LOCAL[cmd](JSON.parse(fs.readFileSync(opts.payload, 'utf8'))))}\n`);
    return 0;
  }
  const handler = { status: cmdStatus, plan: cmdPlan, run: cmdRun, models: cmdModels }[cmd];
  if (!handler) { process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`); return 64; }
  const SIDES = ['windows', 'wsl', 'local'];
  const oneOf = (flag, value, allowed, note = '') => {
    if (value !== undefined && !allowed.includes(value)) throw new Error(`${flag} must be one of ${allowed.join(', ')}${note}`);
  };
  oneOf('--tier', opts.tier, TIERS);
  for (const h of opts.host ?? []) oneOf('--host', h, HOSTS);
  oneOf('--pin-host', opts['pin-host'], HOSTS);
  oneOf('--pin-side', opts['pin-side'], SIDES);
  oneOf('--here', opts.here, SIDES);
  oneOf('--access', opts.access, ACCESS, ' (there is no full-access mode)');
  return handler(opts, loadConfig());
}

let invokedDirectly = false;
try { invokedDirectly = Boolean(process.argv[1]) && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url; } catch { /* imported */ }
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    code => { process.exitCode = code; },
    e => { process.stderr.write(`${e?.message ?? e}\n`); process.exitCode = 1; },
  );
}
