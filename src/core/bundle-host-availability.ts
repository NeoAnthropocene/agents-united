import type { BundleDefinition, BundleHostAvailability, InstallScope } from './types.js';
import { isKnownHost } from './hosts.js';

/** Manifest keys are host identities, rather than installation directory aliases. */
export function normalizeAvailabilityHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  return normalized === 'agents' || normalized === 'gemini' ? 'antigravity' : normalized;
}

export function validateBundleHostAvailability(bundle: BundleDefinition): void {
  const value: unknown = bundle.hostAvailability;
  if (value === undefined) return;
  const fail = (): never => { throw new Error(`Registry validation error: bundle "${bundle.name}" hostAvailability must allow named hosts with lane "native" and nonempty scopes (workspace/global).`); };
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) fail();
  for (const [host, realization] of Object.entries(value as Record<string, unknown>)) {
    if (host !== 'antigravity' && (!isKnownHost(host) || normalizeAvailabilityHost(host) !== host)) fail();
    if (!realization || typeof realization !== 'object' || Array.isArray(realization)) fail();
    const entry = realization as Record<string, unknown>;
    if (entry.lane !== 'native' || !Array.isArray(entry.scopes) || entry.scopes.length === 0
      || entry.scopes.some(scope => scope !== 'workspace' && scope !== 'global')
      || new Set(entry.scopes).size !== entry.scopes.length
      || Object.keys(entry).some(key => key !== 'lane' && key !== 'scopes')) fail();
  }
}

export function assertBundleHostAvailability(
  bundle: BundleDefinition,
  targets: readonly string[],
  scope: InstallScope,
  nativeLane: (host: string) => boolean,
): void {
  if (!bundle.hostAvailability) return;
  const available = Object.entries(bundle.hostAvailability)
    .map(([host, entry]) => `${host} ${entry.lane} (${entry.scopes.join(', ')})`).join('; ');
  for (const requested of targets.length > 0 ? targets : ['no host']) {
    const host = normalizeAvailabilityHost(requested);
    const entry = bundle.hostAvailability[host as keyof BundleHostAvailability];
    const requiredScope = scope === 'project' ? 'workspace' : 'global';
    if (!entry || !nativeLane(host) || !entry.scopes.includes(requiredScope)) {
      throw new Error(`Bundle "${bundle.name}" is unavailable for ${requested} in ${requiredScope} scope with ${nativeLane(host) ? 'native' : 'legacy'} lane. Available: ${available}. --force and --allow-under-construction cannot bypass hostAvailability.`);
    }
  }
}
