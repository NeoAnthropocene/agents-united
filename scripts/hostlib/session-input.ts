/** Explicit local record scope for the distributable reader; no home/project search. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SessionReportDiagnostic, SessionReportFile, SessionReportInput } from '../../src/core/types.ts';
import { loadSession, sessionEvidenceFingerprint, trimSession } from './session-report.ts';

const RECORD_TYPES = new Set(['user', 'assistant', 'attachment', 'system', 'cost-state', 'agent-setting', 'permission-mode']);

function inspectCost(record: Record<string, unknown>, file: string, line: number): void {
  const values: unknown[] = [record.totalCostUSD, record.totalAPIDuration, record.totalDuration];
  const models = record.modelUsage;
  if (models && typeof models === 'object' && !Array.isArray(models)) {
    for (const usage of Object.values(models)) {
      if (!usage || typeof usage !== 'object' || Array.isArray(usage)) continue;
      const fields = usage as Record<string, unknown>;
      values.push(fields.inputTokens, fields.outputTokens, fields.cacheReadInputTokens, fields.costUSD);
    }
  }
  if (values.some(value => !Number.isFinite(Number(value ?? 0)))) throw new Error('Non-finite numeric evidence at line ' + line + ': ' + file);
}

function inspectJsonl(bytes: Buffer, file: string, diagnostics: SessionReportDiagnostic[]): number {
  const lines = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes).split(/\r?\n/);
  let last = lines.length - 1;
  while (last >= 0 && !lines[last]!.trim()) last--;
  let recognized = 0, ignored = 0;
  for (let index = 0; index <= last; index++) {
    const text = lines[index]!.trim();
    if (!text) continue;
    let value: unknown;
    try { value = JSON.parse(lines[index]!) as unknown; }
    catch {
      if (index === last && text.startsWith('{')) {
        diagnostics.push({ path: file, kind: 'partial-tail', line: index + 1 });
        continue;
      }
      throw new Error('Invalid JSON at line ' + (index + 1) + ': ' + file);
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object at line ' + (index + 1) + ': ' + file);
    const type = (value as Record<string, unknown>).type;
    if (type === 'cost-state') inspectCost(value as Record<string, unknown>, file, index + 1);
    if (typeof type === 'string' && RECORD_TYPES.has(type)) recognized++;
    else ignored++;
  }
  if (ignored) diagnostics.push({ path: file, kind: 'ignored-records', count: ignored });
  return recognized;
}

function ordinaryPath(value: string): string {
  if (!path.isAbsolute(value) || value.split(/[\\/]/).some(part => part === '.' || part === '..')) throw new Error('Pass an absolute path without traversal aliases.');
  const file = path.resolve(value);
  for (let current = file; ; current = path.dirname(current)) {
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Linked input path is unavailable: ' + current);
    if (current === path.dirname(current)) break;
  }
  return file;
}

export function explicitLead(value: string): string {
  const file = ordinaryPath(value);
  if (!file.endsWith('.jsonl') || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error('Required ordinary lead .jsonl file is unavailable.');
  const stem = path.basename(file).slice(0, -'.jsonl'.length);
  if (!stem || stem === '.' || stem === '..' || /[<>:"\\|?*\x00-\x1f]|[. ]$/.test(stem) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) throw new Error('Unsafe derived lead filename stem.');
  return file;
}

export function inspectSessionInput(value: string): SessionReportInput {
  const lead = explicitLead(value);
  const files: SessionReportFile[] = [];
  const diagnostics: SessionReportDiagnostic[] = [];
  let totalBytes = 0;
  const add = (file: string, kind: SessionReportFile['kind']): void => {
    ordinaryPath(file);
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error('Required ordinary input file unavailable: ' + file);
    if (files.length >= 128 || stat.size > 16 * 1024 * 1024 || totalBytes + stat.size > 64 * 1024 * 1024) throw new Error('Selected input file/count/byte budget exceeded.');
    const bytes = fs.readFileSync(file);
    totalBytes += bytes.length;
    if (bytes.length > 16 * 1024 * 1024 || totalBytes > 64 * 1024 * 1024) throw new Error('Selected input byte budget changed while reading.');
    if (kind === 'metadata') {
      const metadata: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
      if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Metadata must be a JSON object: ' + file);
    } else if (!inspectJsonl(bytes, file, diagnostics) && kind === 'lead') throw new Error('Unavailable Claude record format: no recognized lead records.');
    files.push({ path: file, kind, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  };
  add(lead, 'lead');
  const project = path.dirname(lead);
  const sub = ordinaryPath(path.join(project, path.basename(lead, '.jsonl'), 'subagents'));
  const contained = path.relative(project, sub);
  if (!contained || contained === '..' || contained.startsWith('..' + path.sep) || path.isAbsolute(contained)) throw new Error('Derived sibling scope escapes the selected project.');
  if (fs.existsSync(sub)) {
    if (!fs.statSync(sub).isDirectory()) throw new Error('Subagent closure must be an ordinary directory.');
    const names = fs.readdirSync(sub).filter(name => name.endsWith('.jsonl') || name.endsWith('.meta.json')).sort();
    if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Case-colliding selected input names are unavailable.');
    for (const name of names) {
      if (name.endsWith('.jsonl')) add(path.join(sub, name), 'subagent');
      else {
        add(path.join(sub, name), 'metadata');
        const paired = name.replace(/\.meta\.json$/, '.jsonl');
        if (!names.some(candidate => process.platform === 'win32' ? candidate.toLowerCase() === paired.toLowerCase() : candidate === paired)) diagnostics.push({ path: path.join(sub, name), kind: 'unmatched-metadata' });
      }
    }
  }
  if (!files.some(file => file.kind === 'subagent')) diagnostics.push({ path: sub, kind: 'missing-subagents' });
  return { lead, files, completeness: diagnostics.length ? 'partial' : 'complete', diagnostics };
}

export function confirmSessionInput(before: SessionReportInput): void {
  const after = inspectSessionInput(before.lead);
  if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('Selected input closure changed while reading; stable evidence is unavailable.');
}

export function verifyTrimDestination(lead: string, value: string): string {
  const out = ordinaryPath(value);
  if (fs.existsSync(out)) throw new Error('Trim output must be absent; preserve the existing destination.');
  if (!fs.statSync(path.dirname(out), { throwIfNoEntry: false })?.isDirectory()) throw new Error('Trim output parent must be an existing ordinary directory.');
  const within = (parent: string, child: string): boolean => {
    const relative = path.relative(parent, child);
    return !relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
  };
  const project = path.dirname(lead);
  if (within(project, out) || within(out, project)) throw new Error('Trim source/output roots overlap.');
  if (out.split(path.sep).some(part => ['.agents', '.claude', '.cline', '.cursor', '.codex', '.opencode', '.gemini'].includes(part.toLowerCase()))) throw new Error('Trim output is a managed Host path.');
  return out;
}

function verifyTrimTree(root: string, input: SessionReportInput): void {
  const project = path.dirname(input.lead);
  const stem = path.basename(input.lead, '.jsonl');
  const expected = new Set(input.files.map(file => path.relative(project, file.path)));
  const directories = new Set([stem, path.join(stem, 'subagents')]);
  const seen = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = ordinaryPath(path.join(dir, entry.name)), rel = path.relative(root, file);
      if (entry.isDirectory() && directories.has(rel)) walk(file);
      else if (entry.isFile() && expected.has(rel)) seen.add(rel);
      else throw new Error('Unexpected prepared trim path: ' + rel);
    }
  };
  walk(root);
  if (seen.size !== expected.size) throw new Error('Prepared trim inventory omitted required files.');
}

export function prepareTrimmedSession(input: SessionReportInput, destination: string): SessionReportInput {
  const out = verifyTrimDestination(input.lead, destination);
  const evidence = sessionEvidenceFingerprint(loadSession(input.lead));
  const parent = path.dirname(out);
  const staging = fs.mkdtempSync(path.join(parent, '.session-report-'));
  try {
    const stagedLead = trimSession(input.lead, staging);
    verifyTrimTree(staging, input);
    const prepared = inspectSessionInput(stagedLead);
    if (sessionEvidenceFingerprint(loadSession(stagedLead)) !== evidence) throw new Error('Bounded trim changes supported record classifications; preserve and inspect the original evidence.');
    confirmSessionInput(input);
    verifyTrimDestination(input.lead, destination);
    fs.renameSync(staging, out);
    const delivered = (file: string): string => path.join(out, path.relative(staging, file));
    return { ...prepared, lead: delivered(prepared.lead), files: prepared.files.map(file => ({ ...file, path: delivered(file.path) })), diagnostics: prepared.diagnostics.map(diagnostic => ({ ...diagnostic, path: delivered(diagnostic.path) })) };
  } finally {
    if (path.dirname(path.resolve(staging)) !== parent || !path.basename(staging).startsWith('.session-report-')) throw new Error('Unexpected owned staging cleanup path.');
    ordinaryPath(staging);
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
  }
}
