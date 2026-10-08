import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toDesignSystemTokens, validateDesignSystemTokens } from './helpers/claude-design-tokens.js';

/**
 * Plan 036 O2 (the maintainer's yes of 2026-10-08, "O2 next"): the tokens in the form that the Design System type of
 * Claude Design reads. Jamileh has no shell, so `design-system-tokens` carries a reference table and two worked
 * examples (decision D24 of Plan 035 stands: the skill has no script). Every example is held to the rules by the
 * converter in `tests/helpers/claude-design-tokens.ts`, so the table cannot drift from the rule it states.
 */

const read = (p: string): string => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');
const SKILL_DIR = 'registry/skills/design-system-tokens';
const REF = read(`${SKILL_DIR}/references/claude-design-format.md`);
const SKILL = read(`${SKILL_DIR}/SKILL.md`);
const EXAMPLE = read(`${SKILL_DIR}/examples/worked-example.md`);
const FIXTURE: unknown = JSON.parse(read('tests/fixtures/designer/design-tokens.json'));
const jsonBlocks = (md: string): unknown[] => [...md.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m => JSON.parse(m[1]!) as unknown);

describe('the Claude Design token format: the worked examples of the reference', () => {
  const blocks = (): unknown[] => jsonBlocks(REF);

  it('has three blocks: the skill\'s own example converted, then a second input and its output', () => {
    expect(blocks()).toHaveLength(3);
  });

  it('the first block is the skill\'s own worked example, converted by the rules', () => {
    const source = jsonBlocks(EXAMPLE)[0];
    expect(blocks()[0]).toEqual(toDesignSystemTokens(source, 'Worked example'));
    expect(validateDesignSystemTokens(blocks()[0] as ReturnType<typeof toDesignSystemTokens>)).toEqual([]);
  });

  it('the second pair covers spacing, radius, font families, type styles and another family, converted by the rules', () => {
    expect(blocks()[2]).toEqual(toDesignSystemTokens(blocks()[1], 'Spacing and type example'));
    expect(validateDesignSystemTokens(blocks()[2] as ReturnType<typeof toDesignSystemTokens>)).toEqual([]);
    const out = blocks()[2] as ReturnType<typeof toDesignSystemTokens>;
    expect(out.spacing?.tokens.map(t => t.name)).toEqual(['space-1', 'space-2']);
    expect(out.radius?.tokens[0]?.name).toBe('radius-md');
    expect(out.type?.groups[0]?.styles.map(s => s.name)).toEqual(['body', 'headline']);
    expect(out['shadow']).toBeDefined();
  });

  it('keeps an alias an alias: the target is named by its flattened name, not by its path', () => {
    const out = blocks()[0] as ReturnType<typeof toDesignSystemTokens>;
    const byName = Object.fromEntries(out.color.tokens.map(t => [t.name, t]));
    expect(byName['text-default']!.value).toBe('{gray-900}');
    expect(byName['text-muted']!.usage).toMatch(/white surfaces only/);
    expect(JSON.stringify(out)).not.toMatch(/\{color\./);
  });
});

describe('the Claude Design token format: the PetPal fixture, a real token file', () => {
  it('converts to a list form that the page can read in full', () => {
    const out = toDesignSystemTokens(FIXTURE, 'PetPal');
    expect(validateDesignSystemTokens(out)).toEqual([]);
    const byName = Object.fromEntries(out.color.tokens.map(t => [t.name, t]));
    expect(byName['cta-primary']!.value).toBe('{clay-600}');
    expect(byName['text-on-action']!.value).toBe('{white}');
    expect(byName['clay-600']!.value).toBe('#B5451B');
    expect(out.spacing!.tokens.find(t => t.name === 'space-4')!.value).toBe('32px');
    expect(out.radius!.tokens.find(t => t.name === 'radius-pill')!.value).toBe('999px');
    expect(out.type!.families['base']).toBe('Helvetica, Arial, sans-serif');
    expect(out.type!.groups[0]!.styles.find(s => s.name === 'headline')!.fontSize).toBe('96px');
  });

  it('turns every one of the 22 tokens into an entry, and loses none', () => {
    const out = toDesignSystemTokens(FIXTURE, 'PetPal');
    const entries = out.color.tokens.length + out.spacing!.tokens.length + out.radius!.tokens.length + Object.keys(out.type!.families).length + out.type!.groups[0]!.styles.length;
    expect(entries).toBe(22);
  });
});

describe('the Claude Design token format: what the page drops is refused', () => {
  const colour = (value: string): unknown => ({ color: { a: { $value: value, $type: 'color' } } });

  it('refuses a named colour, var() and color-mix()', () => {
    for (const bad of ['red', 'transparent', 'var(--brand)', 'color-mix(in srgb, red 50%, blue)']) expect(() => toDesignSystemTokens(colour(bad), 'x'), bad).toThrow(/drops it/);
  });

  it('accepts hex with alpha, rgb(), hsl() and oklch()', () => {
    for (const ok of ['#fff', '#ffff', '#ffffff', '#ffffff80', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.5)', 'hsl(10 20% 30%)', 'oklch(0.7 0.1 200)']) expect(() => toDesignSystemTokens(colour(ok), 'x'), ok).not.toThrow();
  });

  it('refuses an alias with no token, an alias loop, and an alias in the colour family that names another family', () => {
    expect(() => toDesignSystemTokens({ color: { a: { $value: '{color.missing}' } } }, 'x')).toThrow(/no token/);
    expect(() => toDesignSystemTokens({ color: { a: { $value: '{color.b}' }, b: { $value: '{color.a}' } } }, 'x')).toThrow(/loop/);
    expect(() => toDesignSystemTokens({ space: { 1: { $value: '8px' } }, color: { a: { $value: '{space.1}' } } }, 'x')).toThrow(/colour token/);
  });

  it('refuses a duplicate name, an unreadable name and a bad length', () => {
    expect(() => toDesignSystemTokens({ color: { a: { b: { $value: '#fff' } }, 'a-b': { $value: '#000' } } }, 'x')).toThrow(/used twice/);
    expect(() => toDesignSystemTokens({ color: { 'a b': { $value: '#fff' } } }, 'x')).toThrow(/does not fit/);
    expect(() => toDesignSystemTokens({ space: { 1: { $value: 'big' } } }, 'x')).toThrow(/not a number or a length/);
  });

  it('refuses a weight or a line height that has no size, and a value that is not a string or a number', () => {
    expect(() => toDesignSystemTokens({ font: { weight: { body: { $value: 700 } } } }, 'x')).toThrow(/has no font\.size\.body/);
    expect(() => toDesignSystemTokens({ color: { a: { $value: { r: 1 } } } }, 'x')).toThrow(/must be a string or a number/);
  });

  it('the validator finds a nested $value left in a list form, a missing alias target and a bad length', () => {
    const base = toDesignSystemTokens({ color: { a: { $value: '#fff' } } }, 'x');
    expect(validateDesignSystemTokens({ ...base, color: { ...base.color, tokens: [{ name: 'b', value: '{nope}', usage: '' }] } }).join(' ')).toMatch(/not a colour token/);
    expect(validateDesignSystemTokens({ ...base, spacing: { tokens: [{ name: 's', value: 'big', usage: '' }] } }).join(' ')).toMatch(/length "big"/);
    expect(validateDesignSystemTokens({ ...base, extra: { $value: '#fff' } }).join(' ')).toMatch(/nested \$value/);
  });
});

describe('the Claude Design token format: the reference and the skill', () => {
  it('states the mapping and the limits that the converter enforces', () => {
    for (const row of ['`color.<group>.<step>`', '`space.<n>`', '`radius.<n>`', '`font.family.<n>`', '`font.size.<n>`', '`$description`', '`shadow.<n>`']) expect(REF, row).toContain(row);
    for (const limit of ['[A-Za-z0-9][A-Za-z0-9_.-]{0,63}', 'oklch()', '`var()`', '`color-mix()`', 'px`, `rem`, `em` or `%`', 'used twice']) expect(REF, limit).toContain(limit);
  });

  it('says that design-tokens.json stays the source, that the second file is derived, and that she has no shell', () => {
    expect(REF).toMatch(/`design-tokens\.json` stays the source/);
    expect(REF).toMatch(/never edit it by hand/);
    expect(REF).toMatch(/You have no shell/);
    expect(REF).toMatch(/`claude-design-tokens\.json`/);
  });

  it('is pointed to from the skill, which keeps its 6,000 character ceiling and still has no script', () => {
    expect(SKILL).toContain('[references/claude-design-format.md](references/claude-design-format.md)');
    expect(SKILL.length).toBeLessThanOrEqual(6000);
    expect(fs.existsSync(path.resolve(`${SKILL_DIR}/scripts`))).toBe(false);
  });

  it('holds no secret, token or key', () => {
    expect(REF).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(REF).not.toMatch(/(api[_-]?key|password)\s*[:=]\s*\S{8,}/i);
  });
});
