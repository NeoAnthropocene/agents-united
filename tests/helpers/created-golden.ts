/**
 * Plan 021 (ADR 0021) / Step 5 — created-output golden capture for the Conformance Suite.
 * Mirrors tests/helpers/golden.ts conventions: UPDATE_GOLDEN=1 is the only write path (an
 * explicit, reviewed maintainer act); otherwise snapshots are compared byte-for-byte and
 * never written. The LEGACY goldens (tests/golden/claude/**) are frozen and never touched —
 * this helper writes only into tests/golden/claude-created/**.
 */
import path from 'node:path';
import fs from 'fs-extra';
import { loadSemanticCore } from '../../src/core/semantic-core.js';
import { loadTranslationLedger } from '../../src/core/registry.js';
import { HOST_DIALECTS } from '../../src/core/dialects.js';
import { ClaudeProjector } from '../../src/core/claude-projector.js';
import { createRole } from '../../src/core/creation/claude.js';
import type {
  ClaudeCreationBindingTable,
  ClaudeCreationProfile,
  DeclaredDelta,
  SemanticCore,
} from '../../src/core/types.js';

export const ROOT = process.cwd();
export const REGISTRY_DIR = path.resolve(ROOT, 'registry');
export const CREATED_GOLDEN_ROOT = path.resolve(ROOT, 'tests', 'golden', 'claude-created');

/**
 * EOL canonicalization (PR #46 CI fix): git's checkout policy renders content-identical files
 * with different line endings per OS (core.autocrlf on Windows). The created-golden pin guards
 * CONTENT bytes; both sides of every comparison are canonicalized to LF here while the snapshot
 * files stay byte-frozen.
 */
export const normalizeEol = (text: string): string => text.replace(/\r\n/g, '\n');

export const PILOT_STEMS = [
  'orchestrator-engineering',
  'subagent-backend-architect',
  'subagent-frontend-architect',
  'subagent-code-reviewer',
  'subagent-repo-index',
] as const;
export type PilotStem = (typeof PILOT_STEMS)[number];

export interface RealizationLayer {
  host: string;
  role: string;
  roleName: string;
  invariantBindings?: Array<{ invariant?: string; feature?: string; binding: string }>;
  aboveFloorScope: string[];
}

export function loadRealization(stem: string): RealizationLayer {
  return fs.readJsonSync(path.join(REGISTRY_DIR, 'realizations', 'claude', `${stem}.json`)) as RealizationLayer;
}

export function loadProfile(): ClaudeCreationProfile {
  const raw = fs.readJsonSync(path.join(REGISTRY_DIR, 'profiles', 'claude@2.1.271.json')) as {
    host: string;
    version: string;
    toolSurface?: Record<string, string[]>;
  };
  const tools = raw.toolSurface ? Object.values(raw.toolSurface).flat() : [];
  return { host: raw.host, version: raw.version, tools };
}

export interface CreatedPipeline {
  stem: PilotStem;
  core: SemanticCore;
  realization: RealizationLayer;
  profile: ClaudeCreationProfile;
  table: ClaudeCreationBindingTable;
  ledger: DeclaredDelta[];
  created: string;
  legacy: string;
}

/** Deterministic pipeline: registry data in, bytes out — no clock, no randomness, no LLM. */
export async function runPipeline(stem: PilotStem): Promise<CreatedPipeline> {
  const cores = await loadSemanticCore(REGISTRY_DIR);
  const core = cores.get(stem);
  if (!core) throw new Error(`created-golden: missing core for ${stem}`);
  const realization = loadRealization(stem);
  const ledger = loadTranslationLedger(REGISTRY_DIR);
  const deltas = ledger.filter(entry => realization.aboveFloorScope.includes(entry.feature));
  const host = HOST_DIALECTS.claude;
  const table: ClaudeCreationBindingTable = {
    host: 'claude',
    roleName: realization.roleName,
    invariantBindings: [...host.invariantBindings, ...(realization.invariantBindings ?? [])],
    commandVocabulary: host.commandVocabulary,
    deltas,
  };
  const profile = loadProfile();
  const created = createRole(core, table, profile);
  const canonical = fs.readFileSync(path.join(REGISTRY_DIR, 'agents', `${stem}.md`), 'utf8');
  const legacy = ClaudeProjector.renderRole(canonical, `agents/${realization.roleName}.md`).content;
  return { stem, core, realization, profile, table, ledger, created, legacy };
}

export interface CreatedGoldenArtifact {
  relPath: string;
  file: string;
  stem: PilotStem;
  content: string;
}

export async function captureCreatedGoldens(): Promise<CreatedGoldenArtifact[]> {
  const artifacts: CreatedGoldenArtifact[] = [];
  for (const stem of PILOT_STEMS) {
    const pipeline = await runPipeline(stem);
    artifacts.push({
      relPath: `.claude/agents/${pipeline.realization.roleName}.md`,
      file: `${pipeline.realization.roleName}.md`,
      stem,
      content: normalizeEol(pipeline.created),
    });
  }
  return artifacts;
}

export function readCreatedGolden(entry: { file: string }): string | undefined {
  const disk = path.join(CREATED_GOLDEN_ROOT, entry.file);
  return fs.existsSync(disk) ? normalizeEol(fs.readFileSync(disk, 'utf8')) : undefined;
}

export const isUpdateCreatedGolden: boolean = process.env.UPDATE_GOLDEN === '1';

/** `UPDATE_GOLDEN=1` maintainer run: rewrite one created snapshot; a no-op otherwise. */
export function syncCreatedGolden(artifact: CreatedGoldenArtifact): void {
  if (!isUpdateCreatedGolden) return;
  fs.outputFileSync(path.join(CREATED_GOLDEN_ROOT, artifact.file), artifact.content, 'utf8');
}