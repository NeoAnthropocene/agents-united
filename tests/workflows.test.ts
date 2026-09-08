import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

describe('Workflow: sync-main-to-dev.yml', () => {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/sync-main-to-dev.yml');

  it('exists and parses as valid YAML', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, 'utf8');
    const parsed = YAML.parse(content);
    expect(parsed).toBeDefined();
    expect(parsed.name).toBe('Sync main to dev');
  });

  it('configures proper triggers and permissions', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const parsed = YAML.parse(content);

    expect(parsed.on.workflow_run).toBeDefined();
    expect(parsed.on.workflow_run.workflows).toContain('Release');
    expect(parsed.on.workflow_run.types).toContain('completed');
    expect(parsed.on.workflow_dispatch).toBeDefined();

    expect(parsed.permissions.contents).toBe('write');
    expect(parsed.permissions['pull-requests']).toBe('write');

    // Asserts SYNC_TOKEN is wired for checkout and sync actions
    expect(content).toContain('secrets.SYNC_TOKEN || secrets.GITHUB_TOKEN');
  });

  it('includes direct merge and push step to avoid PR overhead and unapproved CI runs', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    
    // Direct fast-forward push
    expect(content).toContain('git push origin origin/main:refs/heads/dev');

    // Direct merge and push into dev (handles squash-merged diverged history)
    expect(content).toContain('git checkout -B dev origin/dev');
    expect(content).toContain('git merge origin/main');
    expect(content).toContain('git push origin dev');
    expect(content).toContain('[skip ci]');

    // Fallback to PR creation if direct push fails
    expect(content).toContain('gh pr create');
  });
});
