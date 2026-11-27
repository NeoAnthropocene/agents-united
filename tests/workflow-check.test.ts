/**
 * `agents workflow-check` (ADR 0082, "What `workflow-check` checks"): the read-only deterministic QA of one native Claude
 * workflow script, `registry/hosts/claude/workflows/<name>.js`.
 *
 * Tier 1 happy path, Tier 2 every finding code and its boundary, Tier 3 the built public CLI and the README row, Tier 4 every
 * committed workflow in `registry/hosts/claude/workflows/`. The agreement with the Claude projector is in
 * `workflow-check-projection.test.ts`. The CLI tests need `npm run build` first.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runWorkflowCheck, workflowCheckExitCode, workflowCheckUsageResult, workflowNameProblem, WORKFLOW_CHECK_MAX_BYTES,
} from '../src/core/workflow-check.js';
import { lintWorkflow } from '../src/core/workflow-lint.js';
import { listNativeWorkflows, renderNativeWorkflow } from '../src/core/native-package.js';
import { MARKER_PREFIX } from '../src/core/claude-projector.js';
import type { WorkflowCheckResult } from '../src/core/types.js';

// A pass-through spy on the renderer, so one test can make it misbehave (it is pure and cannot do so with a real input).
vi.mock('../src/core/native-package.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/core/native-package.js')>();
  return { ...actual, renderNativeWorkflow: vi.fn(actual.renderNativeWorkflow) };
});

const CHECK_IDS = ['name', 'size', 'encoding', 'placement', 'lint', 'meta-name', 'skill-pair', 'agent-types', 'render'];
const LATER_THAN_PLACEMENT = ['skill-pair', 'agent-types', 'render'];
const checkout = process.cwd();
const cli = path.resolve(checkout, 'dist/cli.js');
const REAL_REGISTRY = path.resolve(checkout, 'registry');
const REAL_WORKFLOWS = path.join(REAL_REGISTRY, 'hosts', 'claude', 'workflows');

const GOOD = `export const meta = {
  name: 'demo-flow',
  description: 'A demo workflow.',
  phases: [{ title: 'Find', detail: 'look' }, { title: 'Check' }],
}

phase('Find')
const found = await agent('look', { schema: { type: 'object', properties: {} }, agentType: 'code-reviewer' })
const checked = await pipeline([1, 2], n => agent('check ' + n, { phase: 'Check' }))
return { found, checked: checked.filter(Boolean), when: args && args.when }
`;

const toCrlf = (text: string): string => text.replace(/\r?\n/g, '\r\n');
const codesOf = (result: WorkflowCheckResult): string[] => [...new Set(result.findings.map(item => item.code))].sort();
const checkOf = (result: WorkflowCheckResult, id: string) => result.checks.find(check => check.id === id);
const statusesOf = (result: WorkflowCheckResult): Record<string, string> => Object.fromEntries(result.checks.map(check => [check.id, check.status]));
/** A good script grown with a trailing comment to exactly `bytes` bytes (ASCII). */
function scriptOfBytes(bytes: number): string {
  const head = `${GOOD}// `;
  return head + 'x'.repeat(bytes - Buffer.byteLength(head));
}

describe('workflow-check', () => {
  const folders: string[] = [];
  afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });

  interface Options {
    /** The file name and bytes of the workflow under test; default `demo-flow.js` with the good script. */
    name?: string;
    content?: string | Buffer;
    /** Skill folders that hold a SKILL.md; default `['demo-flow']`. */
    skills?: string[];
    /** Native Claude agent files (`<name>.md`); default `['code-reviewer']`. */
    agents?: string[];
  }
  interface Fixture { registry: string; file: string }

  /** A temporary registry laid out like `registry/`, and the absolute path of the workflow under test. */
  function fixture(options: Options = {}): Fixture {
    const registry = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-workflow-check-')));
    folders.push(registry);
    const workflows = path.join(registry, 'hosts', 'claude', 'workflows');
    fs.mkdirSync(workflows, { recursive: true });
    fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'agents'), { recursive: true });
    for (const skill of options.skills ?? ['demo-flow']) {
      fs.mkdirSync(path.join(registry, 'skills', skill), { recursive: true });
      fs.writeFileSync(path.join(registry, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: A skill.\n---\n# ${skill}\n`);
    }
    for (const agent of options.agents ?? ['code-reviewer']) {
      fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'agents', `${agent}.md`), `---\nname: ${agent}\ndescription: An agent.\n---\nBody.\n`);
    }
    const file = path.join(workflows, options.name ?? 'demo-flow.js');
    fs.writeFileSync(file, options.content ?? GOOD);
    return { registry, file };
  }
  const check = (options: Options = {}): WorkflowCheckResult => runWorkflowCheck({ artifact: fixture(options).file });

  // -------------------------------------------------------------------------------------------
  // Tier 1: feature coverage
  // -------------------------------------------------------------------------------------------
  describe('Tier 1: happy path', () => {
    it('passes a good workflow in a registry and reports every check as passed', () => {
      const { file } = fixture();
      const result = runWorkflowCheck({ artifact: file });
      expect(result.status).toBe('passed');
      expect(result.findings).toEqual([]);
      expect(result.version).toBe(1);
      expect(result.kind).toBe('deterministic');
      expect(result.artifact).toBe(file);
      expect(result.bytes).toBe(Buffer.byteLength(GOOD));
      expect(result.maxBytes).toBe(WORKFLOW_CHECK_MAX_BYTES);
      expect(result.checks.map(item => item.id)).toEqual(CHECK_IDS);
      expect(result.checks.every(item => item.status === 'passed' && item.findings.length === 0 && item.reason === null)).toBe(true);
      expect(result.quality).toBe('pending');
      expect(result.live).toBe('unverified');
      expect(workflowCheckExitCode(result)).toBe(0);
    });

    it('sets the size cap at 128 KiB, far above the committed workflows', () => {
      expect(WORKFLOW_CHECK_MAX_BYTES).toBe(128 * 1024);
    });

    it('maps status to the exit codes 0, 1 and 2', () => {
      expect(workflowCheckExitCode(check())).toBe(0);
      expect(workflowCheckExitCode(check({ content: 'const x = 1\n' }))).toBe(1);
      expect(workflowCheckExitCode(runWorkflowCheck({}))).toBe(2);
    });

    it('builds a usage result that echoes the artifact and runs no check', () => {
      const result = workflowCheckUsageResult(['Unknown option --nope.'], { artifact: '/some/flow.js' });
      expect(result.status).toBe('unavailable');
      expect(result.artifact).toBe('/some/flow.js');
      expect(result.bytes).toBeNull();
      expect(result.findings).toEqual([{ code: 'USAGE', path: null, message: 'Unknown option --nope.' }]);
      expect(result.checks.map(item => item.id)).toEqual(CHECK_IDS);
      expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
      expect(workflowCheckExitCode(result)).toBe(2);
    });

    it('never changes the file or the registry it reads', () => {
      const { registry, file } = fixture();
      const listing = (): string[] => fs.readdirSync(registry, { recursive: true }).map(String).sort();
      const before = fs.readFileSync(file);
      const mtime = fs.statSync(file).mtimeMs;
      const tree = listing();
      runWorkflowCheck({ artifact: file });
      expect(fs.readFileSync(file).equals(before)).toBe(true);
      expect(fs.statSync(file).mtimeMs).toBe(mtime);
      expect(listing()).toEqual(tree);
    });

    it('parses the script and never runs it', () => {
      const probe = '__workflowCheckRan';
      const script = `${GOOD}globalThis.${probe} = true\nprocess.exit(7)\n`;
      const result = check({ content: script });
      expect(result.status).toBe('passed');
      expect((globalThis as Record<string, unknown>)[probe]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------------------------
  // Tier 2: boundaries and negative cases
  // -------------------------------------------------------------------------------------------
  describe('Tier 2: usage and unavailable input (exit 2)', () => {
    it('reports USAGE when --artifact is missing or empty', () => {
      for (const input of [{}, { artifact: '' }, { artifact: undefined }]) {
        const result = runWorkflowCheck(input);
        expect(result.status).toBe('unavailable');
        expect(codesOf(result)).toEqual(['USAGE']);
        expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
      }
    });

    it('reports USAGE for a relative path', () => {
      const result = runWorkflowCheck({ artifact: path.join('registry', 'hosts', 'claude', 'workflows', 'demo-flow.js') });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['USAGE']);
      expect(result.findings[0]?.message).toMatch(/absolute/i);
    });

    it('reports INPUT_UNAVAILABLE for a missing file, with the path', () => {
      const { file } = fixture();
      const missing = path.join(path.dirname(file), 'missing-flow.js');
      const result = runWorkflowCheck({ artifact: missing });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
      expect(result.findings[0]?.path).toBe(missing);
      expect(result.bytes).toBeNull();
      expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
    });

    it('reports INPUT_UNAVAILABLE for a directory, even one named like a workflow', () => {
      const { file } = fixture();
      const dir = path.join(path.dirname(file), 'a-flow.js');
      fs.mkdirSync(dir);
      const result = runWorkflowCheck({ artifact: dir });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
    });

    it('reports INPUT_UNAVAILABLE for a path that ends in a separator', () => {
      const { file } = fixture();
      const result = runWorkflowCheck({ artifact: `${file}${path.sep}` });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
    });

    it('refuses a symbolic link, even one that points at a good workflow', (context) => {
      const { file } = fixture();
      const link = path.join(path.dirname(file), 'linked-flow.js');
      try {
        fs.symlinkSync(file, link);
      } catch {
        context.skip();
        return;
      }
      const result = runWorkflowCheck({ artifact: link });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
      expect(result.findings[0]?.message).toMatch(/link/i);
      expect(workflowCheckExitCode(result)).toBe(2);
    });

    it('is unavailable (exit 2), not passed, when the renderer throws', () => {
      vi.mocked(renderNativeWorkflow).mockImplementationOnce(() => { throw new Error('renderer broke'); });
      const result = check();
      expect(result.status).toBe('unavailable');
      expect(workflowCheckExitCode(result)).toBe(2);
      expect(result.findings.some(item => item.code === 'INPUT_UNAVAILABLE')).toBe(true);
    });
  });

  describe('Tier 2: NAME', () => {
    it('accepts lower-case kebab-case names, digits included', () => {
      for (const name of ['a.js', 'flow-1.js', 'a-b-c.js', '2fa-flow.js']) {
        const result = check({ name, skills: [name.slice(0, -3)] });
        expect(checkOf(result, 'name')?.status, name).toBe('passed');
      }
    });

    it('fails names that are not lower-case kebab-case .js, and says which file name', () => {
      for (const name of ['Bad_Name.js', 'Demo-Flow.js', 'demo.mjs', 'demo', '-demo.js', 'demo-.js', 'a--b.js', 'a b.js', 'demo.JS', 'a.b.js', 'demo.js.md']) {
        const result = check({ name, skills: [] });
        expect(result.status, name).toBe('failed');
        expect(codesOf(result), name).toContain('NAME');
        expect(checkOf(result, 'name')?.status, name).toBe('failed');
        expect(result.findings.find(item => item.code === 'NAME')?.path, name).toBe(result.artifact);
      }
    });

    it('refuses every Windows reserved device name, with or without an extension, in any case (the pure rule, on every host)', () => {
      const devices = ['con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)];
      for (const device of devices) {
        for (const name of [`${device}.js`, `${device.toUpperCase()}.js`, `${device}.txt`, device]) {
          expect(workflowNameProblem(name), name).toMatch(/reserved/i);
        }
      }
      for (const name of ['demo-flow.js', 'console.js', 'com10.js', 'lpt0.js', 'conn.js', 'a-con.js', 'aux-flow.js']) expect(workflowNameProblem(name), name).toBeNull();
    });

    it('does not look for a skill pair of a name the native package never lists', () => {
      const result = check({ name: 'Bad_Name.js', skills: [] });
      expect(checkOf(result, 'skill-pair')?.status).toBe('not-run');
      expect(codesOf(result)).not.toContain('SKILL_PAIR');
    });
  });

  describe('Tier 2: SIZE and ENCODING', () => {
    it('passes a file of exactly the size cap and fails one byte more', () => {
      const atCap = scriptOfBytes(WORKFLOW_CHECK_MAX_BYTES);
      expect(Buffer.byteLength(atCap)).toBe(WORKFLOW_CHECK_MAX_BYTES);
      expect(check({ content: atCap }).status).toBe('passed');
      const over = check({ content: `${atCap}x` });
      expect(over.status).toBe('failed');
      expect(codesOf(over)).toEqual(['SIZE']);
      expect(checkOf(over, 'size')?.status).toBe('failed');
    });

    it('does not read an oversize file, runs no later check, and says so', () => {
      const result = check({ content: scriptOfBytes(WORKFLOW_CHECK_MAX_BYTES + 10) });
      expect(result.bytes).toBeNull();
      for (const id of CHECK_IDS.slice(2)) {
        expect(checkOf(result, id)?.status, id).toBe('not-run');
        expect(checkOf(result, id)?.reason, id).toMatch(/not read/i);
      }
      expect(checkOf(result, 'name')?.status).toBe('passed');
    });

    it('fails a byte order mark', () => {
      const result = check({ content: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(GOOD)]) });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['ENCODING']);
      expect(result.findings[0]?.message).toMatch(/BOM|byte order/i);
    });

    it('fails a NUL byte', () => {
      const result = check({ content: `${GOOD}// a${String.fromCharCode(0)}b\n` });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toContain('ENCODING');
      expect(result.findings.find(item => item.code === 'ENCODING')?.message).toMatch(/NUL/);
    });

    it('fails invalid UTF-8', () => {
      const result = check({ content: Buffer.concat([Buffer.from(`${GOOD}// bad `), Buffer.from([0xc3, 0x28]), Buffer.from('\n')]) });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['ENCODING']);
      expect(result.findings[0]?.message).toMatch(/UTF-8/);
    });

    it('accepts valid multi-byte UTF-8 text', () => {
      const umlaut = String.fromCharCode(0xfc);
      expect(check({ content: `${GOOD}// Gr${umlaut}${umlaut}e, ${String.fromCharCode(0x65e5, 0x672c)}\n` }).status).toBe('passed');
    });

    it('treats CRLF like LF in every check and in the result', () => {
      const lf = check();
      const crlf = check({ content: toCrlf(GOOD) });
      expect(crlf.status).toBe('passed');
      expect(crlf.findings).toEqual([]);
      expect(statusesOf(crlf)).toEqual(statusesOf(lf));
      expect(crlf.bytes).toBe(Buffer.byteLength(toCrlf(GOOD)));
    });
  });

  describe('Tier 2: PLACEMENT', () => {
    function placedAt(...segments: string[]): WorkflowCheckResult {
      const { registry } = fixture();
      const file = path.join(registry, ...segments);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, GOOD);
      return runWorkflowCheck({ artifact: file });
    }

    it('fails a workflow that is not at <registry>/hosts/claude/workflows/<name>.js, and reads no file (every later check is not run)', () => {
      const places: string[][] = [
        ['loose', 'demo-flow.js'],
        ['demo-flow.js'],
        ['hosts', 'cline', 'workflows', 'demo-flow.js'],
        ['hosts', 'claude', 'agents', 'demo-flow.js'],
        ['claude', 'workflows', 'demo-flow.js'],
        ['hosts', 'claude', 'workflows', 'nested', 'demo-flow.js'],
        ['workflows', 'demo-flow.js'],
        ['other', 'hosts', 'claude', 'workflow', 'demo-flow.js'],
      ];
      for (const place of places) {
        const result = placedAt(...place);
        expect(result.status, place.join('/')).toBe('failed');
        expect(codesOf(result), place.join('/')).toEqual(['PLACEMENT']);
        expect(checkOf(result, 'placement')?.status).toBe('failed');
        // Where the registry is cannot be known, so nothing can bound the read: the file is not opened and no content check runs.
        expect(result.bytes, place.join('/')).toBeNull();
        for (const id of ['size', 'encoding', 'lint', 'meta-name', ...LATER_THAN_PLACEMENT]) {
          expect(checkOf(result, id)?.status, `${place.join('/')} ${id}`).toBe('not-run');
          expect(checkOf(result, id)?.reason, id).toMatch(/not read/i);
        }
        expect(checkOf(result, 'name')?.status).toBe('passed');
      }
    });

    it('names the expected place in the finding', () => {
      const result = placedAt('loose', 'demo-flow.js');
      expect(result.findings[0]?.message).toContain('hosts/claude/workflows');
    });

    it('takes the registry as the folder four levels up, whatever its name', () => {
      const { registry } = fixture();
      const renamed = path.join(path.dirname(registry), `${path.basename(registry)}-moved`);
      fs.renameSync(registry, renamed);
      folders.push(renamed);
      const result = runWorkflowCheck({ artifact: path.join(renamed, 'hosts', 'claude', 'workflows', 'demo-flow.js') });
      expect(result.status).toBe('passed');
    });
  });

  // Blocker 2 of Codex round 1: the reads must stay inside the registry tree the path names. The pure name and placement checks
  // come first and touch no file; then the registry is found from the path, its real path is taken, every folder from the
  // checkout down must be a real folder spelled exactly as the file system holds it, and the file opened must be the file inspected.
  describe('Tier 2: reads stay inside the registry tree', () => {
    const base = (): string => {
      const made = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-workflow-tree-')));
      folders.push(made);
      return made;
    };
    /** A junction (a directory symlink elsewhere); skips the test when the platform refuses to create one. */
    function junction(context: { skip: () => void }, target: string, link: string): boolean {
      try {
        fs.symlinkSync(target, link, 'junction');
        return true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EPERM' || code === 'EACCES') { context.skip(); return false; }
        throw error;
      }
    }
    const unavailableWith = (result: WorkflowCheckResult, message: RegExp): void => {
      expect(result.status).toBe('unavailable');
      expect(workflowCheckExitCode(result)).toBe(2);
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
      expect(result.findings[0]?.message).toMatch(message);
      expect(result.bytes).toBeNull();
      expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
    };

    it('runs the pure name and placement checks before any file-system access', () => {
      const nothing = path.join(os.tmpdir(), 'au-workflow-no-such-folder');
      const watched = ['lstatSync', 'statSync', 'fstatSync', 'openSync', 'readSync', 'readdirSync', 'realpathSync', 'existsSync', 'readFileSync'] as const;
      const spies = watched.map(name => vi.spyOn(fs, name));
      try {
        const cases: Array<[string, string, string]> = [
          [path.join(nothing, 'hosts', 'claude', 'workflows', 'con.js'), 'NAME', 'a Windows device name'],
          [path.join(nothing, 'hosts', 'claude', 'workflows', 'Bad_Name.js'), 'NAME', 'a bad name'],
          [path.join(nothing, 'loose', 'demo-flow.js'), 'PLACEMENT', 'a misplaced file'],
          [path.join(path.parse(nothing).root, 'hosts', 'claude', 'workflows', 'demo-flow.js'), 'PLACEMENT', 'a registry that is a file-system root'],
        ];
        for (const [artifact, code, label] of cases) {
          const result = runWorkflowCheck({ artifact });
          expect(result.status, label).toBe('failed');
          expect(workflowCheckExitCode(result), label).toBe(1);
          expect(codesOf(result), label).toContain(code);
          for (const id of ['size', 'encoding', 'lint', 'meta-name', ...LATER_THAN_PLACEMENT]) expect(checkOf(result, id)?.status, `${label} ${id}`).toBe('not-run');
          for (const [index, spy] of spies.entries()) expect(spy, `${label}: fs.${watched[index]}`).not.toHaveBeenCalled();
        }
      } finally {
        for (const spy of spies) spy.mockRestore();
      }
    });

    it('refuses a workflows folder that is a link or junction to another registry (skipped when a junction cannot be created)', context => {
      const outside = fixture();
      const inside = path.join(base(), 'registry');
      fs.mkdirSync(path.join(inside, 'hosts', 'claude'), { recursive: true });
      if (!junction(context, path.join(outside.registry, 'hosts', 'claude', 'workflows'), path.join(inside, 'hosts', 'claude', 'workflows'))) return;
      unavailableWith(runWorkflowCheck({ artifact: path.join(inside, 'hosts', 'claude', 'workflows', 'demo-flow.js') }), /link|junction/i);
    });

    it('refuses a hosts folder that is a link or junction to another registry (skipped when a junction cannot be created)', context => {
      const outside = fixture();
      const inside = path.join(base(), 'registry');
      fs.mkdirSync(inside, { recursive: true });
      if (!junction(context, path.join(outside.registry, 'hosts'), path.join(inside, 'hosts'))) return;
      unavailableWith(runWorkflowCheck({ artifact: path.join(inside, 'hosts', 'claude', 'workflows', 'demo-flow.js') }), /link|junction/i);
    });

    it('refuses a registry folder that is a link or junction to another registry (skipped when a junction cannot be created)', context => {
      const outside = fixture();
      const inside = path.join(base(), 'registry');
      if (!junction(context, outside.registry, inside)) return;
      unavailableWith(runWorkflowCheck({ artifact: path.join(inside, 'hosts', 'claude', 'workflows', 'demo-flow.js') }), /link|junction/i);
    });

    it('resolves a link above the checkout instead of refusing it (skipped when a junction cannot be created)', context => {
      const tree = base();
      const real = path.join(tree, 'real');
      fs.mkdirSync(real);
      const { registry } = fixture();
      fs.renameSync(registry, path.join(real, 'registry'));
      const alias = path.join(tree, 'alias');
      if (!junction(context, real, alias)) return;
      expect(runWorkflowCheck({ artifact: path.join(alias, 'registry', 'hosts', 'claude', 'workflows', 'demo-flow.js') }).status).toBe('passed');
    });

    // On a case-insensitive file system (Windows) the lower-case spelling reaches the upper-case entry, and the check must say
    // so; on a case-sensitive one the alias does not exist. Either way the artifact is refused as unavailable (exit 2).
    it.each(['registry', 'hosts', 'claude', 'workflows', 'file'] as const)('refuses a lower-case alias of an upper-case %s entry', which => {
      const spelled: Record<typeof which, string> = { registry: 'au-registry', hosts: 'hosts', claude: 'claude', workflows: 'workflows', file: 'demo-flow.js' };
      const held = { ...spelled, [which]: which === 'file' ? 'Demo-Flow.js' : `${spelled[which][0].toUpperCase()}${spelled[which].slice(1)}` };
      const root = path.join(base(), held.registry);
      const dir = path.join(root, held.hosts, held.claude, held.workflows);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, held.file), GOOD);
      const result = runWorkflowCheck({ artifact: path.join(path.dirname(root), spelled.registry, 'hosts', 'claude', 'workflows', 'demo-flow.js') });
      unavailableWith(result, process.platform === 'win32' ? /spelled|exact|case/i : /./);
    });

    it('refuses a file replaced between the inspection and the open (the open file is not the inspected one)', () => {
      const { file } = fixture();
      const replacement = path.join(path.dirname(file), 'replacement.tmp');
      fs.writeFileSync(replacement, `${GOOD}// the other file\n`);
      // The seam: fs.openSync is the one call between the lstat and the descriptor; this swaps a different file into place first.
      const real = fs.openSync;
      const spy = vi.spyOn(fs, 'openSync').mockImplementationOnce((...args: Parameters<typeof fs.openSync>) => {
        fs.renameSync(replacement, file);
        return real(...args);
      });
      try {
        unavailableWith(runWorkflowCheck({ artifact: file }), /changed|replaced|not the file/i);
        expect(spy).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    describe('the host profile', () => {
      const realProfile = (): string => fs.readFileSync(path.resolve('registry/hosts/claude/profile.json'), 'utf8');
      const withProfile = (place: (profile: string) => void): WorkflowCheckResult => {
        const made = fixture();
        place(path.join(made.registry, 'hosts', 'claude', 'profile.json'));
        return runWorkflowCheck({ artifact: made.file });
      };

      it('reads a valid profile that is within the limit', () => {
        expect(withProfile(profile => fs.writeFileSync(profile, realProfile())).status).toBe('passed');
      });

      it('treats a registry with no profile as one that lists no unsupported Skill', () => {
        expect(withProfile(() => undefined).status).toBe('passed');
      });

      it('is unavailable (exit 2), not read, when the profile is over 256 KiB, although it is valid JSON', () => {
        const padded = `${realProfile()}${' '.repeat(256 * 1024)}`;
        expect(Buffer.byteLength(padded)).toBeGreaterThan(256 * 1024);
        unavailableWith(withProfile(profile => fs.writeFileSync(profile, padded)), /profile/i);
      });

      it('is unavailable (exit 2) when the profile is not a regular file', () => {
        unavailableWith(withProfile(profile => fs.mkdirSync(profile)), /profile/i);
      });

      it('is unavailable (exit 2) when the profile is a link, even one that points at a good profile', context => {
        const target = path.join(base(), 'profile.json');
        fs.writeFileSync(target, realProfile());
        let made = false;
        const result = withProfile(profile => {
          try { fs.symlinkSync(target, profile); made = true; } catch { /* no link permission */ }
        });
        if (!made) { context.skip(); return; }
        unavailableWith(result, /link/i);
      });

      it('is unavailable (exit 2) when the profile is not a valid profile', () => {
        unavailableWith(withProfile(profile => fs.writeFileSync(profile, '{ "not": "a profile" }')), /cannot run|profile/i);
      });
    });
  });

  describe('Tier 2: LINT', () => {
    it('reports one finding per lint problem, with the lint text', () => {
      const script = `${GOOD}import fs from 'node:fs'\nconst t = Date.now()\n`;
      const expected = lintWorkflow(script);
      expect(expected.length).toBeGreaterThanOrEqual(2);
      const result = check({ content: script });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['LINT']);
      expect(checkOf(result, 'lint')?.status).toBe('failed');
      expect(result.findings.map(item => item.message)).toEqual(expected);
    });

    it('fails a script that does not start with `export const meta`', () => {
      const result = check({ content: 'const x = 1\nreturn x\n' });
      expect(codesOf(result)).toEqual(['LINT']);
      expect(result.findings[0]?.message).toMatch(/export const meta/);
    });

    it('fails phase titles that do not match meta.phases, in both directions', () => {
      const result = check({ content: GOOD.replace("phase('Find')", "phase('Other')") });
      const messages = result.findings.map(item => item.message).join('\n');
      expect(codesOf(result)).toEqual(['LINT']);
      expect(messages).toContain('"Other" is used but not listed');
      expect(messages).toContain('lists "Find"');
    });

    it('fails a script that does not parse as plain JavaScript', () => {
      const result = check({ content: `${GOOD}const = ;\n` });
      expect(codesOf(result)).toEqual(['LINT']);
      expect(result.findings[0]?.message).toMatch(/does not parse/);
    });

    it('fails a meta that is not a pure literal', () => {
      const result = check({ content: GOOD.replace("name: 'demo-flow'", "name: ['demo', 'flow'].join('-')") });
      expect(codesOf(result)).toContain('LINT');
      expect(result.findings.map(item => item.message).join('\n')).toMatch(/pure literal/);
    });

    it('lints the script as written: a script that ends without a newline is fine, an empty one is not', () => {
      expect(check({ content: GOOD.trimEnd() }).status).toBe('passed');
      const empty = check({ content: '' });
      expect(empty.status).toBe('failed');
      expect(codesOf(empty)).toEqual(['LINT']);
    });
  });

  // Blocker 1 of Codex round 1: the checker used to evaluate `meta` in a vm and then read its properties outside the vm, so a
  // getter or a coercion hook could run and a malformed shape threw (exit 2). `meta` is now data: any such draft is a LINT
  // finding and exit 1, and nothing in it runs.
  describe('Tier 2: LINT reads meta as data and never runs it', () => {
    const PROBE = '__workflowCheckMetaRan';
    const probe = (): unknown => (globalThis as Record<string, unknown>)[PROBE];
    afterEach(() => { delete (globalThis as Record<string, unknown>)[PROBE]; });
    const draft = (meta: string): string => `export const meta = ${meta}\n\nreturn 1\n`;
    const header = "name: 'demo-flow', description: 'A demo workflow.'";

    it.each([
      ['a getter', `{ ${header}, get phases() { globalThis.${PROBE} = true; throw new Error('boom') } }`],
      ['a toString and valueOf coercion trap', `{ ${header}, phases: [{ title: { toString() { globalThis.${PROBE} = true; throw new Error('boom') }, valueOf() { throw new Error('boom') } } }] }`],
      ['phases that is an object', `{ ${header}, phases: {} }`],
      ['a null phase entry', `{ ${header}, phases: [null] }`],
      ['a non-literal value', `{ name: ['demo', 'flow'].join('-'), description: 'A demo workflow.' }`],
      ['a __proto__ key', `{ ${header}, __proto__: { phases: 5 } }`],
      ['a quoted __proto__ key', `{ ${header}, '__proto__': { phases: 5 } }`],
    ])('fails %s as LINT with exit 1, runs nothing and never evaluates the meta', (_label, meta) => {
      const spy = vi.spyOn(vm, 'runInNewContext');
      try {
        const result = check({ content: draft(meta) });
        expect(result.status).toBe('failed');
        expect(workflowCheckExitCode(result)).toBe(1);
        expect(codesOf(result)).toContain('LINT');
        expect(codesOf(result)).not.toContain('INPUT_UNAVAILABLE');
        expect(checkOf(result, 'lint')?.status).toBe('failed');
        expect(spy).not.toHaveBeenCalled();
        expect(probe()).toBeUndefined();
      } finally {
        spy.mockRestore();
      }
    });

    it('still passes a meta written with quoted keys, comments, trailing commas and a backtick string', () => {
      const meta = "{ 'name': \"demo-flow\", // the name\n  description: `A demo workflow.`, /* none */ phases: [{ 'title': 'Find', },], }";
      expect(check({ content: `export const meta = ${meta}\nphase('Find')\n` }).status).toBe('passed');
    });
  });

  describe('Tier 2: META_NAME', () => {
    it('fails a meta.name that differs from the file name, naming both', () => {
      const result = check({ content: GOOD.replace("name: 'demo-flow'", "name: 'other-flow'") });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['META_NAME']);
      expect(result.findings[0]?.message).toContain('other-flow');
      expect(result.findings[0]?.message).toContain('demo-flow');
    });

    it('is case-sensitive', () => {
      const result = check({ content: GOOD.replace("name: 'demo-flow'", "name: 'Demo-Flow'") });
      expect(codesOf(result)).toContain('META_NAME');
    });

    it('is not run when meta.name cannot be read, so the lint finding is the only one', () => {
      for (const content of ['const x = 1\n', GOOD.replace("name: 'demo-flow'", 'name: 42')]) {
        const result = check({ content });
        expect(checkOf(result, 'meta-name')?.status).toBe('not-run');
        expect(codesOf(result)).toEqual(['LINT']);
      }
    });
  });

  describe('Tier 2: SKILL_PAIR', () => {
    it('fails a workflow without a Skill of the same name, and names the expected file', () => {
      const result = check({ skills: [] });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['SKILL_PAIR']);
      expect(result.findings[0]?.message).toContain('skills/demo-flow/SKILL.md');
      expect(checkOf(result, 'skill-pair')?.status).toBe('failed');
    });

    it('fails a skill of another name, a skill folder without SKILL.md, and a SKILL.md that is a folder', () => {
      expect(codesOf(check({ skills: ['other-flow'] }))).toEqual(['SKILL_PAIR']);
      const bare = fixture({ skills: [] });
      fs.mkdirSync(path.join(bare.registry, 'skills', 'demo-flow'), { recursive: true });
      expect(codesOf(runWorkflowCheck({ artifact: bare.file }))).toEqual(['SKILL_PAIR']);
      const folder = fixture({ skills: [] });
      fs.mkdirSync(path.join(folder.registry, 'skills', 'demo-flow', 'SKILL.md'), { recursive: true });
      expect(codesOf(runWorkflowCheck({ artifact: folder.file }))).toEqual(['SKILL_PAIR']);
    });

    it('does not need the other skills to exist or to be good', () => {
      expect(check({ skills: ['demo-flow', 'other-one', 'other-two'] }).status).toBe('passed');
    });

    // The projector skips a Skill the Claude profile lists as unsupported, and with it the native workflow that stands in for it.
    it('fails a workflow whose Skill the Claude profile lists as unsupported, and passes it when the profile does not', () => {
      const withProfile = (unsupported: string[]): WorkflowCheckResult => {
        const made = fixture();
        const profile = JSON.parse(fs.readFileSync(path.resolve('registry/hosts/claude/profile.json'), 'utf8')) as { unsupportedSkills?: unknown[] };
        profile.unsupportedSkills = unsupported.map(name => ({ name, since: '2026-11-27', rationale: 'Test fixture: written for another host.' }));
        fs.writeFileSync(path.join(made.registry, 'hosts', 'claude', 'profile.json'), `${JSON.stringify(profile, null, 2)}\n`);
        return runWorkflowCheck({ artifact: made.file });
      };
      const unsupported = withProfile(['demo-flow']);
      expect(codesOf(unsupported)).toEqual(['SKILL_PAIR']);
      expect(unsupported.findings[0]?.message).toMatch(/unsupported/i);
      expect(withProfile(['other-flow']).status).toBe('passed');
    });
  });

  describe('Tier 2: AGENT_TYPE', () => {
    const two = (a: string, b: string): string => GOOD.replace("agentType: 'code-reviewer' })", `agentType: '${a}' })\nconst second = await agent('again', { agentType: '${b}' })`);

    it('fails an agentType that is not a native Claude agent, and names it', () => {
      const result = check({ content: GOOD.replace('code-reviewer', 'missing-agent') });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['AGENT_TYPE']);
      expect(result.findings[0]?.message).toContain('missing-agent');
      expect(checkOf(result, 'agent-types')?.status).toBe('failed');
    });

    it('reports one finding per missing type, once each, and none for a type that exists', () => {
      const result = check({ content: two('code-reviewer', 'ghost-one').replace('phase: \'Check\'', "phase: 'Check', agentType: 'ghost-two'"), agents: ['code-reviewer'] });
      expect(result.findings.map(item => item.code)).toEqual(['AGENT_TYPE', 'AGENT_TYPE']);
      expect(result.findings.map(item => item.message).join('\n')).toMatch(/ghost-one[\s\S]*ghost-two|ghost-two[\s\S]*ghost-one/);
      const repeated = check({ content: two('ghost-one', 'ghost-one'), agents: [] });
      expect(repeated.findings.filter(item => item.code === 'AGENT_TYPE')).toHaveLength(1);
    });

    it('passes a script that asks for no agentType', () => {
      expect(check({ content: GOOD.replace(", agentType: 'code-reviewer'", ''), agents: [] }).status).toBe('passed');
    });

    it('does not take a Skill, a non-.md file or a non-native name for an agent', () => {
      expect(codesOf(check({ content: GOOD.replace('code-reviewer', 'demo-flow'), agents: [] }))).toEqual(['AGENT_TYPE']);
      const other = fixture({ agents: [] });
      fs.writeFileSync(path.join(other.registry, 'hosts', 'claude', 'agents', 'code-reviewer.txt'), 'not an agent');
      expect(codesOf(runWorkflowCheck({ artifact: other.file }))).toEqual(['AGENT_TYPE']);
      expect(codesOf(check({ content: GOOD.replace('code-reviewer', 'Code_Reviewer'), agents: ['Code_Reviewer'] }))).toEqual(['AGENT_TYPE']);
    });

    it('never follows an agentType that looks like a path', () => {
      const result = check({ content: GOOD.replace('code-reviewer', '../skills/demo-flow/SKILL'), agents: [] });
      expect(codesOf(result)).toEqual(['AGENT_TYPE']);
    });

    // Blocker 3 of Codex round 1: the gate used to be a regex, so it missed quoted keys, took examples in comments and strings
    // for requests, and ignored a value that is not a string literal. It is now a tokenizer that skips comments, strings, template
    // text and regular expressions, and a value it cannot resolve statically is a finding of its own.
    describe('found by a tokenizer, not a regex', () => {
      const withCall = (call: string): string => `${GOOD.replace(/const found = .*\n/, '')}const kind = 'code-reviewer'\nconst found = await agent('look', ${call})\n`;
      const requests = (call: string, agents: string[] = ['code-reviewer']): WorkflowCheckResult => check({ content: withCall(call), agents });

      it('reads a quoted key, single or double quotes', () => {
        for (const key of ["'agentType'", '"agentType"']) {
          const result = requests(`{ ${key}: 'ghost' }`);
          expect(codesOf(result), key).toEqual(['AGENT_TYPE']);
          expect(result.findings[0]?.message, key).toContain('ghost');
        }
        expect(requests(`{ 'agentType': 'code-reviewer' }`).status).toBe('passed');
      });

      it('reads a computed string key and a key inside a template interpolation', () => {
        expect(codesOf(requests(`{ ['agentType']: kind }`))).toEqual(['AGENT_TYPE_UNRESOLVED']);
        expect(codesOf(check({ content: `${GOOD}const note = \`run \${await agent('again', { agentType: 'ghost' })}\`\n` }))).toEqual(['AGENT_TYPE']);
      });

      it('does not take an example in a comment for a request', () => {
        const result = check({ content: `${GOOD}// ask for { agentType: 'ghost' } here\n/* agentType: 'ghost2', agentType: kind */\n` });
        expect(result.status).toBe('passed');
      });

      it('does not take an example in a string, a template text or a regular expression for a request', () => {
        const result = check({
          content: `${GOOD}const a = "use agentType: 'ghost'"\nconst b = 'agentType: "ghost2"'\nconst c = \`agentType: 'ghost3' and agentType: kind\`\nconst d = /agentType: 'ghost4'/\n`,
        });
        expect(result.status).toBe('passed');
        expect(result.findings).toEqual([]);
      });

      it('is not thrown off by a quote inside a regular expression, a string or a comment before the real request', () => {
        const result = check({ content: `${GOOD.replace(/const found = .*\n/, '')}const q = /'/\nconst s = "it's"\n// it's\nconst found = await agent('look', { agentType: 'ghost' })\n` });
        expect(codesOf(result)).toEqual(['AGENT_TYPE']);
      });

      it('does not take a property read or a ternary for a key', () => {
        expect(check({ content: `${GOOD}const t = args && args.flag ? args.agentType : 'none'\nconst u = cond ? agentType : 'x'\n` }).status).toBe('passed');
      });

      it('accepts a template string without interpolation as a literal', () => {
        expect(requests('{ agentType: `code-reviewer` }').status).toBe('passed');
        expect(codesOf(requests('{ agentType: `ghost` }'))).toEqual(['AGENT_TYPE']);
      });

      it.each([
        ['a variable', '{ agentType: kind }'],
        ['a call', "{ agentType: pick('code-reviewer') }"],
        ['a template with interpolation', '{ agentType: `code-${kind}` }'],
        ['a concatenation', "{ agentType: 'code-' + 'reviewer' }"],
        ['a conditional', "{ agentType: args.deep ? 'code-reviewer' : 'ghost' }"],
        ['a member read', '{ agentType: args.type }'],
        ['a method call on a literal', "{ agentType: 'code-reviewer'.trim() }"],
        ['a shorthand property', '{ agentType }'],
        ['a quoted key with a variable', '{ "agentType": kind }'],
      ])('fails %s as AGENT_TYPE_UNRESOLVED, saying the checker cannot resolve it statically and so fails conservatively', (_label, call) => {
        const result = requests(call);
        expect(result.status).toBe('failed');
        expect(workflowCheckExitCode(result)).toBe(1);
        expect(codesOf(result)).toEqual(['AGENT_TYPE_UNRESOLVED']);
        expect(checkOf(result, 'agent-types')?.status).toBe('failed');
        expect(result.findings[0]?.message).toMatch(/cannot resolve/i);
        expect(result.findings[0]?.message).toMatch(/conservativ/i);
      });

      it('does not take a directory, a link or a non-.md file for an agent', context => {
        const made = fixture({ agents: [] });
        const agents = path.join(made.registry, 'hosts', 'claude', 'agents');
        fs.mkdirSync(path.join(agents, 'code-reviewer.md'));
        const asDirectory = runWorkflowCheck({ artifact: made.file });
        expect(codesOf(asDirectory)).toEqual(['AGENT_TYPE']);
        expect(asDirectory.findings[0]?.message).toContain('code-reviewer');

        fs.rmSync(path.join(agents, 'code-reviewer.md'), { recursive: true });
        const target = path.join(made.registry, 'real-agent.md');
        fs.writeFileSync(target, '---\nname: code-reviewer\ndescription: An agent.\n---\nBody.\n');
        try {
          fs.symlinkSync(target, path.join(agents, 'code-reviewer.md'));
        } catch {
          context.skip();
          return;
        }
        expect(codesOf(runWorkflowCheck({ artifact: made.file }))).toEqual(['AGENT_TYPE']);
      });

      it('still accepts a regular .md agent file', () => {
        expect(check().status).toBe('passed');
      });
    });
  });

  describe('Tier 2: what the checker does not establish', () => {
    it('states its limits in a notes list on every result: Bundle membership of the agent roles, and installability', () => {
      for (const result of [check(), check({ content: 'const x = 1\n' }), runWorkflowCheck({})]) {
        expect(Array.isArray(result.notes)).toBe(true);
        const notes = result.notes.join('\n');
        expect(notes).toMatch(/Bundle/);
        expect(notes).toMatch(/--force/);
        expect(notes).toMatch(/lexical|static/i);
      }
    });

    it('never claims that every agentType was verified', () => {
      expect(check().notes.join('\n')).not.toMatch(/every agentType/i);
    });
  });

  describe('Tier 2: RENDER', () => {
    it('fails a script that carries the managed marker itself', () => {
      const result = check({ content: `${GOOD}// ${MARKER_PREFIX} | profile: claude-native | do not edit\n` });
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['RENDER']);
      expect(checkOf(result, 'render')?.status).toBe('failed');
      expect(result.findings[0]?.message).toContain(MARKER_PREFIX);
    });

    it('fails when the rendered bytes would not pass the lint although the script did', () => {
      vi.mocked(renderNativeWorkflow).mockImplementationOnce((source: string) => `import x from 'y'\n${source}// ${MARKER_PREFIX} | do not edit\n`);
      const result = check();
      expect(codesOf(result)).toEqual(['RENDER']);
      expect(result.findings.some(item => /lint/i.test(item.message))).toBe(true);
    });

    it('fails when the rendered bytes are not the script plus one marker line', () => {
      const cases: Array<[string, (source: string) => string]> = [
        ['a dropped line', source => `${source.split('\n').slice(1).join('\n')}// ${MARKER_PREFIX} | do not edit\n`],
        ['CRLF kept', source => `${toCrlf(source)}// ${MARKER_PREFIX} | do not edit\n`],
        ['no marker', source => source],
        ['a marker that is not the last line', source => `// ${MARKER_PREFIX} | do not edit\n${source}`],
        ['two marker lines', source => `${source}// ${MARKER_PREFIX} | a\n// ${MARKER_PREFIX} | b\n`],
        ['no final newline', source => `${source}// ${MARKER_PREFIX} | do not edit`],
        ['an extra blank line', source => `${source}\n// ${MARKER_PREFIX} | do not edit\n`],
        ['a marker without the comment slashes', source => `${source}${MARKER_PREFIX} | do not edit\n`],
      ];
      for (const [label, render] of cases) {
        vi.mocked(renderNativeWorkflow).mockImplementationOnce(render);
        const result = check();
        expect(result.status, label).toBe('failed');
        expect(codesOf(result), label).toEqual(['RENDER']);
      }
    });

    it('accepts the real renderer: LF-normalised, trailing newlines collapsed to one, then one marker line', () => {
      for (const content of [GOOD, toCrlf(GOOD), `${GOOD}\n\n\n`, GOOD.trimEnd()]) {
        const { file } = fixture({ content });
        const result = runWorkflowCheck({ artifact: file });
        expect(result.status).toBe('passed');
        const rendered = renderNativeWorkflow(fs.readFileSync(file, 'utf8'), 'skills/demo-flow/SKILL.md');
        const lines = rendered.split('\n');
        expect(lines.pop()).toBe('');
        expect(lines.pop()).toContain(MARKER_PREFIX);
        expect(`${lines.join('\n')}\n`).toBe(`${GOOD.replace(/\r\n/g, '\n').replace(/\n*$/, '')}\n`);
      }
    });

    it('is not run when the placement fails', () => {
      const { registry } = fixture();
      const file = path.join(registry, 'loose.js');
      fs.writeFileSync(file, GOOD.replace('demo-flow', 'loose'));
      const result = runWorkflowCheck({ artifact: file });
      expect(checkOf(result, 'render')?.status).toBe('not-run');
    });
  });

  describe('Tier 2: all failures together', () => {
    it('reports every failing check in the fixed order, one finding list', () => {
      const bad = `${GOOD.replace("name: 'demo-flow'", "name: 'other'").replace('code-reviewer', 'ghost')}const stamp = Date.now()\n// ${MARKER_PREFIX} | do not edit\n`;
      const result = check({ content: bad, skills: [] });
      expect(result.status).toBe('failed');
      expect(statusesOf(result)).toEqual({
        name: 'passed', size: 'passed', encoding: 'passed', placement: 'passed', lint: 'failed', 'meta-name': 'failed',
        'skill-pair': 'failed', 'agent-types': 'failed', render: 'failed',
      });
      expect(result.findings.map(item => item.code)).toEqual(['LINT', 'META_NAME', 'SKILL_PAIR', 'AGENT_TYPE', 'RENDER']);
      expect(result.findings).toEqual(result.checks.flatMap(item => item.findings));
    });

    it('lists the file name problem first, then the placement problem', () => {
      const { registry } = fixture();
      const file = path.join(registry, 'Bad_Name.js');
      fs.writeFileSync(file, GOOD);
      const result = runWorkflowCheck({ artifact: file });
      expect(result.findings.map(item => item.code).slice(0, 2)).toEqual(['NAME', 'PLACEMENT']);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Tier 3: the built CLI, and the README row
  // -------------------------------------------------------------------------------------------
  describe('Tier 3: the built CLI', () => {
    function run(...argv: string[]): { status: number | null; json: WorkflowCheckResult; stderr: string } {
      const done = spawnSync(process.execPath, [cli, 'workflow-check', ...argv], { cwd: folderOf(), encoding: 'utf8', timeout: 30_000 });
      return { status: done.status, json: JSON.parse(done.stdout) as WorkflowCheckResult, stderr: done.stderr };
    }
    function folderOf(): string {
      const made = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-workflow-check-cwd-')));
      folders.push(made);
      return made;
    }

    it('exits 0 and prints the passed JSON for a good workflow', () => {
      const { file } = fixture();
      const done = run('--artifact', file);
      expect(done.status).toBe(0);
      expect(done.stderr).toBe('');
      expect(done.json.status).toBe('passed');
      expect(done.json.artifact).toBe(file);
      expect(done.json.findings).toEqual([]);
      expect(done.json.checks.map(item => item.id)).toEqual(CHECK_IDS);
      expect(done.json.quality).toBe('pending');
      expect(done.json.live).toBe('unverified');
    });

    it('exits 1 and lists the findings for a failing workflow', () => {
      const { file } = fixture({ content: `${GOOD}import x from 'y'\n`, skills: [] });
      const done = run('--artifact', file);
      expect(done.status).toBe(1);
      expect(done.json.status).toBe('failed');
      expect(codesOf(done.json)).toEqual(['LINT', 'SKILL_PAIR']);
    });

    it('exits 2 for an unavailable input', () => {
      const { file } = fixture();
      const done = run('--artifact', path.join(path.dirname(file), 'missing-flow.js'));
      expect(done.status).toBe(2);
      expect(done.json.status).toBe('unavailable');
      expect(codesOf(done.json)).toEqual(['INPUT_UNAVAILABLE']);
    });

    // `--help` and `-h` are the one documented exception: they print the usage text and exit 0 (see the help test below).
    it('exits 2 with a JSON USAGE result for every misuse, never CAC prose or a stack trace', () => {
      const { file } = fixture();
      const cases: string[][] = [
        ['--artifact.x', 'foo'],
        ['--foo.bar', '1'],
        ['--artifact', file, '--artifact.x', 'y'],
        ['--artifact', file, '--artifact.x.y', 'z'],
        ['--artifact', file, '--artifact.0', 'z'],
        ['--artifact.x', 'y', '--artifact', file],
        ['--artifact', file, '--a.b', '1', '--a.b.c', '2'],
        ['--a', '1', '--a.b', '2'],
        ['--constructor.prototype.x', '1'],
        ['--help.topic'],
        ['-h.x'],
        ['--artifact', file, '--help.topic'],
        ['--version.x'],
        ['--artifact', file, '--no-artifact'],
        [],
        ['--artifact'],
        ['--artifact', file, '--artifact', file],
        ['--artifact', file, '--nope'],
        ['--artifact', file, '-x'],
        [file],
        ['--artifact', file, 'extra'],
        ['--artifact', 'relative/flow.js'],
        ['--artifact', file, '--', 'more'],
      ];
      for (const argv of cases) {
        const done = run(...argv);
        expect(done.status, argv.join(' ')).toBe(2);
        expect(done.json.status, argv.join(' ')).toBe('unavailable');
        expect(codesOf(done.json), argv.join(' ')).toEqual(['USAGE']);
        expect(done.json.checks.every(item => item.status === 'not-run')).toBe(true);
        expect(done.stderr, argv.join(' ')).toBe('');
      }
    });

    it('prints the usage text and exits 0 for --help, the one input that is not answered with JSON', () => {
      for (const flag of ['--help', '-h']) {
        const done = spawnSync(process.execPath, [cli, 'workflow-check', flag], { cwd: folderOf(), encoding: 'utf8', timeout: 30_000 });
        expect(done.status, flag).toBe(0);
        expect(done.stdout, flag).toContain('--artifact');
        expect(done.stdout, flag).toContain('workflow-check');
        expect(done.stderr, flag).toBe('');
      }
    });

    // The current behaviour, pinned and not a promise of the command: CAC handles --help before the action sees an unknown option,
    // so --help with a misspelled undotted option prints the usage text and exits 0, like skill-check and rule-check. (A dotted
    // option such as --help.topic is caught earlier by the shared parser and is a JSON USAGE result, see the misuse test above.)
    it('prints the usage text and exits 0 for --help together with an unknown option, because CAC handles help first', () => {
      for (const argv of [['--help', '--nope'], ['--nope', '--help'], ['-h', '--nope']]) {
        const done = spawnSync(process.execPath, [cli, 'workflow-check', ...argv], { cwd: folderOf(), encoding: 'utf8', timeout: 30_000 });
        expect(done.status, argv.join(' ')).toBe(0);
        expect(done.stdout, argv.join(' ')).toContain('--artifact');
        expect(done.stdout, argv.join(' ')).toContain('workflow-check');
        expect(done.stderr, argv.join(' ')).toBe('');
      }
    });

    it('lists workflow-check in the top-level help', () => {
      const done = spawnSync(process.execPath, [cli, '--help'], { cwd: folderOf(), encoding: 'utf8', timeout: 30_000 });
      expect(done.status).toBe(0);
      expect(done.stdout).toMatch(/workflow-check\s+Check one native Claude workflow/);
    });

    it('leaves the workflow and its registry untouched', () => {
      const { registry, file } = fixture();
      const listing = (): string[] => fs.readdirSync(registry, { recursive: true }).map(String).sort();
      const before = fs.readFileSync(file);
      const tree = listing();
      run('--artifact', file);
      expect(fs.readFileSync(file).equals(before)).toBe(true);
      expect(listing()).toEqual(tree);
    });
  });

  describe('Documentation: the README command table', () => {
    it('lists agents workflow-check --artifact <path> in the CLI Reference, with a link to its ADR that resolves', () => {
      const readme = fs.readFileSync(path.resolve(checkout, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
      const reference = readme.slice(readme.indexOf('CLI Reference'));
      const rows = reference.split('\n').filter(line => line.startsWith('| `agents '));
      const row = rows.find(line => line.startsWith('| `agents workflow-check'));
      expect(row, 'a table row that starts with `agents workflow-check').toBeDefined();
      expect(row).toContain('--artifact <path>');
      const link = /\]\((\.\/docs\/adr\/0082-[^)#]+\.md)(#[^)]*)?\)/.exec(row ?? '');
      expect(link, 'a link to ADR 0082').not.toBeNull();
      expect(fs.existsSync(path.resolve(checkout, link?.[1] ?? 'missing'))).toBe(true);
      // The row follows the rule-check row.
      expect(rows.findIndex(line => line.startsWith('| `agents workflow-check'))).toBe(rows.findIndex(line => line.startsWith('| `agents rule-check')) + 1);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Tier 4: the real registry
  // -------------------------------------------------------------------------------------------
  describe('Tier 4: every committed workflow in registry/hosts/claude/workflows', () => {
    const files = fs.readdirSync(REAL_WORKFLOWS).filter(name => name.endsWith('.js')).sort();

    it('finds the committed workflows, and the native package lists the same names', () => {
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(listNativeWorkflows(REAL_REGISTRY, 'claude')).toEqual(files.map(name => name.slice(0, -3)));
    });

    // workflow-implement.js and workflow-test.js choose their specialist at run time (`SPECIALISTS[request.specialist]`, then
    // `agentType: task.agentType`). A lexical scan cannot resolve that, so the checker fails them conservatively with
    // AGENT_TYPE_UNRESOLVED and nothing else. This is the known state of the committed files (every other check passes, and
    // workflow-review.js passes in full). Whether those two workflows should write their types as literals or the rule should gain a
    // declaration is open for the maintainers. Any other finding on them, or any finding on another workflow, fails this test.
    const KNOWN_DYNAMIC_AGENT_TYPE = new Set(['workflow-implement.js', 'workflow-test.js']);

    it('passes workflow-check for every committed workflow, except the two that pick their specialist at run time', () => {
      const failures: string[] = [];
      for (const name of files) {
        const result = runWorkflowCheck({ artifact: path.join(REAL_WORKFLOWS, name) });
        expect(result.bytes, name).toBeLessThan(WORKFLOW_CHECK_MAX_BYTES);
        if (KNOWN_DYNAMIC_AGENT_TYPE.has(name)) {
          expect(codesOf(result), name).toEqual(['AGENT_TYPE_UNRESOLVED']);
          expect(result.checks.filter(item => item.status !== 'passed').map(item => item.id), name).toEqual(['agent-types']);
          continue;
        }
        if (result.status !== 'passed') failures.push(`${name}: ${result.findings.map(item => `${item.code} ${item.message}`).join('; ')}`);
        expect(result.checks.every(item => item.status === 'passed'), name).toBe(true);
      }
      expect(failures).toEqual([]);
    });

    it('lists only workflows that exist in the known-dynamic set', () => {
      for (const name of KNOWN_DYNAMIC_AGENT_TYPE) expect(files, name).toContain(name);
    });
  });
});
