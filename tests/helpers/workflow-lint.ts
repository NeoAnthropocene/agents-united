/**
 * The workflow lint moved to `src/core/workflow-lint.ts` (ADR 0082), where `agents workflow-check` uses it. This file keeps the
 * import path the native-workflow tests already use.
 */
export { agentTypesUsed, extractMetaLiteral, lintWorkflow } from '../../src/core/workflow-lint.js';
