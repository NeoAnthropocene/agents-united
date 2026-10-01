import fs from 'node:fs';
import path from 'node:path';
import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { listNativeRoles, nativeRoleSource } from '../src/core/native-package.js';
import { nativeDeltaRows } from './helpers/native-delta.js';

/**
 * Plan 032 Phase 7 — maintainers' conformance of the native Claude agents against the Semantic Core (ADR 0025
 * decision 2): Contract Floor, tools against the capability-class ceiling, guard, model posture. Not user-facing: a
 * native package is the product, so doctor shows users no translation report (see the doctor guard check below).
 */

const REGISTRY = path.resolve('registry');
const ROLES = listNativeRoles(REGISTRY, 'claude');
const sourceOf = (role: string): string => fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', role)!, 'utf8').replace(/\r\n/g, '\n');

describe('native agents against the Semantic Core', () => {
  it('finds no issue in the committed native agents', async () => {
    const rows = await nativeDeltaRows(REGISTRY, 'claude');
    expect(rows.map(row => row.role)).toEqual(ROLES);
    for (const row of rows) expect(row.issues, row.role).toEqual([]);
  });

  it('classifies each agent: floor ok, class-derived tools, the right guard, the specialist model posture', async () => {
    const rows = Object.fromEntries((await nativeDeltaRows(REGISTRY, 'claude')).map(row => [row.role, row]));
    expect(rows['code-reviewer']).toMatchObject({ floor: 'ok', guard: 'read-only', toolGains: [], toolExtras: [], model: 'sonnet', effort: 'medium' });
    expect(rows['repo-index'].guard).toBe('read-only');
    expect(rows['backend-architect'].guard).toBe('destructive');
    expect(rows['frontend-architect'].guard).toBe('destructive');
    expect(rows['code-reviewer'].serverTools).toContain('mcp__github__search_code');
    expect(rows['backend-architect'].serverTools).toEqual(['mcp__context7', 'mcp__github']);
  });

  it('reports a floor that no longer matches the core, naming the field', async () => {
    const stale = sourceOf('code-reviewer').replace('Never echo a discovered secret verbatim', 'Echo secrets');
    const row = (await nativeDeltaRows(REGISTRY, 'claude', { installed: new Map([['code-reviewer', stale]]) })).find(r => r.role === 'code-reviewer')!;
    expect(row.floor).toBe('drift');
    expect(row.issues.join('\n')).toMatch(/Contract Floor.*safety/);
  });

  it('reports a tool beyond the ceiling, and lists a ceiling tool the agent leaves out without calling it an issue', async () => {
    const edited = sourceOf('repo-index').replace('tools: Glob, Grep, LSP,', 'tools: Glob, Grep, Agent,');
    const row = (await nativeDeltaRows(REGISTRY, 'claude', { installed: new Map([['repo-index', edited]]) })).find(r => r.role === 'repo-index')!;
    expect(row.toolExtras).toEqual(['Agent']);
    expect(row.toolGains).toContain('LSP');
    expect(row.issues.join('\n')).toMatch(/Agent/);
    expect(row.issues.join('\n')).not.toMatch(/LSP/);
  });

  it('reports a guard that is missing, or a shell held behind the wrong guard', async () => {
    const noGuard = sourceOf('backend-architect').replace(/  PreToolUse: .*\n/, '  PreToolUse: []\n');
    const rowA = (await nativeDeltaRows(REGISTRY, 'claude', { installed: new Map([['backend-architect', noGuard]]) })).find(r => r.role === 'backend-architect')!;
    expect(rowA.guard).toBe('none');
    expect(rowA.issues.join('\n')).toMatch(/guard/i);
  });

  it('is empty for a host with no native agents', async () => {
    expect(await nativeDeltaRows(REGISTRY, 'cline')).toEqual([]);
  });
});

describe('doctor guard check for installed native agents', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-guard-check');
  const agentsDir = path.join(workspace, '.agents');
  const install = (nativeLane?: boolean) =>
    new InstallEngine().install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane });
  const agentFile = (role: string): string => path.join(workspace, '.claude', 'agents', `${role}.md`);
  const withoutGuard = (text: string): string => text.replace(/^  PreToolUse: .*$/m, '  PreToolUse: []');

  beforeEach(async () => {
    await fse.remove(workspace);
    await fse.ensureDir(workspace);
  });
  afterEach(async () => {
    await fse.remove(workspace);
  });

  it('shows users no translation report, and no warning after a clean install', async () => {
    await install(true);
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report).not.toHaveProperty('nativeDeltas');
    expect(report.warnings.filter(w => /Native agent/.test(w))).toEqual([]);
  });

  it('warns when an installed native role that can run a shell or write files has lost its guard', async () => {
    await install(true);
    await fse.writeFile(agentFile('backend-architect'), withoutGuard(await fse.readFile(agentFile('backend-architect'), 'utf8')));
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.warnings.join('\n')).toMatch(/Native agent backend-architect holds a shell or file writer but carries no guard/);
  });

  it('warns when a read-only role lost its read-only guard', async () => {
    await install(true);
    await fse.writeFile(agentFile('code-reviewer'), withoutGuard(await fse.readFile(agentFile('code-reviewer'), 'utf8')));
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.warnings.join('\n')).toMatch(/Native agent code-reviewer is a read-only role but lacks the read-only guard/);
  });

  it('does not repeat the integrity story: a changed floor is the existing drift warning, not a second report', async () => {
    await install(true);
    const file = agentFile('code-reviewer');
    await fse.writeFile(file, (await fse.readFile(file, 'utf8')).replace('Never echo a discovered secret verbatim', 'Echo secrets'));
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.warnings.join('\n')).toMatch(/Content drift \.claude\/agents\/code-reviewer\.md/);
    expect(report.warnings.filter(w => /Contract Floor/.test(w))).toEqual([]);
  });

  it('says nothing about guards when the native lane is off', async () => {
    await install();
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.warnings.filter(w => /Native agent/.test(w))).toEqual([]);
  });
});
