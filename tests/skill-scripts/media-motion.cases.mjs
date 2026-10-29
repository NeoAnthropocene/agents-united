import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validatePromptSpec } from '../../registry/skills/motion-design-direction/scripts/check-prompt-spec.mjs';

const SCRIPT = path.resolve('registry/skills/motion-design-direction/scripts/check-prompt-spec.mjs');
const EXAMPLE = path.resolve('registry/skills/motion-design-direction/assets/motion-prompt.example.json');

function validSpec() {
  return {
    schemaVersion: 1,
    blueprint: 'Signature-shot launch using recipe 9',
    concept: 'A paper kite catches the dawn and its tail draws the launch lockup.',
    fps: 30,
    totalFrames: 300,
    signatureShot: {
      frame: 270,
      description: 'The kite crosses the sun while its tail resolves into the Northwind wordmark.',
      memorableBecause: 'One gesture connects product, light and brand.',
    },
    visualSystem: {
      typeface: 'Arial Bold with measured tracking',
      palette: ['#12324A', '#F2A981', '#FFF6E5'],
      cameraLanguage: 'Measured dolly moves with no orbit-control drift.',
      materialTreatment: 'Layered translucent paper with fibres, folds and contact shadows.',
      negativeSpace: 'The upper-left sky stays dark and empty for the approved copy.',
    },
    copyContrast: {
      strategy: 'Reserve quiet tonal sky behind type; never add a rectangular panel.',
      noPlaceholderPanels: true,
    },
    depthLayers: [
      { id: 'sky', opacity: 1, blur: 0, parallax: 0.1 },
      { id: 'far-hills', opacity: 0.8, blur: 2, parallax: 0.3 },
      { id: 'kite', opacity: 1, blur: 0, parallax: 0.8 },
      { id: 'foreground-haze', opacity: 0.3, blur: 8, parallax: 1.1 },
    ],
    shots: [
      {
        id: 'hook', startFrame: 0, endFrame: 75,
        framing: 'Macro detail of folded paper against the dawn.',
        cameraMove: { name: 'push-in', start: 'scale 1.00', end: 'scale 1.05', easing: 'easeOutCubic' },
        stateChange: { from: 'Folded kite in shadow', to: 'Open kite catching light' },
        primaryMotion: 'The kite unfolds with weight.',
        secondaryReaction: 'Paper fibres lift and the tail responds to the unfold.',
        lightAndMaterial: 'A warm edge light reveals paper texture and fold shadows.',
        textTreatment: 'No copy; preserve the quiet sky for the next shot.',
        transition: { mechanism: 'The tail sweeps across the lens', inheritedElement: 'The same kite tail' },
      },
      {
        id: 'catch', startFrame: 75, endFrame: 150,
        framing: 'Wide left-negative-space composition with the kite on the right.',
        cameraMove: { name: 'dolly', start: 'x -12', end: 'x 12', easing: 'easeInOutCubic' },
        stateChange: { from: 'Empty sky', to: 'Catch the wind revealed word by word' },
        primaryMotion: 'The kite climbs along the same tail trajectory.',
        secondaryReaction: 'Tail bows flex after the climb and pollen drifts away from copy.',
        lightAndMaterial: 'Bloom stays on the kite, never behind the headline.',
        textTreatment: 'Masked per-word reveal with tracking settle and shallow extrusion.',
        transition: { mechanism: 'The tail becomes an underline', inheritedElement: 'The tail curve' },
      },
      {
        id: 'signature', startFrame: 150, endFrame: 300,
        framing: 'Pull back to the signature sun crossing and final brand lockup.',
        cameraMove: { name: 'pull-back', start: 'scale 1.06', end: 'scale 1.00', easing: 'easeInOutCubic' },
        stateChange: { from: 'Kite and underline', to: 'Northwind Kites spring-drop lockup' },
        primaryMotion: 'The kite crosses the sun as the tail writes the final underline.',
        secondaryReaction: 'The hills settle at different parallax rates and the tail bows lag.',
        lightAndMaterial: 'A single warm rim exposes translucent paper without a global glow.',
        textTreatment: 'The launch line resolves into a stable lockup with a clean reading hold.',
        transition: { mechanism: 'Settle into the final composed frame', inheritedElement: 'The launch lockup' },
      },
    ],
    beatGrid: {
      bpm: 96,
      events: [
        { frame: 0, action: 'First fold begins on the sting.' },
        { frame: 75, action: 'Headline starts after the opening gesture.' },
        { frame: 150, action: 'Signature move starts with the music change.' },
        { frame: 270, action: 'Final lockup lands and holds.' },
      ],
    },
    proofPlan: {
      frames: [0, 45, 74, 75, 120, 149, 150, 210, 270, 299],
      reviewBeforeFullRender: true,
      rejectIf: ['flat or default materials', 'placeholder rectangles', 'clipping or aliasing', 'illegible type'],
    },
  };
}

test('a complete causal signature-shot prompt passes and the shipped example is valid', () => {
  assert.deepEqual(validatePromptSpec(validSpec()), []);
  assert.deepEqual(validatePromptSpec(JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'))), []);
});

test('missing creative structure, camera names and causal transitions are rejected', () => {
  const cases = [
    ['signature.description', spec => { spec.signatureShot.description = ''; }],
    ['shot.camera', spec => { spec.shots[0].cameraMove.name = 'move around nicely'; }],
    ['shot.contiguous', spec => { spec.shots[1].startFrame = 80; }],
    ['shot.transition', spec => { spec.shots[0].transition.inheritedElement = ''; }],
    ['shot.state', spec => { spec.shots[0].stateChange.to = spec.shots[0].stateChange.from; }],
    ['depth.layers', spec => { spec.depthLayers = spec.depthLayers.slice(0, 2); }],
    ['copy.panels', spec => { spec.copyContrast.noPlaceholderPanels = false; }],
    ['proof.gate', spec => { spec.proofPlan.reviewBeforeFullRender = false; }],
    ['proof.coverage', spec => { spec.proofPlan.frames = [0]; }],
  ];
  for (const [code, mutate] of cases) {
    const spec = validSpec();
    mutate(spec);
    const errors = validatePromptSpec(spec);
    assert.ok(errors.some(error => error.code === code), `${code}: ${JSON.stringify(errors)}`);
  }
});

test('the CLI returns structured success and failure without echoing rejected creative content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-prompt-'));
  try {
    const file = path.join(root, 'prompt.json');
    fs.writeFileSync(file, JSON.stringify(validSpec()));
    const pass = spawnSync(process.execPath, [SCRIPT, '--spec', file], { encoding: 'utf8', windowsHide: true });
    assert.equal(pass.status, 0, pass.stderr);
    const passReport = JSON.parse(pass.stdout);
    assert.equal(passReport.schemaVersion, 1);
    assert.equal(passReport.ok, true);
    assert.deepEqual(passReport.errors, []);

    const spec = validSpec();
    spec.signatureShot.description = 'PRIVATE_DO_NOT_ECHO';
    spec.shots = [];
    fs.writeFileSync(file, JSON.stringify(spec));
    const fail = spawnSync(process.execPath, [SCRIPT, '--spec', file], { encoding: 'utf8', windowsHide: true });
    assert.equal(fail.status, 2);
    const failReport = JSON.parse(fail.stdout);
    assert.equal(failReport.ok, false);
    assert.ok(failReport.errors.length > 0);
    assert.doesNotMatch(fail.stdout + fail.stderr, /PRIVATE_DO_NOT_ECHO/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


