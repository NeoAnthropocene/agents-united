/** Dedicated offline contributor entry; no maintenance refresh/network operations. */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { analyse, loadSession, renderReport } from './session-report.ts';
import { confirmSessionInput, inspectSessionInput, prepareTrimmedSession } from './session-input.ts';
import type { SessionReportResult, SessionReportTrimResult } from '../../src/core/types.ts';

const LIMITS = ['Historical role manifests unavailable.', 'Record findings do not prove lead receipt, physical process exit, current quota or invoice.', 'Text output and trimming are not comprehensive privacy or credential scrubbing.'];

function main(): void {
  const { values, positionals } = parseArgs({ options: { host: { type: 'string' }, json: { type: 'boolean' }, out: { type: 'string' } }, allowPositionals: true });
  if (values.host !== 'claude') throw new Error('Unavailable Host: pass --host claude.');
  const trimming = positionals[0] === 'trim';
  const selected = positionals[trimming ? 1 : 0];
  if (positionals.length !== (trimming ? 2 : 1) || !selected || !path.isAbsolute(selected)) throw new Error('Pass exactly one absolute lead .jsonl file.');
  if ((!trimming && values.out !== undefined) || (trimming && (!values.out || values.json))) throw new Error('Use trim <absolute-lead> --host claude --out <absolute-new-directory>.');
  const input = inspectSessionInput(selected);
  if (trimming) {
    const output = prepareTrimmedSession(input, values.out!);
    const result: SessionReportTrimResult = { version: 1, host: 'claude', operation: 'trim', input, output, limits: LIMITS };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  const analysis = analyse(loadSession(input.lead), { roleEvidence: 'unavailable' });
  confirmSessionInput(input);
  const result: SessionReportResult = { version: 1, host: 'claude', input, analysis, limits: LIMITS };
  process.stdout.write((values.json ? JSON.stringify(result, null, 2) : 'Selected record set: ' + input.lead + ' (' + input.completeness + ')\n' + result.limits.join('\n') + '\n\n' + renderReport(analysis)) + '\n');
}
try { main(); }
catch (error) {
  process.stderr.write(JSON.stringify({ status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }) + '\n');
  process.exitCode = 1;
}
