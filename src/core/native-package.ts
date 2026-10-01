/**
 * Plan 032 Phase 7 — the native-package install lane. A host's committed native agents live in
 * `registry/hosts/<host>/agents/<role>.md` (ADR 0025 decisions 1 and 3); install copies one verbatim behind the
 * managed marker. Pure and deterministic: no LLM, no clock, line endings normalised so the bytes (and the hash the
 * lockfile records) are the same on every OS.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Marker profile of this lane; the legacy projection lane writes `profile: claude`. */
export const NATIVE_MARKER_PROFILE = 'claude-native';

const ROLE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const agentsDirOf = (registryDir: string, host: string): string => path.join(registryDir, 'hosts', host, 'agents');

/** Role names (file stems) with a committed native agent for `host`, sorted. Empty when the host has none. */
export function listNativeRoles(registryDir: string, host: string): string[] {
  const dir = agentsDirOf(registryDir, host);
  if (!ROLE_NAME.test(host) || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.md') && ROLE_NAME.test(name.slice(0, -3)))
    .map(name => name.slice(0, -3))
    .sort();
}

/** Absolute path of the native agent for a (prefix-stripped) role name, or `undefined` when the role is legacy-only. */
export function nativeRoleSource(registryDir: string, host: string, roleName: string): string | undefined {
  if (!ROLE_NAME.test(roleName) || !ROLE_NAME.test(host)) return undefined;
  const file = path.join(agentsDirOf(registryDir, host), `${roleName}.md`);
  return fs.existsSync(file) ? file : undefined;
}

/**
 * The installed bytes: the authored file with the managed marker as the first body line, which carries the canonical
 * asset it stands for and the hash of the (LF-normalised) source, so a stale install is a plain hash compare.
 */
export function renderNativeRole(sourceText: string, canonicalRelPath: string): string {
  const source = sourceText.replace(/\r\n/g, '\n');
  const match = FRONTMATTER.exec(source);
  if (!match) throw new Error(`Native package error: ${canonicalRelPath} has no YAML frontmatter.`);
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const canonical = canonicalRelPath.replace(/\\/g, '/');
  const marker = `<!-- managed-by: agents-united | profile: ${NATIVE_MARKER_PROFILE} | canonical: ${canonical} | source: sha256:${hash} | do not edit -->`;
  const body = match[2].replace(/^\n+/, '').replace(/\n*$/, '\n');
  return `---\n${match[1]}\n---\n${marker}\n\n${body}`;
}

// ── Native workflows (Plan 032 Phase 7): `registry/hosts/<host>/workflows/<name>.js` ─────────────────────────────────
// A host workflow replaces the skill of the same name for that host: both want the slash command `/<name>`, and a workflow
// is the host's own form of a fan-out runbook. Install writes the script to the host's workflows folder.

const workflowsDirOf = (registryDir: string, host: string): string => path.join(registryDir, 'hosts', host, 'workflows');

/** Names (file stems) with a committed native workflow for `host`, sorted. Empty when the host has none. */
export function listNativeWorkflows(registryDir: string, host: string): string[] {
  const dir = workflowsDirOf(registryDir, host);
  if (!ROLE_NAME.test(host) || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.js') && ROLE_NAME.test(name.slice(0, -3)))
    .map(name => name.slice(0, -3))
    .sort();
}

/** Absolute path of the native workflow named `name`, or `undefined` when the host has none by that name. */
export function nativeWorkflowSource(registryDir: string, host: string, name: string): string | undefined {
  if (!ROLE_NAME.test(name) || !ROLE_NAME.test(host)) return undefined;
  const file = path.join(workflowsDirOf(registryDir, host), `${name}.js`);
  return fs.existsSync(file) ? file : undefined;
}

/**
 * The installed bytes of a workflow: the authored script, LF-normalised, with the managed marker as the LAST line. A
 * workflow must begin with `export const meta`, so the marker (a line comment, ignored by the parser) goes after the code.
 */
export function renderNativeWorkflow(sourceText: string, canonicalRelPath: string): string {
  const source = sourceText.replace(/\r\n/g, '\n').replace(/\n*$/, '\n');
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const canonical = canonicalRelPath.replace(/\\/g, '/');
  return `${source}// managed-by: agents-united | profile: ${NATIVE_MARKER_PROFILE} | canonical: ${canonical} | source: sha256:${hash} | do not edit\n`;
}
