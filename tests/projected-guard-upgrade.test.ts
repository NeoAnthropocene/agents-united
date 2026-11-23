import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { UpdateEngine } from '../src/core/updater.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';

/**
 * A projected role written before its guard covered PowerShell and MultiEdit has the shorter matchers. It is our file, unedited, so an
 * update renews it to the current matchers (it is not reported as hand-edited and not left behind), and the guard it carries is
 * recognised as a destructive guard before and after.
 */
const OLD_SHELL = 'matcher: Bash\n';
const OLD_WRITE = 'matcher: Write|Edit|NotebookEdit\n';
const NEW_SHELL = 'matcher: Bash|PowerShell\n';
const NEW_WRITE = 'matcher: Write|Edit|MultiEdit|NotebookEdit\n';

describe('a projected role written by the version before is renewed by an update', () => {
  const ROOT = path.join(os.tmpdir(), `agents-united-projected-guard-${process.pid}`);
  const HOME = path.join(ROOT, 'home');
  const PROJECT = path.join(ROOT, 'project');
  const AGENTS = path.join(PROJECT, '.claude', 'agents');

  beforeEach(async () => {
    await fs.remove(ROOT);
    await fs.ensureDir(HOME);
    await fs.ensureDir(PROJECT);
    vi.spyOn(os, 'homedir').mockReturnValue(HOME);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.remove(ROOT);
  });

  it('renews the matchers, keeps the guard script, and does not call the file hand-edited', async () => {
    await new InstallEngine().install('software-engineering', { targetDir: path.join(PROJECT, '.agents'), method: 'copy', fanout: ['claude'] } as never);
    const projected: string[] = [];
    for (const file of await fs.readdir(AGENTS)) {
      const text = (await fs.readFile(path.join(AGENTS, file), 'utf8')).replace(/\r\n/g, '\n');
      if (text.includes(NEW_SHELL) && text.includes(NEW_WRITE) && /args:\n\s+- -e\n/.test(text)) projected.push(file);
    }
    expect(projected.length).toBeGreaterThan(0);
    const file = path.join(AGENTS, projected[0]!);
    const current = (await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n');
    const older = current.split(NEW_SHELL).join(OLD_SHELL).split(NEW_WRITE).join(OLD_WRITE);
    expect(older).not.toBe(current);
    await fs.writeFile(file, older);
    expect(inspectNativeAgent(older).guard).toBe('destructive');

    const report = await DoctorEngine.runDoctor(path.join(PROJECT, '.agents'), 'claude');
    expect(report.warnings.join('\n')).not.toMatch(/modified|hand-edit/i);
    await new UpdateEngine().update('__all__', { hosts: ['agents'], cwd: PROJECT } as never);
    const after = (await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n');
    expect(after).toContain(NEW_SHELL);
    expect(after).toContain(NEW_WRITE);
    expect(after).not.toContain(OLD_SHELL);
    expect(inspectNativeAgent(after).guard).toBe('destructive');
  });
});
