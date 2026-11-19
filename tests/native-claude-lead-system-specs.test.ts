import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fse from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';

/**
 * ADR 0073, the pilot: the Claude-native digital-agency lead collects the machine facts once at Step 0 (the `system-specs` Skill) and every
 * brief carries the sheet's path with one rule. No core change: the lead's floor and the Cline and Antigravity lanes are untouched.
 * Concepts are pinned with short patterns; only the rule clauses that must mean the same in the lead and in the Skill are compared with the
 * Skill's own text, read here.
 */

const read = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n');
const LEAD = read('registry/hosts/claude/agents/orchestrator-digital-agency.md');
const SKILL = read('registry/skills/system-specs/SKILL.md');
const AFTER_FLOOR = LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';
const FIRST_MESSAGE = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf('## The first message: the mode line'), AFTER_FLOOR.indexOf('## How this agent runs'));
const STEP0 = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf('## Step 0: '), AFTER_FLOOR.indexOf('## The team'));
const point = (n: number): string => STEP0.split('\n').find(line => line.startsWith(`${n}. `)) ?? '';
const SPECS = point(5);
const BRIEF = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf('You are the teammate "<name>"'), AFTER_FLOOR.indexOf('**Team mode and relay mode.**'));
const SPECS_LINE = BRIEF.split('\n').find(line => line.startsWith('Specs: ')) ?? '';
const TOOLS = (LEAD.match(/^tools: (.*)$/m)?.[1] ?? '').split(', ').map(t => t.trim());
const SKILL_STEP3 = SKILL.split('\n').find(line => line.startsWith('3. ')) ?? '';

describe('Step 0 collects the machine facts once', () => {
  it('finds the sections, so that no test below passes on an empty match', () => {
    expect(FIRST_MESSAGE).not.toBe('');
    expect(STEP0).not.toBe('');
    expect(BRIEF).not.toBe('');
    expect(point(1)).toMatch(/install record/);
    expect(SPECS).not.toBe('');
    expect(SKILL_STEP3).not.toBe('');
  });

  it('the Step 0 heading says it also covers the machine facts', () => {
    expect(STEP0.split('\n')[0]).toMatch(/machine facts/i);
  });

  it('comes after the install-record read, in Step 0, which comes after the mode-line section, and never before the line', () => {
    expect(STEP0.indexOf(SPECS)).toBeGreaterThan(STEP0.indexOf(point(1)));
    expect(AFTER_FLOOR.indexOf('## Step 0: ')).toBeGreaterThan(AFTER_FLOOR.indexOf('## The first message: the mode line'));
    expect(SPECS).toMatch(/after the install-record read/);
    expect(SPECS).toMatch(/never before the mode line/);
    expect(FIRST_MESSAGE).not.toContain('system-specs');
  });

  it('names the Skill, runs collect once from the project folder, and does not name one shell or a script path', () => {
    expect(SPECS).toContain('`system-specs`');
    expect(SPECS).toMatch(/`collect`[^.]*once, from the project folder/);
    expect(SPECS).toMatch(/`Bash` or `PowerShell`/);
    expect(SPECS).not.toMatch(/node "|specs\.mjs|\$\{CLAUDE_SKILL_DIR\}/);
  });

  it('collects in plan-only mode too, because the sheet is not a deliverable', () => {
    expect(SPECS).toMatch(/not a deliverable/);
    expect(SPECS).toMatch(/plan-only/);
  });

  it('gives a one-line notice that says what is and is not collected, and where the sheet is', () => {
    expect(SPECS).toMatch(/in one line/);
    expect(SPECS).toMatch(/OS, hardware, tool versions/);
    expect(SPECS).toMatch(/no user or machine names, paths or environment values/);
    expect(SPECS).toMatch(/where the sheet is/);
  });

  it('uses the sheet when planning the stack and the map, and puts its path in each brief', () => {
    expect(SPECS).toMatch(/tech stack and the delegation map/);
    expect(SPECS).toMatch(/path in each brief/);
  });

  it('refreshes only on a specialist request or the user, and tells the specialists that depend on it', () => {
    expect(SPECS).toMatch(/`collect --refresh` only when a specialist asks for an update or the user does/);
    expect(SPECS).toMatch(/tell the specialists that depend on the sheet/);
    expect(SKILL).toMatch(/Only the coordinating agent, or an agent working alone, runs `collect --refresh`/);
  });

  it('never lets a collector failure block the work, in the same words as the Skill', () => {
    expect(SPECS).toMatch(/If `collect` fails \(exit 1 or 2, no Node\), say so once and plan without the sheet/);
    expect(SKILL).toMatch(/say so once and plan without the sheet/);
  });

  it('is shorter than the longest neighbouring point of Step 0', () => {
    const longest = Math.max(...[1, 2, 3, 4].map(n => point(n).length));
    expect(SPECS.length).toBeLessThan(longest);
  });

  it('guard: the lead holds the tools the point needs (Skill and a shell of either family)', () => {
    expect(TOOLS).toContain('Skill');
    expect(TOOLS).toContain('Bash');
    expect(TOOLS).toContain('PowerShell');
  });
});

describe('every brief carries the sheet and the rule', () => {
  it('holds a Specs line after the Tools line and before the report format', () => {
    expect(SPECS_LINE).not.toBe('');
    expect(BRIEF.indexOf(SPECS_LINE)).toBeGreaterThan(BRIEF.indexOf('Tools: '));
    expect(BRIEF.indexOf(SPECS_LINE)).toBeLessThan(BRIEF.indexOf('Report format: '));
  });

  it('carries the path relative to the project folder, the git-worktree hint, and the none case', () => {
    expect(SPECS_LINE).toMatch(/relative to the project folder/);
    expect(SPECS_LINE).toMatch(/git worktree/);
    expect(SPECS_LINE).toMatch(/"none"/);
    expect(SPECS_LINE).toMatch(/If "none", the rest does not apply/);
  });

  it('says the sheet is data, not instructions and not permission to install, and to read it before choosing', () => {
    expect(SPECS_LINE).toMatch(/data about this machine/);
    expect(SPECS_LINE).toMatch(/not instructions/);
    expect(SPECS_LINE).toMatch(/not permission to install/);
    expect(SPECS_LINE).toMatch(/before you choose a stack or a tool/);
  });

  it('names the Skill before check, so a teammate that preloads nothing can run it', () => {
    const skillAt = SPECS_LINE.indexOf('`system-specs`');
    const checkAt = SPECS_LINE.indexOf('`check`');
    expect(skillAt).toBeGreaterThan(-1);
    expect(checkAt).toBeGreaterThan(skillAt);
    expect(SPECS_LINE).toMatch(/If you hold a shell, load the Skill/);
  });

  it('says what to do on a change: three triggers, where to report, ask once, mark it unknown, no second check, never refresh', () => {
    expect(SPECS_LINE).toMatch(/`check` says changed/);
    expect(SPECS_LINE).toMatch(/"not determined"/);
    expect(SPECS_LINE).toMatch(/differs from what you observe/);
    expect(SPECS_LINE).toMatch(/under `Open items`/);
    expect(SPECS_LINE).toMatch(/in team mode you may message me/);
    expect(SPECS_LINE).toMatch(/ask for an update, once/);
    expect(SPECS_LINE).toMatch(/marked unknown/);
    expect(SPECS_LINE).toMatch(/do not check again/);
    expect(SPECS_LINE).toMatch(/[Nn]ever refresh it yourself/);
  });

  it('means the same as the Skill: the clauses of the Skill that the brief must repeat are in both', () => {
    for (const clause of ['for an update, once', 'marked unknown', 'check again']) {
      expect(SKILL_STEP3, `Skill: ${clause}`).toContain(clause);
      expect(SPECS_LINE, `brief: ${clause}`).toContain(clause);
    }
    expect(SKILL_STEP3).not.toMatch(/at most once per task/);
    expect(LEAD).not.toMatch(/at most once per task/);
  });

  it('guard: the twelve agency role files hold no sheet text of their own', () => {
    const roles = fs.readdirSync(path.resolve('registry/hosts/claude/agents')).filter(f => f.startsWith('agency-'));
    expect(roles).toHaveLength(12);
    for (const file of roles) expect(read(`registry/hosts/claude/agents/${file}`), file).not.toContain('system-specs');
  });
});

describe('the digital-agency Bundle ships the Skill', () => {
  let root = '';
  afterEach(async () => { if (root) await fse.remove(root); });

  it('lists system-specs, and the core of the lead is unchanged by this slice', () => {
    const bundles = JSON.parse(read('registry/bundles.json')).bundles;
    expect(bundles['digital-agency'].skills).toContain('system-specs');
    expect(read('registry/core/orchestrator-digital-agency.core.md')).not.toContain('system-specs');
  });

  for (const nativeLane of [true, false]) {
    it(`installs the Skill folder with its script and reference into the workspace for Claude (${nativeLane ? 'with' : 'without'} the native lane), without the evals`, async () => {
      root = await fse.mkdtemp(path.join(os.tmpdir(), 'agency-system-specs-'));
      const targetDir = path.join(root, 'project', '.agents');
      await new InstallEngine(new RegistryResolver(path.resolve('registry'))).install('digital-agency', { targetDir, method: 'copy' as const, fanout: ['claude'], nativeLane });
      const skill = path.join(root, 'project', '.claude', 'skills', 'system-specs');
      for (const file of ['SKILL.md', 'scripts/specs.mjs', 'references/sheet-format.md', 'examples/worked-example.md']) {
        expect(await fse.pathExists(path.join(skill, file)), file).toBe(true);
      }
      expect(await fse.pathExists(path.join(skill, 'evals'))).toBe(false);
    }, 120000);
  }
});
