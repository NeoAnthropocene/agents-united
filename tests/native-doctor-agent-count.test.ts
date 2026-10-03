import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';

/**
 * Plan 032 close-out, found preparing the first real Cline session: `agents doctor --host cline` printed "Installed Agents: 0" and
 * "Configured Agents: 0 active natively in any Cline session" on a healthy `--native` install that holds four configured agents.
 * The count read only the canonical store's agent list, and with the native lanes the store copies are replaced by native
 * projections, so the list is empty. When the store lists none, the count falls back to the role projections the lockfile records
 * (for the host asked about, or distinct role names across hosts), so the report matches what is installed.
 */

const BUNDLE = 'software-engineering';
const WS = path.resolve(process.cwd(), 'scratch/test-native-doctor-count');
const STORE = path.join(WS, '.agents');

describe('doctor agent count on native installs', () => {
  beforeEach(async () => {
    await fs.remove(WS);
    await fs.ensureDir(WS);
  });
  afterEach(async () => {
    await fs.remove(WS);
  });

  const install = (fanout: string[], nativeLane?: boolean) =>
    new InstallEngine().install(BUNDLE, { targetDir: STORE, method: 'copy', fanout, ...(nativeLane === undefined ? {} : { nativeLane }) } as never);

  it('counts the four native Cline agents for --host cline', async () => {
    await install(['cline'], true);
    expect((await DoctorEngine.runDoctor(STORE, 'cline')).agentsCount).toBe(4);
  });

  it('counts distinct role names across hosts when no host is asked about', async () => {
    await install(['cline'], true);
    // Cline: four roles. Antigravity (the store's own native lane): those four plus the orchestrator.
    expect((await DoctorEngine.runDoctor(STORE)).agentsCount).toBe(5);
  });

  it('counts the native Claude agents for --host claude', async () => {
    await install(['claude'], true);
    expect((await DoctorEngine.runDoctor(STORE, 'claude')).agentsCount).toBe(5);
  });

  it('keeps the store count when the store lists agents (a legacy install is unchanged)', async () => {
    await install(['cline']);
    const report = await DoctorEngine.runDoctor(STORE, 'cline');
    const lock = await fs.readJson(path.join(STORE, 'agents-united.json'));
    expect(report.agentsCount).toBe(lock.installed.agents.length);
    expect(report.agentsCount).toBeGreaterThan(0);
  });
});
