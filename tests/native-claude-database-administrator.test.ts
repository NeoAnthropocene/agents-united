import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore, scanCoreForHostTokens } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `database-administrator`, brought in the way `cloud-infrastructure-architect` (shell parts) and `devops-engineer` were.
 * Its canonical agent has the same tool set as devops-engineer, run_command included, so it holds a shell and a monitor; its canonical
 * `schedule` is not carried over (a specialist holds no scheduling tool), and its only canonical MCP server is context7 (no github).
 * Every "blocked" and "not blocked" claim of its body is fired at the real guard script.
 */

/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';

const ROLE = 'database-administrator';
const text = (): string => nativeText(ROLE);
const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/subagent-database-administrator.md'), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
const section = (body: string, heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(body)![1]!.trim();
/** A numbered step of the "How to work" section. */
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section(text(), 'How to work'))![0];

describe('native database-administrator: the tools its canonical agent has', () => {
  it("the canonical agent's tools are the file tools, the command tool and the task and timer tools", () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const tools = [...(/\ntools:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(tools).toEqual(['view_file', 'replace_file_content', 'write_to_file', 'run_command', 'grep_search', 'list_dir', 'manage_task', 'schedule', 'find_by_name']);
  });

  it('holds both shells, the editors, the monitor and the task tools, and no web, delegation or scheduling tool', () => {
    const tools = toolsOf(text());
    expect(tools).toEqual(expect.arrayContaining(['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Monitor', 'Glob', 'Grep', 'Read', 'Skill', 'SendMessage', 'ListAgents', 'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite']));
    for (const absent of ['WebFetch', 'WebSearch', 'Agent', 'EnterWorktree', 'LSP', 'CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup']) expect(tools, absent).not.toContain(absent);
  });

  it('the shared core declares the shell and the monitor and not scheduling, and keeps the capabilities the grant needs', async () => {
    const capabilities = (await loadSemanticCore('registry')).get('subagent-database-administrator')!.capabilities ?? [];
    expect(capabilities).toEqual(expect.arrayContaining(['read', 'search', 'edit', 'shell', 'messaging', 'handback', 'skill', 'background-monitor', 'task-tracking', 'mcp-discovery']));
    expect(capabilities).not.toContain('scheduling');
  });

  it('says that a recurring check or timer is a recommendation under Open items, not an action', () => {
    expect(section(text(), 'Boundaries of this host')).toContain('a recurring health check or a timer is a `schedule` request, not an action you take.');
  });

  it('search through Bash is stated for macOS, Linux and WSL', () => {
    expect(step(1)).toContain('On macOS, Linux and WSL this role holds `Bash`, so `Glob` and `Grep` are unavailable there and search runs through `Bash`.');
  });
});

describe('native database-administrator: the guard and live-database claims, against the real script', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-dba-guard-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
    for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
  });
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
  const fire = (tool: string, input: Record<string, unknown>): { blocked: boolean; offered: boolean } => {
    const result = attempt(text(), project, { tool, input }, { agentType: ROLE });
    return { blocked: result.blocked, offered: result.offered };
  };
  const shell = (tool: 'Bash' | 'PowerShell', command: string): boolean => fire(tool, { command }).blocked;

  it('step 6 names exactly what the bound guard blocks, and what it does not', () => {
    const six = step(6);
    expect(six).toContain(`blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect in the command text, and ${COMMON_FORMS}; it is a seat belt, not a boundary.`);
    expect(six).not.toContain('blocks only');
    expect(six).not.toContain('does not enforce the Safety rule');
    // The blocking clause alone: what follows "it is a seat belt" names the commands the guard does NOT stop.
    const blocking = six.slice(six.indexOf('blocks forced'), six.indexOf('it is a seat belt'));
    expect(blocking).not.toMatch(/DROP|migration|psql|mysql|pg_restore/);
    const notStopped = six.slice(six.indexOf('It does not stop'));
    for (const other of ['psql', 'mysql', 'pg_restore', 'DROP DATABASE', 'a migration tool']) expect(notStopped, other).toContain(other);
    expect(six).toMatch(/your own obligation/);
  });

  it.each(['Bash', 'PowerShell'] as const)('%s: blocks a forced push, vercel --prod, a redirect into .env and the destructive shell forms, as the Boundaries say', tool => {
    for (const command of [
      'git push --force origin main', 'git push -f origin main', 'vercel --prod', 'echo DATABASE_URL=x > .env', 'echo DATABASE_URL=x > config/.env.production',
      'rm -rf /', 'sudo ls', 'shutdown now',
    ]) expect(shell(tool, command), command).toBe(true);
  });

  it.each(['Bash', 'PowerShell'] as const)('%s: does not block a database client, a restore, a drop, a migration tool or a delete of a build folder, as step 6 says', tool => {
    for (const command of [
      'psql "$DATABASE_URL" -c "DROP TABLE accounts"',
      'psql -h prod-db.internal -c "DROP DATABASE app_production"',
      'psql "$DATABASE_URL" -c "CREATE INDEX idx_a ON accounts (a)"',
      'mysql -h prod-db.internal -e "TRUNCATE TABLE sessions"',
      'pg_restore --clean --dbname "$DATABASE_URL" backup.dump',
      'npx prisma migrate deploy',
      'git push --force-with-lease origin feature/x',
      'rm -rf ./build',
      'echo DATABASE_URL=x > .env.example',
    ]) expect(shell(tool, command), command).toBe(false);
  });

  it.each([
    ['Write', { file_path: 'C:\\repo\\.env' }],
    ['Write', { file_path: '/repo/.env.production' }],
    ['Edit', { file_path: '/repo/.env.local', old_string: 'a', new_string: 'b' }],
    ['NotebookEdit', { notebook_path: '/repo/.env' }],
  ])('blocks %s of a .env file', (tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>)).toEqual({ blocked: true, offered: true });
  });

  it('blocks MultiEdit of a .env file as well, although the role is not granted that tool (the guard names it as a matcher, which is why the Boundaries sentence lists it)', () => {
    expect(toolsOf(text())).not.toContain('MultiEdit');
    expect(fire('MultiEdit', { file_path: '/repo/.env', edits: [] })).toEqual({ blocked: true, offered: false });
    expect(fire('MultiEdit', { file_path: '/repo/.env.example', edits: [] }).blocked).toBe(false);
  });

  it.each([
    ['Write', { file_path: '/repo/.env.example' }],
    ['Write', { file_path: '/repo/db/migrations/0042_expand_phone.sql' }],
    ['Edit', { file_path: '/repo/ops/pgbouncer.ini', old_string: 'a', new_string: 'b' }],
  ])('does not block %s of %j', (tool, input) => {
    expect(fire(tool as string, input as Record<string, unknown>).blocked).toBe(false);
  });

  it('states what the guard blocks, where it comes from in both modes, and that acceptEdits leaves the limit to the role', () => {
    const boundaries = section(text(), 'Boundaries of this host');
    expect(boundaries).toContain(`- A guard blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect in the command text, and ${COMMON_FORMS}; it is a seat belt, not a boundary. As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case.`);
    expect(boundaries).toContain('`permissionMode: acceptEdits` approves your file edits without asking');
    expect(boundaries).not.toContain('It blocks nothing else');
    expect(boundaries).not.toContain('Its `.env` rule covers');
    expect(text().split('A guard blocks')).toHaveLength(2);
    expect(boundaries).toContain('keeping to migrations, database configuration, runbooks and ADRs, and changing application source only when your brief asks, is your own obligation.');
    // `.env` tokens stripped, so the match runs to the end of the line instead of stopping at their dot.
    const claims = boundaries.replace(/`\.env(\.example)?`/g, 'ENV');
    expect(claims).not.toMatch(/blocks[^\n]*(DROP|psql|mysql|pg_restore)/);
  });

  it('holds no GitHub tool, so the push, merge and create duty is not stated', () => {
    expect(toolsOf(text()).some(tool => tool.startsWith('mcp__github'))).toBe(false);
    expect(text()).toContain('This role holds no GitHub tool.');
    expect(text()).not.toContain('the guard does not see its calls');
  });

  it('step 3 says EXPLAIN ANALYZE executes the statement and needs a connection, and limits it to a disposable database or the brief', () => {
    const three = step(3);
    expect(three).toContain('`EXPLAIN ANALYZE` executes the statement, so it needs a database connection and, for a write, changes data');
    expect(three).toContain('run it only against an isolated test database, or against another database when your brief authorises it');
  });

  it('step 5 verifies in an isolated test database it creates, says what needs network, and keeps credentials out of files', () => {
    const five = step(5);
    expect(five).toContain('in an isolated test database that you create for the run and own');
    expect(five).toContain('staging, production and a shared development database are not isolated test databases');
    expect(five).toContain('A local database you start from an installed engine needs no network; pulling a container image or installing an engine or extension does.');
    expect(five).toContain('never inline a value or a credential hash');
  });

  it('step 4 states the Expand and Contract phases, the DDL policy and the division with backend-architect', () => {
    const four = step(4);
    for (const part of ['Expand (add the nullable column and dual-write)', 'Backfill and switch reads', 'Contract (drop the deprecated columns)', '`CREATE INDEX CONCURRENTLY`', '`NOT VALID`', '`VALIDATE CONSTRAINT`']) expect(four, part).toContain(part);
    expect(four).toContain("You own the engine side: settings, plan analysis, the DDL review, the Expand and Contract plan and pooling. API contracts and ORM models are `backend-architect`'s. Where a change touches application code or an ORM, or both roles could own the migration, put the part you do not own under `Open items` for the lead to route.");
    expect(four).not.toContain('migration code inside the application');
  });

  it('keeps the live-database handback and the destructive-command rule in the Safety floor', () => {
    expect(text()).toContain('- Never run a migration, a schema change or a data change against a database that is not disposable (staging, production, a shared development database) yourself; hand the exact command to the orchestrator for explicit user approval unless your brief authorises it.');
    expect(text()).toContain('- Run tests, rollbacks and restore drills only in isolated test databases that you create for the run.');
    expect(text()).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation, shutdown or dropping a database outside an isolated test database.');
  });
});

describe('native database-administrator: the skill table', () => {
  const bundles = (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: Record<string, { agents?: string[]; skills?: string[]; parentBundle?: string }> }).bundles ?? {};
  const carrying = Object.entries(bundles).filter(([, bundle]) => (bundle.agents ?? []).includes('subagent-database-administrator.md'));
  /** What a Bundle installs: its own skills and its parent's (a child inherits the parent's skills). */
  const installs = (name: string): string[] => [...(bundles[name]?.skills ?? []), ...(bundles[bundles[name]?.parentBundle ?? '']?.skills ?? [])];
  const tableSkills = (): string[] => [...section(text(), 'How to work').matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|$/gm)].map(match => match[1]!);

  it('is carried by the system-architecture-data bundle and the aggregate full bundle, and by no other', () => {
    expect(carrying.map(([name]) => name).sort()).toEqual(['full', 'system-architecture-data']);
  });

  it('names only skills that every carrying bundle installs, and that exist', () => {
    expect(tableSkills().length).toBeGreaterThan(0);
    for (const skill of tableSkills()) {
      expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
      for (const [name] of carrying) expect(installs(name), `${skill} in ${name}`).toContain(skill);
    }
  });

  it('the contract lists the same skills as the canonical agent, all of which exist, and the table names each of them', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('registry/core/subagent-database-administrator.contract.json'), 'utf8')) as { skills: string[] };
    const front = /^---\n([\s\S]*?)\n---\n/.exec(canonical())![1]!;
    const declared = [...(/\nskills:\n((?:  - .*\n?)+)/.exec(`\n${front}\n`)?.[1] ?? '').matchAll(/^  - (.+)$/gm)].map(match => match[1]);
    expect(declared).toHaveLength(6);
    expect(contract.skills).toEqual(declared);
    for (const skill of contract.skills) expect(fs.existsSync(path.resolve('registry/skills', skill, 'SKILL.md')), skill).toBe(true);
    expect([...tableSkills()].sort()).toEqual([...declared].sort());
  });

  it('the Bundle carries backend-architect, whose native agent is reused unchanged', () => {
    expect(bundles['system-architecture-data']!.agents).toEqual(['subagent-database-administrator.md', 'subagent-backend-architect.md']);
    expect(bundles['system-architecture-data']!.parentBundle).toBe('system-architecture');
  });
});

describe('native database-administrator: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(section(text(), 'Working with peers').split('\n')).toEqual(section(nativeText('devops-engineer'), 'Working with peers').split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame', () => {
    expect(text()).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(text()).not.toMatch(/digital agency/i);
    expect(text()).not.toContain('shutdown_request');
  });

  it('step 7 hands the report back as the final answer and conditionally through SubagentHandback', () => {
    expect(step(7)).toBe('7. **Hand back.** Return the report from the Output Contract as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it('carries the session task tracking section of backend-architect verbatim', () => {
    const tail = (body: string): string => body.slice(body.indexOf('\n## Session task tracking\n'));
    expect(tail(text())).toBe(tail(nativeText('backend-architect')));
  });
});

describe('native database-administrator: the MCP servers and posture of its canonical agent', () => {
  it('holds context7 only, as its canonical agent lists, and says when to use it', () => {
    expect(toolsOf(text())).toContain('mcp__context7');
    expect(text()).toContain('- Library and framework questions: confirm them with `mcp__context7` before relying on memory.');
    expect([...canonical().matchAll(/^  - name: (\S+)$/gm)].map(match => match[1])).toEqual(['context7']);
  });

  it('permission mode equals the canonical value; model and effort are the native specialist pin, not the canonical `high`', () => {
    const value = (source: string, key: string): string | undefined => new RegExp(`^${key}: (.+)$`, 'm').exec(source)?.[1];
    expect(value(canonical(), 'permissionMode')).toBe('acceptEdits');
    expect(value(text(), 'permissionMode')).toBe('acceptEdits');
    expect(value(canonical(), 'effort')).toBe('high');
    expect([value(text(), 'model'), value(text(), 'effort')]).toEqual(['sonnet', 'medium']);
  });
});

describe('native database-administrator: the shared scope_boundaries and safety', () => {
  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

  it('carries every numbered Primary Directive of the canonical agent, word for word, with no forbidden host token to reword', async () => {
    const directives = [...(/\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
    expect(directives).toHaveLength(4);
    for (const directive of directives) expect(scanCoreForHostTokens(directive), directive).toEqual([]);
    const scope = normalize((await loadSemanticCore('registry')).get('subagent-database-administrator')!.scope_boundaries);
    for (const directive of directives) expect(scope, directive).toContain(directive);
  });

  it('keeps the core competencies, the report format and the safety checklist of the canonical agent', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-database-administrator')!;
    for (const part of ['PostgreSQL 16/17', 'MySQL 8.4', 'Turso LibSQL', '`shared_buffers`', '`checkpoint_completion_target`', 'EXPLAIN (ANALYZE, BUFFERS, SETTINGS)', 'BRIN indexes', 'PgBouncer transaction versus session pooling', 'Supabase Supavisor', 'AWS RDS Proxy', 'point-in-time recovery (PITR)', '`NOT VALID`']) {
      expect(core.scope_boundaries, part).toContain(part);
    }
    for (const part of ['database instance profile', 'performance and query plan optimization table', 'latency before and after', 'zero-downtime migration safety checklist']) expect(core.output_contract, part).toContain(part);
  });

  it('pins the added safety lines as additions to the canonical text: the live-database handback is the maintainer\'s decision, and the rest follows from the shell it holds', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-database-administrator')!;
    expect(core.safety).toContain('Never run a migration, a schema change or a data change against a database that is not disposable');
    expect(core.safety).toContain('Run tests, rollbacks and restore drills only in isolated test databases');
    expect(canonical()).toContain('Verify migration rollbacks and idempotency in isolated test databases.');
    expect(canonical()).toContain('escalate dangerous schema locks or unresolvable migration deadlocks to the calling orchestrator');
  });
});
