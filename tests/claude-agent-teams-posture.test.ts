import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { resolveClaudeTeamsPosture, describeClaudeTeamsPosture } from '../src/cli.js';

/**
 * Peer-to-peer messaging grants on the four canonical engineering specialists, and the Tier-1/Tier-2
 * Agent Teams posture at launch.
 *
 * Canonical sources are `registry/agents/*.md`; `.claude/**` and `.agents/**` are generated. Every
 * assertion below therefore runs against the canonical file, its projected Claude output (renderer and a
 * real install), or the pure posture helper — never against a generated copy checked into git.
 */

const REGISTRY_AGENTS = path.resolve(process.cwd(), 'registry/agents');

const SPECIALISTS = [
  'subagent-code-reviewer',
  'subagent-repo-index',
  'subagent-backend-architect',
  'subagent-frontend-architect',
];

const PEER_HEADING = '## 🔀 Parallel Work, Handoff & Peer Reachability';
/** Documented Claude subagent semantics: siblings are not reachable; the result goes back to the caller. */
const REPORT_BACK_PHRASE = 'return one structured handoff to the orchestrator';
/** Documented Agent-Teams limit, quoted from the live docs. */
const NO_NESTED_TEAMS_PHRASE = 'teammates cannot spawn their own teammates';
/** The ADR 0014 Consultation Budget wording reused verbatim (no new limits invented). */
const BUDGET_PHRASE = '2 peer exchanges per specialist pair';

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/** Leading YAML frontmatter block of a canonical or projected agent file. */
function frontmatterOf(file: string): Record<string, any> {
  const match = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`No YAML frontmatter found in ${file}`);
  return yaml.parse(match[1]) as Record<string, any>;
}

/** Body (everything after the frontmatter) of an agent file. */
function bodyOf(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match ? match[1] : '';
}


describe('canonical peer-messaging grant — the four engineering specialists', () => {
  for (const name of SPECIALISTS) {
    it(`${name}.md declares send_message in canonical frontmatter (appended, not reordered)`, () => {
      const meta = frontmatterOf(path.join(REGISTRY_AGENTS, `${name}.md`));
      expect(Array.isArray(meta.tools)).toBe(true);
      expect(meta.tools).toContain('send_message');
      expect(meta.tools[meta.tools.length - 1]).toBe('send_message');
    });

    it(`${name}.md carries a peer-messaging section that is honest about both tiers`, () => {
      const body = bodyOf(read(path.join(REGISTRY_AGENTS, `${name}.md`)));
      expect(body).toContain(PEER_HEADING);
      // Agent-Teams route and its documented limits
      expect(body).toContain('send_message');
      expect(body).toContain(NO_NESTED_TEAMS_PHRASE);
      expect(body).toContain('--teams');
      // ordinary-subagent route: no direct sibling reach, Agent-tool nesting depth
      expect(body).toContain(REPORT_BACK_PHRASE);
      expect(body).toContain('3-layer nesting depth');
      // existing ADR 0014 budget reused, never re-invented
      expect(body).toContain(BUDGET_PHRASE);
      expect(body).toContain('1 directed question per peer per planning round');
    });
  }
});

describe('projected Claude specialists carry SendMessage', () => {
  for (const name of SPECIALISTS) {
    it(`renderRole projects ${name} with SendMessage and no surviving canonical token`, () => {
      const canonicalRel = `agents/${name}.md`;
      const { content } = ClaudeProjector.renderRole(read(path.join(REGISTRY_AGENTS, `${name}.md`)), canonicalRel);
      const meta = yaml.parse(content.match(/^---\n([\s\S]*?)\n---/)![1]) as Record<string, any>;

      expect(meta.name).toBe(name.replace(/^subagent-/, ''));
      expect(meta.tools).toContain('SendMessage');
      // the bare Agent pin (tests/claude-projector.test.ts) must be unaffected by the new grant
      expect(meta.tools).toContain('Agent');
      expect(meta.tools.some((t: string) => t.startsWith('Agent('))).toBe(false);
      // unknown tool names block agent launch in Claude Code: no snake_case canonical token may survive
      expect(meta.tools.filter((t: string) => /^[a-z][a-z_]*$/.test(t))).toEqual([]);
    });
  }
});


describe('real install projects SendMessage into .claude/agents/*.md', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-claude-teams-posture');
  const agentsDir = path.join(workspace, '.agents');
  const claudeAgentsDir = path.join(workspace, '.claude', 'agents');

  beforeEach(async () => {
    // NOTE: never pass maxRetries/retryDelay to fs-extra remove() — it hangs in this environment.
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });

  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('all four specialists list SendMessage in the installed projection', async () => {
    await new InstallEngine().install('software-engineering', {
      targetDir: agentsDir,
      method: 'copy',
      fanout: ['claude'],
    });

    for (const name of SPECIALISTS) {
      const projected = path.join(claudeAgentsDir, `${name.replace(/^subagent-/, '')}.md`);
      expect(await fs.pathExists(projected), `${name} projection missing`).toBe(true);
      expect(frontmatterOf(projected).tools).toContain('SendMessage');
    }
  });
});

describe('tier-aware Agent Teams posture at launch', () => {
  it('an organization-tier bundle resolves to teams by default', () => {
    expect(resolveClaudeTeamsPosture(undefined, 'organization')).toMatchObject({
      active: true,
      reason: 'tier-default',
      tier: 'organization',
    });
  });

  it('--no-teams overrides the organization-tier default', () => {
    expect(resolveClaudeTeamsPosture(false, 'organization')).toMatchObject({
      active: false,
      reason: 'opt-out',
    });
  });

  it('a domain-tier bundle does not enable teams without --teams', () => {
    expect(resolveClaudeTeamsPosture(undefined, 'domain')).toMatchObject({
      active: false,
      reason: 'domain-tier',
    });
  });

  it('--teams still forces teams on for a domain-tier bundle', () => {
    expect(resolveClaudeTeamsPosture(true, 'domain')).toMatchObject({
      active: true,
      reason: 'explicit',
    });
  });

  it('an undeclared bundle tier never enables teams silently', () => {
    expect(resolveClaudeTeamsPosture(undefined, undefined).active).toBe(false);
    // `--no-teams` stays an explicit opt-out even when the tier could not be resolved
    expect(resolveClaudeTeamsPosture(false, undefined).reason).toBe('opt-out');
  });

  it('registry tiers drive the decision for the real bundles', async () => {
    const registry = new RegistryResolver();
    const agency = await registry.getBundle('digital-agency');
    const software = await registry.getBundle('software-engineering');

    expect(agency?.tier).toBe('organization');
    expect(software?.tier === 'organization').toBe(false);

    expect(resolveClaudeTeamsPosture(undefined, agency?.tier).active).toBe(true);
    expect(resolveClaudeTeamsPosture(undefined, software?.tier).active).toBe(false);

    // the explicit opt-out wins over both tiers
    expect(resolveClaudeTeamsPosture(false, agency?.tier).active).toBe(false);
    expect(resolveClaudeTeamsPosture(false, software?.tier).active).toBe(false);

    // and the explicit opt-in wins over a domain tier
    expect(resolveClaudeTeamsPosture(true, software?.tier).active).toBe(true);
  });

  it('describeClaudeTeamsPosture explains each decision without over-claiming', () => {
    const domain = describeClaudeTeamsPosture(resolveClaudeTeamsPosture(undefined, 'domain'));
    expect(domain).toContain("tier 'domain'");
    expect(domain).toContain('--teams');

    const tierDefault = describeClaudeTeamsPosture(resolveClaudeTeamsPosture(undefined, 'organization'));
    expect(tierDefault).toContain('organization');
    expect(tierDefault).not.toContain('--teams to enable');

    const optOut = describeClaudeTeamsPosture(resolveClaudeTeamsPosture(false, 'organization'));
    expect(optOut).toContain('--no-teams');
  });

  it('every bundle declares an explicit tier, so Tier 1 is labelled rather than inferred', () => {
    const bundles = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'registry/bundles.json'), 'utf8')
    ).bundles as Record<string, { tier?: string }>;

    const names = Object.keys(bundles);
    expect(names.length).toBeGreaterThan(30);

    const undeclared = names.filter(name => !bundles[name].tier);
    expect(undeclared, `bundles missing an explicit tier: ${undeclared.join(', ')}`).toEqual([]);

    const invalid = names.filter(name => !['domain', 'organization'].includes(bundles[name].tier!));
    expect(invalid).toEqual([]);

    // Tier 1 is the labelled default; Tier 2 stays the small experimental set.
    expect(bundles['software-engineering'].tier).toBe('domain');
    expect(bundles['digital-agency'].tier).toBe('organization');
  });
});

/**
 * Tier 2 (organization) runs with Agent Teams logic, so the specialists those bundles actually declare must
 * carry the peer-messaging grant — otherwise the teammates a Tier-2 lead spawns have no way to reach each
 * other and the tier default is hollow. Derived from bundles.json so the guard cannot drift as bundles change.
 */
describe('organization-tier specialists carry the peer-messaging grant', () => {
  const bundles = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'registry/bundles.json'), 'utf8')
  ).bundles as Record<string, { tier?: string; agents?: string[] }>;

  const tier2Specialists = Array.from(
    new Set(
      Object.values(bundles)
        .filter(bundle => bundle.tier === 'organization')
        .flatMap(bundle => bundle.agents ?? [])
    )
  );

  it('covers the specialist set an organization bundle actually declares', () => {
    expect(tier2Specialists.length).toBeGreaterThanOrEqual(8);
  });

  for (const agentFile of tier2Specialists) {
    it(`${agentFile} declares send_message and documents both reachability routes`, () => {
      const file = path.join(REGISTRY_AGENTS, agentFile);
      expect(frontmatterOf(file).tools).toContain('send_message');

      const body = bodyOf(read(file));
      expect(body).toContain(PEER_HEADING);
      expect(body).toContain(REPORT_BACK_PHRASE);
      expect(body).toContain(BUDGET_PHRASE);
    });

    it(`${agentFile} projects SendMessage into its Claude tools list`, () => {
      const rendered = ClaudeProjector.renderRole(
        read(path.join(REGISTRY_AGENTS, agentFile)),
        `agents/${agentFile}`
      );
      const match = rendered.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      expect(match).not.toBeNull();

      const tools = (yaml.parse(match![1]) as Record<string, any>).tools as string[];
      expect(tools).toContain('SendMessage');
      expect(tools[0]).toBe('Agent');
    });
  }
});
