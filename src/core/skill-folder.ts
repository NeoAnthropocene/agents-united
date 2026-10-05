/**
 * Folders directly under a registry skill that belong to the maintainers and are never installed (Plan 035). `evals/` holds the
 * prompts a skill is tried with; a user's agent has no use for them. Only a folder at the top of the skill counts:
 * `references/evals/` is an ordinary folder and ships.
 */
export const MAINTAINER_ONLY_SKILL_DIRS: readonly string[] = ['evals'];

/**
 * Whether a path inside a skill folder is one that no install lane copies. `rel` is relative to the skill folder and may use either
 * separator. The skill folder itself (an empty path) is never maintainer-only, so a copy filter keeps the root.
 */
export function isMaintainerOnlySkillPath(rel: string): boolean {
  const first = rel.split(/[\\/]/).find(segment => segment !== '' && segment !== '.');
  return first !== undefined && MAINTAINER_ONLY_SKILL_DIRS.includes(first);
}
