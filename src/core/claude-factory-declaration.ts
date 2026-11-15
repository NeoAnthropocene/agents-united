/** Closed reviewed factory declarations shared by delivery and installed startup. */
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import YAML from 'yaml';
import { inspectNativeAgent } from './native-guard.js';
import { nativeGuardFileHooks } from './guard.js';
import { readOnlyGuardFileHooks } from './readonly-guard.js';
import type { ClaudeFactoryBinding } from './types.js';

function fail(message: string): never { throw new Error(`Claude factory binding: ${message}.`); }
export const FACTORY_BINDINGS = [
  { skill: 'realize-artifact', file: 'hosts/claude/agent-factory-realize.binding.json', root: '.claude/skills/realize-artifact' },
  { skill: 'evaluate-artifact', file: 'hosts/claude/agent-factory-evaluate.binding.json', root: '.claude/skills/evaluate-artifact' },
  { skill: 'sync-host', file: 'hosts/claude/agent-factory-sync.binding.json', root: '.claude/skills/sync-host' },
  { skill: 'coordinate-artifact', file: 'hosts/claude/agent-factory-coordinate.binding.json', root: '.claude/skills/coordinate-artifact' },
] as const;
export type FactoryEntry = typeof FACTORY_BINDINGS[number];
/**
 * Maps each factory worker Skill to the role name and reviewed posture its closure derives; wiring resolves by these names, never by list position.
 * `capabilities` are the semantic-core classes the worker must have, checked in the binder `when` the coordinator is part of the install
 * (`coordinated`) or `always`; `capabilityRefusal` is the existing refusal text for that check.
 */
export const FACTORY_WORKERS = [
  { skill: 'realize-artifact', role: 'factory-realizer', definition: 'subagent-realize-for-host', guard: 'destructive',
    requiredInstalled: ['.claude/skills/author-skill/references/skill-attribution.md'], hooks: [{ id: 'reject-destructive-operations', kind: 'destructive' }],
    grant: ['Bash', 'Edit', 'NotebookEdit', 'PowerShell', 'Skill', 'SubagentHandback', 'Write'],
    capabilities: ['edit', 'handback', 'read', 'report', 'search', 'shell', 'skill'], capabilitiesWhen: 'coordinated',
    capabilityRefusal: 'coordinate-artifact worker realizer capabilities differ' },
  { skill: 'evaluate-artifact', role: 'factory-evaluator', definition: 'subagent-factory-evaluator', guard: 'read-only',
    requiredInstalled: [], hooks: [{ id: 'reject-mutating-tools', kind: 'read-only' }], grant: ['SubagentHandback'],
    capabilities: ['handback', 'read', 'report', 'search'], capabilitiesWhen: 'always',
    capabilityRefusal: 'evaluator capabilities must retain exactly the reviewed read/search/report/handback classes' },
  { skill: 'sync-host', role: 'factory-sync', definition: 'subagent-host-update-sync', guard: 'read-only',
    requiredInstalled: [], hooks: [{ id: 'reject-mutating-tools', kind: 'read-only' }], grant: ['SubagentHandback'],
    capabilities: ['handback', 'read', 'report', 'search'], capabilitiesWhen: 'always',
    capabilityRefusal: 'sync capabilities must retain exactly the reviewed read/search/report/handback classes' },
] as const;
export type FactoryWorker = typeof FACTORY_WORKERS[number];

/** Resolve a closed binding entry by its Skill name; an unregistered Skill is refused, never guessed by position. */
export function factoryEntryBySkill(skill: string): FactoryEntry {
  const entry = FACTORY_BINDINGS.find(item => item.skill === skill);
  if (!entry) fail(`unknown factory skill ${skill}`);
  return entry;
}

/** Resolve a fixed worker by its Skill name; an unlisted Skill is never treated as one of the existing workers. */
export function factoryWorkerBySkill(skill: string): FactoryWorker {
  const worker = FACTORY_WORKERS.find(item => item.skill === skill);
  if (!worker) fail(`unknown factory worker skill ${skill}`);
  return worker;
}

/** Resolve a fixed worker by its role name; an unlisted role is never treated as one of the existing workers. */
export function factoryWorkerByRole(role: string): FactoryWorker {
  const worker = FACTORY_WORKERS.find(item => item.role === role);
  if (!worker) fail(`unknown factory worker role ${role}`);
  return worker;
}
export const COORDINATOR_SUPPORT = ['references/job.md', 'references/dispatch.md', 'references/verification.md', 'references/repair.md', 'references/handback.md', 'examples/claude-agent-journey.md', 'assets/report.json',
  'references/skill-authoring.md', 'scripts/check-skill-return.mjs', 'assets/skill-task.schema.json', 'assets/skill-return.schema.json',
  'references/contract-authoring.md', 'scripts/check-contract-return.mjs', 'assets/contract-task.schema.json', 'assets/contract-return.schema.json',
  'references/host-sync.md', 'references/contribution.md'] as const;
export const COORDINATOR_RULES = ['skill-attribution.md', 'git-guardrails.md', 'test-driven-development.md', 'clean-code-and-architecture.md', 'domain-modeling-and-adr.md', 'multi-agent-coordination.md', 'quality-aesthetics-accessibility.md'] as const;
const COORDINATOR_INSTALLED = [
  '.claude/agents/factory-realizer.md', '.claude/agents/factory-evaluator.md', '.claude/agents/factory-sync.md',
  '.claude/skills/realize-artifact/SKILL.md', '.claude/skills/realize-artifact/assets/claude-binding.json',
  '.claude/skills/realize-artifact/assets/job.schema.json', '.claude/skills/realize-artifact/assets/handback.schema.json',
  '.claude/skills/realize-artifact/scripts/check-job.mjs', '.claude/skills/realize-artifact/scripts/check-handback.mjs',
  '.claude/skills/evaluate-artifact/SKILL.md', '.claude/skills/evaluate-artifact/assets/claude-binding.json',
  '.claude/skills/evaluate-artifact/assets/job.schema.json', '.claude/skills/evaluate-artifact/assets/result.schema.json',
  '.claude/skills/evaluate-artifact/assets/rubric.json', '.claude/skills/evaluate-artifact/scripts/check-review.mjs',
  '.claude/skills/sync-host/SKILL.md', '.claude/skills/sync-host/assets/claude-binding.json',
  '.claude/skills/sync-host/assets/sync-job.schema.json', '.claude/skills/sync-host/assets/sync-plan.schema.json', '.claude/skills/sync-host/scripts/check-sync.mjs',
] as const;
export const COORDINATOR_WORKER_SUPPORT = {
  "realize-artifact": [
    "references/job.md",
    "references/checks.md",
    "references/host-inputs.md",
    "references/handback.md",
    "examples/claude-agent-draft.md",
    "assets/job.schema.json",
    "assets/handback.schema.json",
    "assets/report.json",
    "scripts/check-job.mjs",
    "scripts/check-handback.mjs"
  ],
  "evaluate-artifact": [
    "references/job.md",
    "references/rubric.md",
    "references/evidence.md",
    "references/handback.md",
    "examples/claude-agent-review.md",
    "examples/shared-pair-review.md",
    "examples/skill-review.md",
    "assets/job.schema.json",
    "assets/result.schema.json",
    "assets/rubric.json",
    "assets/report.json",
    "scripts/check-review.mjs"
  ],
  "sync-host": [
    "references/job.md",
    "references/plan.md",
    "references/handback.md",
    "examples/one-sync.md",
    "assets/sync-job.schema.json",
    "assets/sync-plan.schema.json",
    "scripts/check-sync.mjs"
  ]
} as const;
const COORDINATOR_ROLE = { name: 'orchestrator-agent-factory', definition: 'orchestrator-agent-factory',
  contract: 'core/orchestrator-agent-factory.contract.json', source: 'hosts/claude/agents/orchestrator-agent-factory.md',
  installed: '.claude/agents/orchestrator-agent-factory.md', loading: 'main', skills: ['coordinate-artifact'], guard: 'destructive' } as const;
const ID = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const REL = z.string().regex(/^[A-Za-z0-9_.\/-]+$/).refine(value =>
  !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..'), 'must be a contained relative path');
const uniqueIds = z.array(ID).refine(values => new Set(values).size === values.length, 'duplicate identifiers');
const declaration = (entry: FactoryEntry, receipt: boolean): z.ZodType<ClaudeFactoryBinding> => {
  const base = z.object({
  version: z.literal(1), bundle: z.literal('agent-factory'),
  source: z.literal(`hosts/claude/skills/${entry.skill}/SKILL.md`), installed: z.literal(`${entry.root}/SKILL.md`),
  surface: z.object({ host: z.literal('claude'), product: z.literal('Claude Code CLI'), scope: z.literal('workspace'), lane: z.literal('native') }).strict(),
  invocation: z.string().min(1),
  roles: z.array(z.object({
    name: ID, definition: ID, contract: REL, source: REL, installed: REL,
    loading: z.enum(['subagent', 'main']), skills: uniqueIds, guard: z.enum(['destructive', 'read-only']),
  }).strict()).min(1).refine(roles => new Set(roles.map(role => role.name)).size === roles.length, 'duplicate role destinations'),
  hooks: z.array(z.object({ id: ID, kind: z.enum(['destructive', 'read-only']) }).strict())
    .refine(hooks => new Set(hooks.map(hook => hook.id)).size === hooks.length, 'duplicate hook identifiers'),
  requiredSupport: z.array(REL.refine(value => /^(references|examples|assets|scripts)\//.test(value) && !value.split('/').includes('evals'), 'invalid required support'))
    .refine(values => new Set(values).size === values.length, 'duplicate support paths'),
  references: z.array(z.object({ source: REL, installed: REL }).strict()),
  requiredInstalled: z.array(REL.refine(value => value.startsWith('.claude/'), 'expected a Claude delivery edge')),
  reviewedInputs: z.array(z.string().min(1)).min(1),
  }).strict();
  const shape = receipt ? base.extend({ _agentsUnitedManaged: z.literal('managed-by: agents-united | profile: claude-native'), sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/) }) : base;
  return entry.skill === 'coordinate-artifact'
    ? shape.extend({ skill: z.literal('coordinate-artifact'), requiredRoles: z.tuple([z.literal('factory-realizer'), z.literal('factory-evaluator'), z.literal('factory-sync')]) }).strict()
    : shape.extend({ skill: z.literal(entry.skill) }).strict();
};

export function parseClaudeFactoryBinding(raw: unknown, entry: FactoryEntry, receipt = false): ClaudeFactoryBinding {
  const result = declaration(entry, receipt).safeParse(raw);
  if (!result.success) return fail(`invalid binding declaration: ${result.error.message}`);
  if (entry.skill === 'evaluate-artifact' && !isDeepStrictEqual(result.data.roles, [{
    name: 'factory-evaluator', definition: 'subagent-factory-evaluator',
    contract: 'core/subagent-factory-evaluator.contract.json',
    source: 'hosts/claude/agents/factory-evaluator.md', installed: '.claude/agents/factory-evaluator.md',
    loading: 'subagent', skills: ['evaluate-artifact'], guard: 'read-only',
  }])) fail('required evaluator role binding must deliver factory-evaluator with its reviewed definition, preload and read-only worker mechanism');
  if (entry.skill === 'sync-host' && !isDeepStrictEqual(result.data.roles, [{
    name: 'factory-sync', definition: 'subagent-host-update-sync',
    contract: 'core/subagent-host-update-sync.contract.json',
    source: 'hosts/claude/agents/factory-sync.md', installed: '.claude/agents/factory-sync.md',
    loading: 'subagent', skills: ['sync-host'], guard: 'read-only',
  }])) fail('required sync role binding must deliver factory-sync with its reviewed definition, preload and read-only worker mechanism');
  if (entry.skill === 'coordinate-artifact') {
    if (!isDeepStrictEqual(result.data.roles, [COORDINATOR_ROLE])) fail('coordinate-artifact requires its exact main role, preload and destructive guard');
    if (!isDeepStrictEqual(result.data.hooks, [{ id: 'reject-destructive-operations', kind: 'destructive' }])) fail('coordinate-artifact requires its exact existing guard mapping');
    if (!isDeepStrictEqual([...result.data.requiredSupport].sort(), [...COORDINATOR_SUPPORT].sort())) fail('coordinate-artifact required support differs from its reviewed closure');
    const references = COORDINATOR_RULES.map(name => ({ source: `rules/${name}`, installed: `${entry.root}/references/rules/${name}` }));
    if (!isDeepStrictEqual(result.data.references, references)) fail('coordinate-artifact required policy references differ');
    if (!isDeepStrictEqual([...result.data.requiredInstalled].sort(), [...COORDINATOR_INSTALLED].sort())) fail('coordinate-artifact required worker delivery edges differ');
  }
  for (const role of result.data.roles) {
    if (role.source !== `hosts/claude/agents/${role.name}.md` || role.installed !== `.claude/agents/${role.name}.md`
      || role.contract !== `core/${role.definition}.contract.json`) fail(`invalid role binding paths for ${role.name}`);
  }
  for (const ref of result.data.references) {
    if (!/^rules\/[a-z0-9-]+\.md$/.test(ref.source) || !ref.installed.startsWith(`${entry.root}/references/`)) fail('invalid rule reference binding');
  }
  return result.data;
}

export function assertClaudeFactoryWorkerBinding(worker: ClaudeFactoryBinding, dependency: FactoryEntry, name: string): void {
      const bySkill = factoryWorkerBySkill(dependency.skill);
      const expectedSupport = COORDINATOR_WORKER_SUPPORT[dependency.skill as keyof typeof COORDINATOR_WORKER_SUPPORT];
      const expectedReferences = COORDINATOR_RULES.map(rule => ({ source: `rules/${rule}`, installed: `${dependency.root}/references/rules/${rule}` }));
      const expectedInstalled = bySkill.requiredInstalled;
      const expectedHooks = bySkill.hooks;
      if (!expectedSupport || !isDeepStrictEqual([...worker.requiredSupport].sort(), [...expectedSupport].sort())
        || !isDeepStrictEqual(worker.references, expectedReferences) || !isDeepStrictEqual(worker.requiredInstalled, expectedInstalled)
        || !isDeepStrictEqual(worker.hooks, expectedHooks)) fail(`coordinate-artifact worker ${name} required closure differs`);

      const { definition: expectedDefinition, guard: expectedGuard } = factoryWorkerByRole(name);
      if (!isDeepStrictEqual(worker.roles, [{ name, definition: expectedDefinition, contract: `core/${expectedDefinition}.contract.json`,
        source: `hosts/claude/agents/${name}.md`, installed: `.claude/agents/${name}.md`, loading: 'subagent', skills: [dependency.skill], guard: expectedGuard }])) fail(`coordinate-artifact required worker ${name} binding differs`);
      // The worker found by Skill and the one found by role name must be one table row.
      if (bySkill !== factoryWorkerByRole(name)) fail(`coordinate-artifact worker ${name} does not belong to skill ${dependency.skill}`);
}

/** Validate the one exact reviewed main-only scope before comparing its base class. */
export function normalizeClaudeFactoryCoordinatorTools(tools: readonly string[]): string[] {
  const delegates = tools.filter(tool => /^Agent(?:\b|\()/.test(tool));
  const match = delegates.length === 1 ? /^Agent\(([^()]*)\)$/.exec(delegates[0]!) : null;
  const names = match?.[1]?.split(',').map(name => name.trim());
  if (!names || !isDeepStrictEqual([...names].sort(), ['factory-evaluator', 'factory-realizer', 'factory-sync'])) fail('coordinate-artifact requires exactly Agent(factory-realizer, factory-evaluator, factory-sync) without a bare, duplicate, missing or additional delegate');
  return tools.map(tool => tool === delegates[0] ? 'Agent' : tool);
}


export function assertClaudeFactoryLoader(binding: ClaudeFactoryBinding, entry: FactoryEntry, skillText: string, fixedWorker = false): void {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skillText);
  let skillMeta: unknown;
  try { skillMeta = match ? YAML.parse(match[1]!) as unknown : undefined; }
  catch { fail('invalid native runbook frontmatter'); }
  const skillLoader = z.object({ name: z.literal(binding.skill), 'user-invocable': z.literal(false), 'disable-model-invocation': z.literal(false).optional(), context: z.never().optional() }).passthrough();
  if (!skillLoader.safeParse(skillMeta).success) fail('native runbook must be model-invocable, non-fork guidance for its required preload');
  if (fixedWorker || entry.skill === 'evaluate-artifact' || entry.skill === 'sync-host' || entry.skill === 'coordinate-artifact') {
    const evaluatorLoader = z.object({
      name: z.literal(entry.skill), description: z.string().min(1), 'user-invocable': z.literal(false),
      'disable-model-invocation': z.literal(false).optional(), license: z.string().optional(), compatibility: z.string().optional(),
      when_to_use: z.string().optional(), metadata: z.record(z.string(), z.unknown()).optional(),
    }).strict();
    if (!evaluatorLoader.safeParse(skillMeta).success) fail(`${entry.skill} preload contains unsupported native mechanics or missing metadata`);
    if (/(?:^|\s)!`/.test(skillText) || /^\s*```!/m.test(skillText)) {
      const preload = entry.skill === 'evaluate-artifact' ? 'factory-evaluator (evaluate-artifact)'
        : entry.skill === 'sync-host' ? 'factory-sync (sync-host)' : entry.skill;
      fail(`${preload} preload dynamic shell injection is unavailable`);
    }
  }
  const declaredSupport = new Set([...binding.requiredSupport, 'assets/claude-binding.json',
    ...binding.references.map(ref => ref.installed.slice(entry.root.length + 1))]);
  for (const rel of skillText.match(/\b(?:references|examples|assets|scripts)\/[A-Za-z0-9_.\/-]+/g) ?? []) {
    if (!declaredSupport.has(rel)) fail(`runbook-referenced support ${rel} is absent from its required binding declaration`);
  }
  if (entry.skill === 'coordinate-artifact') {
    for (const rel of declaredSupport) if (!skillText.includes(rel)) fail(`coordinate-artifact preload omits required consultation ${rel}`);
  }
}

const mechanicsFail = (message: string): never => { throw new Error(`Claude factory critical mechanics: ${message}.`); };
/** The approved fixed grants, independent of source-policy availability at startup. */
export function assertClaudeFactoryRoleMechanics(text: string, name: string, skill: string, destructive: boolean): void {
  const facts = inspectNativeAgent(text);
  const shape = z.object({ name: z.literal(name), description: z.string().min(1), model: z.literal('inherit'),
    effort: z.literal('medium'), background: z.literal(false), tools: z.string().min(1),
    skills: z.tuple([z.literal(skill)]), hooks: z.unknown() }).strict();
  if (!shape.safeParse(facts.meta).success) mechanicsFail(name === 'orchestrator-agent-factory' ? 'coordinate-artifact main must retain its exact reviewed posture and preload' : `critical role posture or preload differs for ${name}`);
  const base = ['Glob', 'Grep', 'ListMcpResourcesTool', 'Read', 'ReadMcpResourceTool', 'ReportFindings'];
  const tools = name === 'orchestrator-agent-factory' ? normalizeClaudeFactoryCoordinatorTools(facts.tools) : facts.tools;
  const expected = name === 'orchestrator-agent-factory'
    ? [...base, 'Agent', 'AskUserQuestion', 'Bash', 'Edit', 'NotebookEdit', 'PowerShell', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite', 'Write']
    : [...base, ...factoryWorkerByRole(name).grant];
  if (!isDeepStrictEqual([...tools].sort(), expected.sort())) mechanicsFail(`critical tool grant differs for ${name}`);
  if (!isDeepStrictEqual(facts.meta.hooks, destructive ? nativeGuardFileHooks() : readOnlyGuardFileHooks())) mechanicsFail(`critical guard registration differs for ${name}`);
  // The caller's Skill and guard class must be the table's for a worker role; the coordinator main is not a table worker.
  if (name !== 'orchestrator-agent-factory') {
    const worker = factoryWorkerByRole(name);
    if (skill !== worker.skill || destructive !== (worker.guard === 'destructive')) mechanicsFail(`critical role binding differs for ${name}`);
  }
}

