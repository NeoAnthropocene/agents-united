import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S5: the redirect-chain reader that ships with `technical-seo-audit` for Selin (who has a shell). It parses
 * the output of `curl -sI -L` and is held to the shapes curl prints, including the example in the skill.
 */

const SKILLS = path.resolve('registry/skills');
const CHAIN = path.join(SKILLS, 'technical-seo-audit', 'scripts', 'redirect-chain.mjs');
const chain = (input: string, ...args: string[]) => spawnSync('node', [CHAIN, ...args], { encoding: 'utf8', input });

const BLOCK = (status: string, headers: string[] = []): string => `HTTP/2 ${status}\r\n${headers.join('\r\n')}${headers.length > 0 ? '\r\n' : ''}\r\n`;

describe('technical-seo-audit redirect-chain.mjs', () => {
  it('reads the output of curl -sI -L: two hops, then a noindex on the final page, is a chain and a finding', () => {
    const out = BLOCK('301', ['location: https://example.com/docs/webhooks/']) + BLOCK('301', ['location: https://www.example.com/docs/webhooks/']) + BLOCK('200', ['x-robots-tag: noindex']);
    const r = chain(out);
    expect(r.stdout).toContain('hop 1: 301 -> https://example.com/docs/webhooks/');
    expect(r.stdout).toContain('hop 2: 301 -> https://www.example.com/docs/webhooks/');
    expect(r.stdout).toContain('final: 200');
    expect(r.stdout).toContain('2 redirect hops');
    expect(r.stdout).toMatch(/redirect chain/i);
    expect(r.stdout).toMatch(/noindex/);
    expect(r.status).toBe(1);
  });

  it('passes a direct 200, and a single redirect to a 200', () => {
    const direct = chain(BLOCK('200', ['content-type: text/html']));
    expect(direct.stdout).toContain('0 redirect hops');
    expect(direct.status).toBe(0);
    const one = chain(BLOCK('301', ['location: /new']) + BLOCK('200'));
    expect(one.stdout).toContain('1 redirect hop');
    expect(one.status).toBe(0);
  });

  it('finds a loop, and a redirect that ends in an error', () => {
    const loop = chain(BLOCK('302', ['location: /a']) + BLOCK('302', ['location: /b']) + BLOCK('302', ['location: /a']) + BLOCK('302', ['location: /b']));
    expect(loop.stdout).toMatch(/redirect loop/i);
    expect(loop.status).toBe(1);
    const dead = chain(BLOCK('301', ['location: /gone']) + BLOCK('404'));
    expect(dead.stdout).toMatch(/final status 404/);
    expect(dead.status).toBe(1);
  });

  it('parses the example in the skill, which is the exact shape curl prints', () => {
    const example = fs.readFileSync(path.join(SKILLS, 'technical-seo-audit', 'examples', 'worked-example.md'), 'utf8');
    const m = example.match(/```text\r?\n\$ curl -sI -L [^\n]*\n([\s\S]*?)```/);
    expect(m, 'the worked example has a curl block').not.toBeNull();
    const r = chain(m![1]!.replace(/\r?\n/g, '\r\n'));
    expect(r.stdout).toContain('2 redirect hops');
    expect(r.stdout).toMatch(/noindex/);
  });

  it('reads a file argument as well as standard input, and exits 2 with usage for a missing file or no hop at all', () => {
    const file = path.join(SKILLS, 'technical-seo-audit', 'examples', 'worked-example.md');
    expect(spawnSync('node', [CHAIN, file], { encoding: 'utf8' }).stdout).toContain('2 redirect hops');
    const missing = spawnSync('node', [CHAIN, path.join(SKILLS, 'technical-seo-audit', 'no-such-file.txt')], { encoding: 'utf8' });
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain('usage');
    const empty = chain('not curl output');
    expect(empty.status).toBe(2);
    expect(empty.stderr).toContain('usage');
  });

  it('is run by technical-seo-audit through CLAUDE_SKILL_DIR', () => {
    expect(fs.readFileSync(path.join(SKILLS, 'technical-seo-audit', 'SKILL.md'), 'utf8')).toContain('${CLAUDE_SKILL_DIR}/scripts/redirect-chain.mjs');
  });
});
