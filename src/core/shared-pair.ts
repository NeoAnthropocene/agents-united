/** Shared-only validation over the existing Semantic Core and Subagent Contract validators. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadSemanticCore, validateSubagentContract } from './semantic-core.js';
import { canonicalFloorProblems } from './native-repository-rules.js';
import type { SharedPairCheckInput, SharedPairCheckResult } from './types.js';

function requirePlainPath(file: string, kind: 'file' | 'directory'): void {
  for (let current = file; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Linked source path requires a location decision: ${current}.`);
    if (current === file && !(kind === 'file' ? stat.isFile() : stat.isDirectory())) throw new Error(`Expected source ${kind}: ${file}.`);
    if (current === path.dirname(current)) break;
  }
}

export async function checkSharedPair(input: SharedPairCheckInput): Promise<SharedPairCheckResult> {
  const result: SharedPairCheckResult = { valid: false, kind: 'deterministic', definition: typeof input.definition === 'string' ? input.definition : '', files: [], findings: [], delivery: 'unverified', quality: 'pending', live: 'unverified' };
  try {
    if (typeof input.registryDir !== 'string' || !path.isAbsolute(input.registryDir)) throw new Error('Source registry must be an absolute path.');
    if (input.registryDir.split(/[\\/]/).some(part => part === '.' || part === '..')) throw new Error('Source registry must not contain traversal aliases.');
    if (typeof input.definition !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.definition)) throw new Error('Definition must be a semantic identifier.');
    const registry = path.resolve(input.registryDir);
    requirePlainPath(registry, 'directory');
    const coreFile = path.join(registry, 'core', `${input.definition}.core.md`);
    const contractFile = path.join(registry, 'core', `${input.definition}.contract.json`);
    for (const file of [coreFile, contractFile]) requirePlainPath(file, 'file');
    for (const name of fs.readdirSync(path.join(registry, 'core')).filter(name => name.endsWith('.core.md'))) {
      requirePlainPath(path.join(registry, 'core', name), 'file');
    }
    result.files = [coreFile, contractFile].map(file => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
    const cores = await loadSemanticCore(registry);
    const contract = validateSubagentContract(JSON.parse(fs.readFileSync(contractFile, 'utf8')) as unknown, cores);
    if (contract.definition !== input.definition) throw new Error('Companion contract definition does not match the requested definition.');
    result.valid = true;
    if (input.canonicalFile !== undefined) {
      if (!fs.existsSync(input.canonicalFile) || !fs.statSync(input.canonicalFile).isFile()) throw new Error(`Missing canonical agent ${input.canonicalFile}.`);
      const problems = canonicalFloorProblems(cores.get(input.definition)!, fs.readFileSync(input.canonicalFile, 'utf8'));
      if (problems.length > 0) { result.valid = false; result.findings.push(...problems); }
    }
  } catch (error) {
    result.valid = false;
    result.findings.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}
