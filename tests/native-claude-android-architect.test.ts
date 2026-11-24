import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { attempt } from './helpers/claude-host-hooks.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * The native `android-architect` (Bundle `mobile-development`): what its authored body must keep saying. It holds a shell, so every claim about
 * what the bound guard blocks, and what it does not stop, is fired against the real script, and the hook is asserted to have fired. Its
 * canonical agent has `commandExecutionPolicy: ask` and `permissionMode: acceptEdits`; the guard hook of the canonical agent (recursive
 * deletes, privilege escalation, shutdown) is part of the shared core's safety.
 */

const ROLE = 'android-architect';
const STEM = 'subagent-android-architect';
const text = (): string => nativeText(ROLE);
const canonical = (): string => fs.readFileSync(path.resolve(`registry/agents/${STEM}.md`), 'utf8').replace(/\r\n/g, '\n');
const toolsOf = (body: string): string[] => /^tools: (.*)$/m.exec(body)![1]!.split(', ');
/** The shared clause every Claude role carries (ADR 0074, tests/guard-destructive-upgrade.test.ts). */
const COMMON_FORMS = 'the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion)';
/** A numbered step of the "How to work" section, not the first line of the file that happens to start with the number. */
const step = (n: number): string => {
  const work = /\n## How to work\n([\s\S]*?)(?=\n## )/.exec(text())![1]!;
  return new RegExp(`^${n}\\. .*$`, 'm').exec(work)![0];
};
const peersSection = (body: string): string => /\n## Working with peers\n([\s\S]*?)(?=\n## )/.exec(body)![1]!.trim();
const sessionSection = (body: string): string => /\n## Session task tracking\n([\s\S]*)$/.exec(body)![1]!.trim();
/** The numbered lines and the "- Never" lines of a block, line endings normalised, so lists can be compared exactly. */
const lf = (block: string): string => block.replace(/\r\n/g, '\n');
const numberedLines = (block: string): string[] => lf(block).split('\n').filter(line => /^\d+\. /.test(line));
const neverLines = (block: string): string[] => lf(block).split('\n').filter(line => line.startsWith('- Never '));
const floorSection = (body: string, heading: string): string => new RegExp('\\n## ' + heading + '\\n([\\s\\S]*?)(?=\\n## )').exec(lf(body))![1]!;

describe('native android-architect: the exact tool set, model and effort', () => {
  it('holds exactly this tool set', () => {
    expect([...toolsOf(text())].sort()).toEqual([
      'Bash', 'Edit', 'Glob', 'Grep', 'ListAgents', 'ListMcpResourcesTool', 'NotebookEdit', 'PowerShell', 'Read', 'ReadMcpResourceTool', 'SendMessage', 'Skill',
      'SubagentHandback', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'ToolSearch', 'Write',
      'mcp__context7', 'mcp__github',
    ]);
  });

  it('pins model sonnet and effort medium (ADR 0018 decision 7)', () => {
    expect(/^model: (.+)$/m.exec(text())![1]).toBe('sonnet');
    expect(/^effort: (.+)$/m.exec(text())![1]).toBe('medium');
  });

  it('holds no delegation, workflow, scheduling, monitor or user-question tool, and says scheduling and spawning are not available', async () => {
    for (const forbidden of ['Agent', 'Workflow', 'CronCreate', 'CronDelete', 'CronList', 'AskUserQuestion', 'WebFetch', 'WebSearch', 'Monitor', 'TaskStop']) expect(toolsOf(text()), forbidden).not.toContain(forbidden);
    const capabilities = (await loadSemanticCore('registry')).get(STEM)!.capabilities;
    expect(capabilities).not.toContain('background-monitor');
    expect(text()).not.toContain('Monitor');
    expect(text()).toContain('- Running workflows, scheduling and spawning subagents are not available to you. Request them from the lead as `run-workflow`, `schedule` or `delegate` entries under `Requests for the lead`.');
  });

  it('holds the two messaging tools its capability gives, and the core declares the capability', async () => {
    expect(toolsOf(text())).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage']));
    expect((await loadSemanticCore('registry')).get(STEM)!.capabilities).toContain('messaging');
  });
});

describe('native android-architect: the MCP servers, skills and permission mode of its canonical agent', () => {
  it('holds github and context7, the servers the canonical agent names, and nothing beyond them', () => {
    const servers = toolsOf(text()).filter(tool => tool.startsWith('mcp__')).sort();
    expect(servers).toEqual(['mcp__context7', 'mcp__github']);
    expect([...canonical().matchAll(/^  - name: (.+)$/gm)].map(match => `mcp__${match[1]}`).sort()).toEqual(servers);
  });

  it('names the same 5 skills as the canonical agent and the contract, in its skill table', () => {
    const listed = /^skills:\n((?:  - .+\n)+)/m.exec(canonical())![1]!.split('\n').filter(Boolean).map(line => line.replace(/^  - /, '')).sort();
    expect(listed).toHaveLength(5);
    const contract = JSON.parse(fs.readFileSync(path.resolve(`registry/core/${STEM}.contract.json`), 'utf8')) as { skills: string[] };
    expect([...contract.skills].sort()).toEqual(listed);
    const table = [...text().matchAll(/^\|[^|\n]*\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(match => match[1]).sort();
    expect(table).toEqual(listed);
  });

  it('keeps permissionMode acceptEdits, as the canonical agent has it, and states its limit in step 5', () => {
    const mode = (source: string): string | undefined => /^permissionMode: (.+)$/m.exec(source.replace(/\r\n/g, '\n'))?.[1];
    expect(mode(canonical())).toBe('acceptEdits');
    expect(mode(text())).toBe('acceptEdits');
    expect(step(5)).toContain('`permissionMode: acceptEdits` approves your file edits and common file commands such as `mkdir`, `mv` and `cp` in the working folder without asking, when that mode is in force (the main session\'s `acceptEdits`, `auto` or `bypassPermissions` mode replaces it, its `plan` mode keeps you in plan mode, and as a teammate your starting mode follows from the lead\'s and can change).');
  });
});

describe('native android-architect: what its own steps say', () => {
  it('step 3 states the duties of the role in its own words', () => {
    const three = step(3);
    for (const phrase of [
      'with state hoisting and Clean Architecture layers (UI, Domain, Data)',
      'Measure a recomposition fix (Layout Inspector or recomposition counts) and report the measurement with the change.',
      'Request only the runtime permissions the feature uses, and keep to scoped storage.',
      'Keep signing keys, keystore passwords and API keys out of source, referenced through `local.properties` or a secrets manager.',
    ]) expect(three, phrase).toContain(phrase);
  });

  it('step 4 runs the build and test gates with a shell and reports a gate that cannot run as not run', () => {
    const four = step(4);
    for (const phrase of [
      '`./gradlew assembleDebug` (or the project\'s documented build task)',
      '`./gradlew test` (and `./gradlew connectedAndroidTest` where an emulator or device is available)',
      'say so explicitly and report that gate as not run instead of asserting success.',
    ]) expect(four, phrase).toContain(phrase);
    expect(four).toContain('with `Bash` or `PowerShell`');
  });

  it('the search caveat of a role with a shell is carried in step 1', () => {
    expect(step(1)).toContain('(on macOS, Linux and WSL this role holds `Bash`, so those two are unavailable there and search runs through `Bash`)');
  });
});

describe('native android-architect: the guard claims', () => {
  it('step 5 names what the guard reads, and what it does not stop', () => {
    const five = step(5);
    expect(five).toContain('reads command text and file paths: it does not stop `./gradlew`, including a release build or a publish task, an `adb install` or a Google Play upload with `fastlane supply`, or an ordinary, non-forced `git push`, and it does not stop a `git add` or `git commit` of a keystore');
    expect(five).toMatch(/your own obligation/);
  });

  it('Boundaries carry the one guard sentence, and say where the guard comes from in both modes', () => {
    const sentence = `A guard blocks \`git push --force\` and \`-f\` (not \`--force-with-lease\`), \`vercel --prod\`, \`.env\` files (not \`.env.example\`) written with an editing tool or a \`>\` or \`>>\` redirect to a \`.env\` path the guard recognises in the command text, and ${COMMON_FORMS}; it is a seat belt, not a boundary.`;
    expect(text().split(sentence)).toHaveLength(2);
    expect(text().split('A guard blocks')).toHaveLength(2);
    expect(text()).toContain(`${sentence} As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case. Never try to get around it.`);
  });

  describe('against the real guard script', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-united-android-architect-guard-'));
    beforeAll(() => {
      fs.mkdirSync(path.join(project, '.claude/hooks'), { recursive: true });
      for (const file of fs.readdirSync(path.resolve('registry/hosts/claude/hooks'))) fs.copyFileSync(path.resolve('registry/hosts/claude/hooks', file), path.join(project, '.claude/hooks', file));
    });
    afterAll(() => fs.rmSync(project, { recursive: true, force: true }));
    const shell = (tool: string, command: string): { blocked: boolean; fired: number } => {
      const result = attempt(text(), project, { tool, input: { command } }, { agentType: ROLE });
      return { blocked: result.blocked, fired: result.fired };
    };
    const write = (tool: string, file: string): { blocked: boolean; fired: number } => {
      const result = attempt(text(), project, { tool, input: { file_path: file } }, { agentType: ROLE });
      return { blocked: result.blocked, fired: result.fired };
    };

    it.each(['Bash', 'PowerShell'])('blocks the forms of the canonical agent\'s own guard (rm -rf, sudo, shutdown) and the named forms through %s, the hook having fired once', tool => {
      for (const command of ['rm -rf /', 'rm -rf ~', 'sudo ls', 'shutdown now', 'git push --force origin main', 'git push -f origin main', 'vercel --prod']) {
        expect(shell(tool, command), `${tool}: ${command}`).toEqual({ blocked: true, fired: 1 });
      }
    });

    it.each(['Bash', 'PowerShell'])('blocks a .env shell redirect, a disk format, a recursive delete of a project folder and a cloud resource-group, project and account deletion through %s, the hook having fired once', tool => {
      for (const command of ['echo API_KEY=1 > .env', 'mkfs.ext4 /dev/sda1', 'rm -Rf .', 'env FOO=1 rm -rf .git', 'az group delete --name rg-prod --yes', 'gcloud projects delete my-project', 'aws organizations close-account --account-id 1']) {
        expect(shell(tool, command), `${tool}: ${command}`).toEqual({ blocked: true, fired: 1 });
      }
    });

    it.each(['Write', 'Edit', 'NotebookEdit'])('blocks a %s of .env and .env.local, and lets .env.example and a source file through, the hook having fired once', tool => {
      expect(write(tool, path.join(project, '.env'))).toEqual({ blocked: true, fired: 1 });
      expect(write(tool, path.join(project, '.env.local'))).toEqual({ blocked: true, fired: 1 });
      expect(write(tool, path.join(project, '.env.example'))).toEqual({ blocked: false, fired: 1 });
      expect(write(tool, path.join(project, 'app/src/main/kotlin/com/example/LoginScreen.kt'))).toEqual({ blocked: false, fired: 1 });
    });

    it.each([
      './gradlew assembleDebug',
      './gradlew assembleRelease',
      './gradlew publishReleaseBundle',
      'adb install app/build/outputs/apk/debug/app-debug.apk',
      'fastlane supply --aab app-release.aab',
      'git push origin feature/login',
      'git add keystore/release.jks',
      'git commit -m "add keystore"',
    ])('does not stop %s, as step 5 says, the hook having fired once', command => {
      expect(shell('Bash', command)).toEqual({ blocked: false, fired: 1 });
    });

    it.each(['Bash', 'PowerShell'])('does not stop a recursive delete of a build folder such as rm -rf app/build through %s', tool => {
      expect(shell(tool, 'rm -rf app/build')).toEqual({ blocked: false, fired: 1 });
    });
  });
});

describe('native android-architect: the peers section of the engineering family', () => {
  it("is devops-engineer's section line for line", () => {
    expect(peersSection(text()).split('\n')).toEqual(peersSection(nativeText('devops-engineer')).split('\n'));
  });

  it('is the Tier 1 form: a lead-spawned subagent first, no agency, no shutdown frame, no teammate-reality paragraph', () => {
    const body = text();
    expect(body).toContain('You run as a subagent that a lead spawns (Tier 1, the usual case) or as a teammate of a coordinated team. Follow the mode your brief names.');
    expect(body).not.toMatch(/digital agency/i);
    expect(body).not.toContain('shutdown_request');
    expect(body).not.toContain('a brief cannot make you a teammate');
  });

  it('step 6 hands the report back through SubagentHandback', () => {
    expect(step(6)).toContain('as your final message: your final answer is the hand-back. Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back.');
  });

  it("carries the e2e-tester's Session task tracking section byte for byte, as the last section", () => {
    expect(sessionSection(text())).toBe(sessionSection(nativeText('e2e-tester')));
    expect(sessionSection(text())).toBe(sessionSection(nativeText('devops-engineer')));
    expect(text().trimEnd().endsWith(sessionSection(text()))).toBe(true);
  });
});

describe('native android-architect: the shared scope_boundaries and safety', () => {
  it('carries the numbered directives of the canonical agent, the core and the native floor as identical lists, and the build and test gates', async () => {
    const scope = (await loadSemanticCore('registry')).get(STEM)!.scope_boundaries.replace(/\s+/g, ' ');
    const section = /\n## Primary Directives\n([\s\S]*?)(?=\n## )/.exec(canonical())![1]!;
    const directives = numberedLines(section);
    expect(directives).toHaveLength(5);
    expect(numberedLines((await loadSemanticCore('registry')).get(STEM)!.scope_boundaries)).toEqual(directives);
    expect(numberedLines(floorSection(text(), 'Scope Boundaries'))).toEqual(directives);
    for (const phrase of ['Audit first', 'Consult the named Skill', 'instead of asserting success']) expect(scope, phrase).toContain(phrase);
  });

  it('carries the Never guardrails of the canonical agent, the core and the native floor as identical lists, and its destructive-command guard', async () => {
    const safety = (await loadSemanticCore('registry')).get(STEM)!.safety;
    const guardrails = neverLines(/\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(canonical())![1]!);
    expect(guardrails).toHaveLength(3);
    expect(neverLines(safety)).toEqual(guardrails);
    expect(neverLines(floorSection(text(), 'Safety'))).toEqual(guardrails);
    expect(safety).toContain('- Do not run destructive shell commands such as recursive deletes, privilege escalation or shutdown.');
    expect(canonical()).toContain('Deny run_command if CommandLine matches /(rm -rf|sudo|shutdown)/i');
  });

  it('names no tool and no host in the core', async () => {
    const core = (await loadSemanticCore('registry')).get(STEM)!;
    const all = [core.identity, core.mission, core.scope_boundaries, core.output_contract, core.safety, ...core.invariants].join('\n');
    for (const token of ['run_command', 'view_file', 'send_message', 'manage_task', 'Bash', 'SubagentHandback', 'Claude']) expect(all, token).not.toContain(token);
  });
});
