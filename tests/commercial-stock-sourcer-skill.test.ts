import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';
import { nativeText } from './helpers/native-roles.js';
import { validateRewrittenSkill } from './helpers/skill-contract.js';
import { checkSkillLayout, supportingText } from './helpers/skill-layout.js';

const SKILL = 'commercial-stock-sourcer';
const DIR = path.resolve('registry/skills', SKILL);
const read = (rel: string): string => fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const skill = (): string => read('SKILL.md');
const body = (): string => skill().replace(/^---\n[\s\S]*?\n---\n/, '');
const meta = (): {
  name: string;
  description: string;
  metadata: { author: string; version: string; icon?: string; source?: string };
  [k: string]: unknown;
} => YAML.parse(/^---\n([\s\S]*?)\n---/.exec(skill())![1]!) as ReturnType<typeof meta>;

const allFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const bundles = (): Record<string, { skills?: string[] }> =>
  (
    JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as {
      bundles: Record<string, { skills?: string[] }>;
    }
  ).bundles;

const tableRow = (role: string): string =>
  nativeText(role)
    .split('\n')
    .find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${SKILL}\``) ?? '';

describe('Tier 3 — Skill Layout, Contract & Host-Fit: commercial-stock-sourcer', () => {
  it('passes checkSkillLayout and validateRewrittenSkill with zero errors and has its laid-out marker', () => {
    const skillsRoot = path.resolve('registry/skills');
    expect(fs.existsSync(DIR)).toBe(true);
    expect(checkSkillLayout(skillsRoot, SKILL)).toEqual([]);
    expect(validateRewrittenSkill(SKILL, skill(), supportingText(DIR))).toEqual([]);
    expect(fs.existsSync(path.resolve('tests/fixtures/laid-out-skills', SKILL))).toBe(true);
  });

  it('stays within the 90-line, 6000-character budget and keeps description under 250 characters', () => {
    const raw = skill();
    expect(raw.length).toBeLessThanOrEqual(6000);
    expect(raw.split('\n').length).toBeLessThanOrEqual(90);
    const d = meta().description.replace(/\s+/g, ' ');
    expect(d).toMatch(/^Use when /);
    expect(d).toMatch(/trigger phrases:/i);
    expect(d).toMatch(/\bSkip it when\b/);
    expect(d.length).toBeLessThan(250);
  });

  it('references every supporting file, uses ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs, and contains zero foreign host tool tokens or secrets', () => {
    const expectedFiles = [
      'references/providers-and-licensing.md',
      'examples/worked-example.md',
      'scripts/fetch-stock.mjs',
      'evals/evals.json',
    ];
    for (const rel of expectedFiles) {
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
      if (!rel.startsWith('evals/')) {
        expect(body(), `SKILL.md mentions ${rel}`).toContain(rel);
      }
    }
    expect(body()).toContain('${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs');

    const forbiddenTokens = [
      'write_to_file',
      'view_file',
      'run_command',
      'generate_image',
      'ArtifactMetadata',
      'agent-embed',
      'MediaResolution',
      'invoke_subagent',
    ];
    for (const file of allFiles(DIR)) {
      const rel = path.relative(DIR, file).replace(/\\/g, '/');
      if (rel.startsWith('evals/')) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const token of forbiddenTokens) {
        expect(text, `${rel} must not contain foreign token ${token}`).not.toContain(token);
      }
      expect(text, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(text, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
    }
  });

  it('teaches the 4-step Vision-in-the-Loop workflow and provenance sidecar requirement', () => {
    const b = body();
    expect(b).toMatch(/Fetch Candidates/i);
    expect(b).toMatch(/Vision-in-the-Loop Inspection/i);
    expect(b).toMatch(/Select, Promote & Clean Up/i);
    expect(b).toMatch(/Provenance Sidecar & Attribution/i);
    expect(b).toMatch(/\.provenance\.json/);
    expect(b).toMatch(/never ship a stock asset unseen/i);
  });

  it('is registered in bundles.json (digital-agency, growth-marketing, product-design, full), host-library/_upstream/skills.json, and digital-agency-audit.md', () => {
    const b = bundles();
    for (const bundleName of ['digital-agency', 'growth-marketing', 'product-design', 'full']) {
      expect(b[bundleName]?.skills, bundleName).toContain(SKILL);
    }
    const prov = JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as {
      skills: Record<string, { provenance: string }>;
    };
    expect(prov.skills[SKILL]?.provenance).toBe('in-house');
    const audit = fs.readFileSync(path.resolve('docs/skill-quality/digital-agency-audit.md'), 'utf8');
    expect(audit).toMatch(/\| `commercial-stock-sourcer` \| Jamileh/);
  });

  it('wires commercial-stock-sourcer into agency-creative-designer.md, subagent-marketing-creative-designer (.core.md and .md), and image-creation Rung 2', () => {
    expect(tableRow('agency-creative-designer')).toMatch(/stock photo|stock|B-roll/i);
    expect(nativeText('agency-creative-designer')).toContain('`commercial-stock-sourcer`');

    const coreText = fs.readFileSync(
      path.resolve('registry/core/subagent-marketing-creative-designer.core.md'),
      'utf8',
    );
    const agentText = fs.readFileSync(path.resolve('registry/agents/subagent-marketing-creative-designer.md'), 'utf8');
    expect(coreText).toMatch(/Commercial Stock & B-Roll Sourcing/i);
    expect(agentText).toMatch(/Commercial Stock & B-Roll Sourcing/i);
    expect(agentText).toContain('commercial-stock-sourcer');

    const imageCreationSkill = fs.readFileSync(path.resolve('registry/skills/image-creation/SKILL.md'), 'utf8');
    const imageCreationLadder = fs.readFileSync(
      path.resolve('registry/skills/image-creation/references/ladder.md'),
      'utf8',
    );
    expect(imageCreationSkill).toContain('`commercial-stock-sourcer`');
    expect(imageCreationLadder).toContain('`commercial-stock-sourcer`');
  });
});

describe('Tier 4 — E2E Portability Linter & Multi-Host Test Harness (prepare.mjs & collect.mjs)', () => {
  it('passes lintSkillPortability with zero violations', () => {
    const raw = skill();
    const fmMatch = /^---\n[\s\S]*?\n---\n/.exec(raw)!;
    const violations = lintSkillPortability({
      dirName: SKILL,
      name: meta().name,
      body: raw.slice(fmMatch[0].length),
      scripts: [
        {
          relPath: 'scripts/fetch-stock.mjs',
          content: read('scripts/fetch-stock.mjs'),
        },
      ],
    });
    expect(violations).toEqual([]);
  });

  it('scaffolds the 4 host test workspaces via prepare.mjs and collects evidence via collect.mjs', () => {
    const prepareScript = path.resolve('scripts/stock-sourcer-test/prepare.mjs');
    const collectScript = path.resolve('scripts/stock-sourcer-test/collect.mjs');
    expect(fs.existsSync(prepareScript)).toBe(true);
    expect(fs.existsSync(collectScript)).toBe(true);

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-sourcer-e2e-'));
    try {
      const prep = spawnSync(process.execPath, [prepareScript, '--root', tmpRoot, '--skip-preflight-network'], {
        encoding: 'utf8',
      });
      expect(prep.status, prep.stderr).toBe(0);

      for (const host of ['claude', 'cline', 'antigravity', 'codex']) {
        const ws = path.join(tmpRoot, host);
        expect(fs.existsSync(path.join(ws, 'BRIEF.md')), `${host} BRIEF.md`).toBe(true);
        expect(fs.existsSync(path.join(ws, 'assets', 'stock')), `${host} assets/stock`).toBe(true);
      }

      // Simulate a completed Vision-in-the-Loop run in the claude workspace
      const claudeStock = path.join(tmpRoot, 'claude', 'assets', 'stock');
      fs.writeFileSync(path.join(claudeStock, 'hero-coffee.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      fs.writeFileSync(
        path.join(claudeStock, 'hero-coffee.jpg.provenance.json'),
        JSON.stringify(
          {
            file: 'assets/stock/hero-coffee.jpg',
            asset: 'hero-coffee',
            sourceType: 'licensed-stock',
            provider: 'openverse',
            sourceId: 'ov-505',
            sourceUrl: 'https://openverse.org/image/ov-505',
            creator: 'Katherine Johnson',
            license: 'CC0 1.0 (Commercial Safe)',
            query: 'pour over coffee',
            inspectedByVision: true,
            visionNotes: 'Warm ceramic dripper on oak counter; top-left negative space clear for headline.',
            retrievedAt: '2026-10-16T18:00:00Z',
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'claude', 'attribution.md'),
        '# Media Attribution\n- Photo by Katherine Johnson via Openverse (CC0 1.0)\n',
      );

      const col = spawnSync(process.execPath, [collectScript, '--root', tmpRoot], {
        encoding: 'utf8',
      });
      expect(col.status, col.stderr).toBe(0);
      expect(col.stdout).toMatch(/claude.*PASS/i);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
