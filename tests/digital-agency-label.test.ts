import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S9: the `experimental` label is removed from `digital-agency` (a draft pull request that waits for
 * the live hardening, M3). The bundle carries no status, like the thirty other bundles that are usable and
 * still being hardened; promoting it to `stable` is a separate decision. This suite pins that no current
 * text still calls the bundle experimental (history in plans and ADRs is not rewritten).
 */

const read = (p: string): string => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');
const bundles = (): Record<string, { status?: string; category?: string }> => JSON.parse(read('registry/bundles.json')).bundles;

describe('digital-agency is no longer labelled experimental', () => {
  it('has no status, and its category does not say Experimental', () => {
    const b = bundles()['digital-agency']!;
    expect(b.status).toBeUndefined();
    expect(b.category).toBe('Cross-Functional Digital Agency');
  });

  it('the README no longer calls it experimental and its links still resolve', () => {
    const readme = read('README.md');
    expect(readme).not.toMatch(/`digital-agency`[^\n]*experimental/i);
    expect(readme).not.toMatch(/experimental\)\s*\|\s*`digital-agency`/i);
    expect(readme).not.toContain('Organization Bundles (Experimental)');
    expect(readme).not.toContain('#-organization-bundles-experimental');
    expect(readme).toContain('## 🏢 Organization Bundles');
    expect(readme).toContain('(#-organization-bundles)');
  });

  it('PROJECT.md does not label the bundle experimental in its tree', () => {
    expect(read('PROJECT.md')).not.toMatch(/digital-agency ⚡ \[Experimental\]/);
  });

  it('CONTEXT.md does not call the Organization Bundle experimental either', () => {
    const context = read('CONTEXT.md');
    expect(context).not.toContain('Organization Bundle (Tier 2 / Experimental)');
    expect(context).toContain('**Organization Bundle (Tier 2)**:');
  });

  it('other bundles keep their statuses (the change touches one bundle)', () => {
    const b = bundles();
    expect(b['software-engineering']!.status).toBe('stable');
    expect(b['product-design']!.status).toBe('stable');
  });
});
