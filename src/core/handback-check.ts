/**
 * ADR 0070 — the hand-back hook of the factory evaluator.
 *
 * A `PreToolUse` hook on the evaluator's hand-back tool (`SubagentHandback`) runs the Skill's own pre-check
 * (`scripts/precheck-handback.mjs`, which runs `check-review.mjs --precheck`) before the result leaves the evaluator. A result the caller's check would refuse is
 * blocked, and the evaluator sees the checker's reason in its own context and corrects it. The evaluator stays read-only: no tool is added.
 *
 * The hook belongs to ONE role, `factory-evaluator`, beside its read-only guard, and to no other. This module is the one place that says so: the generator of the
 * frontmatter block, `factory-check`, the factory binding check and the startup check all ask `expectedWorkerHooks`, so each accepts the extra entry for this role and
 * refuses it anywhere else. The script is a file of the evaluate-artifact Skill (a `requiredSupport` entry of its binding), not a guard script under `.claude/hooks/`,
 * and it is not a guard: its handler carries no `onFailure: "block"`. A hook that blocked every hand-back whenever it failed would strand the worker, a result it lets
 * through is still checked by the caller, and the guards of ADR 0068 are the ones that must fail closed.
 */
import { nativeGuardFileHooks } from './guard.js';
import { readOnlyGuardFileHooks } from './readonly-guard.js';

/** The one role that carries the hand-back hook. */
export const HANDBACK_CHECK_ROLE = 'factory-evaluator';
/** How the role's frontmatter names the script: `${CLAUDE_PROJECT_DIR}` is the one path placeholder a user-owned hook can use. */
export const HANDBACK_CHECK_REFERENCE = '${CLAUDE_PROJECT_DIR}/.claude/skills/evaluate-artifact/scripts/precheck-handback.mjs';
/** Where an install puts it, relative to the workspace. */
export const HANDBACK_CHECK_SCRIPT_REL = '.claude/skills/evaluate-artifact/scripts/precheck-handback.mjs';
/** The hook blocks at most this many hand-backs of one worker, then lets the hand-back through; the caller's check stays the judge. */
export const HANDBACK_MAX_BLOCKS = 3;

export type WorkerHookHandler = { type: 'command'; command: string; args: string[]; onFailure?: 'block' };
export type WorkerHooks = { PreToolUse: Array<{ matcher: string; hooks: WorkerHookHandler[] }> };

/** The hand-back entry: matcher `SubagentHandback`, `node <script>`, no shell, and deliberately no `onFailure` (it fails open). */
export function handbackCheckHooks(): WorkerHooks {
  return { PreToolUse: [{ matcher: 'SubagentHandback', hooks: [{ type: 'command', command: 'node', args: [HANDBACK_CHECK_REFERENCE] }] }] };
}

/** The hooks a factory worker must carry, as generated: its guard, and for the evaluator (read-only) the hand-back entry after it. */
export function expectedWorkerHooks(roleName: string, guard: 'destructive' | 'read-only'): WorkerHooks {
  const base: WorkerHooks = guard === 'destructive' ? nativeGuardFileHooks() : readOnlyGuardFileHooks();
  return roleName === HANDBACK_CHECK_ROLE && guard === 'read-only' ? { PreToolUse: [...base.PreToolUse, ...handbackCheckHooks().PreToolUse] } : base;
}
