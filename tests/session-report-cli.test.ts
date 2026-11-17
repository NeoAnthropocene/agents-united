import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import type { SessionReportResult, SessionReportTrimResult } from '../src/core/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('packaged session reader public CLI', () => {
  let root: string;
  let lead: string;
  const cli = path.resolve('dist/session-report.js');
  const id = 'aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa';
  const inventory = async (): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    const walk = async (dir: string, prefix = ''): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const rel = prefix + entry.name, file = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) result[rel] = 'link:' + await fs.readlink(file);
        else if (entry.isDirectory()) { result[rel + '/'] = 'directory'; await walk(file, rel + '/'); }
        else result[rel] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
      }
    };
    await walk(root);
    return result;
  };
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-session-cli-')));
    lead = path.join(root, 'records', id + '.jsonl');
    const line = (record: Record<string, unknown>): string => JSON.stringify(record) + '\n';
    await fs.outputFile(lead, [
      { type: 'user', sessionId: id, version: '2.1.311', timestamp: '2026-10-28T10:00:00Z', promptId: 'human-1', message: { role: 'user', content: 'Review the supplied synthetic document.' } },
      { type: 'user', promptId: 'injected', isMeta: true, message: { role: 'user', content: 'Injected tool guidance is not a human prompt.' } },
      { type: 'user', promptId: 'peer', message: { role: 'user', content: '<cross-session-message from-name="reviewer" pipe="private-transport">Peer evidence only.</cross-session-message>' } },
    ].map(line).join(''));
    const sub = path.join(root, 'records', id, 'subagents');
    await fs.outputFile(path.join(sub, 'agent-reviewer.jsonl'), [
      { type: 'assistant', timestamp: '2026-10-28T10:00:01Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'handback-1', name: 'SubagentHandback', input: { message: '## Peer messages received\nNone.\n## Open items\nQuality is pending.' } }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'handback-1', content: '{"success":true}' }] } },
    ].map(line).join(''));
    await fs.writeJson(path.join(sub, 'agent-reviewer.meta.json'), { name: 'reviewer', customAgentType: 'synthetic-reviewer', taskKind: 'subagent' });
  });
  afterEach(async () => { await fs.remove(root); });
  it('reads the explicitly selected records with current human provenance and accepted handback semantics', () => {
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as { analysis: { session: { prompts: number; agents: Array<{ name: string; received: Array<{ kind: string }>; reports: Array<{ source: string; state?: string }> }> } } };
    expect(report.analysis.session.prompts).toBe(1);
    expect(report.analysis.session.agents.find(agent => agent.name === 'lead')?.received).toMatchObject([{ kind: 'cross-session' }]);
    expect(report.analysis.session.agents.find(agent => agent.name === 'reviewer')?.reports).toMatchObject([{ source: 'subagent-handback', state: 'accepted' }]);
  });
  it('does not inspect a transcript-controlled project or infer a historical manifest', async () => {
    const recordedProject = path.join(root, 'recorded-project');
    // Reading this supposed manifest would fail; the selected input closure excludes it.
    await fs.ensureDir(path.join(recordedProject, '.claude/agents/synthetic-reviewer.md'));
    await fs.appendFile(lead, JSON.stringify({ type: 'system', cwd: recordedProject }) + '\n');
    const worker = path.join(root, 'records', id, 'subagents/agent-reviewer.jsonl');
    await fs.appendFile(worker, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'write-1', name: 'Write', input: { file_path: '/synthetic/draft.md' } }] } }) + '\n');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as { analysis: { findings: Array<{ id: string; verdict: string; evidence: string[] }> } };
    expect(report.analysis.findings.find(finding => finding.id === 'H1c')).toMatchObject({ verdict: 'not seen', evidence: [expect.stringMatching(/manifest.*unavailable|unavailable.*manifest/i)] });
  });
  it('refuses a linked selected lead instead of following it', async () => {
    const linked = path.join(root, 'linked.jsonl');
    await fs.symlink(lead, linked, 'file');
    const result = spawnSync(process.execPath, [cli, linked, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toMatch(/linked/i);
  });
  it('returns exact input pins for the selected lead and sibling closure without reading another session', async () => {
    await fs.writeFile(path.join(path.dirname(lead), 'unrelated.jsonl'), 'Unrelated invalid data must not be read.');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as { input: { lead: string; files: Array<{ path: string; bytes: number; sha256: string }> } };
    expect(report).toMatchObject({ input: { lead, files: expect.any(Array) } });
    expect(report.input.files.map(file => file.path).sort()).toEqual([
      lead, path.join(root, 'records', id, 'subagents/agent-reviewer.jsonl'), path.join(root, 'records', id, 'subagents/agent-reviewer.meta.json'),
    ].sort());
    for (const file of report.input.files) {
      const bytes = await fs.readFile(file.path);
      expect(file.bytes).toBe(bytes.length);
      expect(file.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    }
  });
  it('refuses a malformed interior record instead of silently dropping it', async () => {
    await fs.writeFile(lead, (await fs.readFile(lead, 'utf8')).replace('\n', '\n{broken interior}\n'));
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/JSON.*line 2|line 2.*JSON/i);
  });
  it.each(['missing host', 'other host', 'prefix', 'relative', 'extra input', 'project search', 'unknown flag'])('refuses an ambiguous or unsupported invocation: %s', kind => {
    let args = [lead, '--host', 'claude', '--json'];
    if (kind === 'missing host') args = [lead, '--json'];
    else if (kind === 'other host') args = [lead, '--host', 'codex', '--json'];
    else if (kind === 'prefix') args[0] = id.slice(0, 8);
    else if (kind === 'relative') args[0] = path.relative(root, lead);
    else if (kind === 'extra input') args.push(lead);
    else if (kind === 'project search') args.push('--project', path.dirname(lead));
    else args.push('--force');
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toBe('');
  });
  it.each(['ancestor', 'worker', 'metadata', 'subdirectory'])('refuses a linked selected closure component: %s', async kind => {
    const sub = path.join(root, 'records', id, 'subagents');
    const original = kind === 'ancestor' ? path.dirname(lead) : kind === 'subdirectory' ? sub : path.join(sub, kind === 'worker' ? 'agent-reviewer.jsonl' : 'agent-reviewer.meta.json');
    const saved = path.join(root, 'saved-input');
    await fs.rename(original, saved);
    await fs.symlink(saved, original, kind === 'worker' || kind === 'metadata' ? 'file' : 'junction');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/linked/i);
  });
  it.each(['null', '[]', '"other format"', '{"type":"other-format"}'])('refuses an unsupported selected lead: %s', async content => {
    await fs.writeFile(lead, content + '\n');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toBe('');
  });
  it('discloses a malformed object-shaped final line as partial while preserving earlier evidence', async () => {
    await fs.appendFile(lead, '{"type":"assistant","message":');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as SessionReportResult;
    expect(report.input.completeness).toBe('partial');
    expect(report.input.diagnostics).toContainEqual({ path: lead, kind: 'partial-tail', line: 4 });
    expect(report.analysis.session.prompts).toBe(1);
  });
  it('discloses ignored future record kinds instead of treating them as observed evidence', async () => {
    await fs.appendFile(lead, '{"type":"future-record","payload":"not interpreted"}\n');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as SessionReportResult;
    expect(report.input.diagnostics).toContainEqual({ path: lead, kind: 'ignored-records', count: 1 });
    expect(report.input.completeness).toBe('partial');
    expect(report.analysis.session.prompts).toBe(1);
  });
  it('refuses an input file beyond the fixed 16 MiB budget', async () => {
    await fs.writeFile(lead, JSON.stringify({ type: 'user', promptId: 'large', message: { role: 'user', content: 'x'.repeat(16 * 1024 * 1024) } }) + '\n');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/budget/i);
    expect(result.stdout).toBe('');
  });
  it.each(['missing workers', 'unmatched metadata'])('discloses unavailable sibling evidence: %s', async kind => {
    const sub = path.join(root, 'records', id, 'subagents');
    if (kind === 'missing workers') await fs.remove(sub);
    else await fs.writeJson(path.join(sub, 'unmatched.meta.json'), { name: 'unmatched' });
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as SessionReportResult;
    expect(report.input.completeness).toBe('partial');
    expect(report.input.diagnostics).toContainEqual(expect.objectContaining({ kind: kind === 'missing workers' ? 'missing-subagents' : 'unmatched-metadata' }));
    if (kind === 'unmatched metadata') {
      expect(report.input.files.map(file => file.path)).toContain(path.join(sub, 'unmatched.meta.json'));
      expect(report.analysis.session.agents).toHaveLength(2);
    }
  });
  it.each(['count', 'aggregate bytes'])('refuses a selected closure over its fixed budget: %s', async kind => {
    const sub = path.join(root, 'records', id, 'subagents');
    const record = JSON.stringify({ type: 'user', message: { role: 'user', content: kind === 'count' ? 'bounded' : 'x'.repeat(14 * 1024 * 1024) } }) + '\n';
    for (let index = 0; index < (kind === 'count' ? 128 : 5); index++) await fs.writeFile(path.join(sub, 'extra-' + index + '.jsonl'), record);
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/budget/i);
    expect(result.stdout).toBe('');
  });
  it.each(['array', 'invalid UTF-8'])('refuses malformed selected metadata: %s', async kind => {
    await fs.writeFile(path.join(root, 'records', id, 'subagents/agent-reviewer.meta.json'), kind === 'array' ? '[]' : Buffer.from([0xff, 0xfe]));
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toBe('');
  });
  it.each(['.jsonl', '..jsonl', '...jsonl'])('refuses an unsafe derived lead stem before sibling discovery: %s', async name => {
    const selected = path.join(path.dirname(lead), name);
    await fs.copyFile(lead, selected);
    await fs.outputFile(path.join(root, 'subagents/outside.jsonl'), '{"type":"user","message":{"content":"Outside selected project."}}\n');
    const result = spawnSync(process.execPath, [cli, selected, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/unsafe|stem|filename/i);
    expect(result.stdout).toBe('');
  });
  it.each(['NBSP', 'BOM', 'vertical tab'])('checks the actual parser bytes without normalizing %s', async kind => {
    const prefix = kind === 'NBSP' ? '\u00a0' : kind === 'BOM' ? '\ufeff' : '\u000b';
    await fs.writeFile(lead, prefix + await fs.readFile(lead, 'utf8'));
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/JSON.*line 1|line 1.*JSON/i);
    expect(result.stdout).toBe('');
  });
  it.each(['total cost', 'model usage', 'duration'])('refuses non-finite numeric evidence in %s', async kind => {
    const record: Record<string, unknown> = { type: 'cost-state', totalCostUSD: 0.5, modelUsage: {} };
    if (kind === 'total cost') record.totalCostUSD = 'not-a-number';
    else if (kind === 'model usage') record.modelUsage = { synthetic: { costUSD: 'Infinity' } };
    else record.totalDuration = '1e999';
    await fs.appendFile(lead, JSON.stringify(record) + '\n');
    const result = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/numeric|finite/i);
    expect(result.stdout).toBe('');
  });
  it('refuses an existing trim destination before any workspace mutation', async () => {
    const out = path.join(root, 'existing-output');
    await fs.outputFile(path.join(out, 'sentinel.txt'), 'Preserve this user evidence.\n');
    const before = await inventory();
    const result = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', out], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/absent|exists/i);
    expect(await inventory()).toEqual(before);
  });
  it('prepares a checked trimmed copy while preserving inputs and current prompt/handback evidence', async () => {
    await fs.appendFile(lead, JSON.stringify({ type: 'user', promptId: 'human-2', message: { role: 'user', content: 'Contact fixture-person@corp.invalid about the synthetic document.' } }) + '\n');
    const before = await inventory();
    const out = path.join(root, 'prepared');
    const result = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', out], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as SessionReportTrimResult;
    expect(report).toMatchObject({ version: 1, host: 'claude', operation: 'trim', output: { lead: path.join(out, id + '.jsonl') } });
    expect(report.input.files).toHaveLength(3);
    expect(report.output.files).toHaveLength(3);
    for (const file of report.output.files) {
      const bytes = await fs.readFile(file.path);
      expect(file.bytes).toBe(bytes.length);
      expect(file.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    }
    const copied = await fs.readFile(report.output.lead, 'utf8');
    expect(copied).not.toContain('fixture-person@corp.invalid');
    expect(copied).not.toContain('private-transport');
    const checked = spawnSync(process.execPath, [cli, report.output.lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0);
    const independent = JSON.parse(checked.stdout) as SessionReportResult;
    expect(independent.analysis.session.prompts).toBe(2);
    expect(independent.analysis.session.agents.find(agent => agent.name === 'reviewer')?.reports).toMatchObject([{ state: 'accepted' }]);
    const after = await inventory();
    for (const [file, value] of Object.entries(before)) expect(after[file], file).toBe(value);
    expect(Object.keys(after).filter(file => !Object.hasOwn(before, file) && !file.startsWith('prepared/'))).toEqual([]);
  });
  it.each(['inside source', 'ancestor', 'missing parent', 'managed root', 'linked parent', 'traversal alias', 'corrupt source'])('preserves the whole workspace on trim refusal: %s', async kind => {
    let out = path.join(root, 'prepared');
    if (kind === 'inside source') out = path.join(path.dirname(lead), 'prepared');
    else if (kind === 'ancestor') out = root;
    else if (kind === 'missing parent') out = path.join(root, 'missing', 'prepared');
    else if (kind === 'managed root') { await fs.ensureDir(path.join(root, '.claude')); out = path.join(root, '.claude', 'prepared'); }
    else if (kind === 'linked parent') {
      const parent = path.join(root, 'ordinary-parent'); await fs.ensureDir(parent);
      const link = path.join(root, 'linked-parent'); await fs.symlink(parent, link, 'junction');
      out = path.join(link, 'prepared');
    } else if (kind === 'traversal alias') out = root + path.sep + 'records' + path.sep + '..' + path.sep + 'prepared';
    else await fs.writeFile(lead, (await fs.readFile(lead, 'utf8')).replace('\n', '\n{corrupt}\n'));
    const before = await inventory();
    const result = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', out], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toBe('');
    expect(await inventory()).toEqual(before);
  });
  it('removes only its owned stage when the current trimmer cannot preserve numeric evidence', async () => {
    // Legacy trim bounds strings. A valid numeric string this long becomes non-finite after trimming.
    await fs.appendFile(lead, JSON.stringify({ type: 'cost-state', totalCostUSD: '0'.repeat(200), modelUsage: {} }) + '\n');
    const before = await inventory();
    const result = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', path.join(root, 'prepared')], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/non-finite/i);
    expect(await inventory()).toEqual(before);
  });
  it('keeps unmatched metadata in both checked inventories without inventing an extra worker', async () => {
    await fs.writeJson(path.join(root, 'records', id, 'subagents/unmatched.meta.json'), { name: 'unmatched' });
    const result = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', path.join(root, 'prepared')], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as SessionReportTrimResult;
    expect(report.input.files).toHaveLength(4);
    expect(report.output.files).toHaveLength(4);
    expect(report.input.completeness).toBe('partial');
    expect(report.output.completeness).toBe('partial');
    const checked = spawnSync(process.execPath, [cli, report.output.lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0);
    expect((JSON.parse(checked.stdout) as SessionReportResult).analysis.session.agents).toHaveLength(2);
  });
  it.each(['ordinary final report', 'peer wrapper after prefix'])('preserves supported classification through trim: %s', async kind => {
    if (kind === 'ordinary final report') {
      const worker = path.join(root, 'records', id, 'subagents/agent-reviewer.jsonl');
      await fs.appendFile(worker, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x'.repeat(1700) + '\n## Peer messages received\nNone.\n## Open items\nReview pending.' }] } }) + '\n');
    } else await fs.appendFile(lead, JSON.stringify({ type: 'user', promptId: 'peer-with-prefix', message: { content: 'x'.repeat(2100) + '<cross-session-message from-name="peer">Evidence.</cross-session-message>' } }) + '\n');
    const before = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(before.status, before.stderr).toBe(0);
    expect((JSON.parse(before.stdout) as SessionReportResult).analysis.session.prompts).toBe(1);
    const trimmed = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', path.join(root, 'prepared')], { cwd: root, encoding: 'utf8' });
    expect(trimmed.status, trimmed.stderr).toBe(0);
    const copiedLead = (JSON.parse(trimmed.stdout) as SessionReportTrimResult).output.lead;
    const after = spawnSync(process.execPath, [cli, copiedLead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(after.status, after.stderr).toBe(0);
    expect((JSON.parse(after.stdout) as SessionReportResult).analysis.session.prompts).toBe(1);
    if (kind === 'ordinary final report') {
      for (const file of [lead, copiedLead]) {
        const readable = spawnSync(process.execPath, [cli, file, '--host', 'claude'], { cwd: root, encoding: 'utf8' });
        expect(readable.status, readable.stderr).toBe(0);
        expect(readable.stdout).toMatch(/final report has Peer messages received and Open items: yes/);
      }
    }
  });
  it('fails closed when bounded trimming changes an existing reader finding', async () => {
    const worker = path.join(root, 'records', id, 'subagents/agent-reviewer.jsonl');
    const records = [
      { type: 'user', timestamp: '2026-10-28T10:00:02Z', message: { content: 'Read-only consultation; write no files.' } },
      { type: 'user', timestamp: '2026-10-28T10:00:03Z', message: { content: '<teammate-message teammate_id="lead">{"type":"task_assignment"}</teammate-message>' } },
      { type: 'user', timestamp: '2026-10-28T10:00:04Z', message: { content: '<teammate-message teammate_id="lead">' + 'x'.repeat(600) + ' accepted deliver now</teammate-message>' } },
      { type: 'assistant', timestamp: '2026-10-28T10:00:05Z', message: { content: [{ type: 'tool_use', id: 'write-after-acceptance', name: 'Write', input: { file_path: '/synthetic/draft.md' } }] } },
    ];
    await fs.appendFile(worker, records.map(record => JSON.stringify(record) + '\n').join(''));
    const source = spawnSync(process.execPath, [cli, lead, '--host', 'claude', '--json'], { cwd: root, encoding: 'utf8' });
    expect(source.status, source.stderr).toBe(0);
    expect((JSON.parse(source.stdout) as SessionReportResult).analysis.findings.find(finding => finding.id === 'H1a')?.verdict).toBe('seen');
    const before = await inventory();
    const result = spawnSync(process.execPath, [cli, 'trim', lead, '--host', 'claude', '--out', path.join(root, 'prepared')], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/classification|evidence.*changed/i);
    expect(await inventory()).toEqual(before);
  });
});
