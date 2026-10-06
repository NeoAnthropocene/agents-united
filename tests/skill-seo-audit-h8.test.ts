import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035, Sitting D (H8, 2026-10-05), two findings on `seo-audit`.
 *
 * 1. Eval 2 asked for a guaranteed number-one ranking. The role never loaded the skill: its description said "Skip it to
 *    promise rankings", so the listing sent the model away from a request the skill's own anti-pattern answers ("a promised
 *    ranking or traffic number: no audit can know it"). The description now names the request as a trigger and says the
 *    skill declines it.
 * 2. Eval 1 audited `example.com`, the reserved placeholder domain: the four pages return 404, so neither configuration could
 *    produce a per-URL intent table, graded findings or a health score, and 4 of the 7 assertions failed with the skill and
 *    without it. The eval now audits a small static copy of a made-up site that carries the findings the skill is meant to
 *    find, so the comparison can say whether the skill helps.
 */

const SKILL_DIR = path.resolve('registry/skills/seo-audit');
const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const meta = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)![1]) as { description: string };
const description = meta.description.replace(/\s+/g, ' ').trim();
const section = (heading: string): string => text.split(`## ${heading}\n`)[1]?.split(/\n## /)[0] ?? '';

interface Eval { id: number; prompt: string; expected_output: string; files?: string[] }
const evals = (JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'evals', 'evals.json'), 'utf8')) as { evals: Eval[] }).evals;
const site = (rel: string): string => fs.readFileSync(path.join(SKILL_DIR, 'evals', 'files', 'site', rel), 'utf8').replace(/\r\n/g, '\n');

describe('seo-audit loads for a request to guarantee a ranking', () => {
  it('names the request as a trigger phrase and says the skill declines it', () => {
    expect(description).toMatch(/can you guarantee we rank/i);
    expect(description).toMatch(/declines/i);
  });

  it('no longer tells the model to skip the skill for that request, and keeps its other skip', () => {
    expect(description).not.toMatch(/skip it to promise rankings/i);
    expect(description).toMatch(/skip it for paid search/i);
  });

  it('keeps the description within the cap, and Execution Triggers agrees with it', () => {
    expect(description.length).toBeLessThanOrEqual(1024);
    const triggers = section('Execution Triggers');
    expect(triggers).toMatch(/guarantee a ranking/i);
    expect(triggers).toMatch(/decline/i);
    expect(triggers).not.toMatch(/do not use it to promise rankings/i);
  });
});

describe('seo-audit eval 1 audits a static copy that carries the findings', () => {
  const first = evals.find((e) => e.id === 1)!;

  it('points at the site folder and lists the files, all of which exist', () => {
    expect(first.prompt).toMatch(/\bsite\b.*folder|folder.*\bsite\b/i);
    expect(first.prompt).not.toMatch(/example\.com/);
    expect(first.files?.length).toBeGreaterThanOrEqual(6);
    for (const f of first.files ?? []) expect(fs.existsSync(path.join(SKILL_DIR, 'evals', f)), f).toBe(true);
  });

  it('names the four pages that matter and still says Search Console exports can be sent', () => {
    for (const p of ['/docs/webhooks', '/pricing', '/blog/webhook-retries', '/blog/retry-strategies']) expect(first.prompt).toContain(p);
    expect(first.prompt).toMatch(/Search Console/);
  });

  it('plants two critical findings: noindex on the pricing page, a canonical to the staging host on the docs page', () => {
    expect(site('pricing.html')).toMatch(/<meta name="robots" content="[^"]*noindex/);
    expect(site('docs/webhooks.html')).toMatch(/<link rel="canonical" href="https:\/\/staging\./);
  });

  it('plants two major findings: robots and sitemap name the staging host, and two blog posts chase one query', () => {
    expect(site('robots.txt')).toMatch(/Sitemap: https:\/\/staging\./);
    expect(site('sitemap.xml')).toMatch(/staging\.hookrelay\.example/);
    for (const post of ['blog/webhook-retries.html', 'blog/retry-strategies.html']) {
      expect(site(post), post).toMatch(/<title>[^<]*retr(y|ies)[^<]*<\/title>/i);
      expect(site(post), post).toMatch(/<h1>[^<]*webhook retries[^<]*<\/h1>/i);
    }
  });

  it('plants two minor findings: a post with no meta description and an image with no alt text', () => {
    expect(site('blog/retry-strategies.html')).not.toMatch(/name="description"/);
    expect(site('docs/webhooks.html')).toMatch(/<img (?![^>]*\balt=)[^>]*>/);
  });

  it('says in the expected output that the copy cannot show status codes, so the audit must say so', () => {
    expect(first.expected_output).toMatch(/status codes/i);
  });
});
