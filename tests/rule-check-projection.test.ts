/**
 * ADR 0082: rule-check passes exactly the rule the Claude compound projection emits with its content intact.
 *
 * The test drives `ClaudeProjector.planCompoundProjection` on a temporary registry that holds a normal rule, a rule over the
 * line budget, a host entry-point file and a rule the projector's residue safety net would rewrite, then asks `rule-check`
 * about each file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { runRuleCheck } from '../src/core/rule-check.js';
import type { BundleDefinition, ResolvedAssets } from '../src/core/types.js';

const BUDGET = ClaudeProjector.CLAUDE_DIALECT.maxRuleLines;
const NORMAL = '# Keep commits small\n\nCommit one logical change at a time.\nUse read_file before you edit.\n';
const ROUTING = '# Host Routing\n\nSend each task to the host that owns it.\n';
const OVERSIZE = ['# Long rule', '', ...Array.from({ length: BUDGET + 5 }, (_, index) => `Line ${index} of the rule.`)].join('\n');
const ENTRY_POINT = '# Agents\n\nThe entry-point file of a host.\n';

describe('rule-check agrees with the Claude compound projection', () => {
  let registry: string;
  beforeEach(() => {
    registry = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-rule-projection-')));
    fs.mkdirSync(path.join(registry, 'rules'), { recursive: true });
    const files: Record<string, string> = {
      'normal-rule.md': NORMAL, 'oversize-rule.md': OVERSIZE, 'AGENTS.md': ENTRY_POINT, 'host-routing.md': ROUTING,
    };
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(registry, 'rules', name), text);
  });
  afterEach(() => { fs.rmSync(registry, { recursive: true, force: true }); });

  const bundle: BundleDefinition = { name: 'rule-proof', description: 'A bundle that only references rules.', agents: [], skills: [] };
  const resolved = (rules: string[]): ResolvedAssets => ({ targetBundle: 'rule-proof', agents: [], skills: [], workflows: [], rules });
  const checked = (name: string) => runRuleCheck({ artifact: path.join(registry, 'rules', name) });
  const codes = (name: string): string[] => [...new Set(checked(name).findings.map(item => item.code))].sort();

  async function emitted() {
    const artifacts = await ClaudeProjector.planCompoundProjection(
      bundle, 'project', resolved(['normal-rule.md', 'oversize-rule.md', 'AGENTS.md', 'host-routing.md']), registry,
    );
    return artifacts.filter(item => item.kind === 'rule');
  }

  it('emits the normal rule with its title and body, and rule-check passes it', async () => {
    const rule = (await emitted()).find(item => item.relPath === '.claude/rules/normal-rule.md');
    expect(rule).toBeDefined();
    const content = String(rule?.content);
    expect(content).toContain('# Keep commits small');
    expect(content).toContain('Commit one logical change at a time.');
    expect(content).toContain('Use Read before you edit.');
    expect(checked('normal-rule.md').status).toBe('passed');
  });

  it('does not emit the oversize rule or the entry-point file, and rule-check fails both', async () => {
    const paths = (await emitted()).map(item => item.relPath);
    expect(paths).not.toContain('.claude/rules/oversize-rule.md');
    expect(paths).not.toContain('.claude/rules/AGENTS.md');
    expect(codes('oversize-rule.md')).toEqual(['BUDGET']);
    expect(codes('AGENTS.md')).toEqual(['NAME']);
  });

  it('emits a rule whose content the projector rewrote, and rule-check fails exactly that rule', async () => {
    const rule = (await emitted()).find(item => item.relPath === '.claude/rules/host-routing.md');
    expect(rule).toBeDefined();
    const content = String(rule?.content);
    expect(content).not.toContain('# Host Routing');
    expect(content).not.toContain('Send each task to the host that owns it.');
    expect(codes('host-routing.md')).toEqual(['RENDER_CHANGE']);
  });

  it('passes rule-check for exactly the emitted rules whose content is intact', async () => {
    const intact = (await emitted()).filter(item => {
      const name = path.posix.basename(item.relPath);
      const source = fs.readFileSync(path.join(registry, 'rules', name), 'utf8');
      return String(item.content).includes(source.split('\n')[0] ?? '');
    }).map(item => path.posix.basename(item.relPath));
    expect(intact).toEqual(['normal-rule.md']);
    const passing = ['normal-rule.md', 'oversize-rule.md', 'AGENTS.md', 'host-routing.md'].filter(name => checked(name).status === 'passed');
    expect(passing).toEqual(intact);
  });
});
