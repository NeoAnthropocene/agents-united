/**
 * Plan 032 Phases 7 and 8 — the native-package install lane. A host's committed native files live under
 * `registry/hosts/<host>/` (ADR 0025 decisions 1 and 3): agents, workflows, and for Cline also rules, skills and a plugin.
 * Install copies one verbatim behind the managed marker. Pure and deterministic: no LLM, no clock, line endings normalised
 * so the bytes (and the hash the lockfile records) are the same on every OS.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** The hosts that have a native-package lane. The flag is recorded per host (ADR 0026 decision 6). */
export type NativeHost = 'claude' | 'cline' | 'antigravity';

/** Marker profile of the Claude lane; the legacy projection lane writes `profile: claude`. */
export const NATIVE_MARKER_PROFILE = 'claude-native';

/** Marker profile per host, as `-native` beside the legacy `profile: <host>`. */
export const NATIVE_MARKER_PROFILES: Record<NativeHost, string> = { claude: NATIVE_MARKER_PROFILE, cline: 'cline-native', antigravity: 'antigravity-native' };

const ROLE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** The file extension of a host's agent files and workflow files. */
const AGENT_EXT: Record<string, string> = { claude: '.md', cline: '.yml' };
const WORKFLOW_EXT: Record<string, string> = { claude: '.js', cline: '.md' };

const hostDir = (registryDir: string, host: string, kind: string): string => path.join(registryDir, 'hosts', host, kind);
const profileOf = (host: string): string => NATIVE_MARKER_PROFILES[host as NativeHost] ?? `${host}-native`;

/** Sorted stems of the files of one kind that a host ships, `[]` when the host or the folder does not exist. */
function listStems(registryDir: string, host: string, kind: string, ext: string): string[] {
  const dir = hostDir(registryDir, host, kind);
  if (!ROLE_NAME.test(host) || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith(ext) && ROLE_NAME.test(name.slice(0, -ext.length)))
    .map(name => name.slice(0, -ext.length))
    .sort();
}

function sourceOf(registryDir: string, host: string, kind: string, name: string, ext: string): string | undefined {
  if (!ROLE_NAME.test(name) || !ROLE_NAME.test(host)) return undefined;
  const file = path.join(hostDir(registryDir, host, kind), `${name}${ext}`);
  return fs.existsSync(file) ? file : undefined;
}

const normalise = (text: string): string => text.replace(/\r\n/g, '\n');
const sha = (text: string): string => crypto.createHash('sha256').update(text).digest('hex');
const posix = (rel: string): string => rel.replace(/\\/g, '/');
const markerText = (host: string, canonicalRelPath: string, source: string): string =>
  `managed-by: agents-united | profile: ${profileOf(host)} | canonical: ${posix(canonicalRelPath)} | source: sha256:${sha(source)} | do not edit`;

/** A file with YAML frontmatter: the marker becomes the first body line. */
function renderFramed(sourceText: string, canonicalRelPath: string, host: string, what: string): string {
  const source = normalise(sourceText);
  const match = FRONTMATTER.exec(source);
  if (!match) throw new Error(`Native package error: ${canonicalRelPath} has no YAML frontmatter (a native ${what} needs it).`);
  const body = match[2].replace(/^\n+/, '').replace(/\n*$/, '\n');
  return `---\n${match[1]}\n---\n<!-- ${markerText(host, canonicalRelPath, source)} -->\n\n${body}`;
}

/** Code: the script is kept as written and the marker is the LAST line, a comment the parser ignores (a workflow must begin with `export const meta`). */
function renderTrailingMarker(sourceText: string, canonicalRelPath: string, host: string): string {
  const source = normalise(sourceText).replace(/\n*$/, '\n');
  return `${source}// ${markerText(host, canonicalRelPath, source)}\n`;
}

// ── Roles: `registry/hosts/<host>/agents/<role>.<ext>` ───────────────────────────────────────────────────────────────

/** Role names (file stems) with a committed native agent for `host`, sorted. Empty when the host has none. */
export function listNativeRoles(registryDir: string, host: string): string[] {
  return listStems(registryDir, host, 'agents', AGENT_EXT[host] ?? '.md');
}

/** Absolute path of the native agent for a (prefix-stripped) role name, or `undefined` when the role is legacy-only. */
export function nativeRoleSource(registryDir: string, host: string, roleName: string): string | undefined {
  return sourceOf(registryDir, host, 'agents', roleName, AGENT_EXT[host] ?? '.md');
}

/**
 * The installed bytes: the authored file with the managed marker as the first body line, which carries the canonical
 * asset it stands for and the hash of the (LF-normalised) source, so a stale install is a plain hash compare.
 */
export function renderNativeRole(sourceText: string, canonicalRelPath: string, host: NativeHost | string = 'claude'): string {
  return renderFramed(sourceText, canonicalRelPath, host, 'role');
}

// ── Workflows: `registry/hosts/<host>/workflows/<name>.<ext>` ────────────────────────────────────────────────────────
// A host workflow replaces the skill of the same name for that host: both want the slash command `/<name>`, and a workflow
// is the host's own form of a fan-out runbook. Claude's is a script (`.js`), Cline's a markdown command (`.md`).

/** Names (file stems) with a committed native workflow for `host`, sorted. Empty when the host has none. */
export function listNativeWorkflows(registryDir: string, host: string): string[] {
  return listStems(registryDir, host, 'workflows', WORKFLOW_EXT[host] ?? '.js');
}

/** Absolute path of the native workflow named `name`, or `undefined` when the host has none by that name. */
export function nativeWorkflowSource(registryDir: string, host: string, name: string): string | undefined {
  return sourceOf(registryDir, host, 'workflows', name, WORKFLOW_EXT[host] ?? '.js');
}

/** The installed bytes of a workflow: a script gets the marker as its LAST line, a markdown command as its first body line. */
export function renderNativeWorkflow(sourceText: string, canonicalRelPath: string, host: NativeHost | string = 'claude'): string {
  return WORKFLOW_EXT[host] === '.md' ? renderFramed(sourceText, canonicalRelPath, host, 'workflow') : renderTrailingMarker(sourceText, canonicalRelPath, host);
}

// ── Rules, skills and plugins (Cline, Phase 8): native-only files with no canonical asset ────────────────────────────

/** Names of the committed native rules for `host` (`registry/hosts/<host>/rules/<name>.md`), sorted. */
export function listNativeRules(registryDir: string, host: string): string[] {
  return listStems(registryDir, host, 'rules', '.md');
}

export function nativeRuleSource(registryDir: string, host: string, name: string): string | undefined {
  return sourceOf(registryDir, host, 'rules', name, '.md');
}

/**
 * A Cline rule has no frontmatter (so it is always active), so the marker goes above its title. An Antigravity rule must START with
 * frontmatter (the host discards a rule that does not), so a source that has frontmatter keeps it first and the marker follows it.
 */
export function renderNativeRule(sourceText: string, canonicalRelPath: string, host: NativeHost | string = 'cline'): string {
  const source = normalise(sourceText);
  if (FRONTMATTER.test(source)) return renderFramed(sourceText, canonicalRelPath, host, 'rule');
  const body = source.replace(/^\n+/, '').replace(/\n*$/, '\n');
  return `<!-- ${markerText(host, canonicalRelPath, source)} -->\n\n${body}`;
}

/** Names of the committed native skills for `host` (`registry/hosts/<host>/skills/<name>/SKILL.md`), sorted. */
export function listNativeSkills(registryDir: string, host: string): string[] {
  const dir = hostDir(registryDir, host, 'skills');
  if (!ROLE_NAME.test(host) || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && ROLE_NAME.test(entry.name) && fs.existsSync(path.join(dir, entry.name, 'SKILL.md')))
    .map(entry => entry.name)
    .sort();
}

/** Absolute path of the native skill's `SKILL.md`, or `undefined`. */
export function nativeSkillSource(registryDir: string, host: string, name: string): string | undefined {
  if (!ROLE_NAME.test(name) || !ROLE_NAME.test(host)) return undefined;
  const file = path.join(hostDir(registryDir, host, 'skills'), name, 'SKILL.md');
  return fs.existsSync(file) ? file : undefined;
}

export function renderNativeSkill(sourceText: string, canonicalRelPath: string, host: NativeHost | string = 'cline'): string {
  return renderFramed(sourceText, canonicalRelPath, host, 'skill');
}

/** Names of the committed native plugins for `host` (`registry/hosts/<host>/plugins/<name>.js`), sorted. */
export function listNativePlugins(registryDir: string, host: string): string[] {
  return listStems(registryDir, host, 'plugins', '.js');
}

export function nativePluginSource(registryDir: string, host: string, name: string): string | undefined {
  return sourceOf(registryDir, host, 'plugins', name, '.js');
}

/** A plugin is code the host executes, so it is copied unchanged and the marker is a trailing comment. */
export function renderNativePlugin(sourceText: string, canonicalRelPath: string, host: NativeHost | string = 'cline'): string {
  return renderTrailingMarker(sourceText, canonicalRelPath, host);
}
