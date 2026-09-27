import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_BODY_FENCE_LINE_THRESHOLD,
  findOversizedFencedBlocks,
  parseSkillConsultationMap,
} from '../src/core/residue-patterns.js';

/**
 * Plan 025 Step 1 — RED tests for the specialist anatomy redesign (`domain:engineering` first).
 *
 * Checks, per engineering specialist (`registry/agents/subagent-*.md` shipped by a bundle whose
 * `domain` is `engineering`):
 *  (a) the standard anatomy sections are present: Role Definition, Skill Consultation Map,
 *      a Protocol/Execution section, a Safety/Guardrail section, Output Format Requirements;
 *  (b) no fenced code block in the body exceeds the shared lint threshold
 *      (`AGENT_BODY_FENCE_LINE_THRESHOLD`, `src/core/residue-patterns.ts`);
 *  (c) every skill named in the Skill Consultation Map exists under `registry/skills/`;
 *  (d) every frontmatter `skills:` entry appears in the Skill Consultation Map;
 *  (e) a map row naming a skill outside the role's own shipping bundles tells the specialist
 *      to report the gap to its orchestrator (Cross-Bundle Recommendation Protocol);
 *  (f) no vendor name in the `description` of a role shipped in the `software-engineering`
 *      Essentials bundle.
 *
 * RED until Plan 025 Steps 2-3 land the anatomy and skill backfill/extraction.
 */
const REGISTRY = path.resolve(process.cwd(), 'registry');
const AGENTS_DIR = path.join(REGISTRY, 'agents');
const SKILLS_DIR = path.join(REGISTRY, 'skills');

interface BundleDef {
  domain?: string;
  agents?: string[];
  skills?: string[];
}

const BUNDLES = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as {
  bundles: Record<string, BundleDef>;
};

const ESSENTIALS_BUNDLE = 'software-engineering';

const VENDOR_NAME_PATTERNS: readonly RegExp[] = [
  /\bSupabase\b/,
  /\bTurso\b/,
  /\bVercel\b/,
  /\bAzure\b/,
  /\bLovable\b/,
  /\bBolt(?:\.new)?\b/,
  /\bv0\b/,
];

function engineeringAgentFiles(): string[] {
  const files = new Set<string>();
  for (const def of Object.values(BUNDLES.bundles)) {
    if (def.domain === 'engineering') {
      for (const a of def.agents ?? []) {
        if (a.startsWith('subagent-')) files.add(a);
      }
    }
  }
  return [...files].sort();
}

function bundlesShipping(agentFile: string): string[] {
  return Object.entries(BUNDLES.bundles)
    .filter(([, def]) => (def.agents ?? []).includes(agentFile))
    .map(([name]) => name);
}

function skillsInBundles(bundleNames: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const name of bundleNames) {
    for (const s of BUNDLES.bundles[name]?.skills ?? []) set.add(s);
  }
  return set;
}

function readBody(file: string): string {
  return fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
}

function frontmatterSkills(body: string): string[] {
  const fm = /^---\n([\s\S]*?)\n---/.exec(body)?.[1] ?? '';
  const listMatch = /^skills:\n((?:\s+-\s.+\n?)+)/m.exec(fm);
  if (!listMatch) return [];
  return [...listMatch[1].matchAll(/-\s*([a-z0-9-]+)/g)].map(m => m[1]);
}

function frontmatterDescription(body: string): string {
  const fm = /^---\n([\s\S]*?)\n---/.exec(body)?.[1] ?? '';
  const blockMatch = /^description:\s*>\s*\n((?:[ \t]+.+\n?)+)/m.exec(fm);
  if (blockMatch) return blockMatch[1].replace(/\n\s*/g, ' ').trim();
  const inlineMatch = /^description:\s*(.+)$/m.exec(fm);
  return inlineMatch?.[1]?.trim() ?? '';
}

const FILES = engineeringAgentFiles();

describe('Specialist anatomy (Plan 025 Step 1, domain:engineering)', () => {
  it('inventory sanity: 15 engineering specialists found', () => {
    expect(FILES.length).toBe(15);
  });

  it.each(FILES)('%s declares the standard section anatomy', file => {
    const body = readBody(file);
    expect(body, `${file}: missing Role Definition`).toMatch(/^## Role Definition/m);
    expect(body, `${file}: missing Skill Consultation Map`).toMatch(/^## .*Skill Consultation Map/m);
    expect(body, `${file}: missing a Protocol/Execution section`).toMatch(
      /^## .*(Protocol|Execution)/m
    );
    expect(body, `${file}: missing a Safety/Guardrail section`).toMatch(
      /^## .*(Safety|Guardrail|Boundary Constraint)/m
    );
    expect(body, `${file}: missing Output Format Requirements`).toMatch(
      /^## Output Format Requirements/m
    );
  });

  it('no fenced code block in any engineering specialist body exceeds the lint threshold', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const body = readBody(file);
      for (const block of findOversizedFencedBlocks(body)) {
        violations.push(
          `${file}:${block.line} — fenced ${block.lang || '(plain)'} block has ${block.contentLines} content lines (max ${AGENT_BODY_FENCE_LINE_THRESHOLD})`
        );
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('every Skill Consultation Map skill exists under registry/skills/', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const rows = parseSkillConsultationMap(readBody(file));
      for (const row of rows) {
        if (!fs.existsSync(path.join(SKILLS_DIR, row.skill, 'SKILL.md'))) {
          violations.push(`${file}: map row names unknown skill "${row.skill}"`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('every frontmatter `skills:` entry appears in the Skill Consultation Map', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const body = readBody(file);
      const fmSkills = frontmatterSkills(body);
      const mapSkills = new Set(parseSkillConsultationMap(body).map(r => r.skill));
      for (const skill of fmSkills) {
        if (!mapSkills.has(skill)) {
          violations.push(`${file}: frontmatter skill "${skill}" has no Skill Consultation Map row`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it("a map row naming a skill outside the role's own bundles reports the gap to the orchestrator", () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const body = readBody(file);
      const shippedIn = bundlesShipping(file);
      const inBundleSkills = skillsInBundles(shippedIn);
      for (const row of parseSkillConsultationMap(body)) {
        if (inBundleSkills.has(row.skill)) continue;
        if (!/report.*orchestrator/i.test(row.providedBy)) {
          violations.push(
            `${file}: row for "${row.skill}" (outside ${shippedIn.join(', ')}) must say "report to orchestrator" in Provided by`
          );
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('no vendor name in the description of a role shipped in the software-engineering Essentials bundle', () => {
    const essentialsAgents = new Set(BUNDLES.bundles[ESSENTIALS_BUNDLE]?.agents ?? []);
    const violations: string[] = [];
    for (const file of FILES) {
      if (!essentialsAgents.has(file)) continue;
      const description = frontmatterDescription(readBody(file));
      for (const pattern of VENDOR_NAME_PATTERNS) {
        if (pattern.test(description)) {
          violations.push(`${file}: description names vendor ${pattern.source}`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
