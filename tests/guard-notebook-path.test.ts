import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';
import { EARLIER_GUARD_SCRIPTS, GUARD_SCRIPT } from '../src/core/guard.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { EARLIER_SESSION_SCRIPTS, sessionGuardScript } from '../src/core/session-guard.js';

/**
 * NotebookEdit sends its target as `notebook_path`, not `file_path`. The one script template reads the path from `file_path`, else
 * `notebook_path`, so the role guards, the session guard and the generated hook file all block a NotebookEdit to a protected path.
 * The Antigravity and Cline guards are separate files and are not touched here. Offline: the scripts are run with node and a crafted stdin.
 */

const sha = (text: string): string => crypto.createHash('sha256').update(text).digest('hex');
const HOOK_FILE = fs.readFileSync(path.resolve('registry/hosts/claude/hooks/agents-united-guard.js'), 'utf8').trimEnd();

const scripts: Array<[string, string]> = [
  ['the role script (GUARD_SCRIPT)', GUARD_SCRIPT],
  ['the generated hook file', HOOK_FILE],
  ['the session script (project)', sessionGuardScript('project')],
  ['the session script (user)', sessionGuardScript('user')],
];

const fire = (script: string, tool_name: string, tool_input: Record<string, unknown>): number | null =>
  spawnSync(process.execPath, ['-e', script], { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' }).status;

describe.each(scripts)('%s', (_name, script) => {
  it.each([
    ['C:\\repo\\.env'],
    ['/repo/.env'],
    ['C:\\repo\\notebooks\\.env.local'],
  ])('blocks a NotebookEdit to the protected path %s (exit 2)', notebook_path => {
    expect(fire(script, 'NotebookEdit', { notebook_path, new_source: 'x' })).toBe(2);
  });

  it('allows a NotebookEdit to a harmless path and to .env.example', () => {
    expect(fire(script, 'NotebookEdit', { notebook_path: 'C:\\repo\\analysis.ipynb', new_source: 'x' })).toBe(0);
    expect(fire(script, 'NotebookEdit', { notebook_path: '/repo/.env.example', new_source: 'x' })).toBe(0);
  });

  it('still reads file_path for Write, Edit and MultiEdit, and prefers it over notebook_path', () => {
    for (const tool of ['Write', 'Edit', 'MultiEdit']) {
      expect(fire(script, tool, { file_path: '/repo/.env' }), tool).toBe(2);
      expect(fire(script, tool, { file_path: '/repo/a.ts' }), tool).toBe(0);
    }
    expect(fire(script, 'NotebookEdit', { file_path: '/repo/a.ipynb', notebook_path: '/repo/.env' })).toBe(0);
  });

  it('keeps the count of regex literals at 4', () => {
    expect([...script.matchAll(/\/((?:\\.|[^/\\\n])+)\/\.test\(/g)]).toHaveLength(4);
  });
});

describe('the previous script is an earlier form', () => {
  it('is in the one list of earlier scripts, byte for byte, and native roles carrying it are still seen as guarded', () => {
    expect(EARLIER_GUARD_SCRIPTS).toHaveLength(2);
    expect(sha(EARLIER_GUARD_SCRIPTS[1])).toBe('fece8789f7fdbde03730130f0b04753ac291fd82d22b04d65fa6b56fc2749222');
    expect(GUARD_SCRIPT).not.toBe(EARLIER_GUARD_SCRIPTS[1]);
    const role = `---\nname: x\ntools: Bash, Edit\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks:\n        - type: command\n          command: node\n          args: ["-e", ${JSON.stringify(EARLIER_GUARD_SCRIPTS[1])}]\n---\nbody\n`;
    expect(inspectNativeAgent(role).guard).toBe('destructive');
  });

  it('keeps the session scripts of the version before as earlier forms, byte for byte (project, user, user-project)', () => {
    expect(EARLIER_SESSION_SCRIPTS.map(sha)).toEqual([
      '6ca2aa40dfc6ce4b231eecd5df36d31ee50b806e9def86104dcd70e3ed6941de',
      '1a916c9a8736870cd9ffea6c118976544a23df9d171e5c2b62e43a4994617bdc',
      '10dd8b0aa4abe50ac989e7f3d80ba9f962215a701cfe2fd68e06424981087d06',
      // The two INLINE session texts (project, user) that were current when the script moved into a file: their manual route named "the hook entries that contain 'agents-united guard'".
      '34943bfe56ac650384b48dcc921cf65070da492f7a7d3dba5f841140986dae3d',
      '02a978b2ed9e7a92f60fe7284dd272db0a8f1ca17ea267e51d39f4a6621acd3a',
    ]);
  });
});
