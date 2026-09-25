import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Owner Gate-7 field finding (2026-09-25): agents declare skills in their frontmatter
 * `skills:` that their bundles never ship (e.g. grill-me / grill-with-docs on
 * software-engineering), so the projection advertises slash commands that are not installed.
 * This guard makes the class a CI failure: every skill an agent declares must ship in EVERY
 * bundle that includes the agent, and must exist in registry/skills/ (no phantom declarations).
 */
const REGISTRY = path.resolve(process.cwd(), 'registry');

interface BundleDef {
  orchestrator?: string;
  agents?: string[];
  skills?: string[];
}

function frontmatterSkills(agentFile: string): string[] {
  const file = path.join(REGISTRY, 'agents', agentFile);
  if (!fs.existsSync(file)) return [];
  const match = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];
  const front = (yaml.parse(match[1]) ?? {}) as { skills?: unknown };
  return Array.isArray(front.skills) ? front.skills.map(s => String(s).trim()).filter(Boolean) : [];
}

describe('Bundle skill-reference conformance (Gate 7 follow-up)', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as {
    bundles: Record<string, BundleDef>;
  };

  it('every agent-declared skill ships in every bundle that includes the agent', () => {
    const violations: string[] = [];
    for (const [bundleName, def] of Object.entries(manifest.bundles)) {
      const shipped = new Set((def.skills ?? []).map(s => String(s).trim()));
      const agents = [def.orchestrator, ...(def.agents ?? [])].filter((a): a is string => typeof a === 'string');
      for (const agentFile of agents) {
        for (const skill of frontmatterSkills(agentFile)) {
          if (!shipped.has(skill)) {
            violations.push(`${bundleName} → ${agentFile} declares "${skill}" but the bundle does not ship it`);
          }
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('every agent-declared skill exists in registry/skills/ (no phantom declarations)', () => {
    const violations: string[] = [];
    for (const agentFile of fs.readdirSync(path.join(REGISTRY, 'agents')).filter(f => f.endsWith('.md'))) {
      for (const skill of frontmatterSkills(agentFile)) {
        if (!fs.existsSync(path.join(REGISTRY, 'skills', skill))) {
          violations.push(`${agentFile} declares "${skill}" but registry/skills/${skill} does not exist`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});