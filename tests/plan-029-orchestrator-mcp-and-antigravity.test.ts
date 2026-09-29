import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import yaml from 'yaml';

import { ClaudeProjector } from '../src/core/claude-projector.js';
import { ClineProjector } from '../src/core/cline-projector.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { McpLocationRegistry } from '../src/core/mcp-locations.js';
import { loadTranslationLedger } from '../src/core/registry.js';
import { bundlesJson } from './helpers/bundle-lifecycle.js';
import { GOLDEN_ROOT } from './helpers/golden.js';

/**
 * Plan 029 — Orchestrator MCP Access & Antigravity Runtime (RED slice).
 *
 * Encodes the contract of `plans/029-orchestrator-mcp-access-and-antigravity-launcher.md`:
 *
 *   Group 1  canonical baseline: every orchestrator declares context7 + firecrawl + github; every
 *            engineering/architecture/security specialist declares context7 (security also github);
 *   Group 2  the Claude lane stops dropping `mcpServers` and exposes each declared server by name
 *            (plus an `mcp__<server>` tool grant) — with the owner's Option B ruling for the
 *            read-only (`permissionMode: plan`) roles: pinned exact `mcp__github__<read-only tool>`
 *            names, never the bare server-level `mcp__github` grant (Risk R1);
 *   Group 3  Risk R4 — no credential ever reaches a projected artifact (Claude lane, Cline lane,
 *            the Antigravity/canonical store, and the golden trees); servers are name-only;
 *   Group 4  `agents doctor --host <h>` warns for each declared-but-unconfigured server, printing
 *            that host's own add command, and never installs or writes anything;
 *   Group 5  the corrected Claude MCP locations (`.mcp.json`, `~/.claude.json`,
 *            `~/.claude.json > projects.<abs-path>.mcpServers`);
 *   Group 6  the Antigravity launcher: `agy --agent <orchestrator> --prompt-interactive "<prompt>"`,
 *            an `AGY_BIN_PATH` override, a read-only probe (`--version` / `--help` only), the
 *            desktop route + exit 0 when `agy` is absent, and NO silent Cline fallback;
 *   Group 7  the host-primitive matrix records the Antigravity subagent-reachability finding and
 *            the new `mcpServers` disposition.
 *
 * Modules that do not exist yet (`src/core/antigravity-capabilities.ts`,
 * `src/core/antigravity-launcher.ts`) are loaded with a dynamic `await import()` INSIDE the test
 * body on purpose: a top-level import of a missing module would make the whole file fail to
 * collect and mask every independent assertion in it.
 *
 * Nothing here is implemented by this slice — the suite is expected to FAIL (see the plan's
 * Step 1 RED gate). `UPDATE_GOLDEN` is deliberately untouched: golden regeneration is a later,
 * explicit maintainer act.
 *
 * Interface surface this suite pins for the two new modules (the plan fixes the behaviour, not the
 * spelling, so the RED gate pins one name per concept — mirroring `ClaudeCapabilityProbe`):
 *   - `AntigravityCapabilityProbe` — `constructor(runner?, { resolveExecutable })`, `resolveExecutable()`
 *     (`AGY_BIN_PATH` wins when absolute + existing, `source: 'env-binary'`), `probe()` resolving
 *     `{ installed, version?, command?, agentFlag, promptInteractive, modes, diagnostics }` and
 *     spawning ONLY `--version` then `--help`;
 *   - `AntigravityLauncher` — `planActivation({ bundleName, workspace, scope, report, prompt,
 *     orchestrator })` resolving `{ executable, argv }` with one argv element per value, plus a
 *     `launch(plan)` that spawns with `shell: false` (mirroring `ClaudeLauncher`).
 *
 * Guard pairing: the two "no inline server definition" scans are vacuously true while no projected
 * role carries `mcpServers` at all, so Group 3 pairs them with an explicit non-vacuity anchor.
 */

const ROOT = process.cwd();
const REGISTRY_DIR = path.resolve(ROOT, 'registry');
const CANONICAL_AGENTS_DIR = path.join(REGISTRY_DIR, 'agents');
const CANONICAL_SKILLS_DIR = path.join(REGISTRY_DIR, 'skills');
const GOLDEN_TREES_DIR = path.dirname(GOLDEN_ROOT); // tests/golden (claude + claude-created lanes)
const CLI_PATH = path.resolve(ROOT, 'dist', 'cli.js');

/** The owner-approved baseline set (Plan 029 Objective A1) every orchestrator must declare. */
const BASELINE_SERVERS = ['context7', 'firecrawl', 'github'] as const;

/** The canonical read-only `permissionMode` value; the Claude dialect maps it to `plan`. */
const READ_ONLY_PERMISSION_MODE = 'readOnly';

/** The domains whose code/config-writing specialists must declare `context7` (Objective A1). */
const CONTEXT7_SPECIALIST_DOMAINS = ['engineering', 'architecture', 'security'] as const;

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function canonicalAgentPath(file: string): string {
  return path.join(CANONICAL_AGENTS_DIR, file);
}

function readFrontmatter(file: string): any {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`${path.relative(ROOT, file)} has no parsable YAML frontmatter`);
  return yaml.parse(match[1]) ?? {};
}

/**
 * `mcpServers` names, tolerant of both dialects on purpose: the canonical store is a YAML
 * sequence of mapping objects (`- name: github`) while a projected frontmatter may carry plain
 * name references. The canonical *structure* itself is asserted separately in Group 1.
 */
function serverNames(meta: any): string[] {
  const raw = meta?.mcpServers;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry: any) => (typeof entry === 'string' ? entry : entry?.name))
    .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0);
}

function serverEntries(meta: any): any[] {
  const raw = meta?.mcpServers;
  return Array.isArray(raw) ? raw : [];
}

/** The rendered Claude frontmatter of a canonical role, through the REAL projector. */
function renderRoleFrontmatter(file: string): { meta: any; content: string; ledger: any[] } {
  const canonicalRel = `agents/${file}`;
  const result = ClaudeProjector.renderRole(
    fs.readFileSync(canonicalAgentPath(file), 'utf8'),
    canonicalRel
  );
  const match = result.content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`projected ${canonicalRel} carries no frontmatter`);
  return { meta: yaml.parse(match[1]) ?? {}, content: result.content, ledger: result.ledger };
}

/** Specialists (never orchestrators) declared by bundles whose `domain` is in `domains`. */
function specialistsOfDomains(domains: readonly string[]): string[] {
  const out = new Set<string>();
  for (const bundle of Object.values(bundlesJson.bundles) as Array<{
    domain?: string;
    agents?: string[];
  }>) {
    if (!domains.includes(String(bundle.domain ?? ''))) continue;
    for (const agent of bundle.agents ?? []) {
      if (agent.startsWith('subagent-')) out.add(agent);
    }
  }
  return [...out].sort();
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

/** A content fingerprint of a whole tree, used by the "doctor must not write" assertion. */
function treeFingerprint(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of walkFiles(dir)) {
    out[path.relative(dir, file).split(path.sep).join('/')] = crypto
      .createHash('sha256')
      .update(fs.readFileSync(file))
      .digest('hex');
  }
  return out;
}

/** Human-readable differences between two tree fingerprints (empty when identical). */
function fingerprintDiff(
  before: Record<string, string>,
  after: Record<string, string>
): string[] {
  const out: string[] = [];
  for (const [file, hash] of Object.entries(after)) {
    if (!(file in before)) out.push(`created ${file}`);
    else if (before[file] !== hash) out.push(`modified ${file}`);
  }
  for (const file of Object.keys(before)) {
    if (!(file in after)) out.push(`removed ${file}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Group 1 — canonical baseline (Objective A1)
// ---------------------------------------------------------------------------

describe('Plan 029 Group 1 — canonical baseline MCP declarations (Objective A1)', () => {
  const orchestratorFiles = fs
    .readdirSync(CANONICAL_AGENTS_DIR)
    .filter(file => /^orchestrator-.*\.md$/.test(file))
    .sort();

  it('the catalog declares exactly nine orchestrators', () => {
    expect(orchestratorFiles).toHaveLength(9);
  });

  it.each(orchestratorFiles)('%s declares context7, firecrawl and github', file => {
    const declared = serverNames(readFrontmatter(canonicalAgentPath(file)));
    expect(
      declared,
      `${file} must declare the baseline trio; declared: [${declared.join(', ')}]`
    ).toEqual(expect.arrayContaining([...BASELINE_SERVERS]));
  });

  it('canonical mcpServers is a YAML sequence of mapping objects carrying only a server name', () => {
    const violations: string[] = [];
    for (const file of orchestratorFiles) {
      for (const entry of serverEntries(readFrontmatter(canonicalAgentPath(file)))) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          violations.push(`${file}: entry is not a mapping (${JSON.stringify(entry)})`);
          continue;
        }
        const keys = Object.keys(entry);
        if (typeof entry.name !== 'string' || entry.name.length === 0) {
          violations.push(`${file}: entry carries no name`);
        }
        if (keys.some(key => key !== 'name')) {
          violations.push(`${file}: entry carries non-name keys [${keys.join(', ')}]`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every engineering/architecture/security specialist declares context7 (Objective A1)', () => {
    const roles = specialistsOfDomains(CONTEXT7_SPECIALIST_DOMAINS);
    expect(roles.length, 'the derived specialist set must not be empty').toBeGreaterThan(0);
    const missing = roles.filter(
      role => !serverNames(readFrontmatter(canonicalAgentPath(role))).includes('context7')
    );
    expect(missing, `specialists that must declare context7: ${missing.join(', ')}`).toEqual([]);
  });

  it('every security specialist also declares github (Objective A1)', () => {
    const roles = specialistsOfDomains(['security']);
    expect(roles.length, 'the derived security specialist set must not be empty').toBeGreaterThan(0);
    const missing = roles.filter(
      role => !serverNames(readFrontmatter(canonicalAgentPath(role))).includes('github')
    );
    expect(
      missing,
      `security specialists that must declare github: ${missing.join(', ')}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Group 2 — the Claude lane exposes declared servers (Objective A2)
// ---------------------------------------------------------------------------

describe('Plan 029 Group 2 — Claude projection exposes declared servers (Objective A2)', () => {
  it('a non-read-only specialist exposes every declared server by name AND grants its tools', () => {
    const file = 'subagent-backend-architect.md';
    const declared = serverNames(readFrontmatter(canonicalAgentPath(file)));
    expect(declared.length, `${file} must declare servers for this assertion to be meaningful`)
      .toBeGreaterThan(0);

    const { meta } = renderRoleFrontmatter(file);
    expect(serverNames(meta), `projected mcpServers must name [${declared.join(', ')}]`)
      .toEqual(expect.arrayContaining(declared));
    for (const server of declared) {
      expect(meta.tools, `projected tools must carry the server-level grant mcp__${server}`)
        .toContain(`mcp__${server}`);
    }
  });

  it('a projected orchestrator exposes the baseline trio and its tool grants', () => {
    const { meta } = renderRoleFrontmatter('orchestrator-engineering.md');
    for (const server of BASELINE_SERVERS) {
      expect(serverNames(meta), `projected orchestrator must expose ${server}`).toContain(server);
      expect(meta.tools, `projected orchestrator must grant mcp__${server}`).toContain(`mcp__${server}`);
    }
  });

  it('the render no longer records-and-drops mcpServers (FEATURE_LEDGER no longer degraded)', () => {
    const { meta, ledger } = renderRoleFrontmatter('subagent-backend-architect.md');
    // The behavioural half: the key survives into the rendered frontmatter.
    expect(Object.keys(meta)).toContain('mcpServers');
    // The ledger half: whether the disposition lives in FEATURE_LEDGER or INLINE_KEYS, it must
    // never be reported as `degraded` again.
    const row = ledger.find(entry => entry.feature === 'mcpServers');
    if (row) {
      expect(row.disposition, 'FEATURE_LEDGER.mcpServers must no longer be degraded')
        .not.toBe('degraded');
    }
    expect(meta.permissionMode).toBe('acceptEdits');
  });

  it('no projected artifact carries an inline server definition (servers are referenced by name)', () => {
    const violations: string[] = [];
    for (const file of fs.readdirSync(CANONICAL_AGENTS_DIR).filter(f => f.endsWith('.md')).sort()) {
      const { meta } = renderRoleFrontmatter(file);
      for (const entry of serverEntries(meta)) {
        if (typeof entry === 'string') continue;
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          violations.push(`${file}: mcpServers entry is not a name reference`);
          continue;
        }
        const keys = Object.keys(entry);
        if (keys.some(key => key !== 'name')) {
          violations.push(`${file}: inline server definition with keys [${keys.join(', ')}]`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('registry/translation-ledger.json records claude/mcpServers as carried and cline as unsupported', () => {
    const entries = loadTranslationLedger();
    const claude = entries.find(entry => entry.feature === 'mcpServers' && entry.host === 'claude');
    const cline = entries.find(entry => entry.feature === 'mcpServers' && entry.host === 'cline');

    expect(claude, 'the ledger must declare mcpServers for claude').toBeDefined();
    expect(['mapped', 'approximated'], 'claude/mcpServers needs a carried disposition')
      .toContain(claude!.disposition);
    expect(claude!.rationale.trim().length).toBeGreaterThan(0);

    // Step 0(b): Cline Configured Agents inherit no session MCP tools, so this stays unsupported.
    expect(cline?.disposition).toBe('unsupported');
  });
});

describe('Plan 029 Group 2b — Risk R1 / owner decision Option B: read-only roles', () => {
  it('read-only roles pin exact read-only GitHub tool names and never the bare mcp__github grant', () => {
    // `permissionMode: readOnly` projects to `plan`, and READ_ONLY_EXCLUDED_TOOLS
    // (src/core/claude-projector.ts) only strips Write/Edit/NotebookEdit/Bash — it does NOT touch
    // MCP entries. A bare server-level `mcp__github` would therefore hand a read-only role GitHub's
    // write tools, so the projection must pin exact read-only tool names instead.
    const READ_ONLY_GITHUB_TOOL = /^mcp__github__(search_.+|get_.+|list_.+|.+_read)$/;
    const reported: string[] = [];

    for (const file of ['subagent-code-reviewer.md', 'subagent-repo-index.md']) {
      const canonical = readFrontmatter(canonicalAgentPath(file));
      expect(canonical.permissionMode, `${file} fixture must be a read-only role`)
        .toBe(READ_ONLY_PERMISSION_MODE);
      expect(serverNames(canonical), `${file} fixture must declare github`).toContain('github');

      const { meta } = renderRoleFrontmatter(file);
      expect(meta.permissionMode, `${file} must render as a read-only Claude role`).toBe('plan');
      expect(serverNames(meta), `${file} must still expose github by name`).toContain('github');
      expect(meta.tools, `${file} must NOT carry the bare server-level grant`)
        .not.toContain('mcp__github');

      const pinned = (Array.isArray(meta.tools) ? meta.tools : []).filter(
        (tool: string) => typeof tool === 'string' && tool.startsWith('mcp__github__')
      );
      if (pinned.length === 0) {
        reported.push(`${file}: no pinned mcp__github__<tool> entries`);
        continue;
      }
      for (const tool of pinned) {
        if (!READ_ONLY_GITHUB_TOOL.test(tool)) {
          reported.push(`${file}: pins a non-read-only GitHub tool (${tool})`);
        }
      }
      for (const excluded of ['Write', 'Edit', 'Bash']) {
        expect(meta.tools, `${file} keeps the read-only tool filter`).not.toContain(excluded);
      }

      // Step 2 addition (subagent-backend-architect): Risk R1 is a rule about EVERY server a
      // read-only role declares, not only about github — the bare server-level grant is never
      // handed to a `plan` role, whatever the server.
      for (const server of serverNames(canonical)) {
        expect(meta.tools, `${file} must not take the bare server-level grant mcp__${server}`)
          .not.toContain(`mcp__${server}`);
      }
    }

    expect(reported).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Group 3 — Risk R4: no credentials in any projected artifact (HIGH severity)
// ---------------------------------------------------------------------------

/**
 * Realistic credential shapes. Each hit is reported as a hard failure; the placeholder filter
 * below keeps documentation such as `ghp_yourPersonalAccessTokenHere` from being mistaken for a
 * leak (the catalog legitimately documents how to configure a server).
 */
const CREDENTIAL_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  [
    'provider token with a live-shaped prefix',
    /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{16,})/,
  ],
  ['authorization bearer header', /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/],
  [
    'credential-valued assignment',
    /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token|private[_-]?key)\b["']?\s*[:=]\s*["']?(?!your|process\.env|\$\{|<|xxx|example|dummy|redact|placeholder)[A-Za-z0-9._/+-]{16,}/i,
  ],
  [
    'long opaque base64 secret',
    /\b(?=[A-Za-z0-9+/]{60,}={0,2}\b)(?=\S*[A-Z])(?=\S*\d)[A-Za-z0-9+/]{60,}={0,2}\b/,
  ],
  ['sha-like hex secret', /\b[0-9a-fA-F]{64}\b/],
];

const PLACEHOLDER_VALUE = /(your|xxx|placeholder|example|sample|dummy|redact|\.\.\.)/i;

interface ScannedArtifact {
  label: string;
  text: string;
}

/** Every projected artifact across the three host lanes plus the pinned golden trees. */
function collectProjectedArtifacts(): ScannedArtifact[] {
  const artifacts: ScannedArtifact[] = [];
  const agentFiles = fs.readdirSync(CANONICAL_AGENTS_DIR).filter(f => f.endsWith('.md')).sort();

  for (const file of agentFiles) {
    const content = fs.readFileSync(canonicalAgentPath(file), 'utf8');
    const canonicalRel = `agents/${file}`;
    // Claude lane.
    artifacts.push({
      label: `.claude/agents/${file}`,
      text: ClaudeProjector.renderRole(content, canonicalRel).content,
    });
    // Cline lane.
    artifacts.push({
      label: `.cline/agents/${file}`,
      text: ClineProjector.renderConfiguredAgent(content, canonicalRel),
    });
    // Antigravity lane — Antigravity reads the canonical store natively.
    artifacts.push({ label: `registry/${canonicalRel}`, text: content });
  }

  for (const dir of fs.readdirSync(CANONICAL_SKILLS_DIR).sort()) {
    const skillFile = path.join(CANONICAL_SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const content = fs.readFileSync(skillFile, 'utf8');
    const canonicalRel = `skills/${dir}/SKILL.md`;
    artifacts.push({
      label: `.claude/${canonicalRel}`,
      text: ClaudeProjector.renderSkill(content, canonicalRel).content,
    });
    artifacts.push({
      label: `.cline/skills/${dir}/SKILL.md`,
      text: ClineProjector.renderSkillMd(content, canonicalRel),
    });
    artifacts.push({ label: `registry/${canonicalRel}`, text: content });
  }

  // The pinned golden trees (Claude lane + Claude "created" lane).
  for (const file of walkFiles(GOLDEN_TREES_DIR)) {
    artifacts.push({
      label: `tests/golden/${path.relative(GOLDEN_TREES_DIR, file).split(path.sep).join('/')}`,
      text: fs.readFileSync(file, 'utf8'),
    });
  }

  return artifacts;
}

describe('Plan 029 Group 3 — Risk R4: no credentials in any projected artifact', () => {
  it('the scan harness actually covers every lane and the pinned goldens', () => {
    const artifacts = collectProjectedArtifacts();
    const lanes = new Set(artifacts.map(artifact => artifact.label.split('/')[0]));
    expect(
      [...lanes].sort(),
      'the scan must cover the Claude lane, the Cline lane, the Antigravity/canonical store and the goldens'
    ).toEqual(expect.arrayContaining(['.claude', '.cline', 'registry', 'tests']));
    expect(artifacts.length, 'a lane silently scanned nothing').toBeGreaterThan(100);
  });

  it('the credential patterns detect live-shaped secrets (positive control)', () => {
    // Assembled at runtime on purpose: a literal live-shaped token in a committed test file would
    // itself be exactly the artefact Risk R4 forbids.
    const samples: Array<[string, string]> = [
      ['provider token with a live-shaped prefix', `sk-${'a'.repeat(32)}`],
      ['provider token with a live-shaped prefix', `ghp_${'a'.repeat(24)}`],
      ['provider token with a live-shaped prefix', `github_pat_${'a'.repeat(24)}`],
      ['authorization bearer header', `Authorization: Bearer ${'a'.repeat(32)}`],
      ['credential-valued assignment', `"apiKey": "${'a'.repeat(24)}"`],
      ['sha-like hex secret', 'a'.repeat(63) + 'f'],
    ];
    for (const [kind, sample] of samples) {
      const entry = CREDENTIAL_PATTERNS.find(([name]) => name === kind);
      expect(entry, `no pattern registered for ${kind}`).toBeDefined();
      expect(entry![1].test(sample), `the ${kind} pattern missed a live-shaped sample`).toBe(true);
    }
    // …and the documentation placeholders the catalog legitimately ships must never trip it.
    for (const [kind, pattern] of CREDENTIAL_PATTERNS) {
      const placeholder = 'apiKey: <your-api-key-here>';
      expect(pattern.test(placeholder), `${kind} must ignore the placeholder dialect`).toBe(false);
    }
  });

  it('no credential-shaped string appears in any projected artifact or golden file', () => {
    const hits: string[] = [];
    for (const artifact of collectProjectedArtifacts()) {
      for (const [kind, pattern] of CREDENTIAL_PATTERNS) {
        for (const match of artifact.text.match(pattern) ?? []) {
          if (PLACEHOLDER_VALUE.test(match)) continue;
          hits.push(`${artifact.label}: ${kind} -> ${match.slice(0, 24)}…`);
        }
      }
    }
    expect(hits, `credential-shaped content found in projected artifacts: ${hits.join(' | ')}`)
      .toEqual([]);
  });

  it('no projected artifact inlines a server definition (env/command/args/headers/url)', () => {
    const violations: string[] = [];
    for (const artifact of collectProjectedArtifacts()) {
      const match = artifact.text.match(/^---\n([\s\S]*?)\n---/);
      if (!match) continue;
      const meta = yaml.parse(match[1]) ?? {};
      for (const entry of serverEntries(meta)) {
        if (typeof entry === 'string') continue;
        const keys = Object.keys(entry ?? {});
        const inline = keys.filter(key => key !== 'name');
        if (inline.length > 0) {
          violations.push(`${artifact.label}: ${inline.join(', ')}`);
        }
      }
    }
    expect(violations, `inline server definitions: ${violations.join(' | ')}`).toEqual([]);
  });

  it('the projected lanes really do carry declared servers by name (Objective A2 anchor)', () => {
    // Without this anchor the scan above is vacuously green: today no projected role carries
    // `mcpServers` at all, so "nothing inline" would hold for the wrong reason.
    const carriers: string[] = [];
    for (const file of fs.readdirSync(CANONICAL_AGENTS_DIR).filter(f => f.endsWith('.md')).sort()) {
      if (serverNames(readFrontmatter(canonicalAgentPath(file))).length === 0) continue;
      if (serverEntries(renderRoleFrontmatter(file).meta).length > 0) carriers.push(file);
    }
    expect(
      carriers.length,
      'no projected role exposes the servers its canonical frontmatter declares (Objective A2)'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group 4 — doctor declared-but-unconfigured MCP servers (Objective A3)
// ---------------------------------------------------------------------------

/** Every human-readable line a HealthReport can carry, shape-tolerant by design. */
function reportLines(report: any): string[] {
  const lines: string[] = [];
  if (Array.isArray(report?.warnings)) lines.push(...report.warnings.map(String));
  if (Array.isArray(report?.issues)) lines.push(...report.issues.map(String));
  for (const [key, value] of Object.entries(report ?? {})) {
    if (key === 'warnings' || key === 'issues') continue;
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      lines.push(...(value as string[]));
    } else if (Array.isArray(value)) {
      for (const item of value as any[]) {
        if (Array.isArray(item)) {
          lines.push(...item.filter((x: unknown): x is string => typeof x === 'string'));
        }
      }
    }
  }
  return lines;
}

function reportText(report: any): string {
  const lines = reportLines(report);
  return lines.length > 0 ? lines.join('\n') : JSON.stringify(report);
}

describe('Plan 029 Group 4 — doctor declared-but-unconfigured MCP warnings (Objective A3)', () => {
  let suiteRoot: string;
  let workspace: string;
  let agentsDir: string;
  let sandboxHome: string;
  let sandboxAppData: string;

  const originalCwd = process.cwd();
  const ENV_KEYS = ['USERPROFILE', 'HOME', 'APPDATA', 'CLAUDE_BIN_PATH', 'CLINE_BIN_PATH'] as const;
  const originalEnv: Record<string, string | undefined> = {};

  const declaredButUnconfigured = (text: string, server: string): boolean =>
    text
      .split('\n')
      .some(
        line =>
          new RegExp(server, 'i').test(line) &&
          /(not configured|unconfigured|no .*configured|missing)/i.test(line)
      );

  beforeEach(async () => {
    suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'au-plan029-doctor-'));
    workspace = path.join(suiteRoot, 'ws');
    agentsDir = path.join(workspace, '.agents');
    sandboxHome = path.join(suiteRoot, 'home');
    sandboxAppData = path.join(suiteRoot, 'appdata');
    await fs.ensureDir(workspace);
    await fs.ensureDir(sandboxHome);
    await fs.ensureDir(sandboxAppData);

    await new InstallEngine().install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
    });

    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    // Sandbox the home/appData the MCP location registry reads, so the fixture config — never the
    // developer's real ~/.claude.json — decides what counts as "configured".
    process.env.USERPROFILE = sandboxHome;
    process.env.HOME = sandboxHome;
    process.env.APPDATA = sandboxAppData;
    delete process.env.CLAUDE_BIN_PATH;
    delete process.env.CLINE_BIN_PATH;
    process.chdir(workspace);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.remove(suiteRoot);
  });

  it('warns for a declared-but-unconfigured server and prints the host add command (claude)', async () => {
    expect(await fs.pathExists(path.join(sandboxHome, '.claude.json'))).toBe(false);

    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    const text = reportText(report);

    expect(text, 'doctor must name the unconfigured server').toMatch(/context7/);
    expect(text, "doctor must print claude's own add command").toMatch(/claude mcp add/);
    expect(declaredButUnconfigured(text, 'context7')).toBe(true);
  });

  it('stays silent for a server the host has configured via the fixture MCP config', async () => {
    await fs.writeJson(
      path.join(workspace, '.mcp.json'),
      {
        mcpServers: {
          github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
        },
      },
      { spaces: 2 }
    );

    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    const text = reportText(report);

    expect(declaredButUnconfigured(text, 'context7'), 'context7 is still unconfigured').toBe(true);
    expect(
      declaredButUnconfigured(text, 'github'),
      `github is configured in the fixture .mcp.json, so it must not be warned:\n${text}`
    ).toBe(false);
  });

  it('prints the antigravity add command when the antigravity host has no server configured', async () => {
    const report = await DoctorEngine.runDoctor(agentsDir, 'antigravity');
    const text = reportText(report);
    expect(text).toMatch(/context7/);
    expect(text, "doctor must print antigravity's own add command").toMatch(/agy mcp add/);
  });

  it('prints the Cline settings path when the Cline host has no server configured', async () => {
    const report = await DoctorEngine.runDoctor(agentsDir, 'cline');
    const text = reportText(report);
    expect(text).toMatch(/context7/);
    expect(text, "doctor must point at Cline's settings file").toMatch(/cline_mcp_settings\.json/);
  });

  it('prints the host add command through the CLI (`agents doctor --host claude`)', () => {
    const env: Record<string, string | undefined> = {
      ...process.env,
      USERPROFILE: sandboxHome,
      HOME: sandboxHome,
      APPDATA: sandboxAppData,
      CLAUDE_BIN_PATH: undefined,
      CLINE_BIN_PATH: undefined,
    };
    delete env.CLAUDE_BIN_PATH;
    delete env.CLINE_BIN_PATH;

    const result = spawnSync(process.execPath, [CLI_PATH, 'doctor', '--host', 'claude'], {
      cwd: workspace,
      env: env as NodeJS.ProcessEnv,
      encoding: 'utf8',
      timeout: 120_000,
    });
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(out, 'the CLI must name the declared-but-unconfigured server').toMatch(/context7/);
    expect(out, "the CLI must print claude's own add command").toMatch(/claude mcp add/);
  });

  it('never installs or writes a server — doctor only prints', async () => {
    // No real `claude` / `cline` / `agy` may be discoverable here. Probing a real binary is itself a
    // side effect — Cline's CLI drops `.cline/cli-node-extra-ca-certs.pem` into the cwd and the
    // sandboxed home — and this assertion is about doctor writing nothing at all.
    const originalPath = process.env.PATH;
    process.env.PATH =
      process.platform === 'win32'
        ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
        : '/usr/bin:/bin';

    const before = treeFingerprint(suiteRoot);
    let ran = 0;
    try {
      for (const host of ['claude', 'antigravity', 'cline'] as const) {
        const report = await DoctorEngine.runDoctor(agentsDir, host);
        expect(typeof (report as { valid?: unknown })?.valid, 'doctor must return a real report')
          .toBe('boolean');
        ran += 1;
      }
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
    expect(ran, 'the three host runs must have happened').toBe(3);

    const after = treeFingerprint(suiteRoot);
    const diff = fingerprintDiff(before, after);
    expect(diff, `doctor mutated the sandbox (it must only print):\n${diff.join('\n')}`).toEqual([]);

    // The MCP-specific half, independent of anything the host tooling does: not one registered MCP
    // config path may appear (Objective A3 — doctor never installs a server itself).
    const mcpPaths = McpLocationRegistry.LOCATIONS.map(loc =>
      path.relative(suiteRoot, path.normalize(loc.resolvePath(workspace, sandboxHome, sandboxAppData)))
        .split(path.sep)
        .join('/')
    );
    const touched = Object.keys(after).filter(rel => mcpPaths.includes(rel));
    expect(touched, 'doctor wrote an MCP configuration file').toEqual([]);
    expect(walkFiles(sandboxHome), 'doctor wrote into the sandboxed home').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Group 5 — corrected Claude MCP locations (Objective A4)
// ---------------------------------------------------------------------------

describe('Plan 029 Group 5 — corrected Claude MCP locations (Objective A4)', () => {
  let suiteRoot: string;
  let projectDir: string;
  let home: string;
  let appData: string;

  const ENV_KEYS = ['USERPROFILE', 'HOME', 'APPDATA'] as const;
  const originalEnv: Record<string, string | undefined> = {};

  const resolvedClaudePaths = (): string[] =>
    McpLocationRegistry.LOCATIONS.filter(loc => loc.host === 'claude').map(loc =>
      path.normalize(loc.resolvePath(projectDir, home, appData))
    );

  beforeEach(async () => {
    suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'au-plan029-locations-'));
    projectDir = path.join(suiteRoot, 'project');
    home = path.join(suiteRoot, 'home');
    appData = path.join(suiteRoot, 'appdata');
    await fs.ensureDir(projectDir);
    await fs.ensureDir(home);
    await fs.ensureDir(appData);

    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    process.env.APPDATA = appData;
  });

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.remove(suiteRoot);
  });

  it('registers `.mcp.json` at the project root as the primary Claude project-scope config', () => {
    expect(McpLocationRegistry.getPrimaryWritePath('claude', projectDir)).toBe(
      path.join(projectDir, '.mcp.json')
    );
  });

  it('no longer registers the wrong Claude paths', () => {
    const paths = resolvedClaudePaths();
    expect(paths, '`.claude/mcp.json` is not a Claude Code MCP config')
      .not.toContain(path.normalize(path.join(projectDir, '.claude', 'mcp.json')));
    expect(paths, '`<cwd>/claude.json` is not a Claude Code MCP config')
      .not.toContain(path.normalize(path.join(projectDir, 'claude.json')));
    expect(paths, '`~/.claude/mcp.json` is not a Claude Code MCP config')
      .not.toContain(path.normalize(path.join(home, '.claude', 'mcp.json')));
    // Step 2 addition (subagent-backend-architect): `~/claude.json` was the same class of error as
    // the three above — the Claude Code user config is `~/.claude.json`, with the dot.
    expect(
      paths,
      '`~/claude.json` is a mis-spelling of `~/.claude.json`, not a Claude Code MCP config'
    ).not.toContain(path.normalize(path.join(home, 'claude.json')));
  });

  it('registers `~/.claude.json` for the user scope', () => {
    expect(resolvedClaudePaths()).toContain(path.normalize(path.join(home, '.claude.json')));
  });

  it('reads local-scope servers from `~/.claude.json > projects.<abs-path>.mcpServers`', async () => {
    await fs.writeJson(
      path.join(home, '.claude.json'),
      {
        projects: {
          [projectDir]: {
            mcpServers: {
              github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
            },
          },
        },
      },
      { spaces: 2 }
    );

    const discovered = await McpLocationRegistry.discoverForHosts(['claude'], projectDir);
    const localEntries = discovered.filter(
      entry => path.normalize(entry.path) === path.normalize(path.join(home, '.claude.json'))
    );

    expect(localEntries.length, 'the local scope must be discoverable').toBeGreaterThan(0);
    const withGithub = localEntries.filter(
      entry => entry.servers !== undefined && Object.keys(entry.servers).includes('github')
    );
    expect(
      withGithub.length,
      'the local scope must be read from `projects.<abs-path>.mcpServers`'
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Group 6 — Antigravity launcher (Objectives B6 / B7)
// ---------------------------------------------------------------------------

/** `agy --help` surface as verified live on this machine (agy 1.2.12). */
const AGY_HELP = [
  'Usage: agy [options] [command]',
  '',
  'Options:',
  '  --agent <name>              Agent for the current CLI session',
  '  -i, --prompt-interactive    Run an initial prompt interactively and continue the session',
  '  --mode <mode>               accept-edits, plan',
  '  --version                   output the version number',
  '  --help                      display help for command',
  '',
].join('\n');

/** This test file's own path — guaranteed to exist, used as an absolute AGY_BIN_PATH. */
const SELF_PATH = fileURLToPath(import.meta.url);

const ANTIGRAVITY_CAPABILITIES_MODULE = '../src/core/antigravity-capabilities.js';
const ANTIGRAVITY_LAUNCHER_MODULE = '../src/core/antigravity-launcher.js';

/** The `agy` argv the launcher must resolve (verified live: agy 1.2.12). */
const AGY_AGENT_FLAG = '--agent';
const AGY_PROMPT_FLAG = '--prompt-interactive';

describe('Plan 029 Group 6a — AntigravityCapabilityProbe (Objective B6)', () => {
  const originalAgyBin = process.env.AGY_BIN_PATH;

  beforeEach(() => {
    delete process.env.AGY_BIN_PATH;
  });

  afterEach(() => {
    if (originalAgyBin === undefined) delete process.env.AGY_BIN_PATH;
    else process.env.AGY_BIN_PATH = originalAgyBin;
  });

  it('runs exactly `--version` then `--help` and never a headless turn', async () => {
    const mod: any = await import(ANTIGRAVITY_CAPABILITIES_MODULE);
    expect(typeof mod.AntigravityCapabilityProbe, 'AntigravityCapabilityProbe must be exported')
      .toBe('function');

    const invocations: string[][] = [];
    const fakeRunner = async (_executable: string, args: string[]) => {
      invocations.push([...args]);
      if (args.includes('--version')) return { exitCode: 0, stdout: '1.2.12\n', stderr: '' };
      if (args.includes('--help')) return { exitCode: 0, stdout: AGY_HELP, stderr: '' };
      return { exitCode: 1, stdout: '', stderr: 'unexpected invocation' };
    };

    const probe = new mod.AntigravityCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({ executable: 'agy', prefixArgs: [], source: 'path-executable' }),
    });
    const report = await probe.probe();

    expect(report.installed).toBe(true);
    expect(report.version).toContain('1.2.12');
    expect(invocations, 'the probe runs only --version and --help, in that order').toEqual([
      ['--version'],
      ['--help'],
    ]);
    for (const args of invocations) {
      for (const forbidden of ['-p', '--prompt-interactive', '--agent', '--print', 'run']) {
        expect(args, `the probe must never run a session (${forbidden})`).not.toContain(forbidden);
      }
    }
  });

  it('derives the interactive-TUI flags from `agy --help` (verified live: agy 1.2.12)', async () => {
    const mod: any = await import(ANTIGRAVITY_CAPABILITIES_MODULE);
    const probe = new mod.AntigravityCapabilityProbe(
      async (_executable: string, args: string[]) => {
        if (args.includes('--version')) return { exitCode: 0, stdout: '1.2.12\n', stderr: '' };
        if (args.includes('--help')) return { exitCode: 0, stdout: AGY_HELP, stderr: '' };
        return { exitCode: 1, stdout: '', stderr: 'unexpected invocation' };
      },
      {
        resolveExecutable: () => ({
          executable: 'agy',
          prefixArgs: [],
          source: 'path-executable',
        }),
      }
    );

    const report = await probe.probe();

    expect(report.agentFlag, '`--agent <name>` must be detected').toBe(true);
    expect(
      report.promptInteractive,
      '`-i, --prompt-interactive` must be detected'
    ).toBe(true);
    expect(report.modes, '`--mode` values must be detected')
      .toEqual(expect.arrayContaining(['accept-edits', 'plan']));
  });

  it('honours the AGY_BIN_PATH override (mirroring CLAUDE_BIN_PATH)', async () => {
    const mod: any = await import(ANTIGRAVITY_CAPABILITIES_MODULE);
    process.env.AGY_BIN_PATH = SELF_PATH;

    const resolved = new mod.AntigravityCapabilityProbe(async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })).resolveExecutable();

    expect(resolved, 'AGY_BIN_PATH must resolve when the path exists').not.toBeNull();
    expect(resolved.executable).toBe(SELF_PATH);
    expect(resolved.source, 'mirrors CLAUDE_BIN_PATH: an absolute existing override wins').toBe(
      'env-binary'
    );
  });

  it('reports an absent agy as data (installed: false) and never throws', async () => {
    const mod: any = await import(ANTIGRAVITY_CAPABILITIES_MODULE);
    const probe = new mod.AntigravityCapabilityProbe(async () => {
      throw new Error('the runner must not be invoked when no executable resolves');
    }, { resolveExecutable: () => null });

    const report = await probe.probe();
    expect(report.installed).toBe(false);
    expect(report.diagnostics.join('\n')).toMatch(/not found/i);
  });
});

describe('Plan 029 Group 6b — AntigravityLauncher (Objective B6)', () => {
  /** The capability report an installed `agy` 1.2.12 produces (flag detection included). */
  const capabilityReport = {
    installed: true,
    version: '1.2.12',
    command: { executable: 'agy', prefixArgs: [], source: 'path-executable' },
    agentFlag: true,
    promptInteractive: true,
    modes: ['accept-edits', 'plan'],
    diagnostics: [],
  };

  it('resolves `agy --agent <orchestrator> --prompt-interactive "<prompt>"` with one argv element per value', async () => {
    const mod: any = await import(ANTIGRAVITY_LAUNCHER_MODULE);
    expect(typeof mod.AntigravityLauncher, 'AntigravityLauncher must be exported').toBe('function');

    const launcher = new mod.AntigravityLauncher();
    const prompt = 'Review & delete $(rm -rf /) | echo "hacked" %PATH%\nSecond line';
    const plan = launcher.planActivation({
      bundleName: 'software-engineering',
      workspace: path.join(os.tmpdir(), 'au-plan029-agy-ws'),
      scope: 'project',
      report: capabilityReport,
      prompt,
      orchestrator: 'orchestrator-universal.md',
    });

    expect(plan.executable).toBe('agy');
    expect(plan.argv[0]).toBe(AGY_AGENT_FLAG);
    expect(plan.argv[1], 'the --agent value is the bundle orchestrator without .md')
      .toBe('orchestrator-universal');

    const flagIndex = plan.argv.indexOf(AGY_PROMPT_FLAG);
    expect(flagIndex, `argv: ${JSON.stringify(plan.argv)}`).toBeGreaterThan(-1);
    // One element per value: a shell-hostile prompt is never word-split or joined.
    expect(plan.argv[flagIndex + 1]).toBe(prompt);
    expect(plan.argv.filter((entry: string) => entry === prompt)).toHaveLength(1);
    expect(plan.argv.every((entry: unknown) => typeof entry === 'string')).toBe(true);
  });

  it('never shell-joins argv and spawns with shell: false (mirroring ClaudeLauncher.launch)', () => {
    const launcherPath = path.resolve(ROOT, 'src/core/antigravity-launcher.ts');
    expect(fs.existsSync(launcherPath), 'src/core/antigravity-launcher.ts must exist').toBe(true);
    const source = fs.readFileSync(launcherPath, 'utf8');
    expect(source, 'the launcher must spawn with shell: false').toMatch(/shell:\s*false/);
    expect(source, 'the launcher must never spawn with shell: true').not.toMatch(/shell:\s*true/);
    expect(
      source,
      'argv must stay an array — never a shell command string'
    ).not.toMatch(/child_process\.exec\(|execSync\(/);
  });
});

describe('Plan 029 Group 6c — `agents start` on the Antigravity lane (Objectives B6 / B7)', () => {
  let suiteRoot: string;
  let workspace: string;
  let agentsDir: string;
  let sandboxHome: string;
  let sandboxAppData: string;

  const ENV_KEYS = [
    'PATH',
    'USERPROFILE',
    'HOME',
    'APPDATA',
    'AGY_BIN_PATH',
    'CLAUDE_BIN_PATH',
    'CLINE_BIN_PATH',
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};

  /** The bundle's orchestrator (registry/bundles.json). */
  const ORCHESTRATOR = 'orchestrator-engineering';
  const DESKTOP_ROUTE = /\.agents[\\/]agents[\\/]orchestrator-engineering\.md/;
  const CLINE_FALLBACK_NOTE = /falling back to the Cline lane/i;

  const MINIMAL_PATH =
    process.platform === 'win32'
      ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
      : '/usr/bin:/bin';

  function runCli(args: string[], overrides: Record<string, string | undefined>) {
    const env: Record<string, string | undefined> = { ...process.env, ...overrides };
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete env[key];
    }
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
      cwd: workspace,
      env: env as NodeJS.ProcessEnv,
      encoding: 'utf8',
      timeout: 120_000,
    });
  }

  /** No `agy` and no `cline` can resolve on this PATH, so nothing can ever be launched. */
  function absentBinaryEnv(): Record<string, string | undefined> {
    return {
      PATH: MINIMAL_PATH,
      AGY_BIN_PATH: undefined,
      CLAUDE_BIN_PATH: undefined,
      CLINE_BIN_PATH: undefined,
      USERPROFILE: sandboxHome,
      HOME: sandboxHome,
      APPDATA: sandboxAppData,
    };
  }

  beforeEach(async () => {
    suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'au-plan029-start-'));
    workspace = path.join(suiteRoot, 'ws');
    agentsDir = path.join(workspace, '.agents');
    sandboxHome = path.join(suiteRoot, 'home');
    sandboxAppData = path.join(suiteRoot, 'appdata');
    await fs.ensureDir(workspace);
    await fs.ensureDir(sandboxHome);
    await fs.ensureDir(sandboxAppData);

    await new InstallEngine().install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
    });

    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.remove(suiteRoot);
  });

  it('`--dry-run` prints the resolved agy argv (or the documented desktop route)', () => {
    const result = runCli(['start', 'software-engineering', '--host', 'antigravity', '--dry-run'], {
      ...absentBinaryEnv(),
      PATH: process.env.PATH,
      AGY_BIN_PATH: process.execPath, // a real, resolvable binary: the probe reports `installed`
    });
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(result.status, `expected exit 0, got ${result.status}:\n${out}`).toBe(0);
    expect(out, 'the Cline fallback note must be gone on this host').not.toMatch(CLINE_FALLBACK_NOTE);

    // AGY_BIN_PATH resolves to a real, existing executable, so the probe reports `installed` (the
    // same rule CLAUDE_BIN_PATH follows): the dry run must print the resolved argv, not the
    // no-`agy` desktop route.
    expect(out, `the dry run must print the --agent flag:\n${out}`).toContain(AGY_AGENT_FLAG);
    expect(out, `the --agent value must be the bundle orchestrator:\n${out}`)
      .toContain(ORCHESTRATOR);
  });

  it('src/cli.ts no longer carries the silent Cline fallback for non-Cline hosts (Objective B7)', () => {
    const cli = fs.readFileSync(path.resolve(ROOT, 'src', 'cli.ts'), 'utf8');
    expect(cli, 'the silent Cline fallback note must be gone').not.toMatch(CLINE_FALLBACK_NOTE);
  });

  it('without agy it prints the desktop route, exits 0 and never launches Cline', () => {
    const result = runCli(['start', 'software-engineering', '--host', 'antigravity'], absentBinaryEnv());
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(result.status, `expected exit 0, got ${result.status}:\n${out}`).toBe(0);
    expect(out, 'the desktop route must @-mention the canonical orchestrator file')
      .toMatch(DESKTOP_ROUTE);
    expect(out, 'no silent fallback to the Cline lane').not.toMatch(CLINE_FALLBACK_NOTE);
    expect(out, 'the Cline lane must not be reached')
      .not.toMatch(/Starting Cline Team|Cline session finished/);
  });

  it('auto-detects the Antigravity lane when the lockfile hosts are only `.agents`', () => {
    const result = runCli(['start', 'software-engineering'], absentBinaryEnv());
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(result.status, `expected exit 0, got ${result.status}:\n${out}`).toBe(0);
    expect(out, 'the Antigravity lane must be resolved without an explicit --host')
      .toMatch(/antigravity/i);
    expect(out, 'no silent fallback to the Cline lane').not.toMatch(CLINE_FALLBACK_NOTE);
  });
});

// ---------------------------------------------------------------------------
// Group 7 — host primitive matrix (Objectives C8 / C9)
// ---------------------------------------------------------------------------

describe('Plan 029 Group 7 — host primitive matrix records the findings (Objectives C8 / C9)', () => {
  const matrixPath = path.resolve(ROOT, 'docs', 'host-primitive-matrix.md');

  /** The document slice between two headings (whitespace-insensitive: content, not layout). */
  function sectionBetween(content: string, from: RegExp, to: RegExp): string {
    const start = content.search(from);
    if (start < 0) return '';
    const rest = content.slice(start);
    const endMatch = rest.slice(1).search(to);
    return endMatch < 0 ? rest : rest.slice(0, endMatch + 1);
  }

  /** One bullet's text, from its `- **\`label\`**` marker to the next top-level bullet. */
  function bulletText(content: string, label: string): string {
    const marker = `- **\`${label}\`**`;
    const start = content.indexOf(marker);
    if (start < 0) return '';
    const after = content.slice(start + marker.length);
    const next = after.search(/\n- \*\*/);
    return next < 0 ? after : after.slice(0, next);
  }

  /**
   * Markdown-punctuation-free, lowercased text: the assertion is about content, not about where the
   * backticks and bold markers happen to sit (`` `degraded` on Claude `` vs `degraded on Claude`).
   */
  const squash = (text: string): string =>
    text.replace(/[`*_]/g, ' ').replace(/\s+/g, ' ').toLowerCase();

  it('the §2 Subagents table records the Antigravity reachability finding (Objective C8/C9)', () => {
    const content = fs.readFileSync(matrixPath, 'utf8');
    const subagents = sectionBetween(content, /^## 2\. Subagents/m, /^## 3\./m);

    expect(subagents.length, 'the §2 Subagents section must exist').toBeGreaterThan(0);
    expect(subagents, 'the delegation mechanism must stay documented').toMatch(/invoke_subagent/);
    expect(
      subagents,
      'the runtime-registration rule must demand the VERBATIM canonical role body (Objective C9)'
    ).toMatch(/verbatim/i);
    expect(
      subagents,
      'the reachability finding must be stated in the Antigravity cell'
    ).toMatch(/reachab|by name/i);
  });

  it('the mcpServers note reflects the new Claude disposition (Objective A2/A5)', () => {
    const content = fs.readFileSync(matrixPath, 'utf8');
    const note = bulletText(content, 'mcpServers');

    expect(note.length, 'the `mcpServers` note must exist').toBeGreaterThan(0);
    const clean = squash(note);
    expect(clean, 'the note must still describe the Claude disposition').toContain('claude');
    expect(clean, 'the Cline disposition stays unsupported (Step 0(b))').toContain('unsupported');

    // Clause-level: no sentence may still tie Claude to a `degraded` disposition (Objective A2).
    const claudeClauses = clean.split(/[.;:]/).filter(clause => clause.includes('claude'));
    expect(claudeClauses.length, 'the note must say something about Claude').toBeGreaterThan(0);
    for (const clause of claudeClauses) {
      expect(
        clause,
        'Claude must no longer be recorded as degraded (Plan 029 Objective A2)'
      ).not.toContain('degraded');
    }
  });
});

