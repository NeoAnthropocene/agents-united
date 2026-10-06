import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035, Sitting D (H8, 2026-10-05), the funnel skill. Eval 1 asked for graded findings from four numbers and no page:
 * the skill's own rule (the evidence of a finding is a count, a recording or a page element you read) cannot give that, so
 * the assertions about graded findings failed with the skill and without it, and the skill could not show that it beats no
 * skill. Eval 1 now expects what the skill promises with no page (findings labelled "from the numbers, page not walked",
 * none graded S1 or S2), and eval 4 gives the skill a small static course site to read, with one defect planted at each
 * severity, so that the comparison can say whether the skill finds and grades them.
 */

const SKILL_DIR = path.resolve('registry/skills/conversion-funnel-optimization');
interface Eval { id: number; prompt: string; expected_output: string; files?: string[] }
const evals = (JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'evals', 'evals.json'), 'utf8')) as { evals: Eval[] }).evals;
const page = (name: string): string => fs.readFileSync(path.join(SKILL_DIR, 'evals', 'files', 'site', name), 'utf8').replace(/\r\n/g, '\n');

describe('conversion-funnel-optimization eval 1 expects what the skill can give from numbers alone', () => {
  const first = evals.find((e) => e.id === 1)!;

  it('says that findings are labelled from the numbers and that none is graded S1 or S2 without a page', () => {
    expect(first.expected_output).toMatch(/from the numbers, page not walked/);
    expect(first.expected_output).toMatch(/none is graded S1 or S2/i);
  });

  it('no longer asks for evidence items and a buildable fix on findings that no page backs', () => {
    expect(first.expected_output).not.toMatch(/graded S1 to S4 with a location, an evidence item/);
  });
});

describe('conversion-funnel-optimization eval 4 audits a static course site that carries defects at every severity', () => {
  const fixture = evals.find((e) => e.id === 4);

  it('exists, points at the site folder, repeats the funnel numbers, and lists three files that all exist', () => {
    expect(fixture, 'eval 4').toBeDefined();
    expect(fixture!.prompt).toMatch(/\bsite\b.*folder|folder.*\bsite\b/i);
    for (const n of ['18,400', '7,360', '1,470', '590']) expect(fixture!.prompt).toContain(n);
    expect(fixture!.files).toEqual(['files/site/index.html', 'files/site/pricing.html', 'files/site/checkout.html']);
    for (const f of fixture!.files ?? []) expect(fs.existsSync(path.join(SKILL_DIR, 'evals', f)), f).toBe(true);
  });

  it('plants an S1: a card field whose pattern rejects the format its own placeholder shows', () => {
    const checkout = page('checkout.html');
    expect(checkout).toMatch(/name="card"[^>]*pattern="\[0-9\]\{16\}"/);
    expect(checkout).toMatch(/name="card"[^>]*placeholder="1234 5678 9012 3456"/);
  });

  it('plants an S2: a pricing page with no viewport meta, a 960 px table and a small button at its far end', () => {
    const pricing = page('pricing.html');
    expect(pricing).not.toMatch(/name="viewport"/);
    expect(pricing).toMatch(/width:\s*960px/);
    expect(pricing).toMatch(/class="cta"/);
    expect(pricing).toMatch(/font-size:\s*12px/);
  });

  it('plants a second S2, a relevance mismatch: the landing page promises a free lesson and the pricing page offers none', () => {
    expect(page('index.html')).toMatch(/first lesson is free/i);
    expect(page('pricing.html')).not.toMatch(/free/i);
  });

  it('plants S3s: phone, company and address line 2 required with no reason, and no price or refund near the pay button', () => {
    const checkout = page('checkout.html');
    for (const f of ['phone', 'company', 'addr2']) expect(checkout).toMatch(new RegExp(`name="${f}"[^>]*required`));
    expect(checkout).not.toMatch(/refund|149/i);
  });

  it('plants an S4: a pay button labelled Submit', () => {
    expect(page('checkout.html')).toMatch(/<button[^>]*>Submit<\/button>/);
  });

  it('expects the pages to be read, not walked, and the findings graded with location and evidence', () => {
    expect(fixture!.expected_output).toMatch(/read from source, not walked/i);
    expect(fixture!.expected_output).toMatch(/S1/);
    expect(fixture!.expected_output).toMatch(/location/i);
  });
});
