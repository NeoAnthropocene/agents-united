/**
 * Plan 032 Phase 7 — what an installed native Claude agent says about itself that matters to its user: the tools it holds
 * and the PreToolUse guard it carries. `agents doctor` uses it to warn when a role that can run a shell or write files
 * has lost its guard (a safety property); the maintainers' conformance tests use it for the rest. Pure: text in, facts out.
 */
import yaml from 'yaml';
import { GUARD_SCRIPT } from './guard.js';
import { READ_ONLY_GUARD_SCRIPT } from './readonly-guard.js';

export type NativeGuard = 'read-only' | 'destructive' | 'none';

/** Tools that run a command or change a file. Any role holding one needs a guard. */
export const WRITER_TOOLS: readonly string[] = ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

export interface NativeAgentFacts {
  meta: Record<string, unknown>;
  tools: string[];
  guard: NativeGuard;
  holdsWriter: boolean;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

function guardOf(hooks: unknown): NativeGuard {
  const scripts: string[] = [];
  const groups = (hooks as { PreToolUse?: Array<{ hooks?: Array<{ args?: unknown[] }> }> } | undefined)?.PreToolUse;
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const hook of group.hooks ?? []) if (typeof hook.args?.[1] === 'string') scripts.push(hook.args[1]);
  }
  if (scripts.includes(READ_ONLY_GUARD_SCRIPT)) return 'read-only';
  if (scripts.includes(GUARD_SCRIPT)) return 'destructive';
  return 'none';
}

/** Reads the frontmatter of a native agent file; unreadable frontmatter yields no tools and no guard. */
export function inspectNativeAgent(text: string): NativeAgentFacts {
  const source = text.replace(/\r\n/g, '\n');
  let meta: Record<string, unknown> = {};
  try {
    const parsed = yaml.parse(FRONTMATTER.exec(source)?.[1] ?? '');
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>;
  } catch {
    meta = {};
  }
  const tools = String(meta.tools ?? '').split(',').map(tool => tool.trim()).filter(Boolean);
  return { meta, tools, guard: guardOf(meta.hooks), holdsWriter: tools.some(tool => WRITER_TOOLS.includes(tool)) };
}

/** A user-facing problem with the guard of an installed native agent, or `undefined` when it is as it should be. */
export function nativeGuardProblem(facts: NativeAgentFacts): string | undefined {
  if (facts.holdsWriter && facts.guard === 'none') return 'holds a shell or file writer but carries no guard';
  if (!facts.holdsWriter && facts.guard !== 'read-only') return 'is a read-only role but lacks the read-only guard';
  return undefined;
}
