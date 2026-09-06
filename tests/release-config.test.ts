import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
// @ts-ignore
import { analyzeCommits } from '@semantic-release/commit-analyzer';

describe('semantic-release configuration (.releaserc.json)', () => {
  const releasercPath = path.resolve(process.cwd(), '.releaserc.json');

  it('contains valid JSON with releaseRules configuring release and Release', () => {
    const config = fs.readJsonSync(releasercPath);
    expect(config.branches).toContain('main');

    const commitAnalyzerPlugin = config.plugins.find(
      (p: any) => Array.isArray(p) && p[0] === '@semantic-release/commit-analyzer'
    );

    expect(commitAnalyzerPlugin).toBeDefined();
    const rules = commitAnalyzerPlugin[1]?.releaseRules;
    expect(rules).toBeDefined();

    expect(rules).toContainEqual({ type: 'release', release: 'minor' });
    expect(rules).toContainEqual({ type: 'Release', release: 'minor' });
    expect(rules).toContainEqual({ type: 'feat', release: 'minor' });
    expect(rules).toContainEqual({ type: 'fix', release: 'patch' });
  });

  it('triggers a minor release when a commit starts with Release: or release:', async () => {
    const config = fs.readJsonSync(releasercPath);
    const commitAnalyzerPlugin = config.plugins.find(
      (p: any) => Array.isArray(p) && p[0] === '@semantic-release/commit-analyzer'
    );
    const pluginConfig = commitAnalyzerPlugin[1];

    const releaseUpper = await analyzeCommits(pluginConfig, {
      commits: [{ message: 'Release: Plan 012 Subagent-First Planning Loop (#13)', hash: 'abc1234' }],
      logger: { log: () => {} },
    });
    expect(releaseUpper).toBe('minor');

    const releaseLower = await analyzeCommits(pluginConfig, {
      commits: [{ message: 'release: 0.7.0 update', hash: 'abc1235' }],
      logger: { log: () => {} },
    });
    expect(releaseLower).toBe('minor');

    const featCommit = await analyzeCommits(pluginConfig, {
      commits: [{ message: 'feat: add new agent bundle', hash: 'abc1236' }],
      logger: { log: () => {} },
    });
    expect(featCommit).toBe('minor');

    const fixCommit = await analyzeCommits(pluginConfig, {
      commits: [{ message: 'fix: resolve race condition', hash: 'abc1237' }],
      logger: { log: () => {} },
    });
    expect(fixCommit).toBe('patch');

    const choreCommit = await analyzeCommits(pluginConfig, {
      commits: [{ message: 'chore: update documentation', hash: 'abc1238' }],
      logger: { log: () => {} },
    });
    expect(choreCommit).toBeNull();
  });
});
