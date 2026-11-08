import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';

// Plan 050: installed availability is universal; routing and preloading are opt-in.
// These tests inspect declarations, not model behavior or host execution.
const registry = path.resolve('registry');
const companions = ['host-agent-router', 'handoff', 'git-guardrails'];
interface Bundle {
  orchestrator?: string;
  parentBundle?: string;
  skills?: string[];
  agents?: string[];
  workflows?: string[];
  rules?: string[];
  status?: string;
  hostAvailability?: unknown;
  nativeRoles?: Record<string, string>;
  personaAliases?: Record<string, string>;
}
const bundles = (JSON.parse(fs.readFileSync(path.join(registry, 'bundles.json'), 'utf8')) as {
  bundles: Record<string, Bundle>;
}).bundles;
const leads = [...new Set(Object.values(bundles).flatMap(bundle => bundle.orchestrator ? [bundle.orchestrator] : []))].sort();
const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();
const clause = "Only when the user explicitly asks to run work on another host CLI, use host-agent-router if installed. Name the proposed hosts and explain that this spends the user's other accounts; get consent before the first run, treating existing consent for those hosts and this scope as valid. Otherwise continue this host's normal delegation. Follow the router's worker contract: read-only by default, one isolated checkout per editing worker, and verify the handoff against changed files before accepting work.";

function read(relative: string): string {
  return fs.readFileSync(path.join(registry, relative), 'utf8').replace(/\r\n/g, '\n');
}
function frontmatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  return match ? (yaml.parse(match[1]) ?? {}) as Record<string, unknown> : {};
}
function body(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '');
}
function filesBelow(relative: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(registry, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) out.push(...filesBelow(child));
    else if (/\.(md|ya?ml)$/.test(entry.name)) out.push(child);
  }
  return out;
}
// Find native lead agents, the Cline lead rule and the Cline coordinator Skill.
// Restrict to lead paths, so adding unrelated specialists does not create a clause mandate.
const nativeLeadFiles = filesBelow('hosts').filter(file =>
  /\/(?:agents|rules)\/[^/]*orchestrator[^/]*\.(?:md|ya?ml)$/.test(file)
  || /\/skills\/orchestrator-[^/]+\/SKILL\.md$/.test(file));
const coreLeadFiles = leads.map(file => `core/${file.replace(/\.md$/, '.core.md')}`).filter(file => fs.existsSync(path.join(registry, file)));

describe('Plan 050 — every declared Bundle carries the dormant router contract', () => {
  it.each(Object.entries(bundles))('%s declares all three Skills exactly once, including standalone addons', (_name, bundle) => {
    // Check the actual declaration: parent resolution must not hide a missing addon owner.
    for (const skill of companions) expect((bundle.skills ?? []).filter(item => item === skill)).toHaveLength(1);
  });

  it('the three Skills and worker supporting files exist as installable registry assets', () => {
    for (const skill of companions) expect(fs.existsSync(path.join(registry, 'skills', skill, 'SKILL.md'))).toBe(true);
    for (const file of ['scripts/router.mjs', 'references/worker-contract.md', 'assets/config.default.json']) {
      expect(fs.existsSync(path.join(registry, 'skills/host-agent-router', file))).toBe(true);
    }
  });

  it('covers every current canonical lead and every native lead surface', () => {
    const canonicalLeads = fs.readdirSync(path.join(registry, 'agents')).filter(file => /^orchestrator-.*\.md$/.test(file)).sort();
    expect(leads).toEqual(canonicalLeads);
    expect(coreLeadFiles).toEqual(['core/orchestrator-digital-agency.core.md', 'core/orchestrator-engineering.core.md']);
    expect(nativeLeadFiles).toEqual(expect.arrayContaining([
      'hosts/claude/agents/orchestrator-engineering.md',
      'hosts/claude/agents/orchestrator-digital-agency.md',
      'hosts/antigravity/agents/orchestrator-engineering.md',
      'hosts/cline/rules/agents-united-orchestrator-engineering.md',
      'hosts/cline/skills/orchestrator-engineering/SKILL.md',
    ]));
  });

  it.each(leads)('canonical %s states the opt-in contract in its body', file => {
    expect(normalize(body(read(`agents/${file}`)))).toContain(clause);
  });

  it.each(coreLeadFiles)('%s carries the contract in its shared safety floor', file => {
    expect(normalize(String(frontmatter(read(file)).safety ?? ''))).toContain(clause);
  });

  it.each(nativeLeadFiles)('%s carries the opt-in contract in native body text', file => {
    expect(normalize(body(read(file)))).toContain(clause);
  });

  it.each([...leads.map(file => `agents/${file}`), ...nativeLeadFiles])('%s preloads the router only for the universal lead', file => {
    const declared = frontmatter(read(file)).skills;
    const skills = Array.isArray(declared) ? declared.map(String) : typeof declared === 'string' ? [declared] : [];
    expect(skills.filter(skill => skill === 'host-agent-router')).toHaveLength(file === 'agents/orchestrator-universal.md' ? 1 : 0);
  });

  it('preserves contributor-only factory delivery rather than expanding host support', () => {
    const factory = bundles['agent-factory'];
    expect(factory.status).toBe('under-construction');
    expect(factory.hostAvailability).toEqual({ claude: { lane: 'native', scopes: ['workspace'] } });
    expect(factory.agents).toEqual([]);
    expect(factory.workflows).toEqual([]);
    expect(factory.rules).toEqual(['skill-attribution.md']);
    expect(factory.skills).toContain('author-skill');
    expect(factory.orchestrator).toBeUndefined();
  });

  it('preserves standalone optional 3D placement without inventing host or parent restrictions', () => {
    const optional = bundles['agency-3d-production'];
    expect(optional.parentBundle).toBeUndefined();
    expect(optional.orchestrator).toBeUndefined();
    expect(optional.hostAvailability).toBeUndefined();
    expect(optional.agents).toEqual(['subagent-3d-designer.md']);
    expect(optional.nativeRoles).toEqual({ 'subagent-3d-designer.md': 'agency-3d-designer' });
    expect(optional.personaAliases).toEqual({ 'arda-3d': 'subagent-3d-designer' });
    expect(optional.skills).toEqual(expect.arrayContaining(['3d-design-direction', 'threejs-scene-production', '3d-asset-review', 'workflow-agency-3d-production', 'audiovisual-review', 'handoff']));
    expect(bundles['remotion-agent-skills']).toBeUndefined();
  });
});
