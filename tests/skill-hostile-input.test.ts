import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';
import { measureSkill } from '../src/core/skill-quality.js';

/**
 * P8a review F1 and F2: two regular expressions that were quadratic on one long hostile line.
 * The fixed code must flag exactly the inputs the old expressions flagged, in linear time. The
 * old expressions are kept here, verbatim, as the reference the new code is compared with.
 */

// ---- The reference: the expressions exactly as they were before the fix ---------------------
const OLD_BASH_ONLY_SHEBANG = /^#!.*\bbash\b/;
const OLD_BASH_ONLY_SYNTAX = /\[\[.*\]\]|local\s+-[aA]\b|<\(/;
const OLD_THIRD_PARTY_SOURCE = /^\s+source:\s*(\S+)/m;
const FRONT_MATTER_FOR_REFERENCE = /^---\r?\n([\s\S]*?)\r?\n---/;

const referenceBashFlagged = (content: string): boolean =>
  OLD_BASH_ONLY_SHEBANG.test(content.split('\n')[0] ?? '') || OLD_BASH_ONLY_SYNTAX.test(content);
const referenceThirdParty = (frontMatter: string): boolean => {
  const source = frontMatter.match(OLD_THIRD_PARTY_SOURCE)?.[1];
  return source !== undefined && !/NeoAnthropocene\/agents-united/i.test(source);
};

// ---- The code under test, reached only through its public entry points ----------------------
const BASH_MESSAGE = 'uses a bash-only shebang or syntax';
const lintScript = (content: string, relPath = 'scripts/x.sh'): string[] =>
  lintSkillPortability({ dirName: 's', name: 's', body: '', scripts: [{ relPath, content }] });
const newBashFlagged = (content: string): boolean => lintScript(content).some(message => message.includes(BASH_MESSAGE));

const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-hostile-')));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
/** The `thirdParty` figure the measure reports for a SKILL.md with this exact text. */
function newThirdParty(skillMd: string): boolean {
  counter += 1;
  const name = `s${counter}`;
  fs.mkdirSync(path.join(scratch, name), { recursive: true });
  fs.writeFileSync(path.join(scratch, name, 'SKILL.md'), skillMd);
  return measureSkill(scratch, name, new Set()).thirdParty;
}
const frontMatterOf = (skillMd: string): string => skillMd.match(FRONT_MATTER_FOR_REFERENCE)?.[1] ?? '';

/** A small deterministic generator, so the differential run is the same on every machine. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
function randomText(next: () => number, pieces: string[], maxPieces: number): string {
  const count = Math.floor(next() * maxPieces);
  let out = '';
  for (let i = 0; i < count; i += 1) out += pieces[Math.floor(next() * pieces.length)]!;
  return out;
}

// ---------------------------------------------------------------------------------------------
// F1: BASH_ONLY_SYNTAX
// ---------------------------------------------------------------------------------------------

describe('portability lint: the bash-only syntax test is linear and flags exactly what it flagged before', () => {
  const table: Array<[string, string]> = [
    ['an empty script', ''],
    ['a plain POSIX script', '#!/bin/sh\necho hello\n'],
    ['[[ ]] on one line', 'if [[ -f x ]]; then echo y; fi\n'],
    ['an empty [[]]', '[[]]\n'],
    ['[[ with only one ] after it', '[[ x ]\n'],
    ['[[ and ]] on different lines', '[[ x\n]]\n'],
    ['[[ and ]] split by a carriage return', '[[ x\r]]\n'],
    ['[[ and ]] split by U+2028', '[[ x\u2028]]\n'],
    ['[[ and ]] split by U+2029', '[[ x\u2029]]\n'],
    ['[[ and ]] split by CRLF', '[[ x\r\n]]\n'],
    ['the closing ]] before the opening [[', ']] and then [[\n'],
    ['touching brackets [[]', '[[]\n'],
    ['overlapping brackets [[[]]]', '[[[]]]\n'],
    ['a later [[ closed on its own line after an unclosed one', '[[ open\nok [[ x ]] done\n'],
    ['an unclosed first [[ and a closed second [[ on one line', '[[ a [[ b ]]\n'],
    ['local -a', 'f() { local -a arr; }\n'],
    ['local -A', 'f() { local -A map; }\n'],
    ['local with a tab before the flag', 'f() { local\t-a arr; }\n'],
    ['local across a newline', 'f() { local\n-a arr; }\n'],
    ['local -ab (no word boundary)', 'f() { local -ab arr; }\n'],
    ['local -x', 'f() { local -x arr; }\n'],
    ['process substitution', 'diff <(sort a) <(sort b)\n'],
    ['a lone <', 'cat < file\n'],
    ['a bash shebang', '#!/bin/bash\necho hi\n'],
    ['an env bash shebang', '#!/usr/bin/env bash\necho hi\n'],
    ['a bash shebang only on line two', 'echo hi\n#!/bin/bash\n'],
    ['bashful in a shebang (no word boundary)', '#!/bin/bashful\necho hi\n'],
    ['a shebang with CRLF', '#!/bin/bash\r\necho hi\r\n'],
    ['brackets in a quoted string', 'echo "a [[ b ]] c"\n'],
    ['many brackets without a closer', `${'[['.repeat(40)}\n`],
    ['many closers without an opener', `${']]'.repeat(40)}\n`],
  ];

  it.each(table)('agrees with the old expressions on %s', (_label, content) => {
    expect(newBashFlagged(content)).toBe(referenceBashFlagged(content));
  });

  it('flags a bash-only .sh script and keeps the message and the counterpart rule', () => {
    const messages = lintScript('if [[ -f x ]]; then echo y; fi\n');
    expect(messages).toEqual([
      'Skill "s": scripts/x.sh uses a bash-only shebang or syntax with no cross-platform counterpart ' +
        '(e.g. a .ps1 or .py file with the same name). Windows has no bash by default; scripts must run on Windows and POSIX.',
    ]);
    const withCounterpart = lintSkillPortability({
      dirName: 's', name: 's', body: '',
      scripts: [{ relPath: 'scripts/x.sh', content: 'if [[ -f x ]]; then :; fi\n' }, { relPath: 'scripts/x.ps1', content: 'Write-Output ok\n' }],
    });
    expect(withCounterpart).toEqual([]);
  });

  it('never flags a non-.sh script whatever it holds', () => {
    expect(lintScript('if [[ -f x ]]; then echo y; fi\n', 'scripts/x.mjs')).toEqual([]);
  });

  it('agrees with the old expressions on 4,000 random strings built from the interesting characters', () => {
    const next = prng(0x5eed);
    const pieces = ['[', ']', '[[', ']]', '<', '(', ')', 'local', ' ', '\t', '-', 'a', 'A', 'x', '\n', '\r', '\r\n', '\u2028', '\u2029', '#!', '/bin/bash', 'bash', ' bash '];
    for (let i = 0; i < 4000; i += 1) {
      const content = randomText(next, pieces, 14);
      expect(newBashFlagged(content), JSON.stringify(content)).toBe(referenceBashFlagged(content));
    }
  });

  it('lints a 256 KiB single line of [[ in well under two seconds, for a .sh and a non-.sh script', () => {
    const hostile = '['.repeat(256 * 1024);
    for (const relPath of ['scripts/x.sh', 'scripts/x.mjs']) {
      const started = performance.now();
      const messages = lintScript(hostile, relPath);
      const elapsed = performance.now() - started;
      expect(elapsed, `${relPath} took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
      expect(messages).toEqual([]);
    }
  }, 120_000);

  it('still finds a ]] that closes a [[ on the same 256 KiB line, quickly', () => {
    const hostile = `${'['.repeat(256 * 1024)}]]`;
    const started = performance.now();
    const flagged = newBashFlagged(hostile);
    const elapsed = performance.now() - started;
    expect(elapsed, `took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
    expect(flagged).toBe(true);
  }, 120_000);

  it('handles many long lines each holding an unclosed [[ quickly', () => {
    const hostile = `${'[[ '.repeat(100)}\n`.repeat(900);
    const started = performance.now();
    const flagged = newBashFlagged(hostile);
    const elapsed = performance.now() - started;
    expect(elapsed, `took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
    expect(flagged).toBe(referenceBashFlagged(hostile));
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------
// F2: the third-party source test of the quality measure
// ---------------------------------------------------------------------------------------------

describe('quality measure: the third-party source test is linear and answers exactly as it did before', () => {
  const skill = (frontMatter: string): string => `---\n${frontMatter}\n---\n\n# Title\n\nSome body text for the skill.\n`;
  const table: Array<[string, string]> = [
    ['no source at all', 'name: a\ndescription: b'],
    ['an indented upstream source', 'name: a\nmetadata:\n  source: https://example.com/x'],
    ['an indented source from this repository', 'name: a\nmetadata:\n  source: https://github.com/NeoAnthropocene/agents-united/x'],
    ['the repository name in another case', 'name: a\nmetadata:\n  source: https://github.com/neoanthropocene/AGENTS-UNITED/x'],
    ['a tab-indented source', 'metadata:\n\tsource: https://example.com/x'],
    ['a source with no space after the colon', 'metadata:\n  source:https://example.com/x'],
    ['a source with many spaces after the colon', 'metadata:\n  source:      https://example.com/x'],
    ['a source whose value is on the next line', 'metadata:\n  source:\n    https://example.com/x'],
    ['a source whose value is on the next line after a blank line', 'metadata:\n  source:\n\n    https://example.com/x'],
    ['a source with no value at the end of the front matter', 'metadata:\n  source:'],
    ['a source with only spaces after it at the end', 'metadata:\n  source:   '],
    ['an unindented source (column 0, previous line not blank)', 'name: a\nsource: https://example.com/x'],
    ['a column 0 source directly after a blank line', 'name: a\n\nsource: https://example.com/x'],
    ['a column 0 source directly after a whitespace-only line', 'name: a\n   \nsource: https://example.com/x'],
    ['a column 0 source after a CRLF blank line', 'name: a\r\n\r\nsource: https://example.com/x'],
    ['a column 0 source after a single CRLF', 'name: a\r\nsource: https://example.com/x'],
    ['a column 0 source after a bare carriage return', 'name: a\rsource: https://example.com/x'],
    ['a column 0 source after a U+2028 and a space', 'name: a\u2028 source: https://example.com/x'],
    ['a column 0 source directly after U+2028', 'name: a\u2028source: https://example.com/x'],
    ['a column 0 source directly after two U+2029', 'name: a\u2029\u2029source: https://example.com/x'],
    ['source as the last word of a value line', 'description: use the source: https://example.com/x'],
    ['a key that merely ends in source', 'metadata:\n  open-source: https://example.com/x'],
    ['an upper case Source key', 'metadata:\n  Source: https://example.com/x'],
    ['two sources, the first from this repository', 'a:\n  source: NeoAnthropocene/agents-united\nb:\n  source: https://example.com/x'],
    ['two sources, the first upstream', 'a:\n  source: https://example.com/x\nb:\n  source: NeoAnthropocene/agents-united'],
    ['a first candidate with no value, then a real one', 'a:\n  source:   \nb:\n  source: https://example.com/x'],
    ['a first candidate cut by a column 0 key, then a real one', 'a:\n  source:\nb: 1\nc:\n  source: https://example.com/x'],
    ['a non-breaking space indent', 'metadata:\n\u00a0\u00a0source: https://example.com/x'],
    ['a BOM-like U+FEFF indent', 'metadata:\n\ufeffsource: https://example.com/x'],
    ['the first line of the front matter indented', '  source: https://example.com/x'],
    ['the first line of the front matter unindented', 'source: https://example.com/x'],
    ['a leading blank line then a column 0 source', '\nsource: https://example.com/x'],
    ['an empty front matter', ''],
  ];

  it.each(table)('agrees with the old expression on %s', (_label, frontMatter) => {
    const text = skill(frontMatter);
    expect(newThirdParty(text)).toBe(referenceThirdParty(frontMatterOf(text)));
  });

  it('reports the cases that matter the way they were reported', () => {
    expect(newThirdParty(skill('name: a\nmetadata:\n  source: https://example.com/x'))).toBe(true);
    expect(newThirdParty(skill('name: a\nmetadata:\n  source: https://github.com/NeoAnthropocene/agents-united/x'))).toBe(false);
    // Preserved on purpose: `\s+` spans newlines, so a column 0 source right after a blank line matches.
    expect(newThirdParty(skill('name: a\n\nsource: https://example.com/x'))).toBe(true);
    expect(newThirdParty(skill('name: a\nsource: https://example.com/x'))).toBe(false);
  });

  it('agrees with the old expression on 1,500 random front matters built from the interesting characters', () => {
    const next = prng(0xfeed);
    const pieces = ['source:', 'source: ', ' ', '  ', '\t', '\n', '\r', '\r\n', '\u2028', '\u2029', '\u00a0', 'x', 'k:', 'NeoAnthropocene/agents-united', 'https://example.com/y', '---', '#'];
    for (let i = 0; i < 1500; i += 1) {
      const text = `---\n${randomText(next, pieces, 14)}\n---\n\nbody text here\n`;
      expect(newThirdParty(text), JSON.stringify(text)).toBe(referenceThirdParty(frontMatterOf(text)));
    }
  }, 120_000);

  it('measures a SKILL.md whose front matter is 256 KiB of blank lines in well under two seconds', () => {
    const text = skill('\n'.repeat(256 * 1024));
    counter += 1;
    const name = `s${counter}`;
    fs.mkdirSync(path.join(scratch, name), { recursive: true });
    fs.writeFileSync(path.join(scratch, name, 'SKILL.md'), text);
    const started = performance.now();
    const measure = measureSkill(scratch, name, new Set());
    const elapsed = performance.now() - started;
    expect(elapsed, `took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
    expect(measure.thirdParty).toBe(false);
  }, 120_000);

  it('finds a real source after 256 KiB of whitespace, and gives CRLF blank lines the same speed', () => {
    for (const eol of ['\n', '\r\n', ' \n']) {
      const text = skill(`${eol.repeat(100 * 1024)}  source: https://example.com/x`);
      counter += 1;
      const name = `s${counter}`;
      fs.mkdirSync(path.join(scratch, name), { recursive: true });
      fs.writeFileSync(path.join(scratch, name, 'SKILL.md'), text);
      const started = performance.now();
      const measure = measureSkill(scratch, name, new Set());
      const elapsed = performance.now() - started;
      expect(elapsed, `${JSON.stringify(eol)} took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
      expect(measure.thirdParty).toBe(true);
    }
  }, 120_000);

  it('handles a run of blank lines with no source keyword at all, then a failing candidate, quickly', () => {
    const text = skill(`${'\n'.repeat(100 * 1024)}  source:${' '.repeat(100 * 1024)}`);
    counter += 1;
    const name = `s${counter}`;
    fs.mkdirSync(path.join(scratch, name), { recursive: true });
    fs.writeFileSync(path.join(scratch, name, 'SKILL.md'), text);
    const started = performance.now();
    const measure = measureSkill(scratch, name, new Set());
    const elapsed = performance.now() - started;
    expect(elapsed, `took ${elapsed.toFixed(0)} ms`).toBeLessThan(2000);
    expect(measure.thirdParty).toBe(referenceThirdParty(frontMatterOf(text)));
  }, 120_000);
});
