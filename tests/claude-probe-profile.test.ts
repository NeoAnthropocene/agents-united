import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClaudeCapabilityProbe } from '../src/core/claude-capabilities.js';
import { loadHostProfile } from '../src/core/host-profile.js';
import type { ProcessRunner } from '../src/core/types.js';

/**
 * Plan 032 Phase 7 — the capability probe reads the Claude host profile (`registry/hosts/claude/profile.json`) for what it
 * knows about the host, instead of keeping the knowledge in code. The runtime facts still come from the binary
 * (ADR 0018 decision 11: `--version` and `--help` only), and the profile adds the expectations to check them against.
 */

const profile = loadHostProfile('registry', 'claude');
const PREFIX = ['/x/cli.js'];
const HELP = 'Usage: claude\n  --plugin-dir <path>   load plugins\nEnvironment:\n  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS   agent teams\n';

const probeFor = (version: string, help = HELP) => {
  const runner: ProcessRunner = async (_exe, args) =>
    args.includes('--version') ? { exitCode: 0, stdout: `${version} (Claude Code)\n`, stderr: '' } : { exitCode: 0, stdout: help, stderr: '' };
  return new ClaudeCapabilityProbe(runner, { resolveExecutable: () => ({ executable: 'node', prefixArgs: PREFIX, source: 'node-wrapper' }) }).probe();
};

describe('profile-backed Claude capability probe', () => {
  it('the profile carries the SubagentHandback version floor as data', () => {
    expect(profile.features.subagentHandback.since).toBe('2.1.271');
    expect(profile.minVersion).toBe('2.1.271');
  });

  it('derives the hand-off floor from the profile: the floor itself and later versions have it, earlier ones do not', async () => {
    expect((await probeFor('2.1.271')).subagentHandback).toBe(true);
    expect((await probeFor('2.1.285')).subagentHandback).toBe(true);
    expect((await probeFor('2.2.0')).subagentHandback).toBe(true);
    expect((await probeFor('2.1.270')).subagentHandback).toBe(false);
    expect((await probeFor('1.9.999')).subagentHandback).toBe(false);
  });

  it('the profile carries the agent-teams version floor as data, dated by the changelog snapshot', () => {
    expect(profile.features.agentTeams.since).toBe('2.1.32');
    const changelog = fs.readFileSync(path.join('host-library', 'claude', 'changelog.md'), 'utf8').split(/\r?\n/);
    const entry = changelog.findIndex((line) => /Added research preview agent teams feature/.test(line));
    expect(entry).toBeGreaterThan(-1);
    let heading = entry;
    while (heading > 0 && !/^## \d+\.\d+\.\d+/.test(changelog[heading])) heading -= 1;
    expect(changelog[heading]).toBe(`## ${profile.features.agentTeams.since}`);
  });

  // `claude --help` on 2.1.289 and 2.1.291 names neither agent teams nor CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS (checked
  // 2026-10-06), and the feature runs there: session 4b08fd11 ran nine in-process teammates on 2.1.291 (Plan 035 H1).
  it('derives agent-teams support from the profile floor when --help does not name it: the floor and later versions have it, earlier ones do not', async () => {
    const helpWithoutTeams = 'Usage: claude\n  --plugin-dir <path>   load plugins\n';
    for (const version of ['2.1.32', '2.1.289', '2.1.291', '2.2.0']) {
      expect((await probeFor(version, helpWithoutTeams)).agentTeamsExperimental, version).toBe(true);
    }
    for (const version of ['2.1.31', '2.0.0', '1.9.999']) {
      expect((await probeFor(version, helpWithoutTeams)).agentTeamsExperimental, version).toBe(false);
    }
  });

  it('reports the profile it checked against, with no diagnostics for a version the profile was reviewed against', async () => {
    const report = await probeFor(profile.reviewedAgainst);
    expect(report.profile).toEqual({ profileId: profile.profileId, minVersion: profile.minVersion, reviewedAgainst: profile.reviewedAgainst, belowMinimum: false, newerThanReviewed: false });
    expect(report.diagnostics).toEqual([]);
  });

  it('flags a version older than the profile minimum', async () => {
    const report = await probeFor('2.1.200');
    expect(report.profile?.belowMinimum).toBe(true);
    expect(report.diagnostics.join('\n')).toMatch(/older than the minimum 2\.1\.271/);
  });

  it('records a version newer than the reviewed one as data for maintainers, and tells the user nothing', async () => {
    const report = await probeFor('2.9.0');
    expect(report.profile?.newerThanReviewed).toBe(true);
    expect(report.installed).toBe(true);
    expect(report.diagnostics).toEqual([]);
  });

  it('flags a --help that contradicts the profile (the plugin lane is declared available but the flag is missing)', async () => {
    const report = await probeFor('2.1.285', 'Usage: claude\n');
    expect(report.pluginSupport).toBe(false);
    expect(report.diagnostics.join('\n')).toMatch(/profile declares the plugin lane available.*--plugin-dir/);
  });

  it('still runs exactly --version then --help', async () => {
    const calls: string[][] = [];
    const runner: ProcessRunner = async (_exe, args) => {
      calls.push(args);
      return args.includes('--version') ? { exitCode: 0, stdout: '2.1.285\n', stderr: '' } : { exitCode: 0, stdout: HELP, stderr: '' };
    };
    await new ClaudeCapabilityProbe(runner, { resolveExecutable: () => ({ executable: 'node', prefixArgs: PREFIX, source: 'node-wrapper' }) }).probe();
    expect(calls).toEqual([[...PREFIX, '--version'], [...PREFIX, '--help']]);
  });

  it('leaves the profile out when Claude is not installed', async () => {
    const report = await new ClaudeCapabilityProbe(async () => ({ exitCode: 0, stdout: '', stderr: '' }), { resolveExecutable: () => null }).probe();
    expect(report.installed).toBe(false);
    expect(report.profile).toBeUndefined();
  });
});
