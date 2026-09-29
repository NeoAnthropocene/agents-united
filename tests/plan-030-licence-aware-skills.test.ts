import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { classifyLicence, lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';

/**
 * Plan 030 — Licence-aware third-party skill adaptation.
 *
 * - Every catalog skill passes the licence lint (no blocked licence anywhere; every
 *   copyleft/share-alike skill carries LICENSE, NOTICE.md and a SHA-pinned source).
 * - The 12 adapted skills exist, carry their upstream licence and changes note, ship a
 *   runbook split into references/, pass the portability lint, and are credited in README.
 * - The two Plan 027 link-only stubs are gone.
 * - Bundles and specialists wire every adapted skill where the plan places it.
 */

const REGISTRY = path.resolve(process.cwd(), 'registry');
const SKILLS_DIR = path.join(REGISTRY, 'skills');
const AGENTS_DIR = path.join(REGISTRY, 'agents');
const README = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');
const BUNDLES = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as {
  bundles: Record<string, { skills?: string[]; agents?: string[] }>;
};

interface Adapted {
  dir: string;
  license: 'Apache-2.0' | 'MPL-2.0' | 'CC-BY-SA-4.0';
  upstream: string;
  bundles: string[];
  specialists: string[];
}

const ADAPTED: Adapted[] = [
  { dir: 'threat-modeling', license: 'Apache-2.0', upstream: 'trailofbits/skills-curated', bundles: ['secops-application-security'], specialists: ['appsec-penetration-tester', 'security-engineer'] },
  { dir: 'security-best-practices', license: 'Apache-2.0', upstream: 'trailofbits/skills-curated', bundles: ['secops-application-security'], specialists: ['security-engineer'] },
  { dir: 'terraform-test-patterns', license: 'MPL-2.0', upstream: 'hashicorp/agent-skills', bundles: ['devops-engineering'], specialists: ['devops-engineer'] },
  { dir: 'terraform-style-guide', license: 'MPL-2.0', upstream: 'hashicorp/agent-skills', bundles: ['devops-engineering', 'system-architecture-cloud'], specialists: ['devops-engineer', 'cloud-infrastructure-architect'] },
  { dir: 'semgrep-scanning', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['secops-application-security'], specialists: ['security-engineer'] },
  { dir: 'codeql-scanning', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['secops-application-security'], specialists: ['security-engineer'] },
  { dir: 'sarif-triage', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['secops-application-security'], specialists: ['security-engineer', 'appsec-penetration-tester'] },
  { dir: 'supply-chain-risk-audit', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['secops-application-security'], specialists: ['security-engineer'] },
  { dir: 'variant-analysis', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['secops-application-security'], specialists: ['appsec-penetration-tester'] },
  { dir: 'security-diff-review', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['secops-application-security'], specialists: ['security-engineer'] },
  { dir: 'property-based-testing', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['qa-automation'], specialists: ['qa-automation-lead'] },
  { dir: 'mutation-testing', license: 'CC-BY-SA-4.0', upstream: 'trailofbits/skills', bundles: ['qa-automation'], specialists: ['qa-automation-lead'] },
];

function readSkill(dir: string): { frontmatter: any; body: string } {
  const raw = fs.readFileSync(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${dir}: SKILL.md has no parsable frontmatter`);
  return { frontmatter: yaml.parse(match[1]) ?? {}, body: match[2] };
}

function listFiles(root: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(root, rel));
    else out.push(rel);
  }
  return out;
}

describe('Plan 030 — licence tiers', () => {
  it('classifies the tier table', () => {
    expect(classifyLicence('MIT')).toBe('permissive');
    expect(classifyLicence('Apache-2.0')).toBe('permissive');
    expect(classifyLicence('MPL-2.0')).toBe('weak-copyleft');
    expect(classifyLicence('CC-BY-SA-4.0')).toBe('share-alike');
    expect(classifyLicence('CC-BY-NC-SA-4.0')).toBe('blocked');
    expect(classifyLicence('CC-BY-ND-4.0')).toBe('blocked');
    expect(classifyLicence('GPL-3.0-only')).toBe('blocked');
    expect(classifyLicence('AGPL-3.0')).toBe('blocked');
  });

  it('flags a share-alike skill missing its licence file, notice and SHA pin', () => {
    const v = lintSkillLicence({ dirName: 'x', license: 'CC-BY-SA-4.0', source: 'https://example.com', files: ['SKILL.md'] });
    expect(v).toHaveLength(3);
  });

  it('every catalog skill passes the licence lint', () => {
    const violations: string[] = [];
    for (const dir of fs.readdirSync(SKILLS_DIR)) {
      if (!fs.existsSync(path.join(SKILLS_DIR, dir, 'SKILL.md'))) continue;
      const { frontmatter } = readSkill(dir);
      violations.push(
        ...lintSkillLicence({
          dirName: dir,
          license: frontmatter.metadata?.license,
          source: frontmatter.metadata?.source,
          files: listFiles(path.join(SKILLS_DIR, dir)),
        })
      );
    }
    expect(violations).toEqual([]);
  });
});

describe('Plan 030 — adapted skills', () => {
  it.each(ADAPTED)('$dir carries its licence, notice and pinned source', (spec) => {
    const dir = path.join(SKILLS_DIR, spec.dir);
    const { frontmatter } = readSkill(spec.dir);
    expect(frontmatter.name).toBe(spec.dir);
    expect(frontmatter.metadata?.license).toBe(spec.license);
    expect(frontmatter.metadata?.source).toContain(`github.com/${spec.upstream}/`);
    expect(frontmatter.metadata?.source).toMatch(/\b[0-9a-f]{40}\b/);
    expect(frontmatter.metadata?.commit).toMatch(/^[0-9a-f]{40}$/);

    expect(fs.existsSync(path.join(dir, 'LICENSE'))).toBe(true);
    const notice = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
    expect(notice).toContain(frontmatter.metadata.commit);
    expect(notice).toContain(spec.license);
    expect(notice).toMatch(/## What changed/);
  });

  it.each(ADAPTED)('$dir is an adaptation: no link-only stub, runbook sections, references/', (spec) => {
    const { frontmatter, body } = readSkill(spec.dir);
    expect(frontmatter['disable-slash-command'] === true && /link-only/i.test(body)).toBe(false);
    expect(body).not.toMatch(/Link-Only Stub/);
    for (const re of [
      /## Overview & Purpose/,
      /## Execution Triggers/,
      /## Input & Output Requirements/,
      /## Step-by-Step Execution Runbook/,
      /## Code & Config Exemplars/,
      /## Edge Cases & Error Recovery/,
      /## Verification Checklist/,
    ]) {
      expect(body, `${spec.dir} missing ${re.source}`).toMatch(re);
    }
    const refs = path.join(SKILLS_DIR, spec.dir, 'references');
    expect(fs.readdirSync(refs).filter((f) => f.endsWith('.md')).length).toBeGreaterThan(0);
    // Every references/ file the runbook links to exists.
    for (const [, rel] of body.matchAll(/\]\((references\/[^)#\s]+)/g)) {
      expect(fs.existsSync(path.join(SKILLS_DIR, spec.dir, rel)), `${spec.dir} links missing ${rel}`).toBe(true);
    }
  });

  it.each(ADAPTED)('$dir passes the portability lint', (spec) => {
    const { frontmatter, body } = readSkill(spec.dir);
    const skillDir = path.join(SKILLS_DIR, spec.dir);
    const scripts = listFiles(skillDir)
      .filter((f) => f.startsWith('scripts/'))
      .map((relPath) => ({ relPath, content: fs.readFileSync(path.join(skillDir, relPath), 'utf8') }));
    expect(lintSkillPortability({ dirName: spec.dir, name: frontmatter.name, body, scripts })).toEqual([]);
  });

  it.each(ADAPTED)('$dir is credited in the README', (spec) => {
    const credits = README.slice(README.indexOf('## 🤝 Credits & Acknowledgments'));
    expect(credits).toContain(`\`${spec.dir}\``);
    expect(credits).toContain(`github.com/${spec.upstream}`);
  });

  it.each(ADAPTED)('$dir is in its bundles and the full bundle', (spec) => {
    for (const b of [...spec.bundles, 'full']) {
      expect(BUNDLES.bundles[b]?.skills ?? [], `${spec.dir} missing from ${b}`).toContain(spec.dir);
    }
  });

  it.each(ADAPTED)('$dir is wired to its specialists (frontmatter + Skill Consultation Map)', (spec) => {
    for (const s of spec.specialists) {
      const raw = fs.readFileSync(path.join(AGENTS_DIR, `subagent-${s}.md`), 'utf8');
      const fm = yaml.parse(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
      // Frontmatter preloads a skill, so it may only name skills every bundle shipping the
      // role also ships (tests/bundle-skill-refs.test.ts). Otherwise the map row is the wiring.
      const shipping = Object.entries(BUNDLES.bundles)
        .filter(([name, def]) => name !== 'full' && (def.agents ?? []).includes(`subagent-${s}.md`))
        .map(([, def]) => def.skills ?? []);
      if (shipping.every((skills) => skills.includes(spec.dir))) {
        expect(fm.skills, `${s} frontmatter`).toContain(spec.dir);
      }
      const mapStart = raw.indexOf('## Skill Consultation Map');
      expect(mapStart, `${s} has no Skill Consultation Map`).toBeGreaterThan(-1);
      const map = raw.slice(mapStart, raw.indexOf('\n## ', mapStart + 5));
      expect(map, `${s} map row`).toContain(`\`${spec.dir}\``);
    }
  });

  it.each(ADAPTED)('$dir has no dangling relative links or stale bash-helper names', (spec) => {
    const root = path.join(SKILLS_DIR, spec.dir);
    const problems: string[] = [];
    for (const rel of listFiles(root).filter((f) => f.endsWith('.md'))) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target) || target.includes('{baseDir}')) continue;
        const file = target.split('#')[0];
        if (!file) continue;
        if (!fs.existsSync(path.resolve(root, path.dirname(rel), file))) problems.push(`${rel} -> ${target}`);
      }
      for (const stale of ['build_log.sh', 'find_databases.sh', 'generate_suite.sh', 'run-scans.sh', 'run_logged']) {
        if (rel !== 'NOTICE.md' && text.includes(stale)) problems.push(`${rel} mentions ${stale}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('code-reviewer reaches security-diff-review through a cross-bundle map row', () => {
    const raw = fs.readFileSync(path.join(AGENTS_DIR, 'subagent-code-reviewer.md'), 'utf8');
    const row = raw.split('\n').find((l) => l.includes('`security-diff-review`'));
    expect(row).toBeDefined();
    expect(row).toMatch(/secops-application-security/);
    expect(row).toMatch(/report to orchestrator/);
  });

  it('the README no longer carries the "linked, not vendored" block', () => {
    expect(README).not.toMatch(/linked, not vendored/);
    expect(README).toMatch(/carry their own licen[cs]e/i);
  });

  it('no NonCommercial upstream content is vendored anywhere', () => {
    for (const dir of fs.readdirSync(SKILLS_DIR)) {
      const lic = path.join(SKILLS_DIR, dir, 'LICENSE');
      if (fs.existsSync(lic)) expect(fs.readFileSync(lic, 'utf8'), dir).not.toMatch(/NonCommercial/);
    }
  });
});
