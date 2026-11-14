/** Explicit native-only factory registrations, separate from the legacy role lane. */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import crypto from 'node:crypto';
import type { BundleDefinition, ClaudeFactoryBinding, InstallScope, LockfileManifest, ResolvedAssets } from './types.js';
import { assetOwners } from './types.js';
import type { PlannedClaudeArtifact } from './claude-projector.js';
import { nativeWorkflowSource, renderNativeRole, renderNativeRule } from './native-package.js';
import { loadSemanticCore, validateSubagentContract } from './semantic-core.js';
import { GUARD_SCRIPT, NATIVE_GUARD_FILES, nativeGuardFileHooks } from './guard.js';
import { READ_ONLY_GUARD_SCRIPT, readOnlyGuardFileHooks } from './readonly-guard.js';
import { checkFloor } from './native-floor.js';
import { inspectNativeAgent } from './native-guard.js';
import { loadHostProfile, loadToolPolicy, resolveGrant } from './host-profile.js';
import { hasClaudeContractTaskReceipt } from './claude-contract-binding.js';
import { FACTORY_BINDINGS, type FactoryEntry, parseClaudeFactoryBinding, assertClaudeFactoryWorkerBinding, assertClaudeFactoryLoader, assertClaudeFactoryRoleMechanics, normalizeClaudeFactoryCoordinatorTools } from './claude-factory-declaration.js';
export { normalizeClaudeFactoryCoordinatorTools } from './claude-factory-declaration.js';

function fail(message: string): never { throw new Error(`Claude factory binding: ${message}.`); }
const activeBindings = (resolved: ResolvedAssets): readonly FactoryEntry[] => FACTORY_BINDINGS.filter(entry => resolved.skills.includes(entry.skill));

function requiredFile(root: string, rel: string): string {
  const file = path.resolve(root, rel);
  const relative = path.relative(path.resolve(root), file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Claude factory binding: required path escapes its source root: ${rel}.`);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Claude factory binding: missing required file ${rel}.`);
  for (let current = file; current !== path.resolve(root); current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Claude factory binding: linked required file ${rel}.`);
  }
  return file;
}

function readBinding(registryDir: string, entry: FactoryEntry): ClaudeFactoryBinding {
  if (entry.skill === 'coordinate-artifact' && !fs.existsSync(path.join(registryDir, entry.file))) fail('coordinate-artifact missing required coordinator binding declaration');
  const file = requiredFile(registryDir, entry.file);
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown; }
  catch { return fail('invalid binding JSON'); }
  return parseClaudeFactoryBinding(raw, entry);
}

export async function planClaudeFactoryArtifacts(
  bundle: BundleDefinition, resolved: ResolvedAssets, registryDir: string,
  scope: InstallScope, nativeLane: boolean,
): Promise<PlannedClaudeArtifact[]> {
  const artifacts: PlannedClaudeArtifact[] = [];
  for (const entry of activeBindings(resolved)) artifacts.push(...await planFactoryEntry(entry, bundle, resolved, registryDir, scope, nativeLane));
  return artifacts;
}

async function planFactoryEntry(
  entry: FactoryEntry, bundle: BundleDefinition, resolved: ResolvedAssets, registryDir: string,
  scope: InstallScope, nativeLane: boolean,
): Promise<PlannedClaudeArtifact[]> {
  if (bundle.name !== 'agent-factory' || scope === 'global' || !nativeLane) {
    throw new Error('Claude factory realization requires its owning agent-factory bundle in the workspace native lane.');
  }
  const binding = readBinding(registryDir, entry);
  if (binding.skill === 'coordinate-artifact') {
    for (const [index, name] of binding.requiredRoles.entries()) {
      const dependency = FACTORY_BINDINGS[index]!;
      if (!resolved.skills.includes(dependency.skill)) fail(`coordinate-artifact requires worker ${name} and task ${dependency.skill}`);
      const worker = readBinding(registryDir, dependency);
      assertClaudeFactoryWorkerBinding(worker, dependency, name);
    }
  }
  const skillText = fs.readFileSync(requiredFile(registryDir, binding.source), 'utf8');
  assertClaudeFactoryLoader(binding, entry, skillText, resolved.skills.includes('coordinate-artifact'));
  if (nativeWorkflowSource(registryDir, 'claude', binding.skill)) fail('native workflow would shadow the required runbook');
  requiredFile(registryDir, `skills/${binding.skill}/SKILL.md`);
  for (const rel of binding.requiredSupport) requiredFile(registryDir, `skills/${binding.skill}/${rel}`);
  for (const ref of binding.references) requiredFile(registryDir, ref.source);
  for (const hook of binding.hooks) {
    const file = requiredFile(registryDir, `hosts/claude/hooks/${NATIVE_GUARD_FILES[hook.kind].name}.js`);
    const expected = hook.kind === 'destructive' ? GUARD_SCRIPT : READ_ONLY_GUARD_SCRIPT;
    if (fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd() !== expected.trimEnd()) fail(`required guard ${hook.id} differs from its reviewed script`);
  }
  const cores = await loadSemanticCore(registryDir);
  const policy = loadToolPolicy(registryDir, 'claude');
  const profile = loadHostProfile(registryDir, 'claude');
  for (const role of binding.roles) {
    requiredFile(registryDir, `core/${role.definition}.core.md`);
    const contractFile = requiredFile(registryDir, role.contract);
    const contract = validateSubagentContract(JSON.parse(fs.readFileSync(contractFile, 'utf8')) as unknown, cores);
    if (contract.definition !== role.definition) fail(`role ${role.name} definition does not match its contract`);
    for (const id of contract.skills) if (!role.skills.includes(id) || !resolved.skills.includes(id)) fail(`unbound skill ${id} for ${role.name}`);
    for (const id of contract.hooks) if (!binding.hooks.some(hook => hook.id === id && hook.kind === role.guard)) fail(`unbound hook ${id} for ${role.name}`);
    if (!binding.hooks.some(hook => hook.kind === role.guard && contract.hooks.includes(hook.id))) fail(`guard ${role.guard} is not permitted by the contract for ${role.name}`);
    if (contract.workflows.length) fail(`unavailable workflow ${contract.workflows.join(', ')} for ${role.name}`);
    const text = fs.readFileSync(requiredFile(registryDir, role.source), 'utf8');
    const facts = inspectNativeAgent(text);
    if (facts.meta.name !== role.name) fail(`native role name must be ${role.name}`);
    if (typeof facts.meta.description !== 'string' || !facts.meta.description.trim()) fail(`required description missing for ${role.name}`);
    for (const key of Object.keys(facts.meta)) if (!profile.artifacts.agent.allowedKeys.includes(key)) fail(`unknown native key ${key} for ${role.name}`);
    if (facts.meta.disallowedTools !== undefined) fail(`native deny overlay changes the required grant for ${role.name}`);
    if (role.loading === 'subagent' && (facts.meta.permissionMode !== undefined || facts.meta.memory !== undefined || facts.meta.mcpServers !== undefined)) {
      fail(`permission, memory or server override is unavailable for worker ${role.name}`);
    }
    if (role.loading === 'subagent' && facts.meta.background !== false) fail(`role ${role.name} must select foreground background: false`);
    if (role.loading === 'subagent' && (facts.meta.model !== 'inherit' || facts.meta.effort !== 'medium')) fail(`worker ${role.name} must retain the reviewed inherited model and medium effort`);
    const preloaded = Array.isArray(facts.meta.skills) ? facts.meta.skills as unknown[] : [];
    if (!isDeepStrictEqual([...preloaded].sort(), [...role.skills].sort())) fail(`required preload mismatch for ${role.name}`);
    for (const skill of role.skills) if (!contract.skills.includes(skill)) fail(`unbound preload ${skill} for ${role.name}`);
    const core = cores.get(role.definition)!;
    if (entry.skill === 'realize-artifact' && resolved.skills.includes('coordinate-artifact')
      && !isDeepStrictEqual([...(core.capabilities ?? [])].sort(), ['edit', 'handback', 'read', 'report', 'search', 'shell', 'skill'])) fail('coordinate-artifact worker realizer capabilities differ');
    if (entry.skill === 'evaluate-artifact' && !isDeepStrictEqual([...(core.capabilities ?? [])].sort(), ['handback', 'read', 'report', 'search'])) {
      fail('evaluator capabilities must retain exactly the reviewed read/search/report/handback classes');
    }
    const floorProblems = checkFloor(text, core);
    if (floorProblems.length) fail(`floor mismatch for ${role.name}: ${floorProblems.join('; ')}`);
    let realization = facts.tools;
    if (entry.skill === 'coordinate-artifact') {
      if (!isDeepStrictEqual([...(core.capabilities ?? [])].sort(), ['ask-user', 'delegate', 'edit', 'read', 'report', 'search', 'shell', 'task-tracking'])) fail('coordinate-artifact main capability classes differ');
      realization = normalizeClaudeFactoryCoordinatorTools(facts.tools);
    }
    const granted = resolveGrant(policy, core.capabilities ?? [], { subagent: role.loading === 'subagent', background: false }).tools;
    if (!isDeepStrictEqual([...realization].sort(), [...granted].sort())) fail(`grant mismatch for ${role.name}`);
    const hooks = role.guard === 'destructive' ? nativeGuardFileHooks() : readOnlyGuardFileHooks();
    if (!isDeepStrictEqual(facts.meta.hooks, hooks)) fail(`required guard registration mismatch for ${role.name}`);
    if (resolved.skills.includes('coordinate-artifact')) assertClaudeFactoryRoleMechanics(text, role.name, binding.skill, role.guard === 'destructive');
  }
  const artifacts: PlannedClaudeArtifact[] = binding.roles.map(role => ({
    kind: 'role', relPath: role.installed,
    content: renderNativeRole(fs.readFileSync(requiredFile(registryDir, role.source), 'utf8'), role.source, 'claude'),
    managedMarker: true, ownedByBundle: true,
  }));
  for (const ref of binding.references) artifacts.push({
    kind: 'rule', relPath: ref.installed, ownedByBundle: true, managedMarker: true,
    content: renderNativeRule(fs.readFileSync(requiredFile(registryDir, ref.source), 'utf8'), ref.source, 'claude'),
  });
  artifacts.push({
    kind: 'skill', relPath: `${entry.root}/assets/claude-binding.json`, ownedByBundle: true, managedMarker: true,
    content: JSON.stringify({
      ...binding, _agentsUnitedManaged: 'managed-by: agents-united | profile: claude-native',
      sourceHash: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(requiredFile(registryDir, entry.file))).digest('hex')}`,
    }, null, 2) + '\n',
  });
  return artifacts;
}

/** Required edges resolve against the combined projection plan, before state writes. */
export function assertClaudeFactoryDelivery(resolved: ResolvedAssets, registryDir: string, artifacts: readonly PlannedClaudeArtifact[]): void {
  const entries = activeBindings(resolved);
  if (!entries.length) return;
  const expected = entries.flatMap(entry => {
    const binding = readBinding(registryDir, entry);
    if (entry.skill === 'coordinate-artifact') {
      const own = new Set([binding.installed, ...binding.requiredSupport.map(rel => `${entry.root}/${rel}`), ...binding.references.map(ref => ref.installed), `${entry.root}/assets/claude-binding.json`]);
      for (const artifact of artifacts) if (artifact.relPath.startsWith(`${entry.root}/`) && !own.has(artifact.relPath)) fail(`coordinate-artifact unreviewed support in delivery plan: ${artifact.relPath}`);
    }
    return [binding.installed, ...binding.roles.map(role => role.installed),
      ...binding.requiredSupport.map(rel => `${entry.root}/${rel}`), ...binding.references.map(ref => ref.installed),
      ...binding.requiredInstalled, ...binding.roles.map(role => NATIVE_GUARD_FILES[role.guard].rel), `${entry.root}/assets/claude-binding.json`];
  });
  const counts = new Map<string, number>();
  for (const artifact of artifacts) counts.set(artifact.relPath, (counts.get(artifact.relPath) ?? 0) + 1);
  for (const [rel, count] of counts) if (count !== 1) fail(`duplicate planned delivery destination ${rel}`);
  for (const rel of expected) if (counts.get(rel) !== 1) fail(`missing required planned delivery edge ${rel}`);
}

/** Preserve user files before the ordinary installer can write canonical/state files. */
export function assertClaudeFactoryTargets(
  resolved: ResolvedAssets, registryDir: string, workspaceRoot: string,
  lock: Partial<LockfileManifest>, force: boolean,
): void {
  const entries = activeBindings(resolved);
  if (!entries.length) return;
  const targets = new Set(entries.flatMap(entry => {
    const binding = readBinding(registryDir, entry);
    return [...binding.roles.map(role => role.installed), ...binding.roles.map(role => NATIVE_GUARD_FILES[role.guard].rel),
      binding.installed, ...binding.requiredSupport.map(rel => `${entry.root}/${rel}`),
      ...binding.references.map(ref => ref.installed), ...binding.requiredInstalled, `${entry.root}/assets/claude-binding.json`];
  }));
  const root = path.resolve(workspaceRoot);
  for (const rel of targets) {
    const file = path.resolve(root, rel);
    for (let current = file; current !== root; current = path.dirname(current)) {
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail(`linked delivery destination ${rel}`);
    }
    if (!fs.existsSync(file)) continue;
    if (!fs.statSync(file).isFile()) fail(`delivery collision at ${rel}`);
    const record = lock.projections?.[rel];
    if (!record) fail(`unmanaged delivery collision at ${rel}; preserve the file and select a different role or remove the conflict explicitly`);
    const hash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
    if (hash !== record.hash && !force) fail(`user-modified delivery ${rel}; review its diff before explicit --force replacement`);
  }
}

/** Removal depends on installed records, so a missing source binding cannot strand it. */
export function assertClaudeFactoryRemoval(workspaceRoot: string, stateDir: string, lock: LockfileManifest, force: boolean): void {
  const projections = lock.projections;
  if (!projections || (!FACTORY_BINDINGS.some(entry => projections[`${entry.root}/assets/claude-binding.json`])
    && !hasClaudeContractTaskReceipt(lock))) return;
  const check = (root: string, rel: string, recordedHash: string): void => {
    const base = path.resolve(root);
    const file = path.resolve(base, rel);
    const relative = path.relative(base, file);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`removal path escapes its recorded root: ${rel}`);
    for (let current = file; current !== base; current = path.dirname(current)) {
      if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`linked removal destination ${rel}`);
    }
    if (!fs.existsSync(file)) return;
    if (!fs.statSync(file).isFile()) fail(`removal collision at ${rel}`);
    const actualHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
    if (actualHash !== recordedHash && !force) fail(`user-modified delivery ${rel}; review its diff before explicit --force removal`);
  };
  for (const [rel, record] of Object.entries(projections)) {
    const canonical = record.canonical ?? '';
    const source = lock.files[canonical] ?? lock.files[canonical.replace(/^\.agents\//, '')];
    const owners = new Set([...(record.owners ?? []), ...assetOwners(source)]);
    if (owners.has('agent-factory') && owners.size === 1) check(workspaceRoot, rel, record.hash);
  }
  for (const [rel, record] of Object.entries(lock.files)) {
    const owners = assetOwners(record);
    if (owners.includes('agent-factory') && owners.length === 1 && record.method !== 'symlink') check(stateDir, rel, record.hash);
  }
}
