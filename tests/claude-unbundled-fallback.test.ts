import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';

/**
 * Plan 016 follow-up — the unbundled Claude fallback.
 *
 * A fanout whose identifier has no bundle definition (`domain:<name>` pseudo-entries, addon
 * identifiers, bundles absent from bundles.json) cannot use the compound lane, so it lands in the
 * generic fallback. That path used to render `.claude/agents/*.md` with the legacy generic
 * TOOL_NAME_MAP, which dropped `invoke_subagent` and `send_message` outright — leaving a coordinator
 * with NO `Agent` tool at all, so it could not delegate — and the ADR-0017 guard ("any role entry
 * exists") then froze that degraded file forever, because re-projection always skipped it.
 *
 * These assertions cover the three behaviours that fix it: the dialect renderer, the repair of a
 * fallback-written role, and the continued protection of a compound-owned one.
 */
describe('Claude fallback for fanouts without a bundle definition', () => {
  const suiteRoot = path.resolve(process.cwd(), 'scratch/test-claude-unbundled-fallback');
  const workspace = path.join(suiteRoot, 'ws');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');

  const claudeAgent = (role: string) => path.join(workspace, '.claude', 'agents', `${role}.md`);

  const install = (identifier: string) =>
    new InstallEngine().install(identifier, { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });

  async function toolsOf(role: string): Promise<string[]> {
    const raw = await fs.readFile(claudeAgent(role), 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) throw new Error(`no frontmatter in ${role}`);
    return match[1]
      .split(/\r?\n/)
      .filter(line => /^\s*-\s/.test(line))
      .map(line => line.trim().replace(/^-\s*/, ''));
  }

  beforeEach(async () => {
    // NOTE: never pass maxRetries/retryDelay to fs-extra remove() — it hangs this environment.
    await fs.remove(suiteRoot);
    await fs.ensureDir(workspace);
  });

  afterEach(async () => {
    await fs.remove(suiteRoot);
  });

  it('renders the Claude dialect for a domain:* fanout instead of the legacy tool map', async () => {
    await install('domain:engineering');

    const coordinator = await toolsOf('orchestrator-engineering');
    // Delegation must survive: the legacy map produced six tools and no Agent entry at all.
    expect(coordinator).toContain('Agent');
    expect(coordinator).toContain('SendMessage');
    expect(coordinator.length).toBeGreaterThan(6);

    expect(await toolsOf('backend-architect')).toContain('Agent');
  });

  it('never replaces a compound-owned role with the fallback rendering', async () => {
    // 1. the bundle's own compound lane first: an allowlist, and no bare Agent beside it
    await install('software-engineering');
    const compound = await toolsOf('orchestrator-engineering');
    expect(compound.some(tool => tool.startsWith('Agent('))).toBe(true);
    expect(compound).not.toContain('Agent');

    // 2. a bundle-less fanout then runs over the same role
    await install('domain:engineering');

    // The compound projection is authoritative and must be left alone.
    const after = await toolsOf('orchestrator-engineering');
    expect(after.some(tool => tool.startsWith('Agent('))).toBe(true);
    expect(after).toEqual(compound);
  });

  it('re-renders a role this fallback previously degraded instead of freezing it', async () => {
    await install('domain:engineering');

    const rel = '.claude/agents/backend-architect.md';
    const lock = await fs.readJson(lockPath);
    // The fallback records the `.agents/`-prefixed canonical, which is what marks it as repair-able.
    expect(lock.projections[rel].canonical.startsWith('.agents/')).toBe(true);

    // Simulate the historical degradation: a managed file stripped back to the legacy tool set.
    await fs.writeFile(
      claudeAgent('backend-architect'),
      '<!-- managed-by: agents-united | profile: claude | canonical: .agents/agents/subagent-backend-architect.md | do not edit -->\n\nlegacy body\n',
      'utf8'
    );

    await install('domain:engineering');

    const repaired = await toolsOf('backend-architect');
    expect(repaired).toContain('Agent');
    expect(repaired).toContain('SendMessage');
  });
});
