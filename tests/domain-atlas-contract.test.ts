import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { RegistryResolver } from '../src/core/registry.js';

/**
 * ADR 0010 — Domain Atlas contract tests.
 *
 * The Prime Orchestrator (`registry/agents/orchestrator-universal.md`) embeds a
 * generated "Domain Atlas": a compact Department Domain -> Essentials Bundle
 * routing map. This suite asserts that the Atlas prose matches registry truth
 * in `registry/bundles.json`, mirroring the recommendation-contract pattern for
 * the 7 Lead Orchestrators. It also enforces the routing boundary rules:
 *   C1 - every department Essentials bundle is present with `agents add <bundle>`;
 *   C2 - Organizational Bundles (e.g. `digital-agency`) are NEVER auto-recommended;
 *   C3 - no placeholder commands remain;
 *   C4 - the Universal department entries (`universal-skills`, `full`) are listed.
 */

const REGISTRY_AGENTS_DIR = path.resolve(process.cwd(), 'registry/agents');
const resolver = new RegistryResolver();

/** Section bounded by the `## 🗺️ Domain Atlas` heading and the next `##` heading. */
function extractAtlasSection(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => /Domain Atlas/.test(l) && /##/.test(l));
  if (start === -1) return null;

  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (i !== start && /^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

interface AtlasRow {
  department: string;
  essentials: string;
  command: string;
}

/**
 * Parses the first markdown table in the Atlas section. Columns:
 * Capability | Target Department | Essentials Bundle | Recommended Command
 * (backticks stripped). Robust to trailing/leading pipes.
 */
function extractAtlasRows(content: string): AtlasRow[] {
  const section = extractAtlasSection(content);
  if (!section) return [];

  const rows: AtlasRow[] = [];
  let collecting = false;
  for (const line of section.split(/\r?\n/)) {
    const t = line.trim();
    if (!(t.startsWith('|') && t.endsWith('|'))) {
      if (collecting) break;
      continue;
    }
    const cells = t.split('|').slice(1, -1).map(c => c.trim().replace(/`/g, ''));
    if (cells.length < 4) continue;
    const isSeparator = cells.every(c => /^-{2,}$/.test(c));
    if (isSeparator) {
      collecting = true;
      continue;
    }
    if (!collecting) continue;
    rows.push({ department: cells[1], essentials: cells[2], command: cells[3] });
  }
  return rows;
}

/** The 7 department Essentials bundles plus the two Universal optional routes. */
function expectedRoutableBundles(manifest: { bundles: Record<string, any> }): string[] {
  const essentials: string[] = [];
  for (const [name, b] of Object.entries(manifest.bundles as Record<string, any>)) {
    if (b.tier === 'organization') continue;
    if (b.parentBundle) continue;
    // Universal has three non-parent bundles; only universal-skills & full are
    // routable destinations (universal-orchestration is the router itself).
    if (b.domain === 'universal' && name !== 'universal-skills' && name !== 'full') continue;
    essentials.push(name);
  }
  return essentials.sort();
}

/** Every concrete `agents add <X>` token in the Atlas commands column. */
function atlasCommandNames(rows: AtlasRow[]): string[] {
  const names = rows
    .map(r => r.command.match(/^agents\s+add\s+(\S+)$/)?.[1])
    .filter((n): n is string => !!n);
  return Array.from(new Set(names));
}

describe('Domain Atlas contract (universal-orchestration / Prime Orchestrator)', () => {
  let content: string;
  let rows: AtlasRow[];
  let manifestFile: { bundles: Record<string, any> };

  beforeAll(async () => {
    content = await fs.readFile(path.join(REGISTRY_AGENTS_DIR, 'orchestrator-universal.md'), 'utf8');
    rows = extractAtlasRows(content);
    manifestFile = await fs.readJson(path.resolve(process.cwd(), 'registry/bundles.json'));
  });

  it('bundle universal-orchestration exists and declares orchestrator-universal as its orchestrator', async () => {
    const bundle = await resolver.getBundle('universal-orchestration');
    expect(bundle).toBeDefined();
    expect(bundle!.orchestrator).toBe('orchestrator-universal.md');
  });

  it('C1: Atlas lists every routable Essentials bundle with an exact `agents add <name>` command', () => {
    const expected = expectedRoutableBundles(manifestFile);
    const atlasNames = atlasCommandNames(rows);
    for (const name of expected) {
      expect(atlasNames).toContain(name);
      const row = rows.find(r => r.essentials === name);
      expect(row).toBeDefined();
      expect(row!.command).toBe(`agents add ${name}`);
    }
    // Nothing extra beyond what the registry declares as routable destinations.
    expect(new Set(atlasNames)).toEqual(new Set(expected));
  });

  it('C2: Organizational Bundles are NEVER auto-recommended by the Atlas', () => {
    // digital-agency is the only Organization Bundle in the registry today.
    expect(manifestFile.bundles['digital-agency']?.tier).toBe('organization');
    expect(atlasCommandNames(rows)).not.toContain('digital-agency');
    // If more org bundles appear later, ensure none are routable either.
    for (const [name, b] of Object.entries(manifestFile.bundles) as any) {
      if (b.tier === 'organization') expect(atlasCommandNames(rows)).not.toContain(name);
    }
  });

  it('C3: Atlas contains no placeholder commands and every command is a bare `agents add <name>`', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.command.startsWith('agents add ')).toBe(true);
      expect(row.command).not.toContain('<');
      expect(row.command).not.toMatch(/\s[-]{1,2}[a-z]/i); // no extra flags
    }
  });

  it('C4: Universal department lists both `universal-skills` and `full` as optional routes', () => {
    const dep = new Set(rows.map(r => r.department));
    expect(dep).toContain('Universal Autonomous Department');
    expect(rows.filter(r => r.department === 'Universal Autonomous Department').map(r => r.essentials).sort()).toEqual(
      ['full', 'universal-skills']
    );
  });

  it('Atlas is embedded in the orchestrator file (no loose asset file required)', () => {
    expect(extractAtlasSection(content)).not.toBeNull();
  });
});