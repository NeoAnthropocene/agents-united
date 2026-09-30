/**
 * Plan 032 Phase 5 / ADR 0025 decision 8 — the host-neutral capability class vocabulary.
 * Leaf module (no imports beyond types) so both the Semantic Core validator and the per-host
 * tool policy can share it. Adding a class is a compile error until it is defined here.
 */
import type { CapabilityClass } from './types.js';

interface ClassDefinition {
  description: string;
  /** A role may declare the class. `meta` tools (ending the conversation, feedback drafts) are never granted. */
  grantable: boolean;
  /** Every tool of a read-only class must be non-mutating in every host policy. */
  readOnly: boolean;
}

export const CLASS_DEFINITIONS: Record<CapabilityClass, ClassDefinition> = {
  read: { description: 'Read files and connected-server resources', grantable: true, readOnly: true },
  search: { description: 'Find files by name and search their contents', grantable: true, readOnly: true },
  'code-intel': { description: 'Language-server navigation and diagnostics', grantable: true, readOnly: true },
  edit: { description: 'Create and change files', grantable: true, readOnly: false },
  shell: { description: 'Run shell commands', grantable: true, readOnly: false },
  'background-monitor': { description: 'Run and watch background commands and streams', grantable: true, readOnly: false },
  web: { description: 'Fetch pages and search the web', grantable: true, readOnly: true },
  delegate: { description: 'Spawn subagents', grantable: true, readOnly: false },
  workflow: { description: 'Run scripted multi-agent workflows', grantable: true, readOnly: false },
  scheduling: { description: 'Schedule prompts and remote routines', grantable: true, readOnly: false },
  'ask-user': { description: 'Ask the user a multiple-choice question', grantable: true, readOnly: true },
  notify: { description: 'Notify the user or send them a file', grantable: true, readOnly: true },
  worktree: { description: 'Create and leave isolated git worktrees', grantable: true, readOnly: false },
  report: { description: 'Deliver structured findings or a subagent report', grantable: true, readOnly: true },
  handback: { description: "Deliver a subagent's final report to whoever spawned it", grantable: true, readOnly: true },
  artifacts: { description: 'Publish shareable pages', grantable: true, readOnly: false },
  skill: { description: 'Load a skill into the conversation', grantable: true, readOnly: true },
  messaging: { description: 'Message other agents and sessions', grantable: true, readOnly: true },
  'task-tracking': { description: 'Keep a task checklist', grantable: true, readOnly: true },
  plan: { description: 'Enter and leave plan mode', grantable: true, readOnly: true },
  'mcp-discovery': { description: 'Discover and wait for connected-server tools', grantable: true, readOnly: true },
  meta: { description: 'Session-ending, feedback and onboarding tools that no role grants', grantable: false, readOnly: false },
};

export const CAPABILITY_CLASSES: readonly CapabilityClass[] = Object.keys(CLASS_DEFINITIONS) as CapabilityClass[];

export function isCapabilityClass(value: string): value is CapabilityClass {
  return Object.prototype.hasOwnProperty.call(CLASS_DEFINITIONS, value);
}
