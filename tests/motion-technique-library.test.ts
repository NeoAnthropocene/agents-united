import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const base = path.resolve('registry/skills/motion-design-direction');
const script = path.join(base, 'scripts/techniques.mjs');
const run = (...args: string[]): unknown => JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: os.tmpdir() }));

describe('original motion technique library', () => {
  it('resolves the Claude technique reference from the invoked installed Skill root', () => {
    const role = fs.readFileSync('registry/hosts/claude/agents/agency-motion-designer.md', 'utf8');
    expect(role).not.toContain('../../../skills/motion-design-direction');
    expect(role).toContain('returned installed Skill root');
  });

  it.each([
    'registry/hosts/claude/agents/agency-motion-designer.md',
    'registry/agents/subagent-motion-designer.md',
    'registry/skills/native-motion-production/references/protocol.md',
    'registry/skills/remotion-production/references/composition.md',
  ])('routes %s through the shared technique choice and craft gates', file => {
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain('motion-design-direction/references/technique-library.md');
    expect(text).toMatch(/technique/i);
    expect(text).toMatch(/proof|craft/i);
  });

  it('lists eight stable cards independently of the project working directory', () => {
    const result = run('list') as { techniques: { id: string }[] };
    expect(result.techniques).toHaveLength(8);
    expect(new Set(result.techniques.map(card => card.id)).size).toBe(8);
    expect(result.techniques.map(card => card.id)).toContain('character-reaction');
  });

  it('runs the installed CLI through a linked Skill directory from another cwd', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'motion linked skill '));
    try {
      const linked = path.join(folder, 'installed-motion-skill');
      fs.symlinkSync(base, linked, process.platform === 'win32' ? 'junction' : 'dir');
      const result = execFileSync(process.execPath, [path.join(linked, 'scripts/techniques.mjs'), 'list'], {
        encoding: 'utf8', cwd: os.tmpdir(),
      });
      expect(JSON.parse(result).techniques).toHaveLength(8);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });

  it('can be imported when node -e receives a non-file argument', () => {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e',
      "import {selectTechnique} from './registry/skills/motion-design-direction/scripts/techniques.mjs'; console.log(selectTechnique('character-reaction','native').renderer)",
      'not-an-entry-file'], { encoding: 'utf8' });
    expect(result.trim()).toBe('native');
  });

  it('searches case-insensitively across multiple terms and reports no matches honestly', () => {
    expect(run('search', 'PAPER depth')).toMatchObject({ techniques: [{ id: 'paper-depth-stage' }] });
    expect(run('search', 'nonexistent-film-treatment')).toMatchObject({ techniques: [] });
  });

  it.each(['native', 'remotion'])('selects an actionable original prompt and %s mapping without approving production', renderer => {
    const selected = run('select', 'character-reaction', '--renderer', renderer) as { card: { promptTemplate: string; sound: { intention: string; cueRule: string }; proofChecks: string[] }; mapping: string; gates: string[] };
    expect(selected.card.promptTemplate).toContain('{subject}');
    expect(selected.card.sound.intention.length).toBeGreaterThan(40);
    expect(selected.card.sound.cueRule).toContain('timeline');
    expect(selected.mapping.length).toBeGreaterThan(100);
    expect(selected.card.proofChecks.length).toBeGreaterThanOrEqual(3);
    expect(selected.gates.join(' ')).toMatch(/referenceFrames.*materialPasses.*proofComparison/s);
    expect(selected).toMatchObject({ disposition: 'original', evidenceStatus: 'inspiration-only', creativeAcceptance: 'unverified' });
    expect(selected).not.toHaveProperty('referenceFrames');
  });

  it('keeps every card useful for both lanes with pinned inspiration and explicit rejection criteria', () => {
    const data = JSON.parse(fs.readFileSync(path.join(base, 'assets/techniques.json'), 'utf8')) as {
      sources: { id: string; commit: string; license: string; inspectedPaths: string[] }[];
      techniques: { id: string; inspirations: string[]; parameters: Record<string, string>; native: string; remotion: string; avoidWhen: string; composition: string }[];
    };
    expect(data.sources).toHaveLength(4);
    for (const source of data.sources) {
      expect(source.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(source.license).toBeTruthy();
      expect(source.inspectedPaths).toContain('LICENSE');
    }
    for (const card of data.techniques) {
      expect(Object.keys(card.parameters).length, card.id).toBeGreaterThanOrEqual(3);
      expect(card.native.length, card.id).toBeGreaterThan(100);
      expect(card.remotion.length, card.id).toBeGreaterThan(100);
      expect(card.composition.length, card.id).toBeGreaterThan(70);
      expect(card.avoidWhen.length, card.id).toBeGreaterThan(30);
      for (const id of card.inspirations) expect(data.sources.some(source => source.id === id)).toBe(true);
    }
  });

  it.each([[], ['select', 'missing', '--renderer', 'native'], ['select', 'character-reaction'], ['select', 'character-reaction', '--renderer', 'unknown'], ['list', '--install'], ['search', '']].map(args => ({ args })))('fails closed on invalid command $args', ({ args }) => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('techniques:');
  });

  it('cannot use a selected card as viewed-reference or craft-gate evidence', () => {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import fs from 'node:fs';
      import {validatePromptSpec} from './registry/skills/motion-design-direction/scripts/check-prompt-spec.mjs';
      const spec=JSON.parse(fs.readFileSync('./registry/skills/motion-design-direction/assets/motion-prompt.example.json'));
      delete spec.referenceFrames;
      spec.techniqueSelection=JSON.parse(process.argv[1]);
      process.stdout.write(JSON.stringify(validatePromptSpec(spec,{requireCraftGate:true})));
    `, JSON.stringify(run('select', 'paper-depth-stage', '--renderer', 'native'))], { encoding: 'utf8' });
    expect(result).toContain('reference');
    expect(JSON.parse(result).length).toBeGreaterThan(0);
  });
});
