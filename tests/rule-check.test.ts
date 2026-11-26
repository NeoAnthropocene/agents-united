/**
 * `agents rule-check` (ADR 0082, "What rule-check checks"): the read-only deterministic QA of one canonical rule file.
 *
 * Tier 1 happy path, Tier 2 every failure code and its boundary, Tier 3 agreement with the Claude projector and the
 * built public CLI, Tier 4 every real rule in `registry/rules/`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { ruleCheckExitCode, ruleCheckUsageResult, ruleNameProblem, runRuleCheck } from '../src/core/rule-check.js';
import { ClaudeProjector, ENTRYPOINT_RULES } from '../src/core/claude-projector.js';
import type { RuleCheckResult } from '../src/core/types.js';

const CHECK_IDS = ['name', 'size', 'encoding', 'budget', 'front-matter', 'structure', 'managed-marker', 'claude-render'];
const BUDGET = ClaudeProjector.CLAUDE_DIALECT.maxRuleLines;
const SIZE_CAP = 64 * 1024;
const checkout = process.cwd();
const cli = path.resolve(checkout, 'dist/cli.js');
const REAL_RULES = path.resolve(checkout, 'registry', 'rules');

const GOOD = '# Keep commits small\n\nCommit one logical change at a time.\nExplain why in the message.\n';
const toCrlf = (text: string): string => text.replace(/\r?\n/g, '\r\n');
const codesOf = (result: RuleCheckResult): string[] => [...new Set(result.findings.map(item => item.code))].sort();
const checkOf = (result: RuleCheckResult, id: string) => result.checks.find(check => check.id === id);

/** A rule of exactly `fileLines` lines (title, blank, then body lines), with or without a final newline. */
function ruleOfLines(fileLines: number, eol: '\n' | '\r\n' = '\n', finalNewline = true): string {
  const lines = ['# Long rule', ''];
  while (lines.length < fileLines) lines.push(`Line ${lines.length + 1} of the rule.`);
  return lines.join(eol) + (finalNewline ? eol : '');
}

describe('rule-check', () => {
  const folders: string[] = [];
  afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });

  function folder(): string {
    const made = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-rule-check-')));
    folders.push(made);
    return made;
  }
  /** Writes one rule file in a fresh temp folder and returns its absolute path. */
  function rule(content: string | Buffer, name = 'good-rule.md'): string {
    const file = path.join(folder(), name);
    fs.writeFileSync(file, content);
    return file;
  }
  const check = (content: string | Buffer, name?: string): RuleCheckResult => runRuleCheck({ artifact: rule(content, name) });

  // -------------------------------------------------------------------------------------------
  // Tier 1: feature coverage
  // -------------------------------------------------------------------------------------------
  describe('Tier 1: happy path', () => {
    it('passes a plain rule and reports every check as passed', () => {
      const file = rule(GOOD);
      const result = runRuleCheck({ artifact: file });
      expect(result.status).toBe('passed');
      expect(result.findings).toEqual([]);
      expect(result.version).toBe(1);
      expect(result.kind).toBe('deterministic');
      expect(result.artifact).toBe(file);
      expect(result.budget).toBe(BUDGET);
      expect(result.lines).toBe(GOOD.split(/\r?\n/).length);
      expect(result.checks.map(item => item.id)).toEqual(CHECK_IDS);
      expect(result.checks.every(item => item.status === 'passed' && item.findings.length === 0)).toBe(true);
      expect(result.quality).toBe('pending');
      expect(result.live).toBe('unverified');
      expect(ruleCheckExitCode(result)).toBe(0);
    });

    it('accepts blank lines before the title and a rule without a final newline', () => {
      expect(check('\n\n# Title\nBody text').status).toBe('passed');
    });

    it('maps status to the exit codes 0, 1 and 2', () => {
      expect(ruleCheckExitCode(check(GOOD))).toBe(0);
      expect(ruleCheckExitCode(check('no title\nbody\n'))).toBe(1);
      expect(ruleCheckExitCode(runRuleCheck({}))).toBe(2);
    });

    it('builds a usage result that echoes the artifact and runs no check', () => {
      const result = ruleCheckUsageResult(['Unknown option --nope.'], { artifact: '/some/rule.md' });
      expect(result.status).toBe('unavailable');
      expect(result.artifact).toBe('/some/rule.md');
      expect(result.lines).toBeNull();
      expect(result.findings).toEqual([{ code: 'USAGE', path: null, message: 'Unknown option --nope.' }]);
      expect(result.checks.map(item => item.id)).toEqual(CHECK_IDS);
      expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
      expect(ruleCheckExitCode(result)).toBe(2);
    });

    it('never changes the file it reads', () => {
      const file = rule(GOOD);
      const before = fs.readFileSync(file);
      const mtime = fs.statSync(file).mtimeMs;
      runRuleCheck({ artifact: file });
      expect(fs.readFileSync(file).equals(before)).toBe(true);
      expect(fs.statSync(file).mtimeMs).toBe(mtime);
      expect(fs.readdirSync(path.dirname(file))).toEqual(['good-rule.md']);
    });

    it('treats a rule that looks like code as data', () => {
      const result = check('# Title\n\n```js\nprocess.exit(7); require("child_process").execSync("echo x");\n```\n');
      expect(result.status).toBe('passed');
    });
  });

  // -------------------------------------------------------------------------------------------
  // Tier 2: boundaries and negative cases
  // -------------------------------------------------------------------------------------------
  describe('Tier 2: usage and unavailable input (exit 2)', () => {
    it('reports USAGE when --artifact is missing or empty', () => {
      for (const input of [{}, { artifact: '' }, { artifact: undefined }]) {
        const result = runRuleCheck(input);
        expect(result.status).toBe('unavailable');
        expect(codesOf(result)).toEqual(['USAGE']);
        expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
      }
    });

    it('reports USAGE for a relative path', () => {
      const result = runRuleCheck({ artifact: path.join('registry', 'rules', 'good-rule.md') });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['USAGE']);
      expect(result.findings[0]?.message).toMatch(/absolute/i);
    });

    it('reports INPUT_UNAVAILABLE for a missing file, with the path', () => {
      const missing = path.join(folder(), 'missing-rule.md');
      const result = runRuleCheck({ artifact: missing });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
      expect(result.findings[0]?.path).toBe(missing);
      expect(result.lines).toBeNull();
      expect(result.checks.every(item => item.status === 'not-run')).toBe(true);
    });

    it('reports INPUT_UNAVAILABLE for a directory, even one named like a rule', () => {
      const dir = path.join(folder(), 'a-rule.md');
      fs.mkdirSync(dir);
      const result = runRuleCheck({ artifact: dir });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
    });

    it('reports INPUT_UNAVAILABLE for a path that ends in a separator', () => {
      const file = rule(GOOD);
      const result = runRuleCheck({ artifact: `${file}${path.sep}` });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
    });

    it('refuses a symbolic link, even one that points at a good rule', (context) => {
      const target = rule(GOOD);
      const link = path.join(path.dirname(target), 'linked-rule.md');
      try {
        fs.symlinkSync(target, link);
      } catch {
        context.skip();
        return;
      }
      const result = runRuleCheck({ artifact: link });
      expect(result.status).toBe('unavailable');
      expect(codesOf(result)).toEqual(['INPUT_UNAVAILABLE']);
      expect(result.findings[0]?.message).toMatch(/link/i);
    });
  });

  describe('Tier 2: NAME', () => {
    it('accepts lower-case kebab-case names, digits included', () => {
      for (const name of ['a.md', 'rule-1.md', 'a-b-c.md', '2fa-rule.md']) expect(check(GOOD, name).status).toBe('passed');
    });

    it('fails names that are not lower-case kebab-case .md', () => {
      for (const name of ['Bad_Name.md', 'UPPER.md', 'rule.txt', 'rule', '-rule.md', 'rule-.md', 'a--b.md', 'a b.md', 'rule.MD', 'a.b.md']) {
        const result = check(GOOD, name);
        expect(result.status, name).toBe('failed');
        expect(codesOf(result), name).toEqual(['NAME']);
        expect(checkOf(result, 'name')?.status).toBe('failed');
        expect(result.findings[0]?.path).toBe(result.artifact);
      }
    });

    it('refuses every Windows reserved device name, with or without an extension, in any case (the pure rule, on every host)', () => {
      const devices = ['con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)];
      for (const device of devices) {
        for (const name of [`${device}.md`, `${device.toUpperCase()}.md`, `${device}.txt`, device, `${device}.a.md`]) {
          expect(ruleNameProblem(name), name).toMatch(/reserved/i);
        }
      }
      for (const name of ['good-rule.md', 'console.md', 'com10.md', 'lpt0.md', 'conn.md', 'a-con.md', 'aux-rule.md', 'com1x.md']) expect(ruleNameProblem(name), name).toBeNull();
    });

    // Not run on Windows: there `con.md` is the console device, so the file cannot exist and a write would go to the console.
    it.skipIf(process.platform === 'win32')('fails con.md, nul.md and lpt9.md with NAME and names the reserved device', () => {
      for (const name of ['con.md', 'nul.md', 'lpt9.md', 'aux.md', 'com1.md', 'prn.md']) {
        const result = check(GOOD, name);
        expect(result.status, name).toBe('failed');
        expect(codesOf(result), name).toEqual(['NAME']);
        expect(result.findings[0]?.message, name).toMatch(/reserved/i);
        expect(result.findings[0]?.message, name).toContain(name);
      }
    });

    it('compares entry-point names without regard to case, and says they are entry points', () => {
      for (const name of ['claude.md', 'Agents.md', 'GEMINI.MD', 'cursor.md', 'claude.local.md', 'Claude.Local.Md']) {
        const result = check(GOOD, name);
        expect(result.status, name).toBe('failed');
        expect(codesOf(result), name).toEqual(['NAME']);
        expect(result.findings[0]?.message, name).toMatch(/entry/i);
      }
    });

    it('fails every host entry-point name and says it is an entry point', () => {
      for (const name of [...ENTRYPOINT_RULES]) {
        const result = check(GOOD, name);
        expect(result.status, name).toBe('failed');
        expect(codesOf(result), name).toEqual(['NAME']);
        expect(result.findings[0]?.message, name).toMatch(/entry/i);
      }
      expect([...ENTRYPOINT_RULES].sort()).toEqual(['AGENTS.md', 'CLAUDE.local.md', 'CLAUDE.md', 'CURSOR.md', 'GEMINI.md']);
    });
  });

  describe('Tier 2: SIZE and ENCODING', () => {
    const filler = (bytes: number): string => `# T\n\n${'x'.repeat(bytes - 5)}`;

    it('passes a file of exactly the size cap and fails one byte more', () => {
      const atCap = filler(SIZE_CAP);
      expect(Buffer.byteLength(atCap)).toBe(SIZE_CAP);
      expect(check(atCap).status).toBe('passed');
      const over = check(`${atCap}x`);
      expect(over.status).toBe('failed');
      expect(codesOf(over)).toEqual(['SIZE']);
      expect(checkOf(over, 'size')?.status).toBe('failed');
    });

    it('does not run the content checks on an oversize file, and says so', () => {
      const result = check(filler(SIZE_CAP + 10));
      expect(result.lines).toBeNull();
      for (const id of ['encoding', 'budget', 'front-matter', 'structure', 'managed-marker', 'claude-render']) expect(checkOf(result, id)?.status, id).toBe('not-run');
      expect(checkOf(result, 'name')?.status).toBe('passed');
    });

    it('fails a byte order mark', () => {
      const result = check(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(GOOD)]));
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['ENCODING']);
      expect(result.findings[0]?.message).toMatch(/BOM|byte order/i);
    });

    it('fails a NUL byte', () => {
      const result = check(`# Title\n\nbody\u0000more\n`);
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['ENCODING']);
      expect(result.findings[0]?.message).toMatch(/NUL/);
    });

    it('fails invalid UTF-8', () => {
      const result = check(Buffer.concat([Buffer.from('# Title\n\nbody '), Buffer.from([0xc3, 0x28]), Buffer.from('\n')]));
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['ENCODING']);
      expect(result.findings[0]?.message).toMatch(/UTF-8/);
    });

    it('accepts valid multi-byte UTF-8 text', () => {
      expect(check('# Regeln für Übergaben\n\nSchreibe „klar“ und knapp — auch 日本語.\n').status).toBe('passed');
    });

    it('reports the other checks as well when the encoding fails', () => {
      const result = check(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('no title here\nbody\n')]));
      expect(codesOf(result)).toEqual(['ENCODING', 'STRUCTURE']);
    });
  });

  describe('Tier 2: BUDGET', () => {
    it('counts lines exactly as the projector does (a final newline adds one)', () => {
      expect(check(ruleOfLines(BUDGET - 1, '\n', true)).lines).toBe(BUDGET);
      expect(check(ruleOfLines(BUDGET, '\n', false)).lines).toBe(BUDGET);
      expect(check(ruleOfLines(BUDGET, '\n', true)).lines).toBe(BUDGET + 1);
    });

    it('passes exactly the budget and fails one line more', () => {
      expect(BUDGET).toBe(200);
      for (const finalNewline of [true, false]) {
        const at = ruleOfLines(finalNewline ? BUDGET - 1 : BUDGET, '\n', finalNewline);
        const over = ruleOfLines(finalNewline ? BUDGET : BUDGET + 1, '\n', finalNewline);
        expect(at.split(/\r?\n/).length).toBe(BUDGET);
        expect(over.split(/\r?\n/).length).toBe(BUDGET + 1);
        const passed = check(at);
        expect(passed.status).toBe('passed');
        expect(passed.lines).toBe(BUDGET);
        const failed = check(over);
        expect(failed.status).toBe('failed');
        expect(codesOf(failed)).toEqual(['BUDGET']);
        expect(failed.lines).toBe(BUDGET + 1);
        expect(failed.findings[0]?.message).toContain(String(BUDGET + 1));
        expect(failed.findings[0]?.path).toBe(failed.artifact);
      }
    });

    it('gives the same result for CRLF and LF files', () => {
      for (const fileLines of [BUDGET - 1, BUDGET, BUDGET + 1]) {
        for (const finalNewline of [true, false]) {
          const lf = check(ruleOfLines(fileLines, '\n', finalNewline));
          const crlf = check(ruleOfLines(fileLines, '\r\n', finalNewline));
          expect(crlf.status).toBe(lf.status);
          expect(crlf.lines).toBe(lf.lines);
          expect(codesOf(crlf)).toEqual(codesOf(lf));
        }
      }
    });
  });

  describe('Tier 2: FRONT_MATTER', () => {
    it('fails a rule that opens with a front-matter block', () => {
      const result = check('---\nname: x\n---\n# Title\n\nBody.\n');
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['FRONT_MATTER']);
      expect(checkOf(result, 'front-matter')?.status).toBe('failed');
    });

    it('fails an empty front-matter block and a CRLF one', () => {
      expect(codesOf(check('---\n---\n# Title\n\nBody.\n'))).toEqual(['FRONT_MATTER']);
      expect(codesOf(check(toCrlf('---\npaths:\n  - "src/**"\n---\n# Title\n\nBody.\n')))).toEqual(['FRONT_MATTER']);
    });

    it('does not take a later horizontal rule for front matter', () => {
      expect(check('# Title\n\nBody.\n\n---\n\nMore.\n').status).toBe('passed');
    });

    it('does not take an unclosed leading rule for front matter (the structure check reports it)', () => {
      const result = check('---\n# Title\n\nBody.\n');
      expect(codesOf(result)).toEqual(['STRUCTURE']);
    });
  });

  describe('Tier 2: STRUCTURE', () => {
    it('fails a rule without a level-1 title as its first non-empty line', () => {
      for (const text of ['Just prose.\nMore prose.\n', 'Intro line\n# Title\nBody\n', '## Level two\nBody\n', '#NoSpace\nBody\n', '#\nBody\n', '']) {
        const result = check(text);
        expect(result.status, JSON.stringify(text)).toBe('failed');
        expect(codesOf(result), JSON.stringify(text)).toEqual(['STRUCTURE']);
        expect(checkOf(result, 'structure')?.status).toBe('failed');
      }
    });

    it('fails a rule with a title but no body', () => {
      for (const text of ['# Title\n', '# Title', '# Title\n\n   \n\t\n']) {
        const result = check(text);
        expect(codesOf(result), JSON.stringify(text)).toEqual(['STRUCTURE']);
      }
    });

    it('accepts a title followed by one non-empty line', () => {
      expect(check('# Title\nx').status).toBe('passed');
    });

    it('judges the text after a front-matter block, so one mistake gives one finding', () => {
      expect(codesOf(check('---\nname: x\n---\n# Title\n\nBody.\n'))).toEqual(['FRONT_MATTER']);
    });
  });

  describe('Tier 2: MANAGED_MARKER', () => {
    it('fails a rule that carries the marker the projector writes', () => {
      const projected = ClaudeProjector.renderRule('# Title\n\nBody.\n', 'rules/good-rule.md').content;
      const result = check(projected);
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toContain('MANAGED_MARKER');
      expect(checkOf(result, 'managed-marker')?.status).toBe('failed');
    });

    it('fails the marker wherever it appears in the file', () => {
      const result = check('# Title\n\nBody.\n\n<!-- managed-by: agents-united | profile: claude | canonical: rules/x.md | do not edit -->\n');
      expect(codesOf(result)).toEqual(['MANAGED_MARKER']);
    });

    it('does not fail on similar words', () => {
      expect(check('# Title\n\nThis rule is managed by the team; agents united in purpose.\n').status).toBe('passed');
    });
  });

  describe('Tier 2: RENDER_CHANGE (what the Claude rendering would drop or rewrite)', () => {
    const renderedBody = (text: string): string => ClaudeProjector.renderRule(text, 'rules/good-rule.md').content.split('\n').slice(2).join('\n');

    it('fails a rule titled "Host Routing", whose heading and paragraph the projector would drop', () => {
      const text = '# Host Routing\n\nSend each task to the host that owns it.\n';
      expect(renderedBody(text)).not.toContain('Send each task');
      const result = check(text);
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['RENDER_CHANGE']);
      expect(checkOf(result, 'claude-render')?.status).toBe('failed');
      expect(result.findings[0]?.message).toContain('Host Routing');
      expect(result.findings[0]?.path).toBe(result.artifact);
    });

    it("fails a later section whose heading names another host's routing, and names that heading", () => {
      const result = check('# Title\n\nIntro.\n\n## Nested Subagent Delegation\n\nDetails.\n\n## Other\n\nKept.\n');
      expect(codesOf(result)).toEqual(['RENDER_CHANGE']);
      expect(result.findings[0]?.message).toContain('Nested Subagent Delegation');
    });

    it('fails a residue phrase in prose, which the projector would replace', () => {
      for (const phrase of ['language_server', 'language_server.exe', 'Cline & CLI', 'Nested Subagent Delegation', 'Host Routing']) {
        const text = '# Title\n\nMention ' + phrase + ' in a sentence.\n';
        expect(renderedBody(text), phrase).not.toContain(phrase);
        const result = check(text);
        expect(codesOf(result), phrase).toEqual(['RENDER_CHANGE']);
        expect(result.findings[0]?.message, phrase).toContain(phrase);
      }
    });

    it('fails a heading the projector would replace with its own section, and names it', () => {
      const result = check('# Title\n\n## Delegation Mechanics\n\nHow work is handed on.\n');
      expect(codesOf(result)).toEqual(['RENDER_CHANGE']);
      expect(result.findings[0]?.message).toContain('Delegation Mechanics');
    });

    it('passes the ordinary tool and command vocabulary rewrite', () => {
      const fence = '```';
      const text = '# Tools\n\nUse read_file, then run_command and send_message.\nStart with team_command.\n\n' + fence + '\nread_file stays in a fence\n' + fence + '\n';
      expect(renderedBody(text)).toContain('Use Read, then Bash and SendMessage.');
      const result = check(text);
      expect(result.status).toBe('passed');
      expect(checkOf(result, 'claude-render')?.status).toBe('passed');
    });

    it('keeps the title line and a non-empty body for every rule that passes', () => {
      for (const text of [GOOD, '# Title\nx', '\n\n# Title\nBody text', toCrlf(GOOD), '# Use read_file\n\nBody.\n']) {
        const result = check(text);
        expect(result.status, JSON.stringify(text)).toBe('passed');
        const lines = renderedBody(text).split(/\r?\n/).filter(line => line.trim() !== '');
        expect(lines.length, JSON.stringify(text)).toBeGreaterThanOrEqual(2);
        expect(lines[0], JSON.stringify(text)).toMatch(/^# \S/);
      }
    });

    it('does not run on a rule over the budget, which the projector skips', () => {
      const result = check(ruleOfLines(BUDGET + 1).replace('Line 3 of the rule.', 'Host Routing'));
      expect(codesOf(result)).toEqual(['BUDGET']);
      expect(checkOf(result, 'claude-render')?.status).toBe('not-run');
    });

    it('reports a rewrite together with the other failures', () => {
      const result = check('---\nname: x\n---\n# Host Routing\n\nBody.\n');
      expect(codesOf(result)).toEqual(['FRONT_MATTER', 'RENDER_CHANGE']);
    });
  });

  describe('Tier 2: all failures together', () => {
    it('reports every failed check in one result, each with the file path', () => {
      const text = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('---\nname: x\n---\n<!-- managed-by: agents-united | profile: claude -->\n\n'),
        Buffer.from('Intro without title\n'),
        Buffer.from(Array.from({ length: BUDGET }, (_, index) => `line ${index}\n`).join('')),
      ]);
      const result = check(text, 'Bad_Name.md');
      expect(result.status).toBe('failed');
      expect(codesOf(result)).toEqual(['BUDGET', 'ENCODING', 'FRONT_MATTER', 'MANAGED_MARKER', 'NAME', 'STRUCTURE']);
      expect(result.findings.every(item => item.path === result.artifact)).toBe(true);
      expect(result.checks.filter(item => item.status === 'failed').map(item => item.id)).toEqual(['name', 'encoding', 'budget', 'front-matter', 'structure', 'managed-marker']);
      expect(ruleCheckExitCode(result)).toBe(1);
    });

    it('lists the findings of each check under that check and again at the top level', () => {
      const result = check('no title\n', 'Bad.md');
      const nested = result.checks.flatMap(item => item.findings);
      expect(nested).toEqual(result.findings);
      expect(result.findings).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Tier 3: agreement with the projector and the built CLI
  // -------------------------------------------------------------------------------------------
  describe('Tier 3: cross-feature consistency with the Claude projector', () => {
    it('fails BUDGET exactly when renderRule refuses the same bytes, for LF and CRLF', () => {
      for (const eol of ['\n', '\r\n'] as const) {
        for (const finalNewline of [true, false]) {
          for (const fileLines of [BUDGET - 2, BUDGET - 1, BUDGET, BUDGET + 1, BUDGET + 2]) {
            const text = ruleOfLines(fileLines, eol, finalNewline);
            const result = check(text);
            let refused = false;
            try { ClaudeProjector.renderRule(text, 'rules/good-rule.md'); } catch { refused = true; }
            expect(codesOf(result).includes('BUDGET'), `${fileLines} lines ${JSON.stringify(eol)} final newline ${finalNewline}`).toBe(refused);
          }
        }
      }
    });

    it('a rule that passes projects with the marker first and no front matter', () => {
      const result = check(GOOD);
      expect(result.status).toBe('passed');
      const projected = ClaudeProjector.renderRule(GOOD, 'rules/good-rule.md').content;
      expect(projected.startsWith('<!-- managed-by: agents-united')).toBe(true);
      // The marker is the first line (the check above implies nothing precedes it, so no front matter), and the canonical text follows it unchanged.
      const [marker, blank, ...rest] = projected.split('\n');
      expect(marker).toMatch(/^<!-- .* -->$/);
      expect(blank).toBe('');
      expect(rest.join('\n')).toBe(GOOD);
    });
  });

  describe('Tier 3: the built CLI', () => {
    interface Json extends RuleCheckResult {}
    function run(...argv: string[]): { status: number | null; json: Json; stderr: string } {
      const done = spawnSync(process.execPath, [cli, 'rule-check', ...argv], { cwd: folder(), encoding: 'utf8', timeout: 30_000 });
      return { status: done.status, json: JSON.parse(done.stdout) as Json, stderr: done.stderr };
    }

    it('exits 0 and prints the passed JSON for a good rule', () => {
      const file = rule(GOOD);
      const done = run('--artifact', file);
      expect(done.status).toBe(0);
      expect(done.stderr).toBe('');
      expect(done.json.status).toBe('passed');
      expect(done.json.artifact).toBe(file);
      expect(done.json.findings).toEqual([]);
      expect(done.json.checks.map(item => item.id)).toEqual(CHECK_IDS);
    });

    it('exits 1 and lists the findings for a failing rule', () => {
      const done = run('--artifact', rule('no title\n', 'Bad_Name.md'));
      expect(done.status).toBe(1);
      expect(done.json.status).toBe('failed');
      expect(codesOf(done.json)).toEqual(['NAME', 'STRUCTURE']);
    });

    it('exits 2 for an unavailable input', () => {
      const done = run('--artifact', path.join(folder(), 'missing-rule.md'));
      expect(done.status).toBe(2);
      expect(done.json.status).toBe('unavailable');
      expect(codesOf(done.json)).toEqual(['INPUT_UNAVAILABLE']);
    });

    // `--help` and `-h` are the one documented exception: they print the usage text and exit 0 (see the help test below).
    it('exits 2 with a JSON USAGE result for every misuse, never CAC prose or a stack trace', () => {
      const file = rule(GOOD);
      const cases: string[][] = [
        // Dotted option names: CAC nests them into an object, and one that clashes with another option made CAC throw.
        ['--artifact.x', 'foo'],
        ['--foo.bar', '1'],
        ['--artifact', file, '--artifact.x', 'y'],
        ['--artifact', file, '--artifact.x.y', 'z'],
        ['--artifact', file, '--artifact.0', 'z'],
        ['--artifact.x', 'y', '--artifact', file],
        ['--artifact', file, '--a.b', '1', '--a.b.c', '2'],
        ['--a', '1', '--a.b', '2'],
        ['--constructor.prototype.x', '1'],
        ['--artifact', file, '--no-artifact'],
        [],
        ['--artifact'],
        ['--artifact', file, '--artifact', file],
        ['--artifact', file, '--nope'],
        ['--artifact', file, '-x'],
        [file],
        ['--artifact', file, 'extra'],
        ['--artifact', 'relative/rule.md'],
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
        const done = spawnSync(process.execPath, [cli, 'rule-check', flag], { cwd: folder(), encoding: 'utf8', timeout: 30_000 });
        expect(done.status, flag).toBe(0);
        expect(done.stdout, flag).toContain('--artifact');
        expect(done.stdout, flag).toContain('rule-check');
        expect(done.stderr, flag).toBe('');
      }
    });

    it('lists rule-check in the top-level help', () => {
      const done = spawnSync(process.execPath, [cli, '--help'], { cwd: folder(), encoding: 'utf8', timeout: 30_000 });
      expect(done.status).toBe(0);
      expect(done.stdout).toMatch(/rule-check\s+Check one canonical rule/);
    });

    it('leaves the rule untouched', () => {
      const file = rule(GOOD);
      const before = fs.readFileSync(file);
      run('--artifact', file);
      expect(fs.readFileSync(file).equals(before)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------------------------
  // Tier 4: the real registry
  // -------------------------------------------------------------------------------------------
  describe('Tier 4: every real rule in registry/rules', () => {
    const files = fs.readdirSync(REAL_RULES).filter(name => name.endsWith('.md'));
    const authored = files.filter(name => !ENTRYPOINT_RULES.has(name));

    it('finds the authored rules and the entry-point files', () => {
      expect(authored.length).toBeGreaterThanOrEqual(7);
      expect(files.length - authored.length).toBe(ENTRYPOINT_RULES.size - 1 /* CLAUDE.local.md is not shipped */);
    });

    it('passes rule-check for every authored rule, so a real rule never fails', () => {
      const failures: string[] = [];
      for (const name of authored) {
        const result = runRuleCheck({ artifact: path.join(REAL_RULES, name) });
        if (result.status !== 'passed') failures.push(`${name}: ${result.findings.map(item => `${item.code} ${item.message}`).join('; ')}`);
        expect(result.lines, name).toBeLessThanOrEqual(BUDGET);
      }
      expect(failures).toEqual([]);
    });

    it('keeps the title and body of every authored rule in the Claude rendering', () => {
      for (const name of authored) {
        const text = fs.readFileSync(path.join(REAL_RULES, name), 'utf8');
        const lines = ClaudeProjector.renderRule(text, 'rules/' + name).content.split(/\r?\n/).slice(2).filter(line => line.trim() !== '');
        expect(lines.length, name).toBeGreaterThanOrEqual(2);
        expect(lines[0], name).toBe(text.split(/\r?\n/).find(line => line.trim() !== '')?.trimEnd());
      }
    });

    it('refuses the entry-point files by name, as the projector skips them', () => {
      for (const name of files.filter(item => ENTRYPOINT_RULES.has(item))) {
        const result = runRuleCheck({ artifact: path.join(REAL_RULES, name) });
        expect(result.status, name).toBe('failed');
        expect(codesOf(result), name).toContain('NAME');
      }
    });
  });

  describe('Documentation: the README command table', () => {
    it('lists agents rule-check --artifact <path> in the CLI Reference, with a link to its ADR that resolves', () => {
      const readme = fs.readFileSync(path.resolve(checkout, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
      const reference = readme.slice(readme.indexOf('CLI Reference'));
      const row = reference.split('\n').find(line => line.startsWith('| `agents rule-check'));
      expect(row, 'a table row that starts with `agents rule-check').toBeDefined();
      expect(row).toContain('--artifact <path>');
      const link = /\]\((\.\/docs\/adr\/0082-[^)#]+\.md)(#[^)]*)?\)/.exec(row ?? '');
      expect(link, 'a link to ADR 0082').not.toBeNull();
      expect(fs.existsSync(path.resolve(checkout, link?.[1] ?? 'missing'))).toBe(true);
    });
  });
});
