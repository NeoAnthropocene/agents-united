/**
 * Plan 032 close-out follow-up (2), ADR 0036 — what a user of a native Tier-2 (organization) bundle on Claude Agent Teams must be told.
 * A teammate that reuses a subagent definition gets its tools, model and body, not its frontmatter hook or its permission mode
 * (observed on Claude Code 2.1.288: a teammate with `Write` granted and the read-only guard in its definition wrote a file with no hook
 * record, while a settings-level guard refused the same teammate's `git push --force` and `.env` write). So the guard a team really has
 * is the settings-level one, an opt-in merge into a user-owned file, and the install says so. Pure helpers: values in, text out.
 */
import type { BundleTier, InstallScope } from './types.js';

export interface TeamNoteInput {
  bundle: string;
  tier: BundleTier | undefined;
  nativeLane: boolean;
  /** The settings-level guard is installed. */
  sessionGuard: boolean;
}

/** The note printed after a native Tier-2 install; undefined for a Tier-1 bundle or an install without the native lane. */
export function nativeTeamNote(input: TeamNoteInput): string | undefined {
  if (!input.nativeLane || input.tier !== 'organization') return undefined;
  const guard = input.sessionGuard
    ? 'That guard is installed.'
    : `It is not installed: add it with agents update ${input.bundle} --session-guard.`;
  return (
    `${input.bundle} runs as an Agent Team: start it with agents start ${input.bundle} --host claude, which switches Agent Teams on for that session.\n` +
    'Teams are experimental and need an interactive session; without them the same roster runs through relays.\n' +
    "A role's own frontmatter hook does not reach a teammate (observed on Claude Code 2.1.288), so the team's shell and file writes\n" +
    `are guarded only by the settings-level guard. ${guard}`
  );
}

/** The consent question for the settings-level guard (default yes), with the teammate reason added for a native Tier-2 install. */
export function sessionGuardPrompt(input: { scope: InstallScope; tier: BundleTier | undefined; nativeLane: boolean }): { message: string; initialValue: true } {
  const where = input.scope === 'global' ? '~/.claude/settings.json' : '.claude/settings.json';
  if (input.nativeLane && input.tier === 'organization') {
    return {
      message:
        `Add the settings-level guard? It is the only guard a teammate of this agent team gets (a role's own hook does not reach a teammate): ` +
        `it blocks git push --force, .env writes and vercel --prod via ${where}.`,
      initialValue: true,
    };
  }
  return {
    message:
      input.scope === 'global'
        ? 'Also guard plain Claude sessions on this machine? (blocks git push --force, .env writes and vercel --prod in ~/.claude/settings.json)'
        : 'Also guard plain Claude sessions in this repo? (blocks git push --force, .env writes and vercel --prod via .claude/settings.json)',
    initialValue: true,
  };
}
