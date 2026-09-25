/**
 * Golden capture helper — the pre-refactor byte pin for the Claude lane (Plan 017,
 * acceptance gates 3 & 8).
 *
 * Renders a FIXED artifact set through the REAL `ClaudeProjector` pipeline
 * (`planCompoundProjection` + `planPluginLane` — the same entry points `InstallEngine`
 * uses) and stores/compares the bytes under `tests/golden/claude/`.
 *
 * - `UPDATE_GOLDEN=1` in a maintainer run rewrites the snapshots; the diff is PR-reviewed
 *   (Plan 017 decision 8 — regeneration is an explicit, reviewed act, never silent).
 * - Without the env var the snapshots are compared byte-for-byte and never written.
 * - `tests/golden/.gitattributes` (`* -text`) keeps git EOL normalization from ever
 *   mutating the pinned bytes on checkout (this repo runs with `core.autocrlf=true`).
 */
import path from 'node:path';
import fs from 'fs-extra';
import { ClaudeProjector } from '../../src/core/claude-projector.js';
import type { BundleDefinition, ResolvedAssets } from '../../src/core/types.js';

export const ROOT = process.cwd();
export const REGISTRY_DIR = path.resolve(ROOT, 'registry');
export const GOLDEN_ROOT = path.resolve(ROOT, 'tests', 'golden', 'claude');

/**
 * EOL canonicalization (PR #46 CI fix): git's checkout policy renders content-identical files
 * with different line endings per OS (core.autocrlf on Windows), so a raw byte compare fails
 * across environments for bytes that differ ONLY in \r. The golden pin guards CONTENT bytes;
 * both sides of every comparison are canonicalized to LF here. The snapshot files themselves
 * stay byte-frozen (`tests/golden/.gitattributes` keeps them raw).
 */
export const normalizeEol = (text: string): string => text.replace(/\r\n/g, '\n');

export interface GoldenEntry {
  /** The planned projection path (`.claude/…` / `.agents/plugins/…`) as the renderer emits it. */
  relPath: string;
  /** Snapshot path relative to `tests/golden/claude/` (explicit, dot-free mirror of `relPath`). */
  file: string;
}

export interface GoldenArtifact extends GoldenEntry {
  content: string;
}

/**
 * The pinned surface (fixed set): the five software-engineering roles, the `git-guardrails`
 * skill, the `git-guardrails` rule, and the rendered plugin manifest
 * (`ClaudeProjector.renderPluginManifest` — private, so it is reached through the real
 * `planPluginLane` call and captured from its planned artifact).
 */
export const GOLDEN_SET: readonly GoldenEntry[] = [
  { relPath: '.claude/agents/orchestrator-engineering.md', file: 'agents/orchestrator-engineering.md' },
  { relPath: '.claude/agents/backend-architect.md', file: 'agents/backend-architect.md' },
  { relPath: '.claude/agents/frontend-architect.md', file: 'agents/frontend-architect.md' },
  { relPath: '.claude/agents/code-reviewer.md', file: 'agents/code-reviewer.md' },
  { relPath: '.claude/agents/repo-index.md', file: 'agents/repo-index.md' },
  { relPath: '.claude/skills/git-guardrails/SKILL.md', file: 'skills/git-guardrails/SKILL.md' },
  { relPath: '.claude/rules/git-guardrails.md', file: 'rules/git-guardrails.md' },
  {
    relPath: '.agents/plugins/software-engineering/.claude-plugin/plugin.json',
    file: 'plugin-manifests/software-engineering.json',
  },
];

/** Fixed render inputs — deliberately narrower than the bundle so the pinned set stays the 8 artifacts above. */
const GOLDEN_AGENTS = [
  'orchestrator-engineering.md',
  'subagent-backend-architect.md',
  'subagent-frontend-architect.md',
  'subagent-code-reviewer.md',
  'subagent-repo-index.md',
];

function goldenBundle(): BundleDefinition {
  const manifest = fs.readJsonSync(path.join(REGISTRY_DIR, 'bundles.json')) as {
    bundles: Record<string, BundleDefinition>;
  };
  const bundle = manifest.bundles['software-engineering'];
  if (!bundle) {
    throw new Error('Golden capture: registry/bundles.json must declare the software-engineering bundle');
  }
  return bundle;
}

function goldenResolved(): ResolvedAssets {
  return {
    targetBundle: 'software-engineering',
    agents: [...GOLDEN_AGENTS],
    skills: ['git-guardrails'],
    workflows: [],
    rules: ['git-guardrails.md'],
  };
}

/**
 * Render the fixed set through the real projector. Throws when any expected artifact is
 * absent from the plan, so the snapshot set can never shrink silently.
 */
export async function captureClaudeGoldens(): Promise<GoldenArtifact[]> {
  const bundle = goldenBundle();
  const resolved = goldenResolved();
  const plan = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, REGISTRY_DIR);
  const pluginPlan = await ClaudeProjector.planPluginLane(bundle, resolved, REGISTRY_DIR);

  const byRelPath = new Map<string, string>();
  for (const artifact of [...plan, ...pluginPlan]) {
    if (typeof artifact.content === 'string') byRelPath.set(artifact.relPath, artifact.content);
  }

  return GOLDEN_SET.map(entry => {
    const content = byRelPath.get(entry.relPath);
    if (content === undefined) {
      throw new Error(`Golden capture: the Claude plan no longer produces ${entry.relPath}`);
    }
    return { ...entry, content: normalizeEol(content) };
  });
}

export function goldenDiskPath(entry: GoldenEntry): string {
  return path.join(GOLDEN_ROOT, entry.file);
}

export function readGolden(entry: GoldenEntry): string | undefined {
  const disk = goldenDiskPath(entry);
  return fs.existsSync(disk) ? normalizeEol(fs.readFileSync(disk, 'utf8')) : undefined;
}

export const isUpdateGolden: boolean = process.env.UPDATE_GOLDEN === '1';

/** `UPDATE_GOLDEN=1` maintainer run: rewrite one snapshot; a no-op otherwise. */
export function syncGolden(artifact: GoldenArtifact): void {
  if (!isUpdateGolden) return;
  fs.outputFileSync(goldenDiskPath(artifact), artifact.content, 'utf8');
}
