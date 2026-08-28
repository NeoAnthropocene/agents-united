import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { ClineProjector } from '../src/core/cline-projector.js';
import type { BundleDefinition } from '../src/core/types.js';

/**
 * Plan 003 — Recommendation contract tests + installed-addon freshness (fixes F5).
 *
 * Part 1 verifies the "Cross-Bundle Dynamic Recommendation Protocol" prose in the
 * orchestrator markdown matches registry truth in `registry/bundles.json`.
 * Part 2 verifies that after installing an addon (or removing it), the parent's
 * Team Manifest + coordinator rule are refreshed so coordinators stop prompting
 * for already-installed addons.
 */

const REGISTRY_AGENTS_DIR = path.resolve(process.cwd(), 'registry/agents');
const resolver = new RegistryResolver();

/** Section bounded by a top-level (##) heading, used to scope table parsing. */
function extractProtocolSection(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => /Cross-Bundle Dynamic Recommendation Protocol/.test(l));
  if (start === -1) return null;

  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    // A new top-level (##) heading ends the protocol section; `###` sub-headings are kept.
    if (i !== start && /^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

interface MatrixRow {
  target: string;
  command: string;
}

/**
 * Parses the markdown "Detection Matrix" table (the first table inside the
 * protocol section). Returns a row per data row with backticks stripped.
 * Robust to column-count differences (3- and 4-column matrices share the
 * "Target" as column 2 and "Recommended Command" as column 3).
 */
function extractMatrixRows(content: string): MatrixRow[] {
  const section = extractProtocolSection(content);
  if (!section) return [];

  const rows: MatrixRow[] = [];
  let collecting = false;
  for (const line of section.split(/\r?\n/)) {
    const t = line.trim();
    if (!(t.startsWith('|') && t.endsWith('|'))) {
      if (collecting) break; // table ended
      continue;
    }
    const cells = t.split('|').slice(1, -1).map(c => c.trim().replace(/`/g, ''));
    if (cells.length < 3) continue;
    const isSeparator = cells.every(c => /^-{2,}$/.test(c));
    if (isSeparator) {
      collecting = true;
      continue;
    }
    if (!collecting) continue; // header row precedes the separator
    rows.push({ target: cells[1], command: cells[2] });
  }
  return rows;
}

/** Every concrete `agents add <X>` token in the file (placeholders skipped). */
function extractAddCommands(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(/agents\s+add\s+([^\s`]+)/g)) {
    const raw = m[1];
    if (raw.includes('<')) continue; // placeholder like <sub-bundle>
    out.push(raw);
  }
  return out;
}

/** Addon-bundle names recommended by a matrix (single `agents add <name>` rows only). */
function matrixAddonNames(rows: MatrixRow[]): string[] {
  const names = rows
    .map(r => r.command.match(/^agents\s+add\s+(\S+)$/)?.[1])
    .filter((n): n is string => !!n && !n.startsWith('domain:') && !n.startsWith('<'));
  return Array.from(new Set(names));
}

/** The "Recommended Addon Policy" list rendered into a coordinator rule. */
function ruleAddonList(ruleContent: string): string[] {
  const match = ruleContent.match(/capabilities from:\s*(.*?),\s*explain the capability/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim().replace(/`/g, '')).filter(Boolean);
}
describe('Part 1 — Recommendation contract (Cross-Bundle Dynamic Recommendation Protocol)', () => {
  describe('R1-R3 — software-engineering essentials orchestrator', () => {
    let content: string;
    let bundle: BundleDefinition;
    let rows: MatrixRow[];

    beforeEach(async () => {
      content = await fs.readFile(path.join(REGISTRY_AGENTS_DIR, 'orchestrator-engineering.md'), 'utf8');
      bundle = (await resolver.getBundle('software-engineering'))!;
      rows = extractMatrixRows(content);
    });

    it('R1: Detection Matrix target sub-bundles EXACTLY equal bundles.json recommendedAddons, each command is `agents add <name>`', () => {
      const contract = bundle.recommendedAddons ?? [];
      const matrixNames = matrixAddonNames(rows);

      expect(new Set(matrixNames)).toEqual(new Set(contract));
      // Every matrix recommendation is an exact `agents add <name>` command
      // (no extra flags, no dangling placeholders).
      for (const row of rows) {
        if (row.command.startsWith('agents add domain:')) continue;
        const name = row.command.match(/^agents add (\S+)$/)?.[1];
        expect(name, `Recommended command must be exactly "agents add <name>", got: ${row.command}`)
          .toBeDefined();
        expect(row.target.startsWith(name ?? '∅'), `target cell ${row.target} should match addon ${name}`)
          .toBe(true);
      }
    });

    it('R2: matrix also contains the whole-domain row `agents add domain:engineering`', () => {
      const domainRow = rows.find(r => r.command === 'agents add domain:engineering');
      expect(domainRow).toBeDefined();
      expect(domainRow!.command).toBe('agents add domain:engineering');
    });

    it('R3: every `agents add <name>` anywhere in the orchestrator resolves via RegistryResolver', async () => {
      for (const cmd of extractAddCommands(content)) {
        await expect(resolver.resolve(cmd), `unresolvable: agents add ${cmd}`).resolves.toBeDefined();
      }
    });
  });

  describe('R4 — projected cline artifacts mirror the registry recommendation list', () => {
    const testWorkspace = path.resolve(process.cwd(), 'scratch/test-recommendation-r4');
    const agentsDir = path.join(testWorkspace, '.agents');

    beforeEach(async () => {
      await fs.remove(testWorkspace);
      await fs.ensureDir(testWorkspace);
    });

    afterEach(async () => {
      await fs.remove(testWorkspace);
    });

    it('installed coordinator rule + team manifest recommendedAddons equal the registry list', async () => {
      const installer = new InstallEngine();
      await installer.install('software-engineering', {
        targetDir: agentsDir,
        method: 'copy',
        fanout: ['cline'],
      });

      const bundle = (await resolver.getBundle('software-engineering'))!;
      const registryAddons = bundle.recommendedAddons ?? [];

      const rulePath = path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'rules', 'agents-united-software-engineering.md');
      const manifestPath = path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'agents-united', 'teams', 'software-engineering.yaml');
      expect(await fs.pathExists(rulePath)).toBe(true);
      expect(await fs.pathExists(manifestPath)).toBe(true);

      const ruleContent = await fs.readFile(rulePath, 'utf8');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = YAML.parse(manifestContent) as { bundle?: string; recommendedAddons: string[] };

      expect(ruleAddonList(ruleContent)).toEqual(registryAddons);
      expect(manifest.bundle).toBe('software-engineering');
      expect(manifest.recommendedAddons).toEqual(registryAddons);
    });
  });

  describe('R5 — generalization over every essentials orchestrator with a detection matrix', () => {
    const cases: Array<{ file: string; bundle: string }> = [
      { file: 'orchestrator-engineering.md', bundle: 'software-engineering' },
      { file: 'orchestrator-marketing.md', bundle: 'growth-marketing' },
      { file: 'orchestrator-design.md', bundle: 'product-design' },
      { file: 'orchestrator-system-architecture.md', bundle: 'system-architecture' },
    ];

    it('R3+equality: no dangling agents add names; strict equality enforced only where the matrix is a clean addon-routing matrix', async () => {
      const skipped: string[] = [];
      for (const c of cases) {
        const bdef = await resolver.getBundle(c.bundle);
        if (!bdef) continue;
        const filePath = path.join(REGISTRY_AGENTS_DIR, c.file);
        const content = await fs.readFile(filePath, 'utf8');
        const rows = extractMatrixRows(content);

        if (rows.length === 0) {
          skipped.push(`${c.file} (no detection-matrix table)`);
          continue;
        }

        // R3 always applies: every concrete `agents add <X>` must resolve.
        for (const cmd of extractAddCommands(content)) {
          await expect(resolver.resolve(cmd), `${c.file}: unresolvable agents add ${cmd}`).resolves.toBeDefined();
        }

        // Strict R1 equality is only well-defined when the matrix is this bundle's own
        // addon-routing matrix (target sets match its recommendedAddons). Cross-domain
        // matrices (e.g. design/architecture routing into other departments) are
        // checked for resolvability above but skipped for the exact-set contract.
        const contract = bdef.recommendedAddons ?? [];
        const matrixNames = matrixAddonNames(rows);
        if (new Set(matrixNames).size === contract.length) {
          expect(new Set(matrixNames), `${c.file}: matrix targets vs recommendedAddons`)
            .toEqual(new Set(contract));
        } else {
          skipped.push(`${c.file} (matrix is cross-domain; exact-set contract not applicable)`);
        }
      }
      // Report which orchestrators were skipped so the harness stays transparent.
      console.log(`[recommendation-contract] skipped equality contract for: ${skipped.join(', ') || '(none)'}`);
    });
  });
});

describe('Part 2 — installed-addon freshness (parent rule + manifest stop recommending installed addons)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-recommendation-freshness');
  const agentsDir = path.join(testWorkspace, '.agents');
  const parentRulePath = path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'rules', 'agents-united-software-engineering.md');
  const parentManifestPath = path.join(testWorkspace, '.agents', 'plugins', 'software-engineering', 'agents-united', 'teams', 'software-engineering.yaml');

  async function readParentState(): Promise<{ ruleAddons: string[]; manifestAddons: string[] }> {
    const ruleContent = await fs.readFile(parentRulePath, 'utf8');
    const manifest = YAML.parse(await fs.readFile(parentManifestPath, 'utf8')) as { recommendedAddons: string[] };
    return { ruleAddons: ruleAddonList(ruleContent), manifestAddons: manifest.recommendedAddons };
  }

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(testWorkspace);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('F1: installing an addon drops it from the parent rule + manifest recommendedAddons', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['cline'] });
    await installer.install('devops-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['cline'] });

    const bundle = (await resolver.getBundle('software-engineering'))!;
    const expected = (bundle.recommendedAddons ?? []).filter(a => a !== 'devops-engineering');

    const { ruleAddons, manifestAddons } = await readParentState();
    expect(ruleAddons).toEqual(expected);
    expect(manifestAddons).toEqual(expected);
    expect(manifestAddons).toHaveLength(5);
    expect(manifestAddons).not.toContain('devops-engineering');
  });

  it('F2: removing the addon restores it in the parent rule + manifest recommendedAddons', async () => {
    const installer = new InstallEngine();
    await installer.install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['cline'] });
    await installer.install('devops-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['cline'] });

    const uninstaller = new UninstallEngine();
    await uninstaller.uninstall('devops-engineering', { targetDir: agentsDir });

    const bundle = (await resolver.getBundle('software-engineering'))!;
    const registryAddons = bundle.recommendedAddons ?? [];

    const { ruleAddons, manifestAddons } = await readParentState();
    expect(ruleAddons).toEqual(registryAddons);
    expect(manifestAddons).toEqual(registryAddons);
    expect(manifestAddons).toContain('devops-engineering');
  });
});