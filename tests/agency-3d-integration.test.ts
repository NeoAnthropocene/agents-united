import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { domainTypes } from '../src/core/native-roster.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { RegistryResolver } from '../src/core/registry.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { evidenceFor } from './helpers/native-invariant-evidence.js';

const root = path.resolve('registry');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'bundles.json'), 'utf8'));
const skills = ['3d-design-direction', 'threejs-scene-production', '3d-asset-review', 'workflow-agency-3d-production', 'audiovisual-review', 'handoff'];

describe('real optional 3D Bundle integration', () => {
  it('scopes questions to the lead when delegated and allows direct standalone clarification', async () => {
    const invariant = 'When delegated, route user questions through the calling lead; in direct standalone work, ask the user for missing brief inputs.';
    const core = (await loadSemanticCore(root)).get('subagent-3d-designer')!;
    expect(core.invariants).toContain(invariant);
    expect(core.invariants).not.toContain('Questions for the user go to the calling lead in the final report, never to the user directly.');
    const canonical = fs.readFileSync(path.join(root, 'agents/subagent-3d-designer.md'), 'utf8');
    const native = fs.readFileSync(path.join(root, 'hosts/claude/agents/agency-3d-designer.md'), 'utf8');
    for (const text of [canonical, native]) {
      expect(text).toMatch(/When delegated[^\n]*questions for the user go to the (?:calling )?lead/i);
      expect(text).toMatch(/direct standalone (?:work|use)[^\n]*ask the user for missing brief inputs/i);
    }
    const evidence = evidenceFor('agency-3d-designer', invariant)!;
    expect(evidence.test(native)).toBe(true);
    expect(evidence.test('When delegated, questions for the user go to the lead.')).toBe(false);
    expect(evidence.test('In direct standalone use, ask the user for missing brief inputs.')).toBe(false);
  });
  it('ships the independent role, all declared Skills and native mapping without a parent', () => {
    const bundle = manifest.bundles['agency-3d-production'];
    expect(bundle).toBeDefined();
    expect(bundle.parentBundle).toBeUndefined();
    expect(bundle.agents).toEqual(['subagent-3d-designer.md']);
    expect(bundle.skills).toEqual(expect.arrayContaining(skills));
    expect(bundle.nativeRoles['subagent-3d-designer.md']).toBe('agency-3d-designer');
    expect(bundle.personaAliases['arda-3d']).toBe('subagent-3d-designer');
    const contract = JSON.parse(fs.readFileSync(path.join(root, 'core/subagent-3d-designer.contract.json'), 'utf8'));
    expect(contract.skills).toEqual(skills);
  });
  it('ships each referenced helper and independent contract references', () => {
    for (const file of [
      '3d-design-direction/scripts/project-3d.mjs',
      '3d-asset-review/scripts/inspect-glb.mjs',
      'threejs-scene-production/scripts/setup-three.mjs',
      'threejs-scene-production/scripts/render-three.mjs',
      'threejs-scene-production/scripts/shared-3d-runtime.mjs',
      'threejs-scene-production/scripts/shot-handoff.mjs',
      'audiovisual-review/scripts/review.mjs',
      ...skills.slice(0, 4).map(s => `${s}/references/contract.md`),
    ]) {
      const location = path.join(root, 'skills', file);
      expect(fs.existsSync(location), file).toBe(true);
      if (file.endsWith('contract.md')) expect(fs.readFileSync(location, 'utf8')).not.toMatch(/placeholder|CONTRACT-PROPOSAL/);
    }
  });
  it('advertises the supplying Bundle in Chris roster and grants his actual Agent tool', () => {
    const role = 'agency-3d-designer';
    expect(domainTypes(manifest.bundles, 'digital-agency').find(type => type.name === role)?.bundles).toEqual(['agency-3d-production']);
    const chris = fs.readFileSync(path.join(root, 'hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8');
    expect(chris).toContain('| `agency-3d-designer` | `agency-3d-production` |');
    expect(inspectNativeAgent(chris).tools.some(tool => tool.startsWith('Agent(') && tool.includes(role))).toBe(true);
  });
  it('excludes the role and its four Skills from resolved full', async () => {
    const full = await new RegistryResolver(root).resolve('full');
    expect(full.agents ?? []).not.toContain('subagent-3d-designer.md');
    for (const skill of skills.slice(0, 4)) expect(full.skills ?? []).not.toContain(skill);
  });
});



