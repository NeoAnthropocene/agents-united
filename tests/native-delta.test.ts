import fs from 'node:fs';
import path from 'node:path';
import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { nativeDeltaRows } from '../src/core/native-delta.js';
import { listNativeRoles, nativeRoleSource } from '../src/core/native-package.js';

/**
 * Plan 032 Phase 7 — `agents doctor --host claude` measures every native agent against the Semantic Core contract
 * (ADR 0025 decision 2: deltas are measured against the core, never against another host's keys): floor, tool grant
 * vs capability classes, guard, model posture.
 */

const REGISTRY = path.resolve('registry');
const ROLES = listNativeRoles(REGISTRY, 'claude');
const sourceOf = (role: string): string => fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', role)!, 'utf8').replace(/\r\n/g, '\n');

describe('nativeDeltaRows', () => {
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

  it('reports a tool beyond the class grant and a class tool the agent lacks', async () => {
    const edited = sourceOf('repo-index').replace('tools: Glob, Grep, LSP, Read,', 'tools: Glob, Grep, Read, Agent,');
    const row = (await nativeDeltaRows(REGISTRY, 'claude', { installed: new Map([['repo-index', edited]]) })).find(r => r.role === 'repo-index')!;
    expect(row.toolExtras).toEqual(['Agent']);
    expect(row.toolGains).toEqual(['LSP']);
    expect(row.issues.join('\n')).toMatch(/Agent/);
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

describe('doctor --host claude native delta table', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-delta');
  const agentsDir = path.join(workspace, '.agents');
  const install = (nativeLane?: boolean) =>
    new InstallEngine().install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane });

  beforeEach(async () => {
    await fse.remove(workspace);
    await fse.ensureDir(workspace);
  });
  afterEach(async () => {
    await fse.remove(workspace);
  });

  it('has no table when the native lane is off', async () => {
    await install();
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.nativeDeltas).toBeUndefined();
  });

  it('has no table without --host claude', async () => {
    await install(true);
    expect((await DoctorEngine.runDoctor(agentsDir)).nativeDeltas).toBeUndefined();
  });

  it('lists every installed native agent with no issue after a clean install', async () => {
    await install(true);
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.nativeDeltas?.map(row => row.role)).toEqual(ROLES);
    expect(report.nativeDeltas?.every(row => row.issues.length === 0)).toBe(true);
    expect(report.warnings.filter(w => /Native agent/.test(w))).toEqual([]);
  });

  it('measures the installed file, not the registry copy: an installed floor that went stale is a warning', async () => {
    await install(true);
    const file = path.join(workspace, '.claude', 'agents', 'code-reviewer.md');
    const text = await fse.readFile(file, 'utf8');
    await fse.writeFile(file, text.replace('Never echo a discovered secret verbatim', 'Echo secrets'));
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    expect(report.nativeDeltas?.find(row => row.role === 'code-reviewer')?.floor).toBe('drift');
    expect(report.warnings.join('\n')).toMatch(/Native agent code-reviewer.*Contract Floor.*safety/);
  });
});
