import { describe, expect, it } from 'vitest';
import { installPackedPackage } from './helpers/packed-package.js';
import type { CommandRunner } from './helpers/packed-package.js';

const base = { npmCli: '/npm/bin/npm-cli.js', prefix: '/tmp/runtime', tarball: '/tmp/agents-united-1.0.0.tgz' };

function recorder(outcomes: Array<string | Error>): { run: CommandRunner; calls: string[][]; warnings: string[]; warn: (line: string) => void } {
  const calls: string[][] = [];
  const warnings: string[] = [];
  const run: CommandRunner = (_command, args) => {
    calls.push(args);
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next ?? '';
  };
  return { run, calls, warnings, warn: line => { warnings.push(line); } };
}

const notCached = (): Error => Object.assign(new Error('Command failed'), { stderr: 'npm error code ENOTCACHED\nnpm error request to https://registry.npmjs.org/@clack%2fprompts failed' });

describe('installPackedPackage', () => {
  it('runs the offline install once and says nothing when it succeeds', () => {
    const r = recorder(['ok']);
    installPackedPackage({ ...base, run: r.run, warn: r.warn });
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).toContain('--offline');
    expect(r.calls[0]).not.toContain('--prefer-offline');
    expect(r.warnings).toEqual([]);
  });

  it('retries once with --prefer-offline after ENOTCACHED, changing nothing else, and says so', () => {
    const r = recorder([notCached(), 'ok']);
    installPackedPackage({ ...base, run: r.run, warn: r.warn });
    expect(r.calls).toHaveLength(2);
    const [first, second] = r.calls as [string[], string[]];
    expect(second).toContain('--prefer-offline');
    expect(second).not.toContain('--offline');
    expect(second.map(a => (a === '--prefer-offline' ? '--offline' : a))).toEqual(first);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/--prefer-offline/);
  });

  it('throws with the output of the retry when the retry also fails', () => {
    const r = recorder([notCached(), Object.assign(new Error('Command failed'), { stderr: 'npm error code E404 retry output' })]);
    expect(() => installPackedPackage({ ...base, run: r.run, warn: r.warn })).toThrow(/E404 retry output/);
    expect(r.calls).toHaveLength(2);
  });

  it('does not retry any other failure and throws with npm output', () => {
    const r = recorder([Object.assign(new Error('Command failed'), { stderr: 'npm error code EACCES denied here' })]);
    expect(() => installPackedPackage({ ...base, run: r.run, warn: r.warn })).toThrow(/EACCES denied here/);
    expect(r.calls).toHaveLength(1);
    expect(r.warnings).toEqual([]);
  });
});
