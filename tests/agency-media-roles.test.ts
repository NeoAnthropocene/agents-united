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

  it('requires a validated signature-shot prompt and reviewed proof frames across the handoff', () => {
    const motion = native('agency-motion-designer');
    const creative = native('agency-creative-designer');
    const lead = native('orchestrator-digital-agency');
    const skill = fs.readFileSync('registry/skills/motion-design-direction/SKILL.md', 'utf8');
    const blueprintPath = 'registry/skills/motion-design-direction/references/prompt-blueprint.md';

    expect(fs.existsSync(blueprintPath)).toBe(true);
    expect(skill).toContain('references/prompt-blueprint.md');
    expect(skill).toContain('check-prompt-spec.mjs');
    expect(motion).toContain('media/specs/motion-prompt.json');
    expect(motion).toContain('check-prompt-spec.mjs');
    expect(motion).toMatch(/signature shot/i);
    expect(motion).toMatch(/one named camera move/i);
    expect(motion).toMatch(/proof frames/i);
    expect(motion).toMatch(/before (?:the )?full render/i);
    expect(creative).toContain('media/specs/visual-handoff.md');
    expect(creative).toMatch(/signature frame/i);
    expect(creative).toMatch(/negative space/i);
    expect(creative).toMatch(/material and light/i);
    expect(lead).toContain('media/specs/motion-prompt.json');
    expect(lead).toMatch(/proof.frame review/i);
    expect(lead).toMatch(/before (?:the )?full render/i);
    for (const file of ['registry/agents/subagent-motion-designer.md', 'registry/agents/orchestrator-digital-agency.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/signature shot/i);
      expect(text, file).toContain('media/specs/motion-prompt.json');
      expect(text, file).toMatch(/proof.frame review/i);
    }
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

  it('wires the reference-led visual craft gate, four material pass decisions, side-by-side proof comparison and final-mux sync/range review across Creative, Motion, Sound, Chris and the blueprints', () => {
    const creativeNative = native('agency-creative-designer');
    const creativeCanonical = fs.readFileSync('registry/agents/subagent-marketing-creative-designer.md', 'utf8');
    const motionNative = native('agency-motion-designer');
    const motionCanonical = fs.readFileSync('registry/agents/subagent-motion-designer.md', 'utf8');
    const soundNative = native('agency-sound-designer');
    const soundCanonical = fs.readFileSync('registry/agents/subagent-sound-designer.md', 'utf8');
    const leadNative = native('orchestrator-digital-agency');
    const leadCanonical = fs.readFileSync('registry/agents/orchestrator-digital-agency.md', 'utf8');

    for (const [label, text] of [['creativeNative', creativeNative], ['creativeCanonical', creativeCanonical]] as const) {
      expect(text, label).toMatch(/1[–-]2.*reference frame/i);
      expect(text, label).toMatch(/SHA-256/i);
      expect(text, label).toMatch(/silhouette/i);
    }
    for (const [label, text] of [['motionNative', motionNative], ['motionCanonical', motionCanonical]] as const) {
      expect(text, label).toMatch(/referenceFrames|reference frame/i);
      expect(text, label).toMatch(/materialPasses|grain.*gradient.*depth.*light/i);
      expect(text, label).toMatch(/proofComparison|side-by-side/i);
      expect(text, label).toMatch(/mux-sync|yuv420p/i);
    }
    for (const [label, text] of [['soundNative', soundNative], ['soundCanonical', soundCanonical]] as const) {
      expect(text, label).toMatch(/mux-sync|signed.*offset|cue offset/i);
    }
    for (const [label, text] of [['leadNative', leadNative], ['leadCanonical', leadCanonical]] as const) {
      expect(text, label).toMatch(/1[–-]2.*reference frame/i);
      expect(text, label).toMatch(/side-by-side|proofComparison/i);
      expect(text, label).toMatch(/mux-sync|cue offset/i);
    }

    for (const file of [
      'registry/skills/motion-design-direction/references/prompt-blueprint.md',
      'registry/skills/motion-design-direction/references/quick-facts.md',
      'registry/skills/motion-design-direction/references/blueprints-01-03.md',
      'registry/skills/motion-design-direction/references/blueprints-04-06.md',
      'registry/skills/motion-design-direction/references/blueprints-07-08.md',
      'registry/skills/motion-design-direction/references/blueprints-09-10.md',
    ]) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/grain/i);
      expect(text, file).toMatch(/gradient.?mesh/i);
      expect(text, file).toMatch(/depth.?blur/i);
      expect(text, file).toMatch(/light.?wrap/i);
    }
    expect(fs.existsSync('docs/adr/0060-reference-led-visual-craft-and-final-mux-sync-gate.md')).toBe(true);
    const motionEvals = JSON.parse(fs.readFileSync('registry/skills/motion-design-direction/evals/evals.json', 'utf8'));
    expect(motionEvals.evals.some((e: { prompt: string }) => /gate-off.*gate-on/i.test(e.prompt))).toBe(true);
    const reviewEvals = JSON.parse(fs.readFileSync('registry/skills/audiovisual-review/evals/evals.json', 'utf8'));
    expect(reviewEvals.evals.some((e: { prompt: string }) => /yuvj420p/i.test(e.prompt))).toBe(true);
    const reviewReport = fs.readFileSync('docs/skill-quality/2026-10-29-pilot-041-review-and-plan-043-eval-protocol.md', 'utf8');
    expect(reviewReport).toMatch(/Dated Maintainer Human Review of Pilot 041/i);
    expect(reviewReport).toMatch(/Plan 043 Job V5 Blind Evaluation Protocol/i);
  });
});
