import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { COORDINATOR_SUPPORT as DECLARED_SUPPORT } from '../src/core/claude-factory-declaration.js';
import type { LockfileManifest } from '../src/core/types.js';
import { SKILL_MD_MAX_CHARS, SKILL_MD_MAX_LINES } from './helpers/skill-layout.js';
import { COORDINATOR_DECLARATION, COORDINATOR_ROOT, COORDINATOR_SUPPORT, coordinatorTree, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

/**
 * The installed contribution runbook of the agent factory (Plan 033, P22, maintainer option (d) "Reference + same wording"):
 * one reference file of the coordinator Skill, named at the hand-off step, and one canonical upstream clause in every factory Skill.
 */
const RUNBOOK = 'references/contribution.md';
const RUNBOOK_FILE = 'registry/skills/coordinate-artifact/references/contribution.md';
const CLAUSE = "Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following the checkout's `docs/artifact-contribution.md`; no commit, push, pull request or publication follows.";
const SKILLS = ['coordinate-artifact', 'author-skill', 'author-contract', 'author-bundle', 'realize-artifact', 'evaluate-artifact'] as const;
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const read = async (rel: string): Promise<string> => lf(await fs.readFile(path.resolve(rel), 'utf8'));
const shared = (skill: string): string => `registry/skills/${skill}/SKILL.md`;
const native = (skill: string): string => `registry/hosts/claude/skills/${skill}/SKILL.md`;
const AGENT_BODY = 'registry/hosts/claude/agents/orchestrator-agent-factory.md';

/** Every markdown file of a shared Skill folder except the maintainer-only evals, as repository-relative paths. */
async function skillMarkdown(skill: string): Promise<string[]> {
  const root = path.resolve('registry/skills', skill), found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'evals') await walk(full); } else if (entry.name.endsWith('.md')) found.push(path.relative(path.resolve('.'), full).split(path.sep).join('/'));
    }
  };
  await walk(root);
  return [...found, native(skill)].sort();
}

/** The `](references/x.md)` targets one entry links, which are the references that entry names. */
const linkedReferences = (entry: string): string[] => [...entry.matchAll(/\]\((references\/[^)#\s]+)\)/g)].map(match => match[1]!);

/** The long option names of one command, read from the source text of `src/cli.ts` (from its `.command('<name>'` to its `.action(`), or null when no such command exists. */
function cliOptions(cliSource: string, command: string): string[] | null {
  const start = cliSource.indexOf(`.command('${command}`);
  if (start < 0) return null;
  return [...cliSource.slice(start, cliSource.indexOf('.action(', start)).matchAll(/\.option\('(?:-[A-Za-z], )?--([a-z][a-z-]*)/g)].map(match => match[1]!);
}

/** Problems of every line that runs a `<name>-check` command: the command exists in `src/cli.ts` and every `--option` on that line is one of its options. */
function cliLineProblems(runbook: string, cliSource: string): string[] {
  const problems: string[] = [];
  for (const line of runbook.split('\n')) {
    // Any word after `dist/cli.js`, and any `<name>-check` after `agents`, is a command of the built CLI.
    for (const run of line.matchAll(/(?:dist\/cli\.js\s+([A-Za-z][\w-]*))|(?:\bagents\s+([a-z]+-ch[a-z]*)\b)/g)) {
      const command = run[1] ?? run[2]!, options = cliOptions(cliSource, command);
      if (!options) { problems.push(`unknown command ${command}: ${line.trim().slice(0, 80)}`); continue; }
      for (const option of line.matchAll(/(?<![\w-])--([A-Za-z][A-Za-z-]*)/g)) if (!options.includes(option[1]!)) problems.push(`${command} has no option --${option[1]}: ${line.trim().slice(0, 80)}`);
    }
  }
  return problems;
}

/** Problems of the `[script: ...]` marks: each item before the first semicolon names a script file under `registry/skills/*\/scripts/`, an `agents` command of `src/cli.ts`, or an npm script. */
function markProblems(runbook: string, known: { scriptFiles: Set<string>; commands: Set<string>; npmScripts: string[]; hasVitest: boolean }): string[] {
  const problems: string[] = [];
  for (const mark of runbook.matchAll(/\[script: ([^\]]+)\]/g)) {
    const items = mark[1]!.split(';')[0]!.split(/,| and /).map(item => item.trim()).filter(Boolean);
    if (items.length === 0) problems.push(`empty mark ${mark[0]}`);
    for (const item of items) {
      const agents = /^agents ([a-z][a-z-]*)$/.exec(item), npm = /^npm run ([\w:-]+)$/.exec(item);
      const ok = /^[a-z][a-z-]*\.mjs$/.test(item) ? known.scriptFiles.has(item)
        : agents ? known.commands.has(agents[1]!)
        : npm ? known.npmScripts.includes(npm[1]!)
        : item === 'npm test' ? known.npmScripts.includes('test')
        : item === 'npx vitest run' ? known.hasVitest
        : false;
      if (!ok) problems.push(`${item} in ${mark[0].slice(0, 80)}`);
    }
  }
  return problems;
}

async function repositoryFacts(): Promise<{ cliSource: string; known: Parameters<typeof markProblems>[1] }> {
  const pkg = await fs.readJson(path.resolve('package.json')) as { scripts: Record<string, string>; devDependencies?: Record<string, string> };
  const cliSource = await read('src/cli.ts');
  const scriptFiles = new Set<string>();
  for (const skill of await fs.readdir(path.resolve('registry/skills'))) {
    const dir = path.resolve('registry/skills', skill, 'scripts');
    if (await fs.pathExists(dir)) for (const name of await fs.readdir(dir)) scriptFiles.add(name);
  }
  return { cliSource, known: { scriptFiles, commands: new Set([...cliSource.matchAll(/\.command\('([a-z][a-z-]*)/g)].map(match => match[1]!)), npmScripts: Object.keys(pkg.scripts), hasVitest: Boolean(pkg.devDependencies?.vitest) } };
}

describe('the contribution runbook is a seventeenth coordinator support path', () => {
  it('exists and is the seventeenth declared support path and required support of the binding, followed only by the four Bundle route paths', async () => {
    expect(await fs.pathExists(path.resolve(RUNBOOK_FILE))).toBe(true);
    const bundleRoute = ['references/bundle-authoring.md', 'scripts/check-bundle-return.mjs', 'assets/bundle-task.schema.json', 'assets/bundle-return.schema.json'];
    expect(DECLARED_SUPPORT).toHaveLength(21);
    expect(DECLARED_SUPPORT[16]).toBe(RUNBOOK);
    expect(DECLARED_SUPPORT.slice(17)).toEqual(bundleRoute);
    const binding = await fs.readJson(path.resolve('registry', COORDINATOR_DECLARATION)) as { requiredSupport: string[] };
    expect(binding.requiredSupport).toHaveLength(21);
    expect(binding.requiredSupport[16]).toBe(RUNBOOK);
    expect(binding.requiredSupport.slice(17)).toEqual(bundleRoute);
    expect([...COORDINATOR_SUPPORT]).toEqual([...DECLARED_SUPPORT]);
  });

  it('is named by both coordinator entries at the hand-off step, next to the handback reference', async () => {
    for (const rel of [shared('coordinate-artifact'), native('coordinate-artifact')]) {
      const step = (await read(rel)).split('\n').find(line => /^6\. /.test(line));
      expect(step, rel).toBeDefined();
      expect(step, rel).toContain('(references/handback.md)');
      expect(step, rel).toContain(`(${RUNBOOK})`);
      expect(step, rel).toMatch(/upstream/i);
    }
  });

  it.each(['references/handback.md', 'references/skill-authoring.md', 'references/contract-authoring.md', 'references/bundle-authoring.md'])('points %s at the runbook for upstream intent', async rel => {
    const text = await read(`registry/skills/coordinate-artifact/${rel}`);
    expect(text).toMatch(/\]\((?:\.\/)?contribution\.md\)/);
  });
});

describe('installation of the contribution runbook', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
  beforeEach(async () => { fixture = await prepareFactoryCoordinator(); });
  afterEach(async () => { await fs.remove(fixture.root); });

  it('installs the runbook with the bundle, lists it in the receipt and records the bundle as its owner with its hash', async () => {
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    const rel = `${COORDINATOR_ROOT}/${RUNBOOK}`;
    expect(await fs.pathExists(fixture.installed(rel))).toBe(true);
    const receipt = await fs.readJson(fixture.installed(`${COORDINATOR_ROOT}/assets/claude-binding.json`)) as { requiredSupport: string[] };
    expect(receipt.requiredSupport).toContain(RUNBOOK);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.[rel]?.owners).toContain('agent-factory');
    expect(lock.projections?.[rel]?.hash).toBe(`sha256:${crypto.createHash('sha256').update(await fs.readFile(fixture.installed(rel))).digest('hex')}`);
  });

  it('refuses an install whose source lacks the runbook, like a missing references/host-sync.md, before any write', async () => {
    for (const missing of [RUNBOOK, 'references/host-sync.md']) {
      const other = await prepareFactoryCoordinator();
      try {
        await fs.remove(other.source(`skills/coordinate-artifact/${missing}`));
        const before = await coordinatorTree(other.workspace);
        await expect(new InstallEngine(new RegistryResolver(other.registry)).install('agent-factory', other.options)).rejects.toThrow(/missing|required|does not exist/i);
        expect(await coordinatorTree(other.workspace)).toEqual(before);
      } finally { await fs.remove(other.root); }
    }
  });

  it('refuses a declaration that drops the runbook before any write', async () => {
    const file = fixture.source(COORDINATOR_DECLARATION), binding = await fs.readJson(file);
    binding.requiredSupport = binding.requiredSupport.filter((item: string) => item !== RUNBOOK);
    await fs.writeJson(file, binding);
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*required support differs/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });

  it('refuses a native entry that no longer names the runbook before any write', async () => {
    const entry = fixture.source('hosts/claude/skills/coordinate-artifact/SKILL.md');
    await fs.writeFile(entry, (await fs.readFile(entry, 'utf8')).replaceAll(RUNBOOK, 'omitted-support'));
    const before = await coordinatorTree(fixture.workspace);
    await expect(new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options)).rejects.toThrow(/coordinate-artifact.*omits required consultation/i);
    expect(await coordinatorTree(fixture.workspace)).toEqual(before);
  });
});

describe('one canonical upstream clause in every factory Skill', () => {
  const STANDS_IN: Array<[string, string]> = [
    ['coordinate-artifact', 'registry/skills/coordinate-artifact/references/handback.md'],
    ['coordinate-artifact', 'registry/skills/coordinate-artifact/references/skill-authoring.md'],
    ['coordinate-artifact', 'registry/skills/coordinate-artifact/references/contract-authoring.md'],
    ['coordinate-artifact', 'registry/skills/coordinate-artifact/references/bundle-authoring.md'],
    ['coordinate-artifact', RUNBOOK_FILE],
    ['author-skill', shared('author-skill')], ['author-skill', native('author-skill')], ['author-skill', 'registry/skills/author-skill/references/job.md'],
    ['author-contract', 'registry/skills/author-contract/references/verification.md'],
    ['author-bundle', shared('author-bundle')], ['author-bundle', native('author-bundle')],
    ['author-bundle', 'registry/skills/author-bundle/references/job.md'], ['author-bundle', 'registry/skills/author-bundle/references/verification.md'],
    ['realize-artifact', shared('realize-artifact')], ['realize-artifact', native('realize-artifact')], ['realize-artifact', 'registry/skills/realize-artifact/references/handback.md'],
    ['evaluate-artifact', shared('evaluate-artifact')], ['evaluate-artifact', native('evaluate-artifact')],
  ];

  it.each(STANDS_IN)('%s: %s carries the clause verbatim', async (_skill, rel) => {
    expect(await read(rel)).toContain(CLAUSE);
  });

  it('holds, for every Skill and for its shared and its native entry, in the entry or in a reference that entry names', async () => {
    for (const skill of SKILLS) {
      for (const rel of [shared(skill), native(skill)]) {
        const entry = await read(rel);
        // The native entries also link policy references (`references/rules/...`) that the binding supplies at install, not this folder.
        const files = linkedReferences(entry).map(ref => `registry/skills/${skill}/${ref}`).filter(file => fs.existsSync(path.resolve(file)));
        const named = [entry, ...(await Promise.all(files.map(read)))];
        // The coordinator entries leave the rule to the references they name at the hand-off step (handback, then the runbook).
        expect(named.some(text => text.includes(CLAUSE)), `${rel}`).toBe(true);
      }
    }
  });

  it('is the upstream part of the coordinator main sentence, which keeps its second sentence', async () => {
    const body = await read(AGENT_BODY);
    expect(body).toContain(`Local intent stops at the candidate. ${CLAUSE} No installation, publication, external Host/provider or paid call follows, for local and upstream intent alike.`);
  });

  // Distinctive fragments of the sentences the clause replaced: the paper's list (Part 1.3) and the same rule in the references it did not list.
  const OLD_VARIANTS: string[] = [
    'Upstream intent may prepare the entire pinned',
    'Upstream intent prepares the pinned contribution template with sent false',
    'Upstream intent prepares the pinned contribution template with `base: "dev"` and `sent: false`',
    'upstream intent only prepares the full pinned dev contribution template with sent false',
    'upstream intent only prepares the pinned contribution template with base dev and sent false',
    'Upstream intent retains the entire pinned',
    'Preparing it authorizes no branch change, commit, push, PR or merge',
    'Upstream intent prepares the existing contribution template and evidence without sending a PR',
    "For upstream preparation, use the selected checkout's `docs/artifact-contribution.md` and focused PR template",
    'for base `dev`, with `sent: false`',
    'this is local preparation, not a sent PR or completed review',
    'upstream intent prepares the existing dev contribution template with sent false',
    'For upstream intent identify the pinned existing contribution template and evidence with `sent: false`',
    'upstream intent prepares the existing dev template with sent false',
    'upstream preparation uses the existing dev template with sent false',
    'The helper returns its body plus draft evidence for dev/sent false',
    'Upstream preparation retains the full pinned artifact-contribution template for dev/sent false',
    'For upstream intent identify the pinned existing dev contribution template and prepared evidence, with `sent: false`',
    'Upstream intent identifies the existing pinned dev contribution template with `sent: false`',
  ];

  it('leaves none of the replaced sentences in any markdown file of the six Skills or in the coordinator main', async () => {
    const files = [AGENT_BODY, ...(await Promise.all(SKILLS.map(skillMarkdown))).flat()];
    for (const rel of files) {
      const text = await read(rel);
      for (const fragment of OLD_VARIANTS) expect(text.includes(fragment), `${rel}: ${fragment}`).toBe(false);
    }
  });

  it('keeps each Skill entry inside the layout cap and the native coordinator entry at or under its measured 5,788 characters', async () => {
    for (const skill of SKILLS) {
      for (const rel of [shared(skill), native(skill)]) {
        const text = await read(rel);
        expect(text.length, rel).toBeLessThanOrEqual(SKILL_MD_MAX_CHARS);
        expect(text.split('\n').length, rel).toBeLessThanOrEqual(SKILL_MD_MAX_LINES);
      }
    }
    expect((await read(native('coordinate-artifact'))).length).toBeLessThanOrEqual(5788);
  });

  it('made the room for the runbook pointer by moving one checklist bullet into the agent body, which still states the whole rule', async () => {
    for (const rel of [shared('coordinate-artifact'), native('coordinate-artifact')]) expect(await read(rel), rel).not.toContain('Revisions reopen/link actual work');
    const body = await read(AGENT_BODY);
    for (const part of ['Before repair reopen assigned work or link an owned fix, invalidate dependent acceptance and close after changed-byte readback/rechecks',
      'Do not leave unresolved fixes marked complete', 'Read back the changed outputs and applicable rechecks before closing']) expect(body, part).toContain(part);
  });

  it('keeps the other Skills from naming a file of another Skill for the rule: they name the two checkout files of the clause only', async () => {
    for (const skill of SKILLS.filter(item => item !== 'coordinate-artifact')) {
      for (const rel of await skillMarkdown(skill)) {
        expect(await read(rel), rel).not.toMatch(/coordinate-artifact\/references\/contribution|references\/contribution\.md/);
      }
    }
  });

  it('names all three skill-check policies where the Skill route names the command', async () => {
    const text = await read('registry/skills/coordinate-artifact/references/skill-authoring.md');
    const step = text.split('\n').find(line => /^9\. /.test(line)) ?? '';
    expect(step).toContain('agents skill-check');
    for (const policy of ['agents-united-original', 'private-owner', 'adapted-source']) expect(step, policy).toContain(policy);
  });
});

describe('the runbook states the route plainly', () => {
  it('is short enough to be read at the hand-off', async () => {
    expect((await read(RUNBOOK_FILE)).length).toBeLessThanOrEqual(11300);
  });

  it('names the template, the guide, base dev, sent false, a branch from origin/dev, never main, and each artifact kind', async () => {
    const text = await read(RUNBOOK_FILE);
    for (const needle of ['.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md', 'docs/artifact-contribution.md', 'base `dev`', '`sent: false`', 'origin/dev', 'never `main`',
      '## Skill', '## Shared pair', '## Claude agent', '## Bundle proposal']) expect(text, needle).toContain(needle);
  });

  it('names every existing check command of each artifact kind, the three policies and the gate before a pull request', async () => {
    const text = await read(RUNBOOK_FILE);
    for (const needle of [
      'check-skill-return.mjs', 'agents skill-check', '--policy', 'agents-united-original', 'private-owner', 'adapted-source', 'registry/quality/skill-boilerplate-corpus.txt', 'check-review.mjs',
      'check-contract-return.mjs', 'contract-check', 'registry/core/',
      'check-job.mjs', 'check-handback.mjs', 'factory-check', 'UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts', 'registry/hosts/claude/agents/',
      'npm run hostlib:verify', 'npm run typecheck && npm test', 'AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts',
      'gh pr list --state all --repo github.com/NeoAnthropocene/agents-united', 'git diff --cached', "command's own exit code",
    ]) expect(text, needle).toContain(needle);
  });

  it('names agents bundle-check as the contributor\'s check of a Bundle proposal, names the evidence of the coordinator route, and says what a pass does not show', async () => {
    const text = await read(RUNBOOK_FILE);
    const section = text.slice(text.indexOf('## Bundle proposal'), text.indexOf('## Gate before a pull request'));
    expect(section).not.toContain('no deterministic check');
    for (const name of ['proposal-check', 'bundle-proposal']) expect(text, name).not.toContain(name);
    const step = section.split('\n').find(line => line.includes('dist/cli.js bundle-check')) ?? '';
    for (const needle of ['`npm run build`', '`node <checkout>/dist/cli.js bundle-check --artifact <absolute proposal folder> --registry <checkout>/registry`', '`--operation update` for an update folder',
      '`--allow-unresolved` only when the proposal names members that are still to be realized', 'lists them as open', 'Exit 0 passed, 1 failed, 2 unavailable', '[script: agents bundle-check]']) expect(step, needle).toContain(needle);
    expect(section).not.toContain('no route that runs');
    expect(section).toContain('(bundle-authoring.md)');
    const collect = section.split('\n').find(line => line.includes('Collect: `bundle-task.json`')) ?? '';
    for (const needle of ['`bundle-return.json`', 'check-bundle-return.mjs', 'preflight and postflight', 'saved `bundle-check` stdout, stderr and exit']) expect(collect, needle).toContain(needle);
    expect(collect).toMatch(/\[script: check-bundle-return\.mjs, agents bundle-check; [^\]]*prose\]/);
    const pass = section.split('\n').find(line => line.includes('A pass does not show')) ?? '';
    for (const needle of ["the leader file's content", "the report's content and hashes", 'licence truth', 'quality', 'prose', '`unverified`']) expect(pass, needle).toContain(needle);
    const template = section.split('\n').find(line => line.includes('Template:')) ?? '';
    expect(template).toContain("the Verification section reports the command's exit and result");
    expect(template).toContain('`unresolved`');
  });

  // Each refusal is pinned on its own, inside its own section only, so dropping or softening one fails exactly one test.
  it.each([
    'No commit, push, force-push, pull request or merge by the factory.',
    'No install into a managed Host folder (for example',
    'no rerun of `draft.mjs` or `draft-pair.mjs`',
    'No paid Host, model or provider session',
    'no `host-agent-router` run without the maintainer\'s explicit authorization, scope and ledger',
    'No cleared hold',
    'no invented source',
    'no check reported that did not run: mark it N/A with the reason',
    'No credentials or raw private sessions in the body or the evidence',
  ])('refuses on its own: %s', async needle => {
    const text = await read(RUNBOOK_FILE);
    const start = text.indexOf('## What this runbook refuses'), end = text.indexOf('## What stays unverified');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(text.slice(start, end)).toContain(needle);
  });

  it('lists the managed Host folders as examples, not as a closed list', async () => {
    const text = await read(RUNBOOK_FILE);
    expect(text.slice(text.indexOf('## What this runbook refuses'))).toMatch(/managed Host folder \(for example `\.claude`, `\.agents`, `\.cline`, `\.cursor`, `\.codex`, `\.opencode`, `\.gemini`\)/);
  });

  it('labels every claim offline, live or unverified, and says a passing checker, a prepared body or an evaluator opinion is not acceptance', async () => {
    const text = await read(RUNBOOK_FILE);
    const section = text.slice(text.indexOf('## What stays unverified'));
    for (const needle of ['`offline`', '`live`', '`unverified`', 'acceptedDraft: false', 'not acceptance', 'legal clearance', 'permission to commit, push or publish', 'Codex, Antigravity and Cline']) expect(section, needle).toContain(needle);
  });

  it('marks every step as checked by a named script or as prose', async () => {
    const text = await read(RUNBOOK_FILE);
    const sections = text.split(/^## /m).slice(1).filter(section => !/^(When it applies|What this runbook refuses|What stays unverified)/.test(section));
    const steps = sections.flatMap(section => section.split('\n').filter(line => /^(?:- |\d+\. )/.test(line)));
    expect(steps.length).toBeGreaterThan(20);
    for (const line of steps) expect(line, line).toMatch(/\[(?:prose|script: [^\]]+)\]/);
  });

  it('names in every script mark only scripts and commands that exist, and a misspelling in a mark fails the check', async () => {
    const text = await read(RUNBOOK_FILE);
    const { known } = await repositoryFacts();
    expect(markProblems(text, known)).toEqual([]);
    expect(markProblems(text.replace('[script: check-review.mjs]', '[script: check-reviw.mjs]'), known)).not.toEqual([]);
    expect(markProblems(text.replace('[script: agents contract-check]', '[script: agents contract-chek]'), known)).not.toEqual([]);
    expect(markProblems(text.replace('[script: npm run hostlib:verify]', '[script: npm run hostlib:verfy]'), known)).not.toEqual([]);
  });

  it('marks the steps with the scripts that really check them: the collection steps of the three routes name the checkers and the gate names both of its commands', async () => {
    const text = await read(RUNBOOK_FILE);
    const lines = text.split('\n');
    const mark = (start: string): string => lines.find(line => line.includes(start)) ?? '';
    expect(mark('Collect: `skill-task.json`')).toMatch(/\[script: check-skill-return\.mjs; [^\]]*prose\]/);
    expect(mark('Collect: `contract-task.json`')).toMatch(/\[script: check-contract-return\.mjs; [^\]]*prose\]/);
    expect(mark('Collect the `factory-check` output')).toMatch(/\[script: agents factory-check, check-review\.mjs\]/);
    expect(mark('`npm run typecheck && npm test` exits 0')).toMatch(/\[script: npm run typecheck, npm test\]/);
  });

  it('runs every check command of the built CLI with options that command has, and a misspelled command or option fails the check', async () => {
    const text = await read(RUNBOOK_FILE);
    const { cliSource, known } = await repositoryFacts();
    const named = [...text.matchAll(/\bnpm run ([\w:-]+)/g)].map(match => match[1]!);
    expect(named).toEqual(expect.arrayContaining(['build', 'hostlib:verify', 'typecheck', 'hostlib:session']));
    for (const script of named) expect(known.npmScripts, `npm run ${script}`).toContain(script);
    expect(cliOptions(cliSource, 'skill-check')).toEqual(['artifact', 'corpus', 'policy']);
    expect(cliOptions(cliSource, 'contract-check')).toEqual(['registry', 'definition']);
    expect(cliOptions(cliSource, 'factory-check')).toEqual(expect.arrayContaining(['registry', 'definition', 'host', 'artifact', 'loading', 'required-skills']));
    expect(cliOptions(cliSource, 'bundle-check')).toEqual(['artifact', 'registry', 'operation', 'allow-unresolved']);
    expect(cliLineProblems(text, cliSource)).toEqual([]);
    const cliLines = text.split('\n').filter(line => /dist\/cli\.js\s+[a-z]|\bagents\s+[a-z]+-check/.test(line));
    expect(cliLines.length).toBeGreaterThanOrEqual(6);
    expect(cliLines.some(line => line.includes('dist/cli.js bundle-check'))).toBe(true);
    expect(cliLineProblems(text.replace('--allow-unresolved', '--allow-unresolve'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('bundle-check --artifact', 'bundle-check --artefact'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('--operation update', '--operaton update'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('dist/cli.js bundle-check', 'dist/cli.js bundle-chek'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('--corpus <checkout>', '--corpuss <checkout>'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('--definition <definition>', '--defintion <definition>'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('--required-skills', '--required-skill'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('dist/cli.js contract-check', 'dist/cli.js contract-chek'), cliSource)).not.toEqual([]);
    expect(cliLineProblems(text.replace('agents skill-check', 'agents skill-chek'), cliSource)).not.toEqual([]);
  });

  it('runs the checkout checks of every route after npm run build, with absolute paths for skill-check', async () => {
    const text = await read(RUNBOOK_FILE);
    const section = (from: string, to: string): string => text.slice(text.indexOf(from), text.indexOf(to));
    expect(text).not.toContain('rerun `agents skill-check`');
    expect(section('## Skill', '## Shared pair')).toContain('node <checkout>/dist/cli.js skill-check --artifact <absolute folder> --corpus <checkout>/registry/quality/skill-boilerplate-corpus.txt --policy <policy>');
    for (const [from, to] of [['## Skill', '## Shared pair'], ['## Shared pair', '## Claude agent'], ['## Claude agent', '## Bundle proposal']]) expect(section(from!, to!), from).toContain('`npm run build`');
    expect(section('## Skill', '## Shared pair')).toMatch(/absolute `--artifact` and `--corpus` paths/);
  });

  it('cites docs/skill-intake.md for bundle placement, specialist wiring and bookkeeping, names registry/bundles.json and states both placement rules', async () => {
    const text = await read(RUNBOOK_FILE);
    const step = text.split('\n').find(line => line.includes('registry/bundles.json') && line.includes('skill-intake')) ?? '';
    expect(step).toContain('section 6');
    expect(step).toContain('section 7');
    expect(step).toContain('section 8');
    expect(step).toContain('contributor-only Skill goes in its named contributor bundle');
    expect(step).toContain('stays out of `full`');
    expect(step).toContain('addon bundle, never an Essentials bundle');
    expect(step).toContain('explicit `full` inventory');
    expect(step).toContain('"N skills" counts in `README.md` and `PROJECT.md`');
  });

  it('says what each provenance disposition requires and what the README credit contains', async () => {
    const text = await read(RUNBOOK_FILE);
    const step = text.split('\n').find(line => line.startsWith('4. Provenance')) ?? '';
    for (const needle of ['original or inspired', 'omits `metadata.source`', 'credits the reviewed inspiration truthfully', 'does not claim its text was copied', 'adapted', '40-character commit SHA',
      'README.md` section 5', 'author or project', 'upstream link', 'adapted from X by Y']) expect(step, needle).toContain(needle);
  });

  it('keeps the whole template, fills Review and remaining work and states the live-test ledger, and searches the prior art the guide names', async () => {
    const text = await read(RUNBOOK_FILE);
    const common = text.slice(text.indexOf('## Common steps'), text.indexOf('## Skill'));
    for (const needle of ['keeps the entire template', 'N/A', 'Review and remaining work', 'reviewer questions', 'exact next action', 'tested commit', 'host/account/model/session', 'quota, prompt and cost ledger including teammates',
      'unknown cost is unresolved', 'npm run hostlib:session']) expect(common, needle).toContain(needle);
    const search = common.split('\n').find(line => line.startsWith('2. Search prior art')) ?? '';
    for (const needle of ['`registry/`', '`registry/hosts/` profiles', '`host-library/` guides and observations', '`tests/`', '`docs/adr/`', 'open and closed pull requests']) expect(search, needle).toContain(needle);
  });

  it('says that evals/ of a new Skill stays in its checkout folder and is never copied to an installed lane', async () => {
    const text = await read(RUNBOOK_FILE);
    expect(text).toContain("A new Skill's `evals/` folder stays inside its checkout folder; no install copies it.");
  });

  it('says what the guide expects of a shared pair without forbidding a pair-only pull request, and writes the commands for a POSIX shell', async () => {
    const text = await read(RUNBOOK_FILE);
    const pair = text.slice(text.indexOf('## Shared pair'), text.indexOf('## Claude agent'));
    expect(pair).toContain('The guide expects a new subagent\'s pair alongside its native host addition; a pair-only pull request is agreed with the maintainer first');
    expect(pair).toContain('with the reason');
    expect(pair).not.toMatch(/must not|never open a pair-only|is forbidden/i);
    expect(text).toContain('Commands are written for a POSIX shell (Git Bash on Windows).');
  });

  it.each([shared('author-contract'), native('author-contract')])('%s names references/verification.md in step 6, the step that speaks of upstream intent', async rel => {
    const step = (await read(rel)).split('\n').find(line => /^6\. /.test(line)) ?? '';
    expect(step).toMatch(/upstream intent/);
    expect(step).toContain('(references/verification.md)');
  });

  it('names no repository file, npm script or agents command that does not exist in this checkout', async () => {
    const text = await read(RUNBOOK_FILE);
    const spans = [...text.matchAll(/`([^`\n]+)`/g)].map(match => match[1]!);
    const scripts = (await fs.readJson(path.resolve('package.json')) as { scripts: Record<string, string> }).scripts;
    const commands = new Set([...(await read('src/cli.ts')).matchAll(/\.command\('([a-z][a-z-]*)/g)].map(match => match[1]!));
    const skillScripts = new Set((await Promise.all((await fs.readdir(path.resolve('registry/skills'))).map(async skill => {
      const dir = path.resolve('registry/skills', skill, 'scripts');
      return (await fs.pathExists(dir)) ? (await fs.readdir(dir)).map(name => `${skill}/scripts/${name}`) : [];
    }))).flat());
    const checked: string[] = [];
    for (const span of spans) {
      let rel = span.replace(/^\$\{CLAUDE_SKILL_DIR\}\//, 'registry/skills/coordinate-artifact/');
      for (const npm of span.matchAll(/\bnpm run ([\w:-]+)/g)) { expect(Object.keys(scripts), span).toContain(npm[1]); checked.push(span); }
      const agents = /^agents ([a-z][a-z-]*)/.exec(span);
      if (agents) { expect([...commands], span).toContain(agents[1]); checked.push(span); }
      for (const file of span.match(/\b(?:tests|docs)\/[A-Za-z0-9_.\/-]+\.(?:ts|md)\b/g) ?? []) { expect(await fs.pathExists(path.resolve(file)), `${span}: ${file}`).toBe(true); checked.push(file); }
      if (/^[A-Za-z0-9_.\-]+\.mjs$/.test(span)) { expect([...skillScripts].some(item => item.endsWith(`/${span}`)), span).toBe(true); checked.push(span); continue; }
      if (!/^(?:\.github|\.claude|docs|registry|src|tests|scripts|host-library)\/[^\s]*$/.test(rel) && !/^(?:CONTEXT|AGENTS|README|PROJECT|CLAUDE)\.md$/.test(rel)) continue;
      // An installed path names a registry Skill file; a placeholder ends the part that must exist.
      rel = rel.replace(/^\.claude\/skills\//, 'registry/skills/').split('<')[0]!.replace(/\/$/, '');
      expect(await fs.pathExists(path.resolve(rel)), `${span} -> ${rel}`).toBe(true);
      checked.push(span);
    }
    expect(checked.length).toBeGreaterThan(25);
  });
});
