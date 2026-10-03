/**
 * Plan 032 close-out — dynamic workflows are a Claude Code feature a user can turn off (`disableWorkflows` in the user settings,
 * `CLAUDE_CODE_DISABLE_WORKFLOWS`) and that Claude Pro keeps off until the Dynamic workflows row of `/config` is switched on.
 * The native lane installs three workflows in place of the skills of the same name, so with workflows off none of the three
 * commands exists. Only the documented switches are read here; the Pro opt-in is stored under a key the docs do not describe
 * (observed: `enableWorkflows`), so it is named in the install note and never relied on. Pure helpers: text and environment in.
 */
import path from 'node:path';
import type { ProjectionInfo } from './types.js';

/** The part of a projection record these helpers read; a full `ProjectionInfo` fits. */
export type WorkflowProjection = Pick<ProjectionInfo, 'host' | 'path' | 'kind'> & { warnings?: string[] };

/** `~/.claude/settings.json`, or the same file under `CLAUDE_CONFIG_DIR` when that is set (the host docs say the config location moves with it). */
export function userSettingsFile(env: Record<string, string | undefined>, homeDir: string): string {
  const configDir = env.CLAUDE_CONFIG_DIR?.trim();
  return path.join(configDir ? configDir : path.join(homeDir, '.claude'), 'settings.json');
}

/** Why workflows are off, from the documented switches, or undefined when none of them is set. */
export function workflowsDisabledBy(userSettings: string | undefined, env: Record<string, string | undefined>): string | undefined {
  if (userSettings) {
    try {
      const parsed = JSON.parse(userSettings) as { disableWorkflows?: unknown } | null;
      if (parsed?.disableWorkflows === true) return '"disableWorkflows": true in your user settings';
    } catch {
      // unreadable settings are not evidence of anything
    }
  }
  const flag = env.CLAUDE_CODE_DISABLE_WORKFLOWS?.trim().toLowerCase();
  if (flag && flag !== '0' && flag !== 'false') return 'CLAUDE_CODE_DISABLE_WORKFLOWS is set';
  return undefined;
}

/** The names of the Claude workflows an install wrote, from its projections. */
export function installedClaudeWorkflows(projections: readonly WorkflowProjection[]): string[] {
  return projections
    .filter(proj => proj.host === 'claude' && proj.kind === 'workflow')
    .map(proj => path.posix.basename(proj.path.replace(/\\/g, '/')).replace(/\.js$/, ''))
    .sort();
}

/** The note printed after a native Claude install that wrote workflows; undefined when it wrote none. */
export function nativeWorkflowNote(projections: readonly WorkflowProjection[]): string | undefined {
  const names = installedClaudeWorkflows(projections);
  if (names.length === 0) return undefined;
  return (
    `The native lane installed ${names.map(name => `/${name}`).join(', ')} as dynamic workflows, in place of the skills of the same name.\n` +
    'They exist only while Claude Code has dynamic workflows turned on. On Claude Pro that is off until you switch on\n' +
    'the "Dynamic workflows" row in /config; "disableWorkflows" in your settings or CLAUDE_CODE_DISABLE_WORKFLOWS turns them off.\n' +
    'Without them those commands are missing; agents update <bundle> --no-native brings the skills back.'
  );
}
