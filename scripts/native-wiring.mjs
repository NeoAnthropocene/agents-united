#!/usr/bin/env node
/**
 * ADR 0075 - the test wiring of a role brought into the Claude native lane, generated from a batch manifest (scripts/factory-batch.schema.json).
 * Contributor tooling: never installed, never run at install time. It plans edits to six test files and prints them; `--write` applies them.
 * It never writes registry/bundles.json, a tool policy or anything under src/; registry/hosts/claude/deltas.json only with `--deltas`.
 *
 *   node scripts/native-wiring.mjs --manifest <file> --checkout <folder> [--write] [--deltas]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FILES = {
  roster: 'tests/helpers/native-roles.ts',
  roles: 'tests/native-claude-agents.test.ts',
  evidence: 'tests/helpers/native-invariant-evidence.ts',
  reach: 'tests/native-claude-own-session.test.ts',
  install: 'tests/native-install-lane.test.ts',
  cli: 'tests/cli-e2e.test.ts',
  deltas: 'registry/hosts/claude/deltas.json',
};

/** Tools a reviewer would not list as "must hold": reading and searching, MCP resources, task tracking, discovery and the server tools. */
const NOT_MUST_HOLD = new Set(['Glob', 'Grep', 'Read', 'LSP', 'ListMcpResourcesTool', 'ReadMcpResourceTool', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TaskOutput', 'ListAgents']);
/** The writer order of the repository's own table (WRITER_MUST_HOLD), used to order a derived must-hold list. */
const WRITER_ORDER = ['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit', 'Monitor', 'EnterWorktree', 'ExitWorktree', 'TodoWrite', 'ToolSearch'];

const lf = text => text.replace(/\r\n/g, '\n');
const readText = file => lf(fs.readFileSync(file, 'utf8'));
const exists = file => fs.existsSync(file);
const quote = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const list = values => `[${values.map(quote).join(', ')}]`;
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/\n/g, '\\n');

/** A tools line split on top-level commas (an `Agent(a, b)` list stays one entry). */
function splitTools(line) {
  const tools = [];
  let depth = 0, current = '';
  for (const char of String(line)) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { tools.push(current.trim()); current = ''; } else current += char;
  }
  if (current.trim()) tools.push(current.trim());
  return tools;
}

/** Problems with a manifest against a checkout; an empty list means it may be used. */
export function checkManifest(manifest, checkout) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['The manifest is not a JSON object.'];
  if (manifest.version !== 1) problems.push('The manifest version must be 1.');
  if (typeof manifest.id !== 'string' || !ID.test(manifest.id)) problems.push('The manifest id must be a kebab-case identifier.');
  if (!Array.isArray(manifest.roles) || manifest.roles.length === 0) return [...problems, 'The manifest names no roles.'];
  let bundles = {};
  try { bundles = JSON.parse(readText(path.join(checkout, 'registry/bundles.json'))).bundles ?? {}; } catch { problems.push('registry/bundles.json cannot be read in the checkout.'); }
  const seen = new Set();
  for (const role of manifest.roles) {
    const name = role?.role;
    if (typeof name !== 'string' || !ID.test(name)) { problems.push('A role has no kebab-case `role`.'); continue; }
    if (seen.has(name)) problems.push(`The role ${name} is named more than once.`);
    seen.add(name);
    for (const key of ['definition', 'bundle', 'lead']) if (typeof role[key] !== 'string' || !ID.test(role[key])) problems.push(`${name}: \`${key}\` must be a kebab-case identifier.`);
    if (!['specialist', 'coordinator'].includes(role.kind)) problems.push(`${name}: \`kind\` must be specialist or coordinator.`);
    if (![1, 2].includes(role.tier)) problems.push(`${name}: \`tier\` must be 1 or 2.`);
    if (!['existing', 'new'].includes(role.pair)) problems.push(`${name}: \`pair\` must be existing or new.`);
    if (typeof role.bundle === 'string' && !Object.hasOwn(bundles, role.bundle)) problems.push(`${name}: the Bundle ${role.bundle} is not in registry/bundles.json.`);
    for (const key of ['native', 'coverage']) {
      if (typeof role[key] !== 'string' || !role[key]) problems.push(`${name}: \`${key}\` must name a file.`);
      else if (!exists(path.join(checkout, role[key]))) problems.push(`${name}: the ${key} file ${role[key]} is missing.`);
    }
    if (role.canonical !== null) {
      if (typeof role.canonical !== 'string' || !role.canonical) problems.push(`${name}: \`canonical\` must name a file or be null.`);
      else if (!exists(path.join(checkout, role.canonical))) problems.push(`${name}: the canonical agent ${role.canonical} is missing.`);
    }
    for (const ext of ['core.md', 'contract.json']) {
      if (typeof role.definition === 'string' && !exists(path.join(checkout, 'registry/core', `${role.definition}.${ext}`))) problems.push(`${name}: registry/core/${role.definition}.${ext} is missing.`);
    }
    if (role.mustHold !== undefined && (!Array.isArray(role.mustHold) || role.mustHold.some(tool => typeof tool !== 'string' || !tool))) problems.push(`${name}: \`mustHold\` must be a list of tool names.`);
  }
  if (!Array.isArray(manifest.leads)) problems.push('The manifest needs a `leads` list (it may be empty).');
  if (!Array.isArray(manifest.decisions)) problems.push('The manifest needs a `decisions` list (it may be empty).');
  for (const decision of manifest.decisions ?? []) {
    const id = decision?.id ?? '(no id)';
    if (typeof decision?.id !== 'string' || !ID.test(decision.id)) problems.push('A decision has no kebab-case `id`.');
    if (typeof decision?.question !== 'string' || !decision.question) problems.push(`Decision ${id}: \`question\` is missing.`);
    if (!['maintainer', 'ai-session'].includes(decision?.by)) problems.push(`Decision ${id}: \`by\` must be maintainer or ai-session.`);
    if (decision?.answer !== null && (typeof decision?.answer !== 'string' || !decision.answer)) problems.push(`Decision ${id}: \`answer\` must be a text or null.`);
    if (decision?.answer !== null && (typeof decision?.date !== 'string' || !DATE.test(decision.date))) problems.push(`Decision ${id}: an answered decision needs a date (YYYY-MM-DD).`);
    if (!Array.isArray(decision?.roles)) problems.push(`Decision ${id}: \`roles\` must be a list.`);
  }
  return problems;
}

/** What the generator needs to know about one role, read from its native file and coverage file. */
function factsOf(role, checkout) {
  const text = readText(path.join(checkout, role.native));
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!front) throw new Error(`${role.native} has no frontmatter.`);
  const meta = YAML.parse(front[1]) ?? {};
  const tools = splitTools(meta.tools ?? '');
  const plain = tools.map(tool => tool.split('(')[0]);
  const serverTools = tools.filter(tool => tool.startsWith('mcp__'));
  const guard = /readonly-guard/.test(front[1]) ? 'read-only' : 'destructive';
  const mutating = ['Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell'].some(tool => plain.includes(tool));
  const derived = plain.filter(tool => !tool.startsWith('mcp__') && !NOT_MUST_HOLD.has(tool));
  const mustHoldDerived = role.mustHold === undefined;
  const mustHold = role.mustHold ?? [...WRITER_ORDER.filter(tool => derived.includes(tool)), ...derived.filter(tool => !WRITER_ORDER.includes(tool)).sort()];
  const searchTools = plain.includes('LSP') ? undefined : ['Glob', 'Grep', 'Read'].filter(tool => plain.includes(tool));
  const workTools = plain.includes('Bash') ? undefined : ['Edit', 'Write'].filter(tool => plain.includes(tool));
  const coverage = JSON.parse(readText(path.join(checkout, role.coverage)));
  return { text, meta, tools, plain, serverTools, guard, mutating, mustHold, mustHoldDerived, searchTools, workTools, coverage, peers: text.includes('## Working with peers') };
}

/** The helper's named invariant texts (`const COMMS = { key: '<text>', ... }`), which its maps use as computed keys (`[COMMS.key]`). */
function namedInvariants(text) {
  const block = /const COMMS = \{([\s\S]*?)\}/.exec(text)?.[1] ?? '';
  return new Map([...block.matchAll(/^\s+(\w+): '((?:[^'\\]|\\.)*)',$/gm)].map(match => [match[1], match[2].replace(/\\'/g, "'")]));
}

/** `'<invariant>': /<pattern>/flags,` (or `[COMMS.key]: ...`) lines of a block that starts at `header` (an object literal opened on that line), at `indent` spaces. */
function patternsIn(text, header, indent) {
  const start = text.indexOf(header);
  if (start < 0) return null;
  const close = text.indexOf(`\n${' '.repeat(indent - 2)}}`, start);
  const named = namedInvariants(text);
  const patterns = new Map();
  const line = new RegExp(`^ {${indent}}(?:'((?:[^'\\\\]|\\\\.)*)'|\\[COMMS\\.(\\w+)\\]): \\/(.*)\\/([a-z]*),$`);
  for (const row of text.slice(start, close).split('\n').slice(1)) {
    const match = line.exec(row);
    if (!match) continue;
    const key = match[1] !== undefined ? match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : named.get(match[2]);
    if (key !== undefined) patterns.set(key, new RegExp(match[3], match[4]));
  }
  return patterns;
}

function rosterRow(role) {
  return `  { role: '${role.role}', stem: '${role.definition}', tier: ${role.tier}, coordinator: ${role.kind === 'coordinator'} },`;
}

function rolesRow(role, facts) {
  const parts = [`name: '${role.role}'`, `stem: '${role.definition}'`, `guard: '${facts.guard}'`];
  if (typeof facts.meta.permissionMode === 'string') parts.push(`permissionMode: '${facts.meta.permissionMode}'`);
  parts.push(`skills: ${list(Array.isArray(facts.meta.skills) ? facts.meta.skills : [])}`, `serverTools: ${list(facts.serverTools)}`, `mutating: ${facts.mutating}`, `mustHold: ${list(facts.mustHold)}`);
  if (facts.searchTools) parts.push(`searchTools: ${list(facts.searchTools)}`);
  if (facts.workTools) parts.push(`workTools: ${list(facts.workTools)}`);
  parts.push(`model: '${facts.meta.model}'`, `effort: '${facts.meta.effort}'`);
  // A must-hold list the manifest did not give is the generator's, not a reviewer's: the row says so.
  return `  { ${parts.join(', ')} },${facts.mustHoldDerived ? " // mustHold derived from the tools line, not a reviewer's choice" : ''}`;
}

/** The stub of a role's own test file: its exact tool set from the tools line, and a case that fails until the role's own claims are written. */
function roleTestStub(role, facts) {
  return [
    "import { describe, expect, it } from 'vitest';",
    "import { splitTools } from '../src/core/native-guard.js';",
    "import { nativeText } from './helpers/native-roles.js';",
    '',
    '/**',
    ` * Native ${role.role}: what its authored body must keep saying. Generated as a stub by scripts/native-wiring.mjs (ADR 0075): the exact tool set`,
    " * comes from the tools line; the role's own claims (every guard, tool or Host behaviour its text names, tested against what is bound) are",
    ' * written by hand, and the last case fails until they are.',
    ' */',
    '',
    `const text = (): string => nativeText('${role.role}');`,
    'const toolsOf = (body: string): string[] => splitTools(/^tools: (.*)$/m.exec(body)![1]!);',
    '',
    `describe('native ${role.role}', () => {`,
    "  it('holds exactly its tools', () => {",
    `    expect(toolsOf(text())).toEqual(${list(facts.tools)});`,
    '  });',
    '',
    "  it('states its own claims (written by hand before the pull request)', () => {",
    `    throw new Error('Write the own claims of ${role.role}: every guard, tool or Host behaviour its text names, tested against what is bound.');`,
    '  });',
    '});',
    '',
  ].join('\n');
}

function installCases(role) {
  return [
    `  it('installs the native ${role.role} for the ${role.bundle} bundle, recorded as a managed role of its canonical agent', async () => {`,
    `    await new InstallEngine().install('${role.bundle}', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });`,
    `    expect(await fs.readFile(claudeAgent('${role.role}'), 'utf8')).toBe(expected('${role.role}'));`,
    `    const record = (await fs.readJson(lockPath)).projections['.claude/agents/${role.role}.md'];`,
    "    expect(record.kind).toBe('role');",
    `    expect(record.canonical).toBe(canonicalOf('${role.role}'));`,
    '    expect(record.managedMarker).toBe(true);',
    '  });',
    '',
    `  it('without the native lane, ${role.bundle} still writes the legacy projection for ${role.role}', async () => {`,
    `    await new InstallEngine().install('${role.bundle}', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });`,
    `    const text = await fs.readFile(claudeAgent('${role.role}'), 'utf8');`,
    "    expect(text).toContain('profile: claude |');",
    "    expect(text).not.toContain('claude-native');",
    '    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();',
    '  });',
    '',
    '',
  ].join('\n');
}

function cliCase(role, facts) {
  const canonical = role.canonical.replace(/^registry\//, '');
  return [
    `  it('installs the native ${role.role} for ${role.bundle} with -t claude --native', async () => {`,
    `    const result = spawnSync(process.execPath, [cliPath, 'add', '${role.bundle}', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });`,
    '    expect(result.status, result.stdout + result.stderr).toBe(0);',
    `    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/${role.role}.md'), 'utf8');`,
    "    expect(text).toContain('profile: claude-native');",
    `    expect(text).toMatch(/^name: ${role.role}$/m);`,
    ...(facts.peers ? ["    expect(text).toContain('## Working with peers');"] : []),
    "    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));",
    '    expect(lock.nativeLane).toBe(true);',
    `    expect(lock.installed.bundles).toContain('${role.bundle}');`,
    `    expect(lock.projections['.claude/agents/${role.role}.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: '${canonical}' });`,
    '  });',
    '',
    '',
  ].join('\n');
}

/** Inserts `block` (whole lines, ending in a newline) at the start of the first line matching `anchor`, or returns null. */
function insertBeforeLine(text, anchor, block) {
  const lines = text.split('\n');
  const at = lines.findIndex(line => anchor(line));
  if (at < 0) return null;
  return [...lines.slice(0, at), ...block.replace(/\n$/, '').split('\n'), ...lines.slice(at)].join('\n');
}

/**
 * The plan for a manifest: `edits` (file, action, role, what), `texts` (the new text of every changed file), `proposals` (what a person applies),
 * `refusals` (nothing may be written while there is one) and `held` (roles an open decision holds back).
 */
export function planWiring(manifest, checkout, options = {}) {
  const plan = { edits: [], texts: {}, proposals: [], refusals: [], held: [] };
  const problems = checkManifest(manifest, checkout);
  if (problems.length) { plan.refusals.push(...problems); return plan; }
  const open = manifest.decisions.filter(decision => decision.answer === null);
  const active = [];
  for (const role of manifest.roles) {
    const decision = open.find(item => item.roles.includes(role.role));
    if (decision) plan.held.push({ role: role.role, decision: decision.id });
    else active.push(role);
  }
  if (!active.length) return plan;

  const texts = {};
  const eol = {};
  const load = key => {
    const rel = FILES[key];
    if (texts[rel] === undefined) {
      const raw = fs.readFileSync(path.join(checkout, rel), 'utf8');
      eol[rel] = raw.includes('\r\n') ? '\r\n' : '\n';
      texts[rel] = lf(raw);
    }
    return texts[rel];
  };
  const original = {};
  const note = (key, action, role, what) => plan.edits.push({ file: FILES[key], action, role, what });
  const refuse = (key, role, what) => plan.refusals.push(`${FILES[key]}: ${role} ${what} differs from what the generator writes; it is left as it is and nothing is written.`);
  for (const key of ['roster', 'roles', 'evidence', 'reach', 'install', 'cli']) original[FILES[key]] = load(key);
  const evidenceText = () => texts[FILES.evidence];
  const shared = patternsIn(original[FILES.evidence], 'export const EVIDENCE: Record<string, RegExp> = {', 2) ?? new Map();

  for (const role of active) {
    const facts = factsOf(role, checkout);

    // 1. The roster helper: one row; a new row ends its tier.
    {
      const row = rosterRow(role);
      const current = texts[FILES.roster].split('\n').find(line => line.startsWith(`  { role: '${role.role}',`));
      if (current === row) note('roster', 'unchanged', role.role, 'roster row');
      else if (current !== undefined) refuse('roster', role.role, 'roster row');
      else {
        const start = texts[FILES.roster].indexOf('export const NATIVE_ROLES');
        const head = texts[FILES.roster].slice(0, start), body = texts[FILES.roster].slice(start);
        const next = insertBeforeLine(body, line => { const tier = /^ {2}\{ role: '[^']+', stem: '[^']+', tier: (\d)/.exec(line); return (tier && Number(tier[1]) > role.tier) || line === '];'; }, `${row}\n`);
        texts[FILES.roster] = head + next;
        note('roster', 'insert', role.role, 'roster row');
      }
    }

    // 2. The ROLES table: one row for a Tier-1 specialist, after the last one-line Tier-1 row; other rows are written by hand.
    {
      const lines = texts[FILES.roles].split('\n');
      const current = lines.find(line => line.startsWith(`  { name: '${role.role}',`) || line === `    name: '${role.role}',` || line.startsWith(`    { name: '${role.role}',`));
      if (role.tier !== 1 || role.kind !== 'specialist') {
        if (current === undefined) plan.proposals.push(`${FILES.roles}: write the ROLES entry of ${role.role} by hand (the generator writes Tier-1 specialist rows only).`);
      } else {
        const row = rolesRow(role, facts);
        if (current === row) note('roles', 'unchanged', role.role, 'ROLES row');
        else if (current !== undefined) refuse('roles', role.role, 'ROLES row');
        else {
          const start = lines.findIndex(line => line.startsWith('const ROLES: RoleSpec[] = ['));
          const block = lines.findIndex((line, index) => index > start && line === '  {');
          if (start < 0 || block < 0) plan.refusals.push(`${FILES.roles}: the ROLES table has no place for a Tier-1 row.`);
          else {
            lines.splice(block, 0, row);
            texts[FILES.roles] = lines.join('\n');
            plan.edits.push({ file: FILES.roles, action: 'insert', role: role.role, what: 'ROLES row', ...(facts.mustHoldDerived ? { derived: ['mustHold'] } : {}) });
          }
        }
      }
    }

    // 3. The evidence helper: one literal pattern per coverage entry the shared pattern does not already bind; a delta is a proposal.
    {
      const needed = [];
      for (const entry of facts.coverage.invariants ?? []) {
        if (typeof entry.evidence === 'string') {
          const common = shared.get(entry.invariant);
          if (common && common.test(facts.text)) continue;
          needed.push(entry);
        } else if (entry.delta) {
          const row = { roles: [role.role], feature: entry.invariant, disposition: entry.delta.disposition, rationale: entry.delta.rationale };
          if (options.deltas) {
            const rel = FILES.deltas;
            const raw = texts[rel] ?? lf(fs.readFileSync(path.join(checkout, rel), 'utf8'));
            if (eol[rel] === undefined) eol[rel] = fs.readFileSync(path.join(checkout, rel), 'utf8').includes('\r\n') ? '\r\n' : '\n';
            const data = JSON.parse(raw);
            const same = data.deltas.find(item => item.feature === row.feature && item.disposition === row.disposition && item.rationale === row.rationale);
            if (same?.roles.includes(role.role)) { note('deltas', 'unchanged', role.role, `delta ${row.feature}`); continue; }
            if (same) same.roles.push(role.role); else data.deltas.push(row);
            texts[rel] = `${JSON.stringify(data, null, 2)}\n`;
            note('deltas', 'insert', role.role, `delta ${row.feature}`);
          } else {
            plan.proposals.push(`${FILES.deltas}: declare for ${role.role} the delta ${JSON.stringify(row)} (written with --deltas).`);
          }
        }
      }
      if (needed.length) {
        const header = `  '${role.role}': {`;
        const existing = patternsIn(evidenceText(), `\n${header}\n`, 4);
        if (existing) {
          const covered = needed.every(entry => existing.get(entry.invariant)?.exec(facts.text)?.[0] !== undefined);
          if (covered) note('evidence', 'unchanged', role.role, 'evidence block');
          else refuse('evidence', role.role, 'evidence block');
        } else {
          const block = [header, ...needed.map(entry => `    ${quote(entry.invariant)}: /${escapeRegExp(entry.evidence)}/,`), '  },'].join('\n');
          const lines = evidenceText().split('\n');
          const start = lines.findIndex(line => line.startsWith('export const ROLE_EVIDENCE'));
          let at = lines.findIndex((line, index) => {
            if (index <= start) return false;
            const key = /^ {2}'([^']+)': \{$/.exec(line);
            return (key && key[1] > role.role) || line === '};';
          });
          while (at > start + 1 && lines[at - 1].startsWith('  //')) at--;
          lines.splice(at, 0, ...block.split('\n'));
          texts[FILES.evidence] = lines.join('\n');
          note('evidence', 'insert', role.role, 'evidence block');
        }
      }
    }

    // 5. The install lane: the sorted list of committed roles, and the two cases of the role's Bundle.
    {
      let text = texts[FILES.install];
      const listStart = text.indexOf('const COMMITTED_NATIVE_ROLES = [');
      const listEnd = text.indexOf('];', listStart);
      const names = [...text.slice(listStart, listEnd).matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1]);
      if (names.includes(role.role)) note('install', 'unchanged', role.role, 'committed-role list entry');
      else {
        const before = names.filter(name => name < role.role).pop();
        const segment = text.slice(listStart, listEnd);
        const updated = before === undefined ? segment.replace(`'${names[0]}'`, `'${role.role}', '${names[0]}'`) : segment.replace(`'${before}',`, `'${before}', '${role.role}',`);
        text = text.slice(0, listStart) + updated + text.slice(listEnd);
        note('install', 'insert', role.role, 'committed-role list entry');
      }
      if (role.canonical === null) plan.proposals.push(`${FILES.install}: write the install cases of ${role.role} by hand (it has no canonical agent).`);
      else {
        const cases = installCases(role);
        const first = cases.split('\n')[0];
        if (text.includes(cases)) note('install', 'unchanged', role.role, 'install cases');
        else if (text.includes(first)) refuse('install', role.role, 'install cases');
        else {
          const next = insertBeforeLine(text, line => line.startsWith("  it('records the lane, and every projection hash matches the file on disk'"), cases);
          if (next === null) plan.refusals.push(`${FILES.install}: the anchor case "records the lane" is missing.`);
          else { text = next; note('install', 'insert', role.role, 'install cases'); }
        }
      }
      texts[FILES.install] = text;
    }

    // 7. The role's own test file: a stub when it is missing (its exact tool set, and a case that fails until its claims are written);
    //    an existing file without the exact tool set gets a proposal, never an edit.
    {
      const rel = `tests/native-claude-${role.role}.test.ts`;
      const file = path.join(checkout, rel);
      if (!exists(file)) {
        texts[rel] = roleTestStub(role, facts);
        plan.edits.push({ file: rel, action: 'create', role: role.role, what: 'role test stub (exact tool set; own claims to be written by hand)' });
      } else if (!lf(fs.readFileSync(file, 'utf8')).includes(`toEqual(${list(facts.tools)})`)) {
        plan.proposals.push(`${rel}: add a case that pins the exact tool set: expect(toolsOf(text())).toEqual(${list(facts.tools)}).`);
      }
    }

    // 6. The CLI end-to-end case.
    if (role.canonical === null) plan.proposals.push(`${FILES.cli}: write the CLI case of ${role.role} by hand (it has no canonical agent).`);
    else {
      const block = cliCase(role, facts);
      const first = block.split('\n')[0];
      const text = texts[FILES.cli];
      if (text.includes(block)) note('cli', 'unchanged', role.role, 'CLI case');
      else if (text.includes(first)) refuse('cli', role.role, 'CLI case');
      else {
        const next = insertBeforeLine(text, line => line.startsWith("  it.each(['domain:contributor'"), block);
        if (next === null) plan.refusals.push(`${FILES.cli}: the anchor case "domain:contributor" is missing.`);
        else { texts[FILES.cli] = next; note('cli', 'insert', role.role, 'CLI case'); }
      }
    }
  }

  // 4. The session-reach count: the number of native agent files in the checkout.
  {
    const count = fs.readdirSync(path.join(checkout, 'registry/hosts/claude/agents')).filter(file => file.endsWith('.md')).length;
    const text = texts[FILES.reach];
    const match = /expect\(files\)\.toHaveLength\((\d+)\);/.exec(text);
    if (!match) plan.refusals.push(`${FILES.reach}: the native file count is missing.`);
    else if (Number(match[1]) === count) note('reach', 'unchanged', null, `native file count ${count}`);
    else { texts[FILES.reach] = text.replace(match[0], `expect(files).toHaveLength(${count});`); note('reach', 'replace', null, `native file count ${match[1]} to ${count}`); }
    if (plan.edits.some(edit => edit.action !== 'unchanged')) plan.proposals.push(`README.md, PROJECT.md: the native Claude agent sources now number ${count}; recompute the counts there from the registry folders.`);
  }

  for (const [rel, text] of Object.entries(texts)) {
    const before = original[rel] ?? null;
    if (text !== before) plan.texts[rel] = (eol[rel] ?? '\n') === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  }
  return plan;
}

/** Writes a plan's changed files; refuses the whole plan when it carries a refusal. */
export function applyWiring(plan, checkout) {
  if (plan.refusals.length) throw new Error(`Wiring refused, nothing written:\n${plan.refusals.join('\n')}`);
  for (const [rel, text] of Object.entries(plan.texts)) {
    if (rel === 'registry/bundles.json' || rel.endsWith('tool-policy.json') || rel.startsWith('src/')) throw new Error(`Wiring refused: ${rel} is never written.`);
    fs.writeFileSync(path.join(checkout, rel), text);
  }
}

function main(argv) {
  const args = { write: false, deltas: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--write') args.write = true;
    else if (flag === '--deltas') args.deltas = true;
    else if (flag === '--manifest' || flag === '--checkout') args[flag.slice(2)] = argv[++i];
    else { process.stderr.write(`Unknown argument ${flag}.\n`); return 2; }
  }
  if (!args.manifest || !args.checkout) { process.stderr.write('Usage: node scripts/native-wiring.mjs --manifest <file> --checkout <folder> [--write] [--deltas]\n'); return 2; }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.resolve(args.manifest), 'utf8')); } catch (error) { process.stderr.write(`The manifest cannot be read: ${error.message}\n`); return 2; }
  const checkout = path.resolve(args.checkout);
  const plan = planWiring(manifest, checkout, { deltas: args.deltas });
  const { texts: _texts, ...report } = plan;
  process.stdout.write(`${JSON.stringify({ ...report, written: args.write && !plan.refusals.length }, null, 2)}\n`);
  if (plan.refusals.length) return 1;
  if (args.write) applyWiring(plan, checkout);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
