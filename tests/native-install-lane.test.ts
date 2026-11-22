import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { listNativeRoles, nativeRoleSource, nativeWorkflowSource, renderNativeRole, renderNativeWorkflow, listNativeWorkflows } from '../src/core/native-package.js';
import { HostProjector } from '../src/core/projector.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { lintWorkflow } from './helpers/workflow-lint.js';

/**
 * Plan 032 Phase 7 — the native-package install lane for Claude agents. Opt-in beside the legacy projection lane
 * (strangler): `nativeLane` installs the committed `registry/hosts/claude/agents/<role>.md` verbatim behind a managed
 * marker, with no rendering step and no LLM. The lane is sticky in the lockfile like the plugin lane, and doctor's
 * freshness check compares against the same native render.
 */

const REGISTRY = path.resolve('registry');
const BUNDLE = 'software-engineering';
/** The five native roles the Tier-1 `software-engineering` bundle installs. */
const NATIVE_ROLES = ['backend-architect', 'code-reviewer', 'frontend-architect', 'orchestrator-engineering', 'repo-index'];
/** Every committed native Claude role, including optional 3D and the bounded contributor main and workers. */
const COMMITTED_NATIVE_ROLES = [
  'accessibility-lead', 'agency-3d-designer', 'agency-campaign-specialist', 'agency-compliance-grc-specialist', 'agency-content-strategist', 'agency-conversion-specialist', 'agency-creative-designer', 'agency-frontend-architect', 'agency-growth-strategist', 'agency-motion-designer', 'agency-qa-automation-lead', 'agency-seo-specialist', 'agency-sound-designer', 'android-architect', 'appsec-penetration-tester', 'backend-architect', 'business-panel-experts', 'cloud-infrastructure-architect', 'cloud-security-architect', 'code-reviewer', 'compliance-grc-specialist', 'cross-platform-specialist', 'data-engineer', 'database-administrator', 'deep-research', 'design-ops-lead', 'design-researcher', 'design-systems-architect', 'designer-toolkit-expert', 'devops-engineer', 'distributed-systems-architect', 'e2e-tester', 'factory-evaluator', 'factory-realizer', 'factory-sync', 'financial-analyst', 'finops-cost-engineer', 'frontend-architect', 'interaction-designer', 'ios-architect', 'legal-contract-analyst', 'lifecycle-email-specialist', 'literature-patent-analyst', 'market-intelligence-analyst', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'marketing-growth-strategist', 'operations-strategist', 'orchestrator-agent-factory', 'orchestrator-business', 'orchestrator-design', 'orchestrator-digital-agency', 'orchestrator-engineering', 'orchestrator-marketing', 'orchestrator-research', 'orchestrator-security', 'orchestrator-system-architecture', 'paid-acquisition-specialist', 'plg-strategist', 'prototype-tester', 'qa-automation-lead', 'repo-index', 'security-engineer', 'seo-specialist', 'socratic-mentor', 'statistical-analyst', 'sysops-sre-lead', 'system-architect', 'ui-designer', 'ux-strategist',
];
const COORDINATORS = ['orchestrator-business', 'orchestrator-design', 'orchestrator-engineering', 'orchestrator-marketing', 'orchestrator-research', 'orchestrator-security', 'orchestrator-system-architecture'];
/** The lead and the five roles the growth-marketing bundle installs as native files (growth-marketing). */
const GROWTH_MARKETING_NATIVE = ['marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'marketing-growth-strategist', 'orchestrator-marketing'];
/** What the seo-content-marketing add-on adds as native files on top of its parent: the SEO specialist and the content strategist, with the lead they share. */
const SEO_CONTENT_NATIVE = ['marketing-content-strategist', 'orchestrator-marketing', 'seo-specialist'];
/** What the performance-paid-acquisition add-on installs as native files on top of its parent: the paid acquisition specialist and the three marketing roles it works with, with the lead they share. */
const PAID_ACQUISITION_NATIVE = ['marketing-campaign-specialist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'orchestrator-marketing', 'paid-acquisition-specialist'];
/** What the product-led-growth add-on installs as native files on top of its parent: the PLG strategist and the two marketing roles it works with, with the lead they share. */
const PLG_NATIVE = ['marketing-conversion-specialist', 'marketing-growth-strategist', 'orchestrator-marketing', 'plg-strategist'];
/** What the lifecycle-email-marketing add-on installs as native files on top of its parent: the lifecycle email specialist and the campaign specialist it works with, with the lead they share. */
const LIFECYCLE_NATIVE = ['lifecycle-email-specialist', 'marketing-campaign-specialist', 'orchestrator-marketing'];
/** The canonical asset a native role stands for: specialists are `subagent-<role>`, a coordinator keeps its own name. */
const canonicalOf = (role: string): string => (COORDINATORS.includes(role) ? `agents/${role}.md` : `agents/subagent-${role}.md`);
const sha256 = (text: string): string => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

describe('native package helpers', () => {
  it('lists the committed native roles of a host, sorted', () => {
    expect(listNativeRoles(REGISTRY, 'claude')).toEqual(COMMITTED_NATIVE_ROLES);
    expect(listNativeRoles(REGISTRY, 'no-such-host')).toEqual([]);
  });

  it('finds a role source by its stripped name, and nothing for a legacy-only role', () => {
    expect(nativeRoleSource(REGISTRY, 'claude', 'code-reviewer')).toBe(path.join(REGISTRY, 'hosts', 'claude', 'agents', 'code-reviewer.md'));
    expect(nativeRoleSource(REGISTRY, 'claude', 'ai-model-architect')).toBeUndefined();
    expect(nativeRoleSource(REGISTRY, 'claude', '../profile')).toBeUndefined();
  });

  const source = '---\r\nname: demo\r\ndescription: A demo.\r\n---\r\n\r\n# demo\r\n\r\nBody.\r\n';

  it('stamps a managed marker as the first body line, keeps the frontmatter, and normalises line endings', () => {
    const rendered = renderNativeRole(source, 'agents/subagent-demo.md');
    expect(HostProjector.hasManagedMarker(rendered)).toBe(true);
    expect(rendered).not.toContain('\r');
    const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(rendered)!;
    expect(yaml.parse(front)).toEqual({ name: 'demo', description: 'A demo.' });
    const lines = body.replace(/^\n/, '').split('\n');
    expect(lines[0]).toMatch(/^<!-- managed-by: agents-united \| profile: claude-native \| canonical: agents\/subagent-demo\.md \| source: sha256:[0-9a-f]{64} \| do not edit -->$/);
    expect(lf(rendered).endsWith('# demo\n\nBody.\n')).toBe(true);
  });

  it('is deterministic and carries the hash of the normalised source', () => {
    expect(renderNativeRole(source, 'agents/subagent-demo.md')).toBe(renderNativeRole(source.replace(/\r\n/g, '\n'), 'agents/subagent-demo.md'));
    expect(renderNativeRole(source, 'agents/subagent-demo.md')).toContain(sha256(lf(source)));
    expect(renderNativeRole(`${source}More.\n`, 'agents/subagent-demo.md')).not.toBe(renderNativeRole(source, 'agents/subagent-demo.md'));
  });

  it('refuses a source without frontmatter', () => {
    expect(() => renderNativeRole('# no frontmatter\n', 'agents/x.md')).toThrow(/frontmatter/);
  });
});

describe('native agents follow the model posture of ADR 0018 decision 7 as amended by its 2026-10-03 addendum (coordinators opus/medium, specialists sonnet/medium)', () => {
  it('pins the coordinator to opus at medium effort in the Claude dialect', () => {
    expect(ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults?.coordinator).toBe('opus');
    expect(ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults?.coordinator).toBe('medium');
  });

  it.each(NATIVE_ROLES)('%s pins its role posture', role => {
    const posture = COORDINATORS.includes(role) ? 'coordinator' : 'specialist';
    const text = lf(fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', role)!, 'utf8'));
    const meta = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(text)![1]);
    expect(meta.model).toBe(ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults?.[posture]);
    expect(meta.effort).toBe(ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults?.[posture]);
  });
});

describe('native install lane (agents add --native)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-install-lane');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const claudeAgent = (role: string): string => path.join(workspace, '.claude', 'agents', `${role}.md`);

  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane, ...extra });
  const expected = (role: string): string =>
    renderNativeRole(fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', role)!, 'utf8'), canonicalOf(role));

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('is off by default: the legacy projection is written for every role', async () => {
    await install();
    for (const role of NATIVE_ROLES) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('writes the committed native file for each native role', async () => {
    await install(true);
    for (const role of NATIVE_ROLES) expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
  });

  it('keeps the legacy projection for a type that has no native agent, in the same workspace', async () => {
    await install(true);
    await new InstallEngine().install('ai-ml-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const legacy = await fs.readFile(claudeAgent('ai-model-architect'), 'utf8');
    expect(legacy).toContain('profile: claude |');
    expect(legacy).not.toContain('claude-native');
    // The native agents installed earlier are untouched by the second install.
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toBe(expected('code-reviewer'));
  });

  it('installs the native product-design roles with the design lead, recorded as managed roles of their canonical agents, the lead at the coordinator posture', async () => {
    await new InstallEngine().install('product-design', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    for (const role of ['interaction-designer', 'orchestrator-design', 'ui-designer', 'ux-strategist']) expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/orchestrator-design.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe('agents/orchestrator-design.md');
    expect(record.managedMarker).toBe(true);
    const meta = yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(lf(fs.readFileSync(nativeRoleSource(REGISTRY, 'claude', 'orchestrator-design')!, 'utf8')))![1]);
    expect(meta.model).toBe(ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults?.coordinator);
    expect(meta.effort).toBe(ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults?.coordinator);
  });

  it('installs the native devops-engineer for the devops-engineering bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('devops-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('devops-engineer'), 'utf8')).toBe(expected('devops-engineer'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/devops-engineer.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('devops-engineer'));
    expect(record.managedMarker).toBe(true);
  });

  it('installs the native ui-designer, ux-strategist and interaction-designer for the product-design bundle, recorded as managed roles of their canonical agents', async () => {
    await new InstallEngine().install('product-design', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const projections = (await fs.readJson(lockPath)).projections;
    for (const role of ['interaction-designer', 'ui-designer', 'ux-strategist']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      expect(projections[`.claude/agents/${role}.md`], role).toMatchObject({ kind: 'role', canonical: canonicalOf(role), managedMarker: true });
    }
  });

  it('without the native lane, product-design still writes the legacy projection for its three designers', async () => {
    await new InstallEngine().install('product-design', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['interaction-designer', 'ui-designer', 'ux-strategist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('without the native lane, devops-engineering still writes the legacy projection for devops-engineer', async () => {
    await new InstallEngine().install('devops-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('devops-engineer'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native security-engineer for the security-operations bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('security-operations', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('security-engineer'), 'utf8')).toBe(expected('security-engineer'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/security-engineer.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('security-engineer'));
    expect(record.managedMarker).toBe(true);
  });

  it('installs the native orchestrator-security with the security-operations bundle, recorded as a managed coordinator of its own canonical agent', async () => {
    await new InstallEngine().install('security-operations', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('orchestrator-security'), 'utf8')).toBe(expected('orchestrator-security'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/orchestrator-security.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe('agents/orchestrator-security.md');
    expect(record.managedMarker).toBe(true);
  });

  it('without the native lane, security-operations still writes the legacy projection for security-engineer', async () => {
    await new InstallEngine().install('security-operations', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('security-engineer'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native accessibility-lead for the frontend-engineering bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('frontend-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('accessibility-lead'), 'utf8')).toBe(expected('accessibility-lead'));
    expect(await fs.readFile(claudeAgent('frontend-architect'), 'utf8')).toBe(expected('frontend-architect'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/accessibility-lead.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('accessibility-lead'));
    expect(record.managedMarker).toBe(true);
  });

  it('without the native lane, frontend-engineering still writes the legacy projection for accessibility-lead', async () => {
    await new InstallEngine().install('frontend-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('accessibility-lead'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native lead, system-architect and backend-architect for the system-architecture bundle, each a managed role of its canonical agent', async () => {
    await new InstallEngine().install('system-architecture', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of ['orchestrator-system-architecture', 'system-architect', 'backend-architect']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, system-architecture still writes the legacy projection for system-architect', async () => {
    await new InstallEngine().install('system-architecture', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('system-architect'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native lead and the five native marketing roles for the growth-marketing bundle, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('growth-marketing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of GROWTH_MARKETING_NATIVE) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
    // The agency's copies of the same cores belong to another bundle and are not installed here.
    expect(await fs.pathExists(claudeAgent('agency-growth-strategist'))).toBe(false);
  });

  it('without the native lane, growth-marketing writes the legacy projection for the lead and all five roles', async () => {
    await new InstallEngine().install('growth-marketing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of GROWTH_MARKETING_NATIVE) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native lead, deep-research and socratic-mentor for the deep-research bundle, recorded as managed roles of their canonical agents', async () => {
    await new InstallEngine().install('deep-research', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of ['orchestrator-research', 'deep-research', 'socratic-mentor']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, the deep-research bundle still writes the legacy projection for both research specialists', async () => {
    await new InstallEngine().install('deep-research', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['deep-research', 'socratic-mentor']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native lead and business-panel-experts for the business-strategy bundle, each a managed role of its canonical agent', async () => {
    await new InstallEngine().install('business-strategy', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of ['orchestrator-business', 'business-panel-experts']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, business-strategy still writes the legacy projection for business-panel-experts', async () => {
    await new InstallEngine().install('business-strategy', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('business-panel-experts'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native design-systems-architect and design-ops-lead for the design-systems-ops bundle, recorded as managed roles of their canonical agents', async () => {
    await new InstallEngine().install('design-systems-ops', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const projections = (await fs.readJson(lockPath)).projections;
    for (const role of ['design-ops-lead', 'design-systems-architect']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      expect(projections[`.claude/agents/${role}.md`], role).toMatchObject({ kind: 'role', canonical: canonicalOf(role), managedMarker: true });
    }
  });

  it('without the native lane, design-systems-ops still writes the legacy projection for its two roles', async () => {
    await new InstallEngine().install('design-systems-ops', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['design-ops-lead', 'design-systems-architect']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native design-researcher, designer-toolkit-expert and prototype-tester for the design-research-testing bundle, recorded as managed roles of their canonical agents', async () => {
    await new InstallEngine().install('design-research-testing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const projections = (await fs.readJson(lockPath)).projections;
    for (const role of ['design-researcher', 'designer-toolkit-expert', 'prototype-tester']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      expect(projections[`.claude/agents/${role}.md`], role).toMatchObject({ kind: 'role', canonical: canonicalOf(role), managedMarker: true });
    }
  });

  it('without the native lane, design-research-testing still writes the legacy projection for its three roles', async () => {
    await new InstallEngine().install('design-research-testing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['design-researcher', 'designer-toolkit-expert', 'prototype-tester']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native sysops-sre-lead with the lead and the natives of its parent bundle for the sysops-sre bundle, each a managed role of its canonical agent', async () => {
    await new InstallEngine().install('sysops-sre', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of ['orchestrator-system-architecture', 'sysops-sre-lead', 'system-architect', 'backend-architect']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, sysops-sre still writes the legacy projection for sysops-sre-lead', async () => {
    await new InstallEngine().install('sysops-sre', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('sysops-sre-lead'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native cloud-infrastructure-architect with system-architect, the natives of its parent bundle and the lead for the system-architecture-cloud bundle, each a managed role of its canonical agent', async () => {
    await new InstallEngine().install('system-architecture-cloud', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of ['orchestrator-system-architecture', 'cloud-infrastructure-architect', 'system-architect', 'backend-architect']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, system-architecture-cloud still writes the legacy projection for cloud-infrastructure-architect', async () => {
    await new InstallEngine().install('system-architecture-cloud', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('cloud-infrastructure-architect'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native database-administrator with backend-architect (reused unchanged), the natives of its parent bundle and the lead for the system-architecture-data bundle, each a managed role of its canonical agent', async () => {
    await new InstallEngine().install('system-architecture-data', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of ['orchestrator-system-architecture', 'database-administrator', 'system-architect', 'backend-architect']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, system-architecture-data still writes the legacy projection for database-administrator', async () => {
    await new InstallEngine().install('system-architecture-data', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('database-administrator'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native finops-cost-engineer with system-architect, the natives of its parent bundle and the lead for the system-architecture-finops bundle, each a managed role of its canonical agent', async () => {
    await new InstallEngine().install('system-architecture-finops', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of ['orchestrator-system-architecture', 'finops-cost-engineer', 'system-architect', 'backend-architect']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, system-architecture-finops still writes the legacy projection for finops-cost-engineer', async () => {
    await new InstallEngine().install('system-architecture-finops', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('finops-cost-engineer'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native SEO specialist and the native content strategist for seo-content-marketing, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('seo-content-marketing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of SEO_CONTENT_NATIVE) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections['.claude/agents/' + role + '.md'];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
    // The Tier 2 copies of the same cores belong to the digital agency and are not installed here.
    expect(await fs.pathExists(claudeAgent('agency-seo-specialist'))).toBe(false);
    expect(await fs.pathExists(claudeAgent('agency-content-strategist'))).toBe(false);
  });

  it('without the native lane, seo-content-marketing writes the legacy projection for the SEO specialist and the content strategist', async () => {
    await new InstallEngine().install('seo-content-marketing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['marketing-content-strategist', 'seo-specialist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native paid acquisition specialist and its three marketing roles for performance-paid-acquisition, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('performance-paid-acquisition', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of PAID_ACQUISITION_NATIVE) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections['.claude/agents/' + role + '.md'];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
    // The Tier 2 copies of the same cores belong to the digital agency and are not installed here.
    for (const role of ['agency-campaign-specialist', 'agency-conversion-specialist', 'agency-creative-designer']) expect(await fs.pathExists(claudeAgent(role)), role).toBe(false);
  });

  it('without the native lane, performance-paid-acquisition writes the legacy projection for the paid acquisition specialist and its three marketing roles', async () => {
    await new InstallEngine().install('performance-paid-acquisition', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['marketing-campaign-specialist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'paid-acquisition-specialist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native PLG strategist and its two marketing roles for product-led-growth, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('product-led-growth', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of PLG_NATIVE) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections['.claude/agents/' + role + '.md'];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
    // The Tier 2 copies of the same cores belong to the digital agency and are not installed here.
    for (const role of ['agency-conversion-specialist', 'agency-growth-strategist']) expect(await fs.pathExists(claudeAgent(role)), role).toBe(false);
  });

  it('without the native lane, product-led-growth writes the legacy projection for the PLG strategist and its two marketing roles', async () => {
    await new InstallEngine().install('product-led-growth', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['marketing-conversion-specialist', 'marketing-growth-strategist', 'plg-strategist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native lifecycle email specialist and the campaign specialist for lifecycle-email-marketing, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('lifecycle-email-marketing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of LIFECYCLE_NATIVE) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections['.claude/agents/' + role + '.md'];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
    // The Tier 2 copy of the campaign core belongs to the digital agency and is not installed here.
    expect(await fs.pathExists(claudeAgent('agency-campaign-specialist'))).toBe(false);
  });

  it('without the native lane, lifecycle-email-marketing writes the legacy projection for the lifecycle email specialist and the campaign specialist', async () => {
    await new InstallEngine().install('lifecycle-email-marketing', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['lifecycle-email-specialist', 'marketing-campaign-specialist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native analytics specialists for the deep-research-analytics bundle, recorded as managed roles of their canonical agents', async () => {
    await new InstallEngine().install('deep-research-analytics', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    const lock = await fs.readJson(lockPath);
    for (const role of ['statistical-analyst', 'literature-patent-analyst', 'deep-research']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind, role).toBe('role');
      expect(record.canonical, role).toBe(canonicalOf(role));
      expect(record.managedMarker, role).toBe(true);
    }
  });

  it('without the native lane, the deep-research-analytics bundle still writes the legacy projection for both analytics specialists', async () => {
    await new InstallEngine().install('deep-research-analytics', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['statistical-analyst', 'literature-patent-analyst']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native financial-analyst for the business-financial-modeling bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('business-financial-modeling', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('financial-analyst'), 'utf8')).toBe(expected('financial-analyst'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/financial-analyst.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('financial-analyst'));
    expect(record.managedMarker).toBe(true);
  });

  it('without the native lane, business-financial-modeling still writes the legacy projection for financial-analyst', async () => {
    await new InstallEngine().install('business-financial-modeling', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('financial-analyst'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native market-intelligence-analyst for the business-market-intelligence bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('business-market-intelligence', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('market-intelligence-analyst'), 'utf8')).toBe(expected('market-intelligence-analyst'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/market-intelligence-analyst.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('market-intelligence-analyst'));
    expect(record.managedMarker).toBe(true);
  });

  it('without the native lane, business-market-intelligence still writes the legacy projection for market-intelligence-analyst', async () => {
    await new InstallEngine().install('business-market-intelligence', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('market-intelligence-analyst'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native legal-contract-analyst and operations-strategist for the business-operations-legal bundle, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('business-operations-legal', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    for (const role of ['legal-contract-analyst', 'operations-strategist']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = (await fs.readJson(lockPath)).projections[`.claude/agents/${role}.md`];
      expect(record.kind).toBe('role');
      expect(record.canonical).toBe(canonicalOf(role));
      expect(record.managedMarker).toBe(true);
    }
  });

  it('without the native lane, business-operations-legal still writes the legacy projection for both of its roles', async () => {
    await new InstallEngine().install('business-operations-legal', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['legal-contract-analyst', 'operations-strategist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native qa-automation-lead for the qa-automation bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('qa-automation', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('qa-automation-lead'), 'utf8')).toBe(expected('qa-automation-lead'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/qa-automation-lead.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('qa-automation-lead'));
    expect(record.managedMarker).toBe(true);
  });

  it('without the native lane, qa-automation still writes the legacy projection for qa-automation-lead', async () => {
    await new InstallEngine().install('qa-automation', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('qa-automation-lead'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native e2e-tester beside the qa-automation-lead for the qa-automation bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('qa-automation', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('e2e-tester'), 'utf8')).toBe(expected('e2e-tester'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/e2e-tester.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('e2e-tester'));
    expect(record.managedMarker).toBe(true);
  });

  it('without the native lane, qa-automation still writes the legacy projection for e2e-tester', async () => {
    await new InstallEngine().install('qa-automation', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    const text = await fs.readFile(claudeAgent('e2e-tester'), 'utf8');
    expect(text).toContain('profile: claude |');
    expect(text).not.toContain('claude-native');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native ios-architect, android-architect and cross-platform-specialist for the mobile-development bundle, each recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('mobile-development', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    for (const role of ['ios-architect', 'android-architect', 'cross-platform-specialist']) {
      expect(await fs.readFile(claudeAgent(role), 'utf8'), role).toBe(expected(role));
      const record = (await fs.readJson(lockPath)).projections[`.claude/agents/${role}.md`];
      expect(record.kind).toBe('role');
      expect(record.canonical).toBe(canonicalOf(role));
      expect(record.managedMarker).toBe(true);
    }
  });

  it('without the native lane, mobile-development still writes the legacy projection for its three roles', async () => {
    await new InstallEngine().install('mobile-development', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
    for (const role of ['ios-architect', 'android-architect', 'cross-platform-specialist']) {
      const text = await fs.readFile(claudeAgent(role), 'utf8');
      expect(text, role).toContain('profile: claude |');
      expect(text, role).not.toContain('claude-native');
    }
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('installs the native cloud-security-architect for the secops-cloud-security bundle, recorded as a managed role of its canonical agent', async () => {
    await new InstallEngine().install('secops-cloud-security', { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    expect(await fs.readFile(claudeAgent('cloud-security-architect'), 'utf8')).toBe(expected('cloud-security-architect'));
    const record = (await fs.readJson(lockPath)).projections['.claude/agents/cloud-security-architect.md'];
    expect(record.kind).toBe('role');
    expect(record.canonical).toBe(canonicalOf('cloud-security-architect'));
    expect(record.managedMarker).toBe(true);
  });

  it('records the lane, and every projection hash matches the file on disk', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    expect(lock.nativeLane).toBe(true);
    for (const role of NATIVE_ROLES) {
      const record = lock.projections[`.claude/agents/${role}.md`];
      expect(record.kind).toBe('role');
      expect(record.canonical).toBe(canonicalOf(role));
      expect(record.managedMarker).toBe(true);
      expect(record.hash).toBe(sha256(await fs.readFile(claudeAgent(role), 'utf8')));
    }
  });

  it('is byte-stable: a second install regenerates identical files without --force', async () => {
    await install(true);
    const first = await fs.readFile(claudeAgent('code-reviewer'));
    await install(true);
    expect((await fs.readFile(claudeAgent('code-reviewer'))).equals(first)).toBe(true);
  });

  it('is sticky: an install without the flag (what `agents update` does) keeps the native files', async () => {
    await install(true);
    await install(undefined, { force: true });
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toBe(expected('code-reviewer'));
    expect((await fs.readJson(lockPath)).nativeLane).toBe(true);
  });

  it('can be turned off explicitly: the legacy projection returns and the record is dropped', async () => {
    await install(true);
    await install(false, { force: true });
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toContain('profile: claude |');
    expect((await fs.readJson(lockPath)).nativeLane).toBeUndefined();
  });

  it('a dry run reports the same projection paths and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toEqual(expect.arrayContaining(NATIVE_ROLES.map(role => `.claude/agents/${role}.md`)));
    expect(await fs.pathExists(path.join(workspace, '.claude'))).toBe(false);
  });

  it('refuses to overwrite an unmanaged file of the same name without --force', async () => {
    await fs.outputFile(claudeAgent('code-reviewer'), '---\nname: code-reviewer\n---\nMine.\n');
    await expect(install(true)).rejects.toThrow(/not managed by agents-united/);
    await install(true, { force: true });
    expect(await fs.readFile(claudeAgent('code-reviewer'), 'utf8')).toBe(expected('code-reviewer'));
  });

  it('doctor finds a fresh native install healthy, and reports drift and stale renders', async () => {
    await install(true);
    const healthy = await DoctorEngine.runDoctor(agentsDir);
    expect(healthy.warnings.filter(w => /projection|drift|Outdated/i.test(w))).toEqual([]);

    const file = claudeAgent('code-reviewer');
    await fs.appendFile(file, '\nA local edit.\n');
    const drifted = await DoctorEngine.runDoctor(agentsDir);
    expect(drifted.warnings.join('\n')).toMatch(/Content drift \.claude\/agents\/code-reviewer\.md/);
  });

  it('doctor reports a native install whose source moved on as outdated (hash freshness)', async () => {
    await install(true);
    const lock = await fs.readJson(lockPath);
    const file = claudeAgent('repo-index');
    // Simulate an older release: rewrite the file with a different source hash, keep the recorded hash in step.
    const older = (await fs.readFile(file, 'utf8')).replace(/source: sha256:[0-9a-f]{64}/, `source: sha256:${'0'.repeat(64)}`);
    await fs.writeFile(file, older);
    lock.projections['.claude/agents/repo-index.md'].hash = sha256(older);
    await fs.writeJson(lockPath, lock);
    const report = await DoctorEngine.runDoctor(agentsDir);
    expect(report.warnings.join('\n')).toMatch(/Outdated projection \.claude\/agents\/repo-index\.md/);
  });

  it('removing the bundle removes the native files it installed', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    for (const role of NATIVE_ROLES) expect(await fs.pathExists(claudeAgent(role)), role).toBe(false);
  });
});

describe('native workflows (agents add --native installs the host workflow in place of the skill of the same name)', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-workflows');
  const agentsDir = path.join(workspace, '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const workflowFile = path.join(workspace, '.claude', 'workflows', 'workflow-review.js');
  const skillDir = path.join(workspace, '.claude', 'skills', 'workflow-review');
  const install = (nativeLane?: boolean, extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy', fanout: ['claude'], nativeLane, ...extra });
  const expected = (): string =>
    renderNativeWorkflow(fs.readFileSync(nativeWorkflowSource(REGISTRY, 'claude', 'workflow-review')!, 'utf8'), 'skills/workflow-review/SKILL.md');

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(workspace);
  });
  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('renders the authored script unchanged with the marker as the last line, so the file still starts with `export const meta`', () => {
    const source = "export const meta = { name: 'x', description: 'y' }\nreturn 1\n";
    const rendered = renderNativeWorkflow(source.replace(/\n/g, '\r\n'), 'skills/x/SKILL.md');
    expect(rendered.startsWith(source)).toBe(true);
    const last = rendered.trimEnd().split('\n').pop()!;
    expect(last).toMatch(/^\/\/ managed-by: agents-united \| profile: claude-native \| canonical: skills\/x\/SKILL\.md \| source: sha256:[0-9a-f]{64} \| do not edit$/);
    expect(HostProjector.hasManagedMarker(rendered)).toBe(true);
    expect(renderNativeWorkflow(source, 'skills/x/SKILL.md')).toBe(rendered);
    expect(lintWorkflow(rendered)).toEqual([]);
  });

  it('is off by default: the skill is projected and no workflow is written', async () => {
    await install();
    expect(await fs.pathExists(path.join(skillDir, 'SKILL.md'))).toBe(true);
    expect(await fs.pathExists(workflowFile)).toBe(false);
  });

  it('installs the workflow instead of the skill of the same name, and keeps every other skill', async () => {
    await install(true);
    expect(await fs.readFile(workflowFile, 'utf8')).toBe(expected());
    expect(await fs.pathExists(skillDir)).toBe(false);
    // A workflow-* skill with no native workflow stays a skill (this follows the registry, so it does not go stale as workflows are added).
    const native = listNativeWorkflows(REGISTRY, 'claude');
    const bundle = Object.values(JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')).bundles as Record<string, { name: string; skills?: string[] }>).find(entry => entry.name === BUNDLE)!;
    const stillSkill = (bundle.skills ?? []).filter(name => name.startsWith('workflow-') && !native.includes(name));
    expect(stillSkill.length).toBeGreaterThan(0);
    for (const name of stillSkill) expect(await fs.pathExists(path.join(workspace, '.claude', 'skills', name, 'SKILL.md')), name).toBe(true);
  });

  it('records it as a workflow projection of the skill it replaces, with a matching hash and ownership', async () => {
    await install(true);
    const record = (await fs.readJson(lockPath)).projections['.claude/workflows/workflow-review.js'];
    expect(record).toMatchObject({ host: 'claude', kind: 'workflow', canonical: 'skills/workflow-review/SKILL.md', managedMarker: true });
    expect(record.owners).toContain(BUNDLE);
    expect(record.hash).toBe(sha256(await fs.readFile(workflowFile, 'utf8')));
  });

  it('is byte-stable on a second install, and sticky across an install without the flag', async () => {
    await install(true);
    const first = await fs.readFile(workflowFile);
    await install(true);
    await install(undefined, { force: true });
    expect((await fs.readFile(workflowFile)).equals(first)).toBe(true);
    expect(await fs.pathExists(skillDir)).toBe(false);
  });

  it('turning the lane off removes the workflow and brings the skill back', async () => {
    await install(true);
    await install(false, { force: true });
    expect(await fs.pathExists(workflowFile)).toBe(false);
    expect(await fs.pathExists(path.join(skillDir, 'SKILL.md'))).toBe(true);
  });

  it('a dry run lists the workflow path and writes nothing', async () => {
    const dry = await install(true, { dryRun: true });
    expect(dry.projections.map(p => p.path)).toContain('.claude/workflows/workflow-review.js');
    expect(await fs.pathExists(path.join(workspace, '.claude'))).toBe(false);
  });

  it('doctor finds it healthy, and reports an edit as content drift', async () => {
    await install(true);
    const healthy = await DoctorEngine.runDoctor(agentsDir);
    expect(healthy.warnings.filter(w => /workflow-review|drift|Outdated/i.test(w))).toEqual([]);
    await fs.appendFile(workflowFile, '// a local edit\n');
    const drifted = await DoctorEngine.runDoctor(agentsDir);
    expect(drifted.warnings.join('\n')).toMatch(/Content drift \.claude\/workflows\/workflow-review\.js/);
  });

  it('removing the bundle removes the workflow it installed', async () => {
    await install(true);
    await new UninstallEngine().uninstall(BUNDLE, { targetDir: agentsDir });
    expect(await fs.pathExists(workflowFile)).toBe(false);
  });
});
