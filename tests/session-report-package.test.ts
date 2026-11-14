import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionReportFile, SessionReportResult, SessionReportTrimResult } from '../src/core/types.js';

describe('session reader from an actual offline npm installation', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (!root) return;
    const temp = await fs.realpath(os.tmpdir());
    const relative = path.relative(temp, root);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Unexpected package-test cleanup root.');
    await fs.remove(root);
  });

  it('reads and trims explicit synthetic records using only the installed executable', async () => {
    const taskRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-session-package-')));
    root = taskRoot;
    const npmCli = path.join(path.dirname(process.env.npm_execpath ?? ''), 'npm-cli.js');
    if (!await fs.pathExists(npmCli)) throw new Error('Run via npm for its offline package CLI.');
    const packed = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', taskRoot], { encoding: 'utf8' })) as Array<{ filename: string; files: Array<{ path: string }> }>;
    expect(packed[0]!.files.filter(file => file.path.endsWith('.jsonl')).map(file => file.path).sort()).toEqual([
      'registry/skills/remotion-production/assets/setup-evidence.example.jsonl',
    ]);
    const runtime = path.join(taskRoot, 'runtime');
    execFileSync(process.execPath, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', runtime, path.join(taskRoot, packed[0]!.filename)], { encoding: 'utf8' });
    const packageRoot = path.join(runtime, 'node_modules/agents-united');
    const manifest = await fs.readJson(path.join(packageRoot, 'package.json')) as { bin: Record<string, string> };
    expect(manifest.bin['agents']).toBe('./dist/cli.js');
    expect(manifest.bin['agents-united']).toBe('./dist/cli.js');
    expect(typeof manifest.bin['agents-session-report']).toBe('string');
    const entry = path.resolve(packageRoot, manifest.bin['agents-session-report']!);
    const entryRelative = path.relative(packageRoot, entry);
    expect(entryRelative.startsWith('..') || path.isAbsolute(entryRelative)).toBe(false);
    expect((await fs.stat(entry)).isFile()).toBe(true);
    const consumer = path.join(taskRoot, 'unrelated-consumer'); await fs.ensureDir(consumer);
    const run = (args: string[]): SpawnSyncReturns<string> => spawnSync(process.execPath, [entry, ...args], { cwd: consumer, encoding: 'utf8' });
    const id = 'bbbbbbbb-2222-4444-8888-bbbbbbbbbbbb';
    const records = path.join(taskRoot, 'records');
    const lead = path.join(records, id + '.jsonl');
    const sub = path.join(records, id, 'subagents');
    const worker = path.join(sub, 'agent-reviewer.jsonl');
    const metadata = path.join(sub, 'agent-reviewer.meta.json');
    const line = (value: Record<string, unknown>): string => JSON.stringify(value) + '\n';
    // This directory would make the legacy implicit manifest read fail; it is outside the selected records.
    await fs.ensureDir(path.join(consumer, '.claude/agents/synthetic-reviewer.md'));
    await fs.outputFile(lead, [
      { type: 'user', sessionId: id, version: '2.1.311', cwd: consumer, timestamp: '2026-10-29T10:00:00Z', promptId: 'human', origin: { kind: 'human' }, message: { role: 'user', content: 'Review the synthetic document. Contact fixture-reader@example.invalid.' } },
      { type: 'user', promptId: 'meta', isMeta: true, message: { role: 'user', content: 'Injected guidance is not a human prompt.' } },
      { type: 'user', promptId: 'notification', origin: { kind: 'task-notification' }, message: { role: 'user', content: '<task-notification>Synthetic notification.</task-notification>' } },
      { type: 'user', promptId: 'peer', origin: { kind: 'peer' }, message: { role: 'user', content: '<cross-session-message from-name="reviewer" pipe="fixture-transport">Synthetic peer evidence.</cross-session-message>' } },
    ].map(line).join(''));
    const handback = 'Synthetic narrative before the required headings. '.repeat(50) + '\n## Peer messages received\nNo peer input.\n## Open items\nIndependent quality and live invocation remain unverified.\n';
    await fs.outputFile(worker, [
      { type: 'assistant', timestamp: '2026-10-29T10:00:01Z', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'write-1', name: 'Write', input: { file_path: '/synthetic/review.md' } },
        { type: 'tool_use', id: 'handback-1', name: 'SubagentHandback', input: { message: handback } },
      ] } },
      { type: 'user', timestamp: '2026-10-29T10:00:02Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'handback-1', content: '{"success":true}' }] } },
    ].map(line).join(''));
    await fs.writeJson(metadata, { name: 'reviewer', customAgentType: 'synthetic-reviewer', taskKind: 'subagent' });
    const unrelated = path.join(records, 'unrelated.jsonl'); await fs.writeFile(unrelated, 'Unrelated invalid data must not be read.\n');
    const sourceBytes = new Map(await Promise.all([lead, worker, metadata, unrelated].map(async file => [file, await fs.readFile(file)] as const)));
    const hash = (bytes: Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');
    const checkPins = async (files: SessionReportFile[], expected: string[]): Promise<void> => {
      expect(files.map(file => file.path).sort()).toEqual([...expected].sort());
      for (const file of files) {
        const bytes = await fs.readFile(file.path);
        expect(file.bytes, file.path).toBe(bytes.length);
        expect(file.sha256, file.path).toBe(hash(bytes));
      }
    };
    const read = run([lead, '--host', 'claude', '--json']);
    expect(read.status, read.stdout + read.stderr).toBe(0);
    const report = JSON.parse(read.stdout) as SessionReportResult;
    await checkPins(report.input.files, [lead, worker, metadata]);
    expect(report.input.completeness).toBe('complete');
    expect(report.analysis.session.prompts).toBe(1);
    expect(report.analysis.session.agents).toHaveLength(2);
    expect(report.analysis.session.agents.find(agent => agent.name === 'lead')?.received).toMatchObject([{ kind: 'cross-session', from: 'reviewer' }]);
    expect(report.analysis.session.agents.find(agent => agent.name === 'reviewer')?.reports).toMatchObject([{ source: 'subagent-handback', state: 'accepted' }]);
    const readable = run([lead, '--host', 'claude']);
    expect(readable.status, readable.stdout + readable.stderr).toBe(0);
    expect(readable.stdout).toContain('final report has Peer messages received and Open items: yes');
    const out = path.join(taskRoot, 'derived');
    const trimmed = run(['trim', lead, '--host', 'claude', '--out', out]);
    expect(trimmed.status, trimmed.stdout + trimmed.stderr).toBe(0);
    const prepared = JSON.parse(trimmed.stdout) as SessionReportTrimResult;
    await checkPins(prepared.input.files, [lead, worker, metadata]);
    const trimmedLead = path.join(out, id + '.jsonl');
    const trimmedWorker = path.join(out, id, 'subagents/agent-reviewer.jsonl');
    const trimmedMetadata = path.join(out, id, 'subagents/agent-reviewer.meta.json');
    expect(prepared.output.lead).toBe(trimmedLead);
    await checkPins(prepared.output.files, [trimmedLead, trimmedWorker, trimmedMetadata]);
    const actualOutputFiles: string[] = [];
    const walkOutput = async (dir: string): Promise<void> => {
      for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) await walkOutput(file);
        else actualOutputFiles.push(file);
      }
    };
    await walkOutput(out);
    expect(actualOutputFiles.sort()).toEqual(prepared.output.files.map(file => file.path).sort());
    const derivedLeadBytes = await fs.readFile(trimmedLead, 'utf8');
    expect(derivedLeadBytes).not.toContain('fixture-reader@example.invalid');
    expect(derivedLeadBytes).not.toContain('fixture-transport');
    const copiedReportBytes = await fs.readFile(trimmedWorker, 'utf8');
    expect(copiedReportBytes).toContain('Peer messages received');
    expect(copiedReportBytes).toContain('Open items');
    const reread = run([trimmedLead, '--host', 'claude', '--json']);
    expect(reread.status, reread.stdout + reread.stderr).toBe(0);
    const independent = JSON.parse(reread.stdout) as SessionReportResult;
    expect(independent.analysis.session.prompts).toBe(1);
    expect(independent.analysis.session.agents.find(agent => agent.name === 'reviewer')?.reports).toMatchObject([{ state: 'accepted' }]);
    const derivedReadable = run([trimmedLead, '--host', 'claude']);
    expect(derivedReadable.status, derivedReadable.stdout + derivedReadable.stderr).toBe(0);
    expect(derivedReadable.stdout).toContain('final report has Peer messages received and Open items: yes');
    for (const args of [[lead, '--host', 'codex', '--json'], [lead, '--host', 'claude', '--refresh']]) {
      const refused = run(args);
      expect(refused.status, refused.stderr).toBe(1);
      expect(refused.stdout).toBe('');
    }
    for (const [file, bytes] of sourceBytes) expect(await fs.readFile(file), file).toEqual(bytes);
    expect(await fs.pathExists(path.join(packageRoot, 'scripts/hostlib/session-report.ts'))).toBe(false);
  }, 60000);
});
