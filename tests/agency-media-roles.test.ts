import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BundlesManifest } from '../src/core/types.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { checkFloor } from '../src/core/native-floor.js';

const manifest = JSON.parse(fs.readFileSync('registry/bundles.json', 'utf8')) as BundlesManifest;
const agency = manifest.bundles['digital-agency'];
const mediaSkills = ['motion-design-direction', 'native-motion-production', 'remotion-production', 'video-generation', 'sound-design-direction', 'audio-generation', 'audio-post-production', 'audiovisual-review', 'workflow-agency-motion-production'];
const roles = ['motion-designer', 'sound-designer'];
const native = (role: string): string => fs.readFileSync(path.join('registry/hosts/claude/agents', `${role}.md`), 'utf8');

describe('digital agency media production roles', () => {
  it('ships both specialists and the complete end-user skill inventory in agency and full', () => {
    for (const bundle of [agency, manifest.bundles.full]) {
      expect(bundle.agents).toEqual(expect.arrayContaining(roles.map(role => `subagent-${role}.md`)));
      expect(bundle.skills).toEqual(expect.arrayContaining(mediaSkills));
    }
    for (const role of roles) expect(agency.nativeRoles?.[`subagent-${role}.md`]).toBe(`agency-${role}`);
  });

  it.each(roles)('%s keeps a semantic floor, guarded production tools and bounded relay', async role => {
    const text = native(`agency-${role}`);
    const core = (await loadSemanticCore('registry')).get(`subagent-${role}`);
    expect(core).toBeDefined();
    expect(checkFloor(text, core!)).toEqual([]);
    const tools = inspectNativeAgent(text).tools;
    expect(tools).toEqual(expect.arrayContaining(['Bash', 'PowerShell', 'Write', 'Edit', 'Skill', 'ToolSearch', 'SendMessage', 'SubagentHandback', 'Monitor', 'TaskGet', 'TaskUpdate']));
    expect(tools).not.toContain('Agent');
    expect(text).toContain('agents-united-guard.js');
    expect(text).toContain('Planning consultation.');
    expect(text).toContain('write no deliverable file');
    expect(text).toContain('Relay mode is the default');
    expect(text).toContain('at most two exchanges per pair');
    expect(text).toContain('timeline revision');
    const authored = text.split('<!-- agents-united:floor:end -->')[1] ?? '';
    expect(authored).toContain('canonical timeline fingerprint');
    expect(authored).toContain('A revision label alone is insufficient');
    expect(authored).toContain('copy change invalidates dependent handoffs');
  });

  it('every specialist identifies media requests during consultation and keeps user questions with Chris', () => {
    for (const role of Object.values(agency.nativeRoles ?? {})) {
      const text = native(role);
      expect(text, role).toContain('Media Request');
      expect(text, role).toContain('Motion Designer');
      expect(text, role).toContain('Sound Designer');
      expect(text, role).toMatch(/required or optional media/);
      expect(text, role).toMatch(/Questions for the user go to (Chris|the lead)/);
    }
    expect(inspectNativeAgent(native('agency-creative-designer')).tools).not.toContain('Bash');
  });

  it('Chris makes routes and approval explicit before production', () => {
    const text = native('orchestrator-digital-agency');
    expect(text).toContain('include, defer or decline');
    expect(text).toContain('Native Claude motion graphics');
    expect(text).toContain('Remotion');
    expect(text).toContain('media/project.json');
    expect(text).toContain('local, API or hybrid');
    expect(text).toContain('Static jobs do not');
    expect(text).toContain('timing approval');
    expect(text).toContain('agency-motion-designer');
    expect(text).toContain('agency-sound-designer');
    expect(text).toContain('external-footage opt-in');
    expect(text).toContain('canonical fingerprint');
    expect(text).toContain('eleven types are a menu');
    expect(agency.planningLoop?.budget?.maxPlanningRounds).toBe(2);
    expect(agency.planningLoop?.budget?.maxPeerExchangesPerPair).toBe(2);
  });

  it('Sound-only WAV ownership and applicable review agree across the floor, roles and lead', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-sound-designer')!;
    const canonical = fs.readFileSync('registry/agents/subagent-sound-designer.md', 'utf8');
    const authored = native('agency-sound-designer').split('<!-- agents-united:floor:end -->')[1] ?? '';
    for (const text of [core.scope_boundaries, canonical, authored]) {
      expect(text).toMatch(/Sound-only[\s\S]*Sound (?:Designer )?owns[\s\S]*lead-approved cue\/timing record/i);
      expect(text).toMatch(/Sound-only[\s\S]*directly to Chris/);
      expect(text).toMatch(/Motion, storyboard, video, renderer installation and mux checks are not applicable/);
    }
    for (const file of ['registry/agents/orchestrator-digital-agency.md', 'registry/hosts/claude/agents/orchestrator-digital-agency.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/For Sound-only WAV[\s\S]*lead-approved cue\/timing record[\s\S]*directly to Chris/);
      expect(text, file).toContain('Motion, storyboard, video, renderer installation and mux checks are not applicable');
      expect(text, file).toContain('canonical fingerprint');
    }
    expect(checkFloor(native('agency-sound-designer'), core)).toEqual([]);
    expect(core.output_contract).toContain('transcript or caption timing when applicable');
  });

  it('names lyric language and synthetic-singing copy rules for the Sound Designer and the lead', async () => {
    const core = (await loadSemanticCore('registry')).get('subagent-sound-designer')!;
    const canonical = fs.readFileSync('registry/agents/subagent-sound-designer.md', 'utf8');
    const authored = native('agency-sound-designer').split('<!-- agents-united:floor:end -->')[1] ?? '';
    for (const text of [canonical, authored]) {
      expect(text).toMatch(/lyric language/i);
      expect(text).toMatch(/synthetic singing/);
      expect(text).toMatch(/named living performer/);
      expect(text).toContain("Kaan's approved copy");
    }
    for (const file of ['registry/agents/orchestrator-digital-agency.md', 'registry/hosts/claude/agents/orchestrator-digital-agency.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/non-commercial weight licence/);
      expect(text, file).toContain("Lyrics remain Kaan's approved copy even when sung");
    }
    expect(checkFloor(native('agency-sound-designer'), core)).toEqual([]);
  });

  it('grants official manual provider names to their specialists and the main-thread pool', () => {
    const lead = inspectNativeAgent(native('orchestrator-digital-agency')).tools;
    for (const [role, servers] of [
      ['motion-designer', ['higgsfield', 'klingai']],
      ['sound-designer', ['elevenlabs', 'fish-audio']],
    ] as const) {
      const tools = inspectNativeAgent(native(`agency-${role}`)).tools;
      for (const server of servers) {
        expect(tools).toContain(`mcp__${server}`);
        expect(lead).toContain(`mcp__${server}`);
        expect(tools.some(tool => tool.startsWith(`mcp__plugin_${server}`) || tool.startsWith(`mcp__claude_ai_${server}`))).toBe(false);
      }
    }
  });

  it('keeps media inventory scoped to agency/full and canonical planning conditional on the agency', () => {
    for (const [name, bundle] of Object.entries(manifest.bundles)) {
      if (name === 'digital-agency' || name === 'full') continue;
      expect((bundle.skills ?? []).filter(skill => mediaSkills.includes(skill)), name).toEqual([]);
    }
    for (const file of agency.agents ?? []) {
      const text = fs.readFileSync(path.join('registry/agents', file), 'utf8');
      expect(text, file).toContain('Media Request');
      if (!roles.some(role => file === `subagent-${role}.md`)) {
        expect(text, file).toContain('When working in the digital-agency Bundle');
        expect(text, file).toContain('Other domains keep their calling lead');
      }
    }
  });
});
