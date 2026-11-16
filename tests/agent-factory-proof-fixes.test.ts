import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Four text fixes that follow the first real headless runs of the factory on the Claude Host
 * (host-library/claude/observations/2026-11-15-claude-2.1.323-factory-stage-proof-headless.md, findings S1-A, S1-B, S2-A, S2-B, S2-C),
 * and the fix round after the independent review of them.
 * Every fix states its rule in the same words in each place it is stated, so each test pins the exact sentence where it stands,
 * and pins that it stands exactly once in that file.
 */
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const read = async (rel: string): Promise<string> => lf(await fs.readFile(path.resolve(rel), 'utf8'));
const count = (text: string, sentence: string): number => text.split(sentence).length - 1;
const REFERENCES = 'registry/skills/coordinate-artifact/references';
const AGENT_BODY = 'registry/hosts/claude/agents/orchestrator-agent-factory.md';
const EVALUATOR_BODY = 'registry/hosts/claude/agents/factory-evaluator.md';
const NATIVE_COORDINATE_ENTRY = 'registry/hosts/claude/skills/coordinate-artifact/SKILL.md';
const NATIVE_EVALUATE_ENTRY = 'registry/hosts/claude/skills/evaluate-artifact/SKILL.md';

/** Every markdown file below a folder, as repository-relative paths; the file type is checked before anything is read. */
async function markdownBelow(rel: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'evals') await walk(full); }
      else if (entry.isFile() && entry.name.endsWith('.md')) found.push(path.relative(path.resolve('.'), full).split(path.sep).join('/'));
    }
  };
  await walk(path.resolve(rel));
  return found.sort();
}
/** The coordinator's Skill files, its native entry and the agent body: everything the coordinator is told to follow. */
const coordinatorFiles = async (): Promise<string[]> => [...await markdownBelow('registry/skills/coordinate-artifact'), NATIVE_COORDINATE_ENTRY, AGENT_BODY];
/** The evaluator's Skill files, its native entry and its agent file. */
const evaluatorFiles = async (): Promise<string[]> => [...await markdownBelow('registry/skills/evaluate-artifact'), NATIVE_EVALUATE_ENTRY, EVALUATOR_BODY];

const PIN_CHECK_OUTPUT = 'Pin every saved check output the evaluator is told to read (raw log and receipt) as an input in `inputs[]` with all eight fields of `assets/job.schema.json`: `id` (lowercase kebab-case, for example `native-check-raw`), `kind` `validator`, `path`, `bytes`, `sha256`, `sections` (`[]`), `status` `clear` and `required` (`true`). Keep that copy byte-identical in a folder of its own that is a sibling of the review root, never its parent or the review root itself, declare that folder alone in `roots.read` (a read root that contains the review root is refused) and keep the originals in `checks[]`.';
const CITE_ONLY_PINNED = 'A citation names only `candidate` or the id of an input the job pins as clear; anything else you want to mention, including a saved check output the job does not pin, goes into prose, never into a citation.';
const OLD_CITE_SENTENCE = 'A citation may name only an id the job pins.';

describe('Fix 1 (S1-B): a review job pins the saved check output the evaluator is told to read, and a citation names only a pinned id', () => {
  it('tells the coordinator, where it builds the review job, how to pin each saved check output as a complete input, once', async () => {
    const text = await read(`${REFERENCES}/verification.md`);
    expect(count(text, PIN_CHECK_OUTPUT)).toBe(1);
    expect(count(text, CITE_ONLY_PINNED)).toBe(1);
  });

  it('tells the evaluator, in the shared evidence reference and in its always-loaded body, the same citation sentence, once', async () => {
    for (const rel of ['registry/skills/evaluate-artifact/references/evidence.md', EVALUATOR_BODY]) expect(count(await read(rel), CITE_ONLY_PINNED), rel).toBe(1);
  });

  it('keeps the older, narrower citation sentence out of every file of the coordinator and of the evaluator', async () => {
    for (const rel of [...await coordinatorFiles(), ...await evaluatorFiles()]) expect(await read(rel), rel).not.toContain(OLD_CITE_SENTENCE);
  });

  it('says in the result guide and in the evaluator body what the checker resolves: a clear pinned input, and the basename of its file', async () => {
    const report = JSON.parse(await read('registry/skills/evaluate-artifact/assets/report.json')) as { citation: string };
    expect(report.citation).toContain('one declared evidence pin with status clear');
    expect(report.citation).toContain('the input basename');
    const body = await read(EVALUATOR_BODY);
    expect(body).toContain('include source ID, path (candidate-relative, or the basename of a pinned input\'s file), caller-provided hash');
    expect(body).not.toContain('contained path');
  });
});

describe('Fix 2 (S2-A, S1-C): the entry dry run is the pinned checkout\'s built CLI and must show the factory main', () => {
  const ENTRY_CLI = 'Run the pinned checkout\'s built CLI, `node <checkout>/dist/cli.js start agent-factory --host claude --dry-run`, never a bare `agents` from the path, and save its output in the evidence folder.';
  const ENTRY_STOP = 'The planned agent must be `orchestrator-agent-factory`; anything else, or a nonzero exit, is recorded and the route stops there and reports, without a workaround.';
  // Plan 033 P38 (S1-C): the launcher no longer refuses an inherited teams setting; it turns teams off for the factory's own session.
  const ENTRY_TEAMS = 'The launcher turns agent teams off for the factory\'s own session and does not refuse a dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; with direct `claude --agent` entry that switch does not apply, so a worker that starts as a teammate is refused and reported.';
  const OLD_ENTRY_TEAMS = 'When the launcher refuses the dry run because `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set in the session, report the refusal and stop; do not clear the variable yourself.';
  const ROUTES = [`${REFERENCES}/skill-authoring.md`, `${REFERENCES}/contract-authoring.md`, `${REFERENCES}/bundle-authoring.md`, `${REFERENCES}/host-sync.md`];
  const PLACES = [...ROUTES, `${REFERENCES}/dispatch.md`, AGENT_BODY];

  it.each(PLACES)('%s names the pinned CLI form, the planned-agent check and the stop rule in the same words, once each', async rel => {
    const text = await read(rel);
    for (const sentence of [ENTRY_CLI, ENTRY_STOP, ENTRY_TEAMS]) expect(count(text, sentence), sentence).toBe(1);
  });

  it.each(ROUTES)('%s reads step 1 in order: how the session starts, what to run, what the output must show, what to do otherwise', async rel => {
    const step = (await read(rel)).split('\n').find(line => /^1\. Entry\./.test(line)) ?? '';
    expect(step).toMatch(/^1\. Entry\. The session is started through the launcher or with `claude --agent`\. Run the pinned checkout's built CLI/);
    expect(step).not.toContain('Or start through the launcher');
    const at = [ENTRY_CLI, ENTRY_STOP, ENTRY_TEAMS, 'Enforced by script when the launcher starts the session'].map(sentence => step.indexOf(sentence));
    expect(at.every(index => index > 0), at.join()).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('keeps the old refusal sentence nowhere in the coordinator\'s files, and says nowhere that the launcher refuses a dry run for the teams variable', async () => {
    for (const rel of await coordinatorFiles()) {
      const text = await read(rel);
      expect(text, rel).not.toContain(OLD_ENTRY_TEAMS);
      expect(text, rel).not.toMatch(/launcher refuses the dry run/i);
      expect(text, rel).not.toMatch(/report the refusal and stop/i);
    }
  });

  it('has no `agents start` anywhere in the coordinator\'s files', async () => {
    for (const rel of await coordinatorFiles()) expect(await read(rel), rel).not.toMatch(/\bagents start\b/);
  });

  it('has no backticked or optioned bare `agents` check command that the coordinator is told to run; they use the pinned built CLI', async () => {
    const commands = 'start|skill-check|contract-check|factory-check|bundle-check';
    for (const rel of await coordinatorFiles()) {
      const text = await read(rel);
      expect(text, rel).not.toMatch(new RegExp(`\`agents (${commands}) [^\`]+\``));
      expect(text, rel).not.toMatch(new RegExp(`\\bagents (${commands}) +(-|<)`));
    }
    // The main names each check command it tells the coordinator to run in the pinned form, never as a bare `agents` command.
    expect(await read(AGENT_BODY)).not.toMatch(/`agents [a-z]+-check`/);
    expect(await read(`${REFERENCES}/skill-authoring.md`)).toContain('`node <checkout>/dist/cli.js skill-check --artifact <absolute draft> --corpus <absolute corpus> --policy <policy>`');
    const verification = await read(`${REFERENCES}/verification.md`);
    expect(verification).toContain('`node <checkout>/dist/cli.js factory-check --registry <absolute> --definition <stem> --host claude`');
    expect(verification).toContain('`node <checkout>/dist/cli.js factory-check --artifact <absolute> --loading <declared> --required-skills <JSON>`');
  });

  it('has no instruction next to a dry run to run it again, retry, continue or work around the stop rule', async () => {
    for (const rel of PLACES) {
      const rest = [ENTRY_CLI, ENTRY_STOP, ENTRY_TEAMS].reduce((text, sentence) => text.replace(sentence, ''), await read(rel));
      for (const sentence of rest.split(/(?<=[.;])\s/).filter(item => /dry[ -]run/i.test(item))) {
        expect(sentence, rel).not.toMatch(/\b(again|retry|continue|proceed|workaround|unset|clear the variable)\b/i);
      }
    }
  });
});

describe('Fix 3 (S1-A, S2-B): a main without an injected preload still reads its Skill entry', () => {
  const SKILL_ENTRY = 'If the text of the "coordinate-artifact" Skill is not already in your context, read its installed entry ".claude/skills/coordinate-artifact/SKILL.md" in full before your first action.';
  const SKILL_DIR = 'In a Skill file, "${CLAUDE_SKILL_DIR}" means that Skill\'s installed folder (".claude/skills/<skill name>" in the project), and a "scripts/", "references/" or "assets/" path in a Skill file is relative to that folder; use the absolute path when running a script.';

  it('says in the opening instructions of the coordinator main to read the installed Skill entry in full, and what the Skill folder variable means, once each', async () => {
    const body = await read(AGENT_BODY);
    expect(count(body, SKILL_ENTRY)).toBe(1);
    expect(count(body, SKILL_DIR)).toBe(1);
    expect(body.indexOf(SKILL_ENTRY)).toBeLessThan(body.indexOf(SKILL_DIR));
    expect(body.indexOf(SKILL_DIR)).toBeLessThan(body.indexOf('## Installed main and actual mechanism'));
    expect(body).toMatch(/^skills:\n {2}- coordinate-artifact$/m);
    expect(body).not.toMatch(/^tools:.*\bSkill\b/m);
  });
});

describe('Fix 4 (S2-C): Windows paths and helper scripts kept with the evidence', () => {
  const PATH_FORM = 'Pass every path argument to a checker or to `git` as an absolute path in the platform\'s own form: on Windows a drive letter, never a `/c/...` form or `$PWD`.';
  const KEEP_SCRIPTS = 'Save any helper script you write to assemble a record in the evidence folder and name it in the report.';
  const PLACES = [`${REFERENCES}/job.md`, `${REFERENCES}/verification.md`, `${REFERENCES}/host-sync.md`, `${REFERENCES}/skill-authoring.md`, `${REFERENCES}/contract-authoring.md`, `${REFERENCES}/bundle-authoring.md`];

  it.each(PLACES)('%s states the platform path form and the evidence-folder rule for helper scripts in the same words, once each', async rel => {
    const text = await read(rel);
    for (const sentence of [PATH_FORM, KEEP_SCRIPTS]) expect(count(text, sentence), sentence).toBe(1);
  });
});
