/**
 * Plan 032 Phases 3 + 5 / ADR 0025 decisions 1, 4, 8 — the per-host profile
 * (`registry/hosts/<host>/profile.json`) and the class-based tool policy
 * (`registry/hosts/<host>/tool-policy.json`). Pure data + validation: no I/O beyond reading the two
 * committed files, no terminal output (clean-architecture rule 2), and no probing of the installed
 * host (ADR 0021 decision 8: profiles are data, never detected at run time).
 *
 * Both files are fail-fast, in the style of `validateHostDialectSpec`: a malformed committed file
 * rejects at load with a message naming the field.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CAPABILITY_CLASSES, CLASS_DEFINITIONS, isCapabilityClass } from './capability-classes.js';
import type {
  CapabilityClass,
  HostProfile,
  ToolCatalogEntry,
  ToolGrant,
  ToolPolicy,
} from './types.js';

export { CAPABILITY_CLASSES } from './capability-classes.js';

const SEMVER = /^\d+\.\d+\.\d+$/;

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const where = issue.path.join('.') || '(root)';
      const extra = issue.code === 'unrecognized_keys' ? ` ${issue.keys.join(', ')}` : '';
      return `${where}: ${issue.message}${extra}`;
    })
    .join('; ');
}

/** A list of unique non-empty strings; non-empty unless the host genuinely has none (`allowEmpty`). */
const uniqueList = (label: string, allowEmpty = false): z.ZodType<string[]> =>
  (allowEmpty ? z.array(z.string().min(1)) : z.array(z.string().min(1)).min(1, `${label} must be non-empty`)).superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item)) ctx.addIssue({ code: 'custom', message: `${label}: duplicate entry "${item}"` });
      seen.add(item);
    }
  });

/** A skill the host does not install (Plan 036 S1b): a slug, the date it was left out, and a reason that says what it relies on. */
const UnsupportedSkillSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'name must be a skill slug (lowercase letters, digits and hyphens)'),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'since must be a YYYY-MM-DD date'),
    rationale: z.string().min(20, 'rationale must say why the host cannot use the skill'),
  })
  .strict();

const ProfileSchema = z
  .object({
    host: z.string().regex(/^[a-z0-9-]+$/, 'host must be a lowercase slug'),
    profileId: z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/, 'profileId must look like claude@2.1.285'),
    version: z.string().regex(SEMVER, 'version must be a semver string'),
    minVersion: z.string().regex(SEMVER, 'minVersion must be a semver string'),
    reviewedAgainst: z.string().regex(SEMVER, 'reviewedAgainst must be a semver string'),
    reviewedSection: z.string().min(1).optional(),
    library: z.string().min(1, 'library must point at host-library/<host>'),
    toolPolicy: z.string().min(1),
    legacyProfile: z.string().min(1).optional(),
    semantics: z.string().optional(),
    artifacts: z
      .object({
        agent: z.object({ path: z.string().min(1), requiredKeys: uniqueList('artifacts.agent.requiredKeys'), allowedKeys: uniqueList('artifacts.agent.allowedKeys') }).strict(),
        skill: z.object({ path: z.string().min(1), allowedKeys: uniqueList('artifacts.skill.allowedKeys'), portableKeys: uniqueList('artifacts.skill.portableKeys') }).strict(),
        hook: z.object({ events: uniqueList('artifacts.hook.events'), handlerTypes: uniqueList('artifacts.hook.handlerTypes'), registerAt: uniqueList('artifacts.hook.registerAt') }).strict(),
        plugin: z
          .object({
            manifestKeys: uniqueList('artifacts.plugin.manifestKeys'),
            ignoredAgentKeys: uniqueList('artifacts.plugin.ignoredAgentKeys', true),
            layout: z.record(z.string().min(1)),
          })
          .strict(),
        mcp: z.object({ scopes: uniqueList('artifacts.mcp.scopes'), transports: uniqueList('artifacts.mcp.transports') }).strict(),
        permissions: z.object({ modes: uniqueList('artifacts.permissions.modes') }).strict(),
      })
      .strict(),
    features: z.record(z.object({ status: z.string().min(1), note: z.string().min(1), since: z.string().regex(/^\d+\.\d+\.\d+$/, 'since must be a x.y.z version').optional() }).strict()),
    unsupportedSkills: z
      .array(UnsupportedSkillSchema)
      .superRefine((items, ctx) => {
        const seen = new Set<string>();
        for (const item of items) {
          if (seen.has(item.name)) ctx.addIssue({ code: 'custom', message: `duplicate entry "${item.name}"` });
          seen.add(item.name);
        }
      })
      .optional(),
  })
  .strict();

/** Throws on a malformed profile; also enforces that the key subsets are real subsets. */
export function validateHostProfile(raw: unknown, where = 'profile.json'): HostProfile {
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Host profile invalid (${where}): ${describeIssues(parsed.error)}.`);
  const profile = parsed.data as HostProfile;
  const { agent, skill } = profile.artifacts;
  for (const key of agent.requiredKeys) {
    if (!agent.allowedKeys.includes(key)) throw new Error(`Host profile invalid (${where}): artifacts.agent.requiredKeys "${key}" is not an allowed key.`);
  }
  for (const key of skill.portableKeys) {
    if (!skill.allowedKeys.includes(key)) throw new Error(`Host profile invalid (${where}): artifacts.skill.portableKeys "${key}" is not an allowed key.`);
  }
  return profile;
}

const ConditionSchema = z
  .object({
    kind: z.enum(['platform', 'model', 'provider', 'version', 'setting', 'plan', 'surface', 'dependency']),
    detail: z.string().min(1),
    source: z
      .string()
      .regex(/^(pages|observations)\/[\w./-]+\.md(#[\w%-]+)?$/, 'source must be a host-library snapshot or observations path such as pages/tools/tools-reference.md#anchor')
      .refine(source => !source.split('#')[0].split('/').includes('..'), 'source must not climb out of the host library'),
  })
  .strict();

const CatalogEntrySchema = z
  .object({
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'tool name must be alphanumeric (underscores allowed)'),
    class: z.string().min(1),
    subagents: z.enum(['available', 'never', 'conditional']),
    backgroundSubagent: z.boolean(),
    mutating: z.boolean(),
    deprecated: z.boolean().optional(),
    conditions: z.array(ConditionSchema),
  })
  .strict();

const PolicySchema = z
  .object({
    host: z.string().regex(/^[a-z0-9-]+$/),
    profile: z.string().min(1),
    semantics: z.string().optional(),
    catalog: z.array(CatalogEntrySchema).min(1),
  })
  .strict();

/** Throws on a malformed policy; returns it with the per-class summary derived from the catalog. */
export function validateToolPolicy(raw: unknown, where = 'tool-policy.json'): ToolPolicy {
  const parsed = PolicySchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Tool policy invalid (${where}): ${describeIssues(parsed.error)}.`);
  const seen = new Set<string>();
  const catalog: ToolCatalogEntry[] = [];
  for (const entry of parsed.data.catalog) {
    if (seen.has(entry.name)) throw new Error(`Tool policy invalid (${where}): duplicate tool "${entry.name}".`);
    seen.add(entry.name);
    if (!isCapabilityClass(entry.class)) throw new Error(`Tool policy invalid (${where}): tool "${entry.name}" has unknown capability class "${entry.class}".`);
    if (CLASS_DEFINITIONS[entry.class].readOnly && entry.mutating) {
      throw new Error(`Tool policy invalid (${where}): read-only class "${entry.class}" contains mutating tool "${entry.name}".`);
    }
    catalog.push({ ...entry, class: entry.class });
  }
  const classes = Object.fromEntries(
    CAPABILITY_CLASSES.map(name => [
      name,
      { description: CLASS_DEFINITIONS[name].description, grantable: CLASS_DEFINITIONS[name].grantable, tools: catalog.filter(tool => tool.class === name).map(tool => tool.name) },
    ]),
  ) as ToolPolicy['classes'];
  return { host: parsed.data.host, profile: parsed.data.profile, semantics: parsed.data.semantics, catalog, classes };
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

export function loadHostProfile(registryDir: string, host: string): HostProfile {
  const file = path.join(registryDir, 'hosts', host, 'profile.json');
  return validateHostProfile(readJson(file), file);
}

/**
 * Plan 036 S1b: the skills a host's profile lists as not installed, by name. A registry with no profile for the host (a synthetic one, or
 * one of an older shape) lists none; a profile that is present but malformed rejects at load, like every committed profile.
 */
export function unsupportedSkillNames(registryDir: string, host: string): ReadonlySet<string> {
  if (!fs.existsSync(path.join(registryDir, 'hosts', host, 'profile.json'))) return new Set();
  return new Set((loadHostProfile(registryDir, host).unsupportedSkills ?? []).map(entry => entry.name));
}

export function loadToolPolicy(registryDir: string, host: string): ToolPolicy {
  const file = path.join(registryDir, 'hosts', host, 'tool-policy.json');
  return validateToolPolicy(readJson(file), file);
}

export interface GrantContext {
  /** The role runs as a subagent (Agent tool, teammate) rather than as the main thread. */
  subagent?: boolean;
  /** The subagent runs in the background (the default subagent mode). Ignored for the main thread. */
  background?: boolean;
}

/**
 * Resolves declared capability classes to the host's native tools, in catalog order, without
 * duplicates. Tools the host withholds from the given context are returned under `dropped` with
 * the reason, so a grant never silently over-promises (a subagent cannot hold `Workflow`).
 */
export function resolveGrant(policy: ToolPolicy, capabilities: readonly CapabilityClass[], context: GrantContext): ToolGrant {
  for (const capability of capabilities) {
    if (!isCapabilityClass(capability)) throw new Error(`Grant invalid: unknown capability class "${capability}".`);
    if (!CLASS_DEFINITIONS[capability].grantable) throw new Error(`Grant invalid: capability class "${capability}" is not grantable.`);
  }
  const wanted = new Set<string>(capabilities);
  const tools: string[] = [];
  const dropped: ToolGrant['dropped'] = [];
  for (const entry of policy.catalog) {
    if (!wanted.has(entry.class)) continue;
    if (entry.deprecated) {
      dropped.push({ tool: entry.name, reason: 'deprecated by the host' });
      continue;
    }
    if (context.subagent && entry.subagents === 'never') {
      dropped.push({ tool: entry.name, reason: 'never available to subagents' });
      continue;
    }
    if (context.subagent && context.background && !entry.backgroundSubagent) {
      dropped.push({ tool: entry.name, reason: 'not kept by background subagents' });
      continue;
    }
    tools.push(entry.name);
  }
  return { tools, dropped };
}

/** What class-derived grants would add to, and what a hand-written realization grants beyond, the classes. */
export function compareRealization(grant: ToolGrant, realizationTools: readonly string[]): { gains: string[]; extras: string[] } {
  const granted = new Set(grant.tools);
  const held = new Set(realizationTools);
  return {
    gains: grant.tools.filter(tool => !held.has(tool)),
    extras: realizationTools.filter(tool => !granted.has(tool)),
  };
}

export interface RoleGrantInput {
  role: string;
  capabilities: readonly CapabilityClass[];
  subagent: boolean;
  realizationTools: readonly string[];
}

export interface ToolPolicyReport {
  roles: Array<{ role: string; grant: ToolGrant; gains: string[]; extras: string[] }>;
  /** Catalog tools that no role's class-derived grant reaches. */
  unreachable: Array<{ tool: string; class: CapabilityClass }>;
  text: string;
}

/**
 * The efficiency report (Plan 032 Phase 5): per role, the tools its classes would add or that were
 * granted by hand outside them; overall, the catalog tools nothing reaches. When a host ships a new
 * tool it shows up here (and in the catalog-drift test) in the host-update PR.
 */
export function toolPolicyReport(policy: ToolPolicy, inputs: readonly RoleGrantInput[]): ToolPolicyReport {
  const roles = inputs.map(input => {
    const grant = resolveGrant(policy, input.capabilities, { subagent: input.subagent });
    return { role: input.role, grant, ...compareRealization(grant, input.realizationTools) };
  });
  const reached = new Set(roles.flatMap(role => role.grant.tools));
  const unreachable = policy.catalog.filter(tool => !reached.has(tool.name)).map(tool => ({ tool: tool.name, class: tool.class }));
  const lines: string[] = [`Tool policy report — ${policy.profile}`, ''];
  for (const role of roles) {
    lines.push(`${role.role}: ${role.grant.tools.length} tools by class`);
    if (role.gains.length > 0) lines.push(`  would add:    ${role.gains.join(', ')}`);
    if (role.extras.length > 0) lines.push(`  hand-granted: ${role.extras.join(', ')}`);
    if (role.grant.dropped.length > 0) lines.push(`  withheld:     ${role.grant.dropped.map(d => `${d.tool} (${d.reason})`).join(', ')}`);
  }
  lines.push('', `unreachable catalog tools (${unreachable.length}): ${unreachable.map(u => `${u.tool} [${u.class}]`).join(', ')}`);
  return { roles, unreachable, text: lines.join('\n') };
}
