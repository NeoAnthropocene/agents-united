import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { loadTranslationLedger } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { RegistryResolver } from '../src/core/registry.js';
import { lintSkillPortability, warnOversizeAntigravityRule } from '../src/core/skill-portability-lint.js';

/**
 * Plan 026 Step 1 (RED, TDD) — the Declared-Delta Registry gains `antigravity` and `cline`
 * coverage, `agents doctor --host <h>` surfaces the degraded/unsupported features that apply,
 * and a new portability lint catches skills that would break at least one active host.
 */

// The Step 0 feature inventory (every canonical field/tool FEATURE_LEDGER already tracks for
// Claude, plus `workflows`, which Plan 026 adds as its own cross-host feature). The two
// above-floor-only Claude affordances (runtimeDeliveredHandback, agentTeamsPeerReachability)
// are deliberately excluded: they are host-native scope additions declared only where the
// realization actually claims them, not canonical fields every host must account for.
const STEP0_FEATURES = [
  'version',
  'type',
  'mainAgent',
  'subagent',
  'inheritCustomizations',
  'commandExecutionPolicy',
  'hooks',
  'rules',
  'effort',
  'invoke_subagent',
  'send_message',
  'manage_task',
  'schedule',
  'define_subagent',
  'manage_subagents',
  'ask_question',
  'generate_image',
  'skills',
  'mcpServers',
  'workflows',
];

describe('Declared-Delta Registry — antigravity/cline completeness (Plan 026 gate 2)', () => {
  const entries = loadTranslationLedger();

  it('has an entry for every Step 0 feature on claude, antigravity and cline', () => {
    const missing: string[] = [];
    for (const feature of STEP0_FEATURES) {
      for (const host of ['claude', 'antigravity', 'cline']) {
        const found = entries.find(e => e.feature === feature && e.host === host);
        if (!found) missing.push(`${feature}/${host}`);
      }
    }
    expect(missing, `undeclared feature/host pairs: ${missing.join(', ')}`).toEqual([]);
  });

  it('every entry carries a valid disposition and a non-empty rationale', () => {
    const valid = new Set(['mapped', 'approximated', 'degraded', 'unsupported']);
    for (const entry of entries) {
      expect(valid.has(entry.disposition), `${entry.feature}/${entry.host} has invalid disposition "${entry.disposition}"`).toBe(true);
      expect(entry.rationale.trim().length, `${entry.feature}/${entry.host} has an empty rationale`).toBeGreaterThan(0);
    }
  });

  it('declares cline skills as mapped (Step 4 STOP condition cleared)', () => {
    const entry = entries.find(e => e.feature === 'skills' && e.host === 'cline');
    expect(entry?.disposition).toBe('mapped');
  });
});

describe('agents doctor --host <h> — declared-delta section (Plan 026 gate 3)', () => {
  // Own scratch subdirectory (not the shared scratch/ root other suites use) so this file's
  // sibling projection dirs (.claude/, .cline/, ...) never collide with a concurrently
  // running suite's own .claude/, .cline/, ... at the shared scratch/ root.
  const tempDir = path.resolve(process.cwd(), 'scratch/host-matrix-doctor/test-workspace');

  // Other suites' workspaces live under scratch/ too, so the compound lane's sibling dirs
  // (.claude/, .cline/, ...) at the scratch/ root can be mid-write from a concurrently
  // running file (see tests/doctor.test.ts's own note on this hazard). A bounded immediate
  // re-attempt absorbs the race.
  const removeWithRetry = async (target: string): Promise<void> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await fs.remove(target);
        return;
      } catch {
        // Concurrent writer; try again immediately.
      }
    }
  };

  beforeEach(async () => {
    await removeWithRetry(tempDir);
    const scratchRoot = path.dirname(tempDir);
    for (const sibling of ['.claude', '.cline', '.agents', '.opencode', '.cursor', '.gemini']) {
      await removeWithRetry(path.join(scratchRoot, sibling));
    }
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await removeWithRetry(tempDir);
  });

  it('--host cline lists degraded/unsupported features for an installed bundle', async () => {
    const resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    const installer = new InstallEngine(resolver);
    await installer.install('software-engineering', { targetDir: tempDir, method: 'copy', fanout: ['cline'] });

    const report = await DoctorEngine.runDoctor(tempDir, 'cline');
    expect(report.declaredDeltas, 'expected declaredDeltas on the report for --host cline').toBeDefined();
    const features = (report.declaredDeltas ?? []).map(d => d.feature);
    expect(features).toContain('hooks');
    expect(features).toContain('mcpServers');
    expect((report.declaredDeltas ?? []).every(d => d.host === 'cline')).toBe(true);
    expect((report.declaredDeltas ?? []).every(d => d.disposition === 'degraded' || d.disposition === 'unsupported')).toBe(true);
  });

  it('--host antigravity lists degraded/unsupported features for an installed bundle', async () => {
    const resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    const installer = new InstallEngine(resolver);
    await installer.install('software-engineering', { targetDir: tempDir });

    const report = await DoctorEngine.runDoctor(tempDir, 'antigravity');
    expect(report.declaredDeltas, 'expected declaredDeltas on the report for --host antigravity').toBeDefined();
    const features = (report.declaredDeltas ?? []).map(d => d.feature);
    expect(features).toContain('workflows');
    expect((report.declaredDeltas ?? []).every(d => d.host === 'antigravity')).toBe(true);
  });

  it('--host claude keeps its existing output and adds only the declared-delta section', async () => {
    const resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    const installer = new InstallEngine(resolver);
    await installer.install('software-engineering', { targetDir: tempDir, method: 'copy', fanout: ['claude'] });

    const report = await DoctorEngine.runDoctor(tempDir, 'claude');
    expect(report.claudeCapability).toBeDefined();
    expect(report.declaredDeltas, 'expected declaredDeltas on the report for --host claude').toBeDefined();
    const features = (report.declaredDeltas ?? []).map(d => d.feature);
    expect(features).toContain('hooks');
    expect(features).toContain('commandExecutionPolicy');
  });

  it('an unrecognized --host value yields no declaredDeltas section (never guesses)', async () => {
    await fs.ensureDir(tempDir);
    const report = await DoctorEngine.runDoctor(tempDir, 'bogus-host');
    expect(report.declaredDeltas).toBeUndefined();
  });
});

describe('Skill portability lint (Plan 026 Objective 5 — RED fixtures)', () => {
  it('flags a name that breaks the Claude Code name rule (uppercase/underscore)', () => {
    const violations = lintSkillPortability({
      dirName: 'My_Bad_Skill',
      name: 'My_Bad_Skill',
      body: '# fine\n',
    });
    expect(violations.some(v => v.includes('lowercase letters, digits and hyphens'))).toBe(true);
  });

  it('flags a name containing a reserved word', () => {
    const violations = lintSkillPortability({
      dirName: 'claude-helper',
      name: 'claude-helper',
      body: '# fine\n',
    });
    expect(violations.some(v => v.includes('reserved-word'))).toBe(true);
  });

  it('flags a name over the 64-char Claude limit', () => {
    const longName = 'a-'.repeat(35) + 'z'; // 71 chars, valid charset
    const violations = lintSkillPortability({ dirName: longName, name: longName, body: '# fine\n' });
    expect(violations.some(v => v.includes('64-char limit'))).toBe(true);
  });

  it('flags a frontmatter name that does not match its directory (Cline rule)', () => {
    const violations = lintSkillPortability({
      dirName: 'on-disk-name',
      name: 'different-name',
      body: '# fine\n',
    });
    expect(violations.some(v => v.includes('directory name'))).toBe(true);
  });

  it('flags an oversize SKILL.md body (exceeds the smallest host limit)', () => {
    const bigBody = Array.from({ length: 600 }, (_, i) => `Line ${i} of filler content.`).join('\n');
    const violations = lintSkillPortability({ dirName: 'big-skill', name: 'big-skill', body: bigBody });
    expect(violations.some(v => v.includes('lines'))).toBe(true);
  });

  it('flags a bash-only script with no cross-platform counterpart', () => {
    const violations = lintSkillPortability({
      dirName: 'deploy-helper',
      name: 'deploy-helper',
      body: '# fine\n',
      scripts: [
        {
          relPath: 'scripts/validate.sh',
          content: '#!/bin/bash\nif [[ -f "$1" ]]; then\n  echo ok\nfi\n',
        },
      ],
    });
    expect(violations.some(v => v.includes('bash-only'))).toBe(true);
  });

  it('does not flag a bash script that has a cross-platform counterpart', () => {
    const violations = lintSkillPortability({
      dirName: 'deploy-helper',
      name: 'deploy-helper',
      body: '# fine\n',
      scripts: [
        { relPath: 'scripts/validate.sh', content: '#!/bin/bash\necho ok\n' },
        { relPath: 'scripts/validate.ps1', content: 'Write-Host "ok"\n' },
      ],
    });
    expect(violations.some(v => v.includes('bash-only'))).toBe(false);
  });

  it('passes a fully compliant skill clean', () => {
    const violations = lintSkillPortability({
      dirName: 'good-skill',
      name: 'good-skill',
      body: '# Good Skill\n\nShort and compliant.\n',
      scripts: [{ relPath: 'scripts/validate.py', content: 'print("ok")\n' }],
    });
    expect(violations).toEqual([]);
  });

  it('warns (does not fail) when a projected rule exceeds the Antigravity budget', () => {
    const oversized = 'x'.repeat(25 * 1024);
    const warning = warnOversizeAntigravityRule('rules/huge.md', oversized);
    expect(warning).toBeDefined();
    expect(warning).toContain('24576-byte');
  });

  it('does not warn for a rule within the Antigravity budget', () => {
    expect(warnOversizeAntigravityRule('rules/small.md', 'short content')).toBeUndefined();
  });
});

describe('Docs — Plan 026 deliverables exist and are linked (gate 5)', () => {
  it('docs/host-primitive-matrix.md exists and covers all three hosts', async () => {
    const content = await fs.readFile(path.resolve(process.cwd(), 'docs/host-primitive-matrix.md'), 'utf8');
    expect(content).toContain('Claude Code');
    expect(content).toContain('Antigravity');
    expect(content).toContain('Cline');
    expect(content.toLowerCase()).toContain('mapped | approximated | degraded | unsupported'.toLowerCase());
  });

  it('docs/skill-intake.md exists and documents the intake checklist', async () => {
    const content = await fs.readFile(path.resolve(process.cwd(), 'docs/skill-intake.md'), 'utf8');
    expect(content.toLowerCase()).toContain('licen');
    expect(content.toLowerCase()).toContain('attribution');
  });

  it('PROJECT.md §6 links the matrix doc', async () => {
    const content = await fs.readFile(path.resolve(process.cwd(), 'PROJECT.md'), 'utf8');
    expect(content).toContain('docs/host-primitive-matrix.md');
  });

  it('README links the matrix or intake doc', async () => {
    const content = await fs.readFile(path.resolve(process.cwd(), 'README.md'), 'utf8');
    expect(content.includes('docs/host-primitive-matrix.md') || content.includes('docs/skill-intake.md')).toBe(true);
  });
});
