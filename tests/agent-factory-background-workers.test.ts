import fs from 'fs-extra';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeLauncher, FACTORY_SESSION_SETTINGS_ARG, factoryLaunchShapeOk } from '../src/core/claude-launcher.js';
import { renderClaudeActivationPlan, resolveClaudeTeamsPosture } from '../src/cli.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { ClaudeCapabilityReport } from '../src/core/types.js';
import { COORDINATOR_ROOT, FACTORY_FORBIDDEN_ENV, cleanFactoryEnv, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

/**
 * Plan 033 P22 (2026-11-16): the factory coordinator runs its three workers (factory-realizer, factory-evaluator, factory-sync) as the Host
 * starts them, in the foreground or the background, and waits for each hand-back. It reverses P19: the launcher no longer turns fork mode off.
 * Offline: no Host is started. The typed authoring forks (author-skill, author-contract, author-bundle) are out of scope and keep their mechanism.
 */
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const read = async (rel: string): Promise<string> => lf(await fs.readFile(path.resolve(rel), 'utf8'));
const count = (text: string, sentence: string): number => text.split(sentence).length - 1;
const frontmatter = (text: string): Record<string, unknown> => YAML.parse(/^---\n([\s\S]*?)\n---/.exec(lf(text))![1]!) as Record<string, unknown>;

const AGENT_BODY = 'registry/hosts/claude/agents/orchestrator-agent-factory.md';
const SHARED_ENTRY = 'registry/skills/coordinate-artifact/SKILL.md';
const NATIVE_ENTRY = 'registry/hosts/claude/skills/coordinate-artifact/SKILL.md';
const SKILL_ROOT = 'registry/skills/coordinate-artifact';
const DISPATCH = `${SKILL_ROOT}/references/dispatch.md`;
const AUTHORING_ROUTES = ['skill', 'contract', 'bundle'].map(route => `${SKILL_ROOT}/references/${route}-authoring.md`);
const RETURN_CHECKERS = ['skill', 'contract', 'bundle'].map(route => `${SKILL_ROOT}/scripts/check-${route}-return.mjs`);
const WORKERS = ['factory-realizer', 'factory-evaluator', 'factory-sync'];

/** The waiting rule: one wording, verbatim in the dispatch reference and in the coordinator's agent body (an interactive main does not preload the Skill). */
const WAITING_RULE = 'Start one worker at a time with Agent: `subagent_type`, a description and a prompt that carries the complete fixed job and the caller-held digest; no teammate name, no model override, no `run_in_background`. If the call returns the worker\'s finished result, go on with the checks. If it returns a launch notice instead, the worker runs in the background: say in one line which worker runs, start no other worker, do nothing that depends on its result, and end your turn; do not poll, sleep or read Host session records. Its hand-back arrives later as a message: accept it only if it comes from the worker you started and repeats the job digest you hold, then treat it as the actual return and go on with the checks. While you wait you may answer the human, but change nothing under the job\'s roots and advance no step. Refuse and report a teammate, a fork of this conversation, a hand-back from a worker you did not start, and a partial or failed return. If no hand-back has come and the human asks, say that the worker still runs and the dependent step is not done; never invent a result or a timeout.';

const NEW_ENTRY = 'The launcher turns agent teams off for the factory\'s own session and does not refuse a dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; with direct `claude --agent` entry that switch does not apply, so a worker that starts as a teammate is refused and reported.';
const OLD_ENTRY = 'The launcher turns agent teams and fork mode off for the factory\'s own session and does not refuse a dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; with direct `claude --agent` entry those switches do not apply, so a worker that starts as a teammate or in the background is refused and reported.';
const ENTRY_PLACES = [...AUTHORING_ROUTES, `${SKILL_ROOT}/references/host-sync.md`, DISPATCH, AGENT_BODY];

/**
 * Text kept on purpose in the coordinator's files, each with its reason. All of it is about the typed authoring forks, which the human starts
 * with a slash command (context: fork, background: false) and which stay out of scope: step 5 of the three authoring routes, and the line of
 * each route's "What stays unproven" that names the fork's foreground run. The three return checkers are skipped as whole files for the same reason.
 */
const TYPED_FORK_EXCEPTIONS = [
  '5. Inspect what the Host actually returned: foreground, returned text, no background or teammate. Intended settings prove nothing. Prose.',
  'that the fork is foreground',
  'that the fork runs in the foreground',
];

/** Every file under the coordinate-artifact Skill folder, as repository-relative paths. */
async function filesBelow(rel: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) found.push(path.relative(path.resolve('.'), full).split(path.sep).join('/'));
    }
  };
  await walk(path.resolve(rel));
  return found.sort();
}

describe('P22: the waiting rule stands verbatim once in the dispatch reference and in the coordinator agent body', () => {
  it.each([DISPATCH, AGENT_BODY])('%s carries the waiting rule exactly once', async rel => {
    expect(count(await read(rel), WAITING_RULE)).toBe(1);
  });

  it('is not in either coordinate-artifact entry (they point to it with the fixed sentence instead)', async () => {
    for (const rel of [SHARED_ENTRY, NATIVE_ENTRY]) {
      const text = await read(rel);
      expect(count(text, WAITING_RULE), rel).toBe(0);
      expect(text, rel).toContain('Start it as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule in [dispatch](references/dispatch.md) says.');
    }
  });

  describe('in the installed copies', () => {
    let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
    beforeEach(async () => { fixture = await prepareFactoryCoordinator(); });
    afterEach(async () => { await fs.remove(fixture.root); });

    it('the installed dispatch reference and the installed coordinator main each carry it once', async () => {
      await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
      for (const rel of [`${COORDINATOR_ROOT}/references/dispatch.md`, '.claude/agents/orchestrator-agent-factory.md']) {
        expect(count(lf(await fs.readFile(fixture.installed(rel), 'utf8')), WAITING_RULE), rel).toBe(1);
      }
    });
  });
});

describe('P22: no coordinator file asks for the foreground or refuses a background worker', () => {
  const coordinatorFiles = async (): Promise<string[]> => [AGENT_BODY, NATIVE_ENTRY, ...(await filesBelow(SKILL_ROOT)).filter(rel => !RETURN_CHECKERS.includes(rel))];

  it('has no run_in_background outside the waiting rule, no "foreground" and no refusal of a background worker, apart from the typed-fork exceptions', async () => {
    const files = await coordinatorFiles();
    expect(files).toContain(SHARED_ENTRY);
    expect(files).toContain(DISPATCH);
    expect(files.length).toBeGreaterThan(20);
    for (const rel of files) {
      let text = (await read(rel)).split(WAITING_RULE).join('');
      if (AUTHORING_ROUTES.includes(rel)) for (const kept of TYPED_FORK_EXCEPTIONS) text = text.split(kept).join('');
      expect(text, rel).not.toContain('run_in_background');
      expect(text, rel).not.toMatch(/foreground/i);
      expect(text, rel).not.toMatch(/fork\/background|background\/teammate|asynchronous/i);
      expect(text, rel).not.toMatch(/background[^.\n]{0,60}\b(refused|blocks?|unavailable|unsupported)\b/i);
      expect(text, rel).not.toMatch(/\b(refuse|refused|block|blocks|unavailable|unsupported)\b[^.\n]{0,60}\bbackground\b/i);
    }
  });

  it('keeps the typed-fork exceptions where they are: step 5 of each authoring route is unchanged', async () => {
    for (const rel of AUTHORING_ROUTES) expect(count(await read(rel), TYPED_FORK_EXCEPTIONS[0]!), rel).toBe(1);
  });
});

describe('P22: the six-file entry sentence', () => {
  it.each(ENTRY_PLACES)('%s has the teams-only sentence once and the P19 sentence nowhere', async rel => {
    const text = await read(rel);
    expect(count(text, NEW_ENTRY)).toBe(1);
    expect(text).not.toContain(OLD_ENTRY);
  });
});

describe('P22: the launcher leaves fork mode alone', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
  const report: ClaudeCapabilityReport = {
    installed: true, version: '2.1.325 (injected report; no Claude invocation)',
    command: { executable: 'claude', prefixArgs: [], source: 'path-executable' },
    pluginSupport: true, agentTeamsExperimental: false, subagentHandback: true, diagnostics: [],
  };
  beforeEach(async () => {
    vi.stubEnv(FACTORY_FORBIDDEN_ENV, undefined);
    vi.stubEnv('CLAUDE_CODE_FORK_SUBAGENT', undefined);
    fixture = await prepareFactoryCoordinator();
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
  });
  afterEach(async () => { vi.unstubAllEnvs(); await fs.remove(fixture.root); });

  const plan = async () => {
    const launcher = new ClaudeLauncher();
    return launcher.planActivation({ ...(await launcher.resolveInstallation('agent-factory', { cwd: fixture.workspace })), bundleName: 'agent-factory', report });
  };

  it('has no fork variable in the plan env or the --settings element, and keeps the agent-teams switch', async () => {
    const p = await plan();
    expect(Object.keys(p.env).map(key => key.toUpperCase())).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    expect(p.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('0');
    expect(FACTORY_SESSION_SETTINGS_ARG).toBe('--settings={"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"0"}}');
    expect(p.argv.filter(arg => /^--settings(?:=|$)/.test(arg))).toEqual([FACTORY_SESSION_SETTINGS_ARG]);
    expect(factoryLaunchShapeOk(p)).toBe(true);
  });

  it.each(['0', '1'])('passes a parent CLAUDE_CODE_FORK_SUBAGENT=%s to the child unchanged: the launcher neither sets nor removes it', async value => {
    vi.stubEnv('CLAUDE_CODE_FORK_SUBAGENT', value);
    const sentinel = path.join(fixture.root, 'spawned.json'), script = path.join(fixture.root, 'harmless.mjs');
    await fs.writeFile(script, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(sentinel)}, JSON.stringify({ teams: process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS ?? null, forkVars: Object.entries(process.env).filter(([key]) => key.toUpperCase() === 'CLAUDE_CODE_FORK_SUBAGENT') }));\n`);
    const launcher = new ClaudeLauncher();
    const p = launcher.planActivation({ ...(await launcher.resolveInstallation('agent-factory', { cwd: fixture.workspace })), bundleName: 'agent-factory', report: {
      ...report, command: { executable: process.execPath, prefixArgs: [script], source: 'node-wrapper' },
    } });
    expect(Object.keys(p.env).map(key => key.toUpperCase())).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    await launcher.launch(p);
    expect(await fs.readJson(sentinel)).toEqual({ teams: '0', forkVars: [['CLAUDE_CODE_FORK_SUBAGENT', value]] });
  });

  it('prints no fork-mode line in the dry run, neither from the renderer nor from the built CLI', async () => {
    const rendered = renderClaudeActivationPlan(await plan(), report, ['claude'], resolveClaudeTeamsPosture(undefined, 'domain'));
    expect(rendered).not.toMatch(/fork mode/i);
    expect(rendered).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    const result = spawnSync(process.execPath, [path.resolve('dist/cli.js'), 'start', 'agent-factory', '--host', 'claude', '--dry-run'], {
      cwd: fixture.workspace, encoding: 'utf8', timeout: 15000,
      env: cleanFactoryEnv({ CLAUDE_BIN_PATH: process.execPath, PATH: '', CI: 'true' }),
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/fork mode/i);
    expect(result.stdout).not.toContain('CLAUDE_CODE_FORK_SUBAGENT');
    expect(result.stdout).toContain('Agent teams (--teams): no (turned off for this session by the launcher');
  });

  it('has a bootstrap prompt that does not refuse a background worker and still refuses a fork, a teammate and a partial return', async () => {
    const prompt = (await plan()).bootstrapPrompt;
    expect(prompt).not.toMatch(/\bbackground\b[^.]*\bmechanism\b|refuse[^.]*\bbackground\b/i);
    expect(prompt).not.toMatch(/foreground/i);
    expect(prompt).toContain('Start one worker at a time as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule');
    expect(prompt).toContain('refuse a fork, a teammate or a partial return');
  });
});

describe('P22: what stays as it was', () => {
  it.each([...WORKERS, 'orchestrator-agent-factory'])('%s still declares background: false (it does not force the foreground; a headless session can still wait)', async name => {
    expect(frontmatter(await fs.readFile(path.resolve(`registry/hosts/claude/agents/${name}.md`), 'utf8')).background).toBe(false);
  });

  it.each(['author-skill', 'author-contract', 'author-bundle'])('the typed authoring entry %s still declares context: fork and background: false', async skill => {
    expect(frontmatter(await fs.readFile(path.resolve(`registry/hosts/claude/skills/${skill}/SKILL.md`), 'utf8'))).toMatchObject({ context: 'fork', background: false });
  });

  it.each(RETURN_CHECKERS)('the return checker %s still refuses an entry whose background is not false', async rel => {
    const text = await read(rel);
    expect(text).toContain("top.get('background') !== 'false'");
    expect(text).toMatch(/stop\('LOADER_MECHANISM', 'Installed author-(skill|contract|bundle) entry must select context: fork, agent: general-purpose, background: false/);
  });
});
