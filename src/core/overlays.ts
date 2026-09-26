/**
 * Plan 017 decision 3 declarative overlays — shared validation (leaf module; consumed by
 * the catalog validator in dialects and by renderRole's overlay application without an
 * import cycle). Rule: overlay hosts must be the spec's own host; overlay fields must be
 * keep/map fields; enum-ish values must sit in the host vocabulary. Fail-fast throws.
 */
export const OVERLAY_FIELD_VOCAB: Record<string, readonly string[]> = {
  permissionMode: ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'delegate'],
  model: ['opus', 'sonnet', 'haiku', 'inherit'],
  effort: ['low', 'medium', 'high', 'inherit'],
};

/**
 * The Claude field policy (keep/map/drop) — ONE map shared by `HOST_DIALECTS.claude.fields`
 * (catalog validation) and renderRole's overlay application (render validation).
 */
export const CLAUDE_FIELD_POLICY: Record<string, 'keep' | 'map' | 'drop'> = {
  name: 'keep',
  description: 'keep',
  model: 'map',
  tools: 'map',
  permissionMode: 'map',
  effort: 'map',
  skills: 'map',
  projections: 'map',
  version: 'drop',
  type: 'drop',
  commandExecutionPolicy: 'drop',
  mainAgent: 'drop',
  subagent: 'drop',
  hooks: 'drop',
  mcpServers: 'drop',
  rules: 'drop',
  inheritCustomizations: 'drop',
};

interface OverlaySpecLike {
  id: string;
  fields: Record<string, 'keep' | 'map' | 'drop'>;
}

export function validateProjectionOverlays(projections: unknown, spec: OverlaySpecLike): void {
  if (projections === undefined || projections === null) return;
  if (typeof projections !== 'object' || Array.isArray(projections)) {
    throw new Error('Projection overlay validation failed: projections must be an object.');
  }
  for (const [host, overlay] of Object.entries(projections as Record<string, unknown>)) {
    if (host !== spec.id) {
      throw new Error(`Projection overlay validation failed: unknown overlay host "${host}".`);
    }
    if (overlay === null || typeof overlay !== 'object' || Array.isArray(overlay)) {
      throw new Error(`Projection overlay validation failed: overlay for "${host}" must be an object.`);
    }
    for (const [field, value] of Object.entries(overlay as Record<string, unknown>)) {
      const policy = spec.fields[field];
      if (policy === undefined) {
        throw new Error(`Projection overlay validation failed: unknown overlay field "${field}".`);
      }
      if (policy === 'drop') {
        throw new Error(
          `Projection overlay validation failed: "${field}" is unsupported on host "${host}" and must never be introduced by an overlay.`,
        );
      }
      const vocab = OVERLAY_FIELD_VOCAB[field];
      if (vocab && (typeof value !== 'string' || !vocab.includes(value))) {
        throw new Error(
          `Projection overlay validation failed: invalid value "${String(value)}" for "${field}" (allowed: ${vocab.join(', ')}).`,
        );
      }
    }
  }
}