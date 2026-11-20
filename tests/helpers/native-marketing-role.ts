import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationOf } from '../../src/core/claude-mcp-routes.js';
import { splitTools } from '../../src/core/native-guard.js';
import { loadSemanticCore } from '../../src/core/semantic-core.js';
import { attempt } from './claude-host-hooks.js';
import { evidenceFor } from './native-invariant-evidence.js';
import { bundles } from './native-coordinator.js';
import { nativeText } from './native-roles.js';

/**
 * What the five Tier 1 marketing specialists (growth-marketing) have in common, as the factory pilot's `devops-engineer` test has it for one role: posture, the tools and servers as bound,
 * the guard against the real script, the peers section of the Tier 1 form, the hand-back step, the session task tracking section, the skill table and the invariants of the core.
 * Each role's test file adds what only that role says. The roles run no shell (their cores grant none), so like the Tier 2 teammates they hold the editors and the web.
 */

export interface MarketingRoleSpec {
  /** The native name, e.g. `marketing-growth-strategist`. */
  role: string;
  /** The canonical registry file stem, e.g. `subagent-marketing-growth-strategist`. */
  type: string;
  /** The Tier 2 file stood on the same core, when there is one. A role on a core of its own leaves it out: its tools are then pinned by the class ceiling in native-claude-agents.test.ts. */
  agency?: string;
  /** The integrations the canonical agent declares (the routes are derived), none of them an image server. */
  servers: string[];
  /** Whether the core has the artifacts class, and so the role holds the `Artifact` tool. */
  artifact: boolean;
  /** The marketing types its "Your peers" line must name. */
  peers: string[];
  /** The things step 6 returns, as the role says it. */
  returns: string;
  /** The role holds a shell (its core grants the shell class): its description, guard checks and Boundaries line differ from the specialists that run none. */
  shell?: boolean;
  /** The bundle that installs the role and whose skill list its skill table draws on, when it is not growth-marketing itself (a child add-on). */
  bundle?: string;
}

const ROLE_SPECIFIC_FORBIDDEN = /Chris\b|Campaign Director|digital agency|Deniz|Emre|Defne|Arda\b|motion designer|sound designer|motion-designer|sound-designer|agency-|workflow-agency-|Media Request/i;
/** The one sentence the two roles whose floor names the frontend architect carry in their body: a hand-off outside the department goes through the lead. */
export const OUT_OF_DEPARTMENT_HANDOFF = 'A hand-off to a role outside the marketing department, such as the frontend architect, goes to `orchestrator-marketing` under `Open items`: that role is present only when its own Bundle is installed, and in this department it is not the agency persona.';
const PERSONAS = /\b(Ava|Jamileh|Yavuz|Kaan|Jale|Selin)\b/;
const IMAGE_TOOL = /\bimage-gen\b|generate_image/;
/** The shared guard sentence every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const GUARD_SENTENCE =
  'A guard blocks forced pushes, `vercel --prod`, `.env` writes and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary.';

export function describeMarketingRole(spec: MarketingRoleSpec): void {
  const text = (): string => nativeText(spec.role);
  const meta = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text())![1]!);
  const tools = (): string[] => splitTools(meta().tools);
  const body = (): string => text().split('<!-- agents-united:floor:end -->')[1]!;
  /** A `##` section of the file, from its heading to the next `##` (or the end). */
  const section = (heading: string): string => new RegExp(`\\n## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
  /** A numbered step of the "How to work" section. */
  const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';
  const canonical = (): string => fs.readFileSync(path.resolve('registry/agents', `${spec.type}.md`), 'utf8').replace(/\r\n/g, '\n');
  const agencyTools = (): string[] => splitTools(/^tools: (.*)$/m.exec(nativeText(spec.agency!))![1]!);

  describe(`native ${spec.role}: posture and tools`, () => {
    it('is pinned to the specialist posture, with the permission mode of its canonical agent, and says in its description that it edits files and runs no shell', () => {
      expect(meta().name).toBe(spec.role);
      expect([meta().model, meta().effort, meta().permissionMode]).toEqual(['sonnet', 'medium', 'acceptEdits']);
      expect(meta().permissionMode).toBe(/^permissionMode: (.+)$/m.exec(canonical())?.[1]);
      expect(meta().skills ?? []).toEqual([]);
      expect(String(meta().description).length).toBeLessThanOrEqual(300);
      expect(meta().description).toContain(spec.shell ? 'Edits files and runs commands.' : 'Edits files, no shell.');
    });

    it('holds the tools of the Tier 2 copy on the same core when there is one, minus every image server', () => {
      if (spec.agency) {
        const expected = agencyTools().filter(tool => !/image/i.test(tool));
        expect([...tools()].sort()).toEqual([...expected].sort());
      }
      expect(tools().filter(tool => /image/i.test(tool))).toEqual([]);
      expect(text()).not.toMatch(IMAGE_TOOL);
    });

    it('holds the servers its canonical agent declares, under every route, and nothing else', () => {
      const front = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(canonical())![1]!) as { mcpServers?: Array<{ name: string } | string> };
      const declared = (front.mcpServers ?? []).map(entry => (typeof entry === 'string' ? entry : entry.name));
      expect([...new Set(tools().filter(tool => tool.startsWith('mcp__')).map(integrationOf))].sort()).toEqual([...spec.servers].sort());
      expect([...declared].sort()).toEqual([...spec.servers].sort());
    });

    it('runs a shell only when its core grants one, spawns nobody and schedules nothing, and holds Artifact only when its core has the artifacts class', async () => {
      const shellTools = ['Bash', 'PowerShell'];
      for (const absent of [...(spec.shell ? [] : shellTools), 'Agent', 'Workflow', 'CronCreate', 'Monitor', 'EnterWorktree', 'ExitWorktree', 'LSP']) expect(tools().map(tool => tool.split('(')[0]), absent).not.toContain(absent);
      const core = (await loadSemanticCore('registry')).get(spec.type)!;
      // The web and the task tools follow the classes the core grants: a core without `web` or `task-tracking` gets neither, and the body must not claim them.
      const webTools = ['WebFetch', 'WebSearch'];
      const taskTools = ['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite'];
      const web = (core.capabilities ?? []).includes('web');
      const tracking = (core.capabilities ?? []).includes('task-tracking');
      for (const present of [...(spec.shell ? shellTools : []), 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'Skill', 'SendMessage', 'SubagentHandback', 'ToolSearch', ...(web ? webTools : []), ...(tracking ? taskTools : [])]) expect(tools(), present).toContain(present);
      for (const absent of [...(web ? [] : webTools), ...(tracking ? [] : taskTools)]) expect(tools(), absent).not.toContain(absent);
      expect(tools().includes('Artifact')).toBe(spec.artifact);
      expect(core.capabilities).toContain('messaging');
      expect((core.capabilities ?? []).includes('artifacts')).toBe(spec.artifact);
      if (spec.shell) expect(core.capabilities).toContain('shell');
      else expect(core.capabilities).not.toContain('shell');
    });
  });

  describe(`native ${spec.role}: the guard, against the real guard script`, () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-marketing-role-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const blocked = (tool: string, input: Record<string, unknown>): boolean => attempt(text(), project, { tool, input }, { agentType: spec.role }).blocked;

    it('blocks a .env write through each editor it holds and lets .env.example through', () => {
      for (const tool of ['Write', 'Edit']) {
        expect(blocked(tool, { file_path: 'C:\\repo\\.env' }), `${tool} .env`).toBe(true);
        expect(blocked(tool, { file_path: 'C:\\repo\\.env.example' }), `${tool} .env.example`).toBe(false);
      }
      expect(blocked('NotebookEdit', { notebook_path: 'C:\\repo\\.env' })).toBe(true);
      expect(blocked('Write', { file_path: 'C:\\repo\\docs\\content\\plan.md' })).toBe(false);
    });

    if (spec.shell) {
      it('blocks the destructive forms through each shell it holds, both ways, and nothing else: the Safety rules are its own obligation', () => {
        for (const tool of ['Bash', 'PowerShell']) {
          expect(attempt(text(), project, { tool, input: { command: 'git status' } }, { agentType: spec.role }).offered, tool + ' is offered').toBe(true);
          const forms = tool === 'Bash'
            ? ['git push --force origin main', 'vercel --prod', 'echo x > .env', 'rm -rf /', 'rm -rf $HOME', 'sudo ls', 'shutdown -h now']
            : ['git push --force origin main', 'vercel --prod', 'echo x > .env', 'Remove-Item -Recurse -Force C:\\'];
          for (const command of forms) expect(blocked(tool, { command }), tool + ': ' + command).toBe(true);
          const allowed = tool === 'Bash'
            ? ['git push --force-with-lease', 'rm -rf build', 'git commit -m x', 'terraform apply', 'curl -IL https://example.com', 'echo x > .env.example']
            : ['git push --force-with-lease', 'Remove-Item -Recurse -Force build', 'git commit -m x', 'terraform apply', 'curl -IL https://example.com', 'echo x > .env.example'];
          for (const command of allowed) expect(blocked(tool, { command }), tool + ': ' + command).toBe(false);
        }
        const boundaries = section('Boundaries of this host');
        expect(boundaries.split(GUARD_SENTENCE)).toHaveLength(2);
        expect(boundaries).toContain('It enforces nothing else, so the rules in your Safety section are your own obligation.');
        expect(boundaries).not.toMatch(/guard blocks[^.]*production deploys/);
      });

      it('states where the guard comes from in both modes, and its permission-mode limit', () => {
        const boundaries = section('Boundaries of this host');
        expect(boundaries).toContain("As a subagent it comes from this file; as a teammate it comes from the project's settings.");
        expect(boundaries).toMatch(/Your permission mode is `acceptEdits`: edits to project files go through without a prompt/);
        expect(boundaries).toContain('You hold a shell.');
        expect(boundaries).toContain('Delegation is the lead\'s job.');
      });
    } else {
      it('offers the role no shell at all, so the shell forms of the one guard sentence are the script\'s, not the role\'s, and the Safety rules are its own obligation', () => {
        for (const tool of ['Bash', 'PowerShell']) expect(attempt(text(), project, { tool, input: { command: 'git push --force origin main' } }, { agentType: spec.role }).offered, tool).toBe(false);
        const boundaries = section('Boundaries of this host');
        expect(boundaries.split(GUARD_SENTENCE)).toHaveLength(2);
        expect(boundaries).toContain('It enforces nothing else, so the rules in your Safety section are your own obligation.');
        expect(boundaries).not.toContain('which you cannot run without a shell');
        expect(boundaries).not.toMatch(/guard blocks[^.]*production deploys/);
      });

      it('states where the guard comes from in both modes, and its permission-mode limit', () => {
        const boundaries = section('Boundaries of this host');
        expect(boundaries).toContain("As a subagent it comes from this file; as a teammate it comes from the project's settings.");
        expect(boundaries).toMatch(/Your permission mode is `acceptEdits`: edits to project files go through without a prompt/);
        expect(boundaries).toContain('You hold editors and no shell.');
        expect(boundaries).toContain('Delegation is the lead\'s job.');
      });
    }
  });

  describe(`native ${spec.role}: no name from outside the domain`, () => {
    it('names no agency person, role or workflow, no persona and no media-production peer in its authored body', () => {
      expect(body()).not.toMatch(ROLE_SPECIFIC_FORBIDDEN);
      expect(body()).not.toMatch(PERSONAS);
      // The one hand-off sentence (decided during the roll-out, open to the maintainer's review) names the agency persona and the frontend architect to say they are not here; everything else in the body stays free of both.
      expect(body().replace(OUT_OF_DEPARTMENT_HANDOFF, '')).not.toMatch(/agency/i);
      expect(body().replace(OUT_OF_DEPARTMENT_HANDOFF, '')).not.toMatch(/frontend.architect/i);
    });
  });

  describe(`native ${spec.role}: the Tier 1 peers section`, () => {
    const peers = (): string => section('Working with peers');

    it('is the Tier 1 form: a lead-spawned subagent first, relay by default, no shutdown frame, no teammate-reality paragraph', () => {
      expect(peers()).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
      expect(peers()).toContain('- **Relay mode is the default.**');
      expect(peers()).not.toContain('shutdown_request');
      expect(peers()).not.toContain('a brief cannot make you a teammate');
    });

    it('names its lead, orchestrator-marketing, as the relay, and the marketing types it works next to by name', () => {
      const line = peers().split('\n').find(candidate => candidate.startsWith('- **Your peers.**')) ?? '';
      expect(line).toContain('`orchestrator-marketing`');
      expect(line).toContain('goes to it and it relays');
      for (const peer of spec.peers) expect(line, peer).toContain(`\`${peer}\``);
      expect(line).not.toContain(`\`${spec.role}\``);
    });

    it('carries the planning consultation, the report sections and the inbox rule as written', () => {
      expect(peers()).toContain('- **Planning consultation.** When the lead consults you before the plan is accepted, answer with a bounded scope-of-work statement');
      expect(peers()).toContain('- **Report sections, always present:** `Peer messages received`');
      expect(peers()).toContain('`Open items` (unanswered questions, missing peer input and blockers, or "none").');
      expect(peers()).toContain('- **Check your inbox before you finish, and do not wait for a reply.**');
      expect(peers()).toContain('- **Your final report is your one hand-back.**');
    });
  });

  describe(`native ${spec.role}: how to work`, () => {
    it('opens with the inputs-first rule, consults the skill at step 2 and hands back at the last step through SubagentHandback after a re-read', () => {
      expect(section('How to work').trimStart().startsWith('**Inputs first.**')).toBe(true);
      expect(step(2)).toMatch(/^2\. \*\*Consult the skill\.\*\* Load the matching skill with the `Skill` tool/);
      const hand = section('How to work').split('\n').find(line => /^\d+\. \*\*Hand back\.\*\*/.test(line)) ?? '';
      expect(hand).toContain('Re-read what you wrote with `Read` before you report');
      expect(hand).toContain(`Return ${spec.returns} and the paths of what you wrote as your final message through \`SubagentHandback\`.`);
    });

    it('names only skills of a bundle that installs this role (growth-marketing, or the child add-on that lists it), each of which exists', () => {
      const defs = bundles();
      const installing = Object.entries(defs).filter(([name, def]) => (name === 'growth-marketing' || def.parentBundle === 'growth-marketing') && (def.agents as string[]).includes(`${spec.type}.md`));
      expect(installing.map(([name]) => name)).toContain(spec.bundle ?? 'growth-marketing');
      const allowed = new Set(installing.flatMap(([, def]) => def.skills as string[]));
      const lines = section('How to work').split('\n');
      const head = lines.findIndex(line => /^\|\s*Situation\s*\|\s*Skill\s*\|\s*Load when\s*\|/.test(line));
      expect(head).toBeGreaterThan(-1);
      const rows = lines.slice(head + 2).filter((line, i, all) => line.startsWith('|') && all.slice(0, i).every(previous => previous.startsWith('|')));
      expect(rows.length).toBeGreaterThanOrEqual(4);
      for (const row of rows) {
        const skill = /^`([a-z0-9-]+)`$/.exec(row.split('|')[2]!.trim())?.[1];
        expect(skill, row).toBeDefined();
        expect(allowed.has(skill!), `${skill} is in no bundle that installs ${spec.role}`).toBe(true);
        expect(fs.existsSync(path.resolve('registry/skills', skill!, 'SKILL.md')), skill).toBe(true);
      }
    });
  });

  describe(`native ${spec.role}: session task tracking`, () => {
    it('has the specialist form of the section, the one every end-user role carries', () => {
      const tracking = section('Session task tracking');
      expect(tracking).toMatch(/actually available/i);
      expect(tracking).toContain('`TodoWrite`');
      expect(tracking).toMatch(/ordinary background subagents/i);
      expect(tracking).toMatch(/verify blockers are completed before `in_progress`/i);
      expect(tracking).toMatch(/without an assigned ID, track your own/i);
      expect(tracking).toMatch(/record `completed` only after evidence and readback/i);
      expect(tracking).toMatch(/Do not leave unresolved fixes marked complete/i);
      expect(text().lastIndexOf('## Session task tracking')).toBeGreaterThan(text().lastIndexOf('## Boundaries of this host'));
    });
  });

  describe(`native ${spec.role}: the invariants of its core`, () => {
    it('are all evidenced in the file as it stands, so no delta has to be declared for this role', async () => {
      const core = (await loadSemanticCore('registry')).get(spec.type)!;
      expect(core.invariants.length).toBeGreaterThanOrEqual(8);
      const unbound = core.invariants.filter(invariant => !evidenceFor(spec.role, invariant)?.test(text()));
      expect(unbound).toEqual([]);
    });
  });
}
