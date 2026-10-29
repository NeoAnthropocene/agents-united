import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { loadCorpus, measureAll, verdictOf } from '../scripts/skill-quality/measure.ts';

const SHA = '30d4553ecd46fbc5212fd0ff006ae43af522158b';
const OFFICIAL = [
  'remotion-best-practices',
  'remotion-captions',
  'remotion-create',
  'remotion-docs',
  'remotion-interactivity',
  'remotion-maps',
  'remotion-markup',
  'remotion-multimedia',
  'remotion-render',
  'remotion-saas',
  'remotion-studio',
  'remotion-upgrade',
];
const SKILLS = path.resolve('registry/skills');
const manifest = JSON.parse(fs.readFileSync('registry/bundles.json', 'utf8')) as {
  bundles: Record<string, { tier?: string; domain?: string; parentBundle?: string; skills?: string[]; recommendedAddons?: string[] }>;
};
const frontmatter = (dir: string): Record<string, any> => {
  const raw = fs.readFileSync(path.join(SKILLS, dir, 'SKILL.md'), 'utf8');
  return YAML.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)![1]);
};
const files = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (current: string, prefix = '') => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(path.join(SKILLS, dir));
  return out;
};

describe('the official Remotion skill add-on', () => {
  it('is an optional child bundle, never part of full', () => {
    const bundle = manifest.bundles['remotion-agent-skills'];
    expect(bundle).toBeDefined();
    expect(bundle.tier).toBe('domain');
    expect(bundle.domain).toBe('organization');
    expect(bundle.parentBundle).toBe('digital-agency');
    expect(bundle.skills).toEqual(OFFICIAL);
    expect(manifest.bundles['digital-agency'].recommendedAddons).toContain('remotion-agent-skills');
    expect(manifest.bundles.full.skills).not.toEqual(expect.arrayContaining(OFFICIAL));
  });

  it('vendors the pinned official skill files with the source-available licence and notice', () => {
    for (const name of OFFICIAL) {
      const dir = path.join(SKILLS, name);
      expect(fs.existsSync(path.join(dir, 'SKILL.md')), name).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'LICENSE.md'), 'utf8'), name).toContain('Remotion License');
      const notice = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
      expect(notice, name).toContain(SHA);
      expect(notice, name).toMatch(/unchanged|no editorial/i);
      const meta = frontmatter(name).metadata ?? {};
      expect(meta.license, name).toBe('LicenseRef-Remotion');
      expect(meta.source, name).toContain(`github.com/remotion-dev/skills/tree/${SHA}`);
      expect(lintSkillLicence({ dirName: name, license: meta.license, source: meta.source, files: files(name) }), name).toEqual([]);
    }
  });

  it('has no broken relative links after removing the duplicate nested copies', () => {
    const broken: string[] = [];
    for (const name of OFFICIAL) {
      const base = path.join(SKILLS, name);
      const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!entry.name.endsWith('.md')) continue;
          for (const [, target] of fs.readFileSync(full, 'utf8').matchAll(/\]\((\.[^)\s]+)\)/g)) {
            const file = target.split('#')[0];
            if (file && !fs.existsSync(path.resolve(path.dirname(full), file))) broken.push(`${path.relative(SKILLS, full)} -> ${target}`);
          }
        }
      };
      walk(base);
    }
    expect(broken).toEqual([]);
  });

  it('documents that neither rendering mode has a licence quota', () => {
    const modes = fs.readFileSync('registry/skills/remotion-production/references/rendering-modes.md', 'utf8');
    expect(modes).toMatch(/neither mode has a render quota/i);
    expect(modes).toMatch(/governs \*\*who may use Remotion for free\*\*/i);
    expect(modes).toContain('@remotion/web-renderer');
    expect(modes).toContain('4.0.491');
    expect(modes).toMatch(/z-index/);
    expect(modes).toMatch(/backdrop-filter/);
    expect(modes).toMatch(/linear-gradient/);
    expect(modes).toMatch(/not\*\* in the scaffold's pinned dependency set|not\*\* in\s+the scaffold's pinned dependency set/i);
    expect(modes).toMatch(/usage_limit_reached/);
    expect(modes).toMatch(/always one event per render|always sends/i);
    const runtime = fs.readFileSync('registry/skills/remotion-production/references/runtime.md', 'utf8');
    expect(runtime).toContain('rendering-modes.md');
    const skill = fs.readFileSync('registry/skills/remotion-production/SKILL.md', 'utf8');
    expect(skill).toContain('references/rendering-modes.md');
  });

  it('records the manual review of the one audit finding', () => {
    const review = fs.readFileSync(path.join(SKILLS, 'remotion-maps', 'SECURITY-REVIEW.md'), 'utf8');
    expect(review).toContain(SHA);
    expect(review).toContain('needs-review');
    expect(review).toContain('REMOTION_MAPTILER_KEY');
    expect(review).toMatch(/no credential value/i);
  });

  it('passes the catalog quality measure as third-party content', () => {
    const corpus = loadCorpus(path.resolve('tests/fixtures/skill-boilerplate-corpus.txt'));
    const measured = measureAll(SKILLS, corpus).filter(row => OFFICIAL.includes(row.name));
    expect(measured).toHaveLength(OFFICIAL.length);
    expect(measured.filter(row => verdictOf(row) !== 'ok')).toEqual([]);
  });

  it('is conditional on Remotion selection and documents every planned host plus optional Studio', () => {
    const production = fs.readFileSync('registry/skills/remotion-production/SKILL.md', 'utf8');
    const guide = fs.readFileSync('registry/skills/remotion-production/references/official-agent-skills.md', 'utf8');
    const studio = fs.readFileSync('registry/skills/remotion-production/references/studio.md', 'utf8');
    expect(production).toContain('references/official-agent-skills.md');
    expect(production).toContain('references/studio.md');
    expect(production).toMatch(/only when .*remotion|Remotion .*selected/i);
    expect(production).toMatch(/optional Studio|Studio .*optional/i);
    for (const host of ['Claude Code', 'Codex', 'Cursor', 'Antigravity', 'Cline', 'GitHub Copilot', 'Kimi Code']) {
      expect(guide, host).toContain(host);
    }
    for (const target of ['.claude/skills/', '.agents/skills/', '~/.claude/skills/', '~/.cursor/skills/', '~/.agents/skills/']) {
      expect(guide, target).toContain(target);
    }
    expect(guide).toContain('npx skills add remotion-dev/skills');
    expect(guide).toMatch(/official plugin/i);
    expect(studio).toMatch(/agent-only/i);
    expect(studio).toMatch(/hands-on/i);
    expect(studio).toContain('npx remotion studio');
    expect(studio).toMatch(/must not replace|final measured export|helper/i);
  });

  it('pins the current package release and ships a release drift checker', () => {
    const source = fs.readFileSync('registry/skills/remotion-production/scripts/project.mjs', 'utf8');
    const runtime = fs.readFileSync('registry/skills/remotion-production/references/runtime.md', 'utf8');
    const checker = fs.readFileSync('registry/skills/remotion-production/scripts/check-release.mjs', 'utf8');
    expect(source).toContain("REMOTION_VERSION = '4.0.539'");
    expect(runtime).toContain('4.0.539');
    expect(runtime).not.toContain('4.0.538');
    expect(checker).toContain('registry.npmjs.org/remotion/latest');
    expect(checker).toMatch(/compareReleaseVersions/);
  });

  it('makes Studio an explicit user choice without replacing agentic production or final gates', () => {
    for (const file of ['registry/agents/orchestrator-digital-agency.md', 'registry/hosts/claude/agents/orchestrator-digital-agency.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/Remotion[\s\S]*Studio/i);
      expect(text, file).toMatch(/agent-only/i);
      expect(text, file).toMatch(/hands-on/i);
      expect(text, file).toMatch(/optional/i);
    }
    for (const file of ['registry/agents/subagent-motion-designer.md', 'registry/hosts/claude/agents/agency-motion-designer.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/Remotion Studio/);
      expect(text, file).toMatch(/agentic|final measured export|helper/i);
    }
  });
});

