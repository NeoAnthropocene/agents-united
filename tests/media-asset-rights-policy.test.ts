import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const base = 'registry/skills/remotion-production';
const read = (file: string): string => fs.readFileSync(`${base}/${file}`, 'utf8');

describe('proportionate asset rights guidance', () => {
  it('keeps intent-specific gates and known restrictions distinct', () => {
    const policy = read('references/asset-rights.md');
    expect(policy).toMatch(/personal-private[\s\S]*one quick[\s\S]*unresolved terms alone[\s\S]*not stall/i);
    expect(policy).toMatch(/noncommercial public[\s\S]*before publication[\s\S]*replacement or owner review/i);
    expect(policy).toMatch(/commercial[\s\S]*actual intended use[\s\S]*before delivery[\s\S]*affected asset[\s\S]*unrelated work/i);
    expect(policy).toMatch(/known restrictions[\s\S]*apply/i);
    expect(policy).toMatch(/noncommercial[\s\S]*not automatic permission/i);
  });

  it('preserves evidence, independent eligibility and voice consent', () => {
    const policy = read('references/asset-rights.md');
    expect(policy).toMatch(/reuse[\s\S]*source[\s\S]*version[\s\S]*hash[\s\S]*intended use/i);
    expect(policy).toMatch(/user-reported-permission[\s\S]*not independently verified/i);
    expect(policy).toMatch(/runtime[\s\S]*eligibility[\s\S]*voice consent[\s\S]*separate/i);
    expect(policy).toMatch(/no automatic[\s\S]*bypass/i);
    expect(policy).toContain('https://www.copyright.gov/fair-use/');
  });

  it('provides a usable example ledger without claiming example assets exist', () => {
    const ledger = read('assets/used-assets.example.md');
    expect(ledger).toMatch(/example[\s\S]*placeholder/i);
    for (const field of ['kind', 'ID', 'path', 'hash', 'version', 'source owner', 'source URL', 'terms URL', 'date', 'status', 'intended use', 'adaptations', 'required attribution', 'decision', 'owner', 'next action']) {
      expect(ledger.toLowerCase(), field).toContain(field.toLowerCase());
    }
    for (const status of ['original', 'licensed', 'user-reported-permission', 'terms-unverified', 'no-license-stated', 'restricted']) expect(ledger).toContain(status);
    expect(ledger).toContain('Check the commercial usage availability of the assets.');
    expect(ledger).toMatch(/actually used/i);
    expect(ledger).toMatch(/tool[\s\S]*code[\s\S]*weights[\s\S]*fonts[\s\S]*voices/i);
  });
});
