import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validatePromptSpec, validateProofComparison } from '../../registry/skills/motion-design-direction/scripts/check-prompt-spec.mjs';

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
        lightWrapNote: undefined,
        textTreatment: 'The launch line resolves into a stable lockup with a clean reading hold.',
        transition: { mechanism: 'Settle into the final composed frame', inheritedElement: 'The launch lockup' },
      },
    ],
    beatGrid: {
      bpm: 96,
      events: [
        { frame: 0, cueId: 'cue-fold', action: 'First fold begins on the sting.' },
        { frame: 75, cueId: 'cue-climb', action: 'Headline starts after the opening gesture.' },
        { frame: 150, cueId: 'cue-cross', action: 'Signature move starts with the music change.' },
        { frame: 270, cueId: 'cue-lockup', action: 'Final lockup lands and holds.' },
      ],
    },
    proofPlan: {
      frames: [0, 45, 74, 75, 120, 149, 150, 210, 270, 299],
      reviewBeforeFullRender: true,
      rejectIf: ['flat or default materials', 'placeholder rectangles', 'clipping or aliasing', 'illegible type'],
    },
  };
}

function validCraftSpec() {
  return {
    ...validSpec(),
    referenceFrames: [
      {
        id: 'ref-paper-rim-01',
        sourceUrl: 'https://x.com/example_studio/status/1900000000000000001',
        author: 'Example Motion Studio',
        sourceFrameOrTimestamp: '00:04.12 (frame 124)',
        capturedAt: '2026-10-29',
        localPath: 'media/references/ref-paper-rim-01.png',
        sha256: `sha256:${'a'.repeat(64)}`,
        permissionScope: 'private-analysis-only',
        viewed: true,
        viewedBy: 'Jamileh',
        analysis: {
          composition: 'Asymmetric right-weighted hero with open upper-left sky reserve.',
          silhouetteAndProportions: 'Tapered diamond kite with long 1:3 ribbon tail and crisp spar angles.',
          paletteAndContrast: 'Deep navy #12324A against warm apricot #F2A981 and cream #FFF6E5 highlights.',
          materialAndSurface: 'Translucent mulberry paper with directional fibre grain and crease shadows.',
          lightDirection: 'Low-angle backlight from 220deg casting warm translucent rim and spar shadow.',
          edgeAndContact: 'Soft 3px rim light wrap where the paper crosses the sun disc; crisp outer fold.',
          typeHierarchy: 'Display headline at 68px tracking -0.02em above quiet 24px subhead.',
          memorableFeature: 'The ribbon tail physically writes the baseline of the brand lockup.',
        },
        shotMapping: {
          shotId: 'signature',
          transferablePrinciple: 'Backlit translucent paper rim and continuous ribbon-to-wordmark gesture.',
          howOursDiffers: 'Uses Northwind octagonal kite geometry and dawn hill parallax instead of studio cyclorama.',
        },
      },
    ],
    materialPasses: {
      grain: {
        enabled: true,
        layers: ['sky', 'kite'],
        frameRange: [0, 300],
        visibleContribution: 'Adds tactile paper fibre micro-contrast on the kite sail without crawling.',
        proofCrop: 'media/proofs/crops/signature-grain-kite.png',
        parameters: {
          seed: 4043,
          scale: 1.25,
          opacity: 0.08,
          surfacePlacement: 'paper-sail-and-sky-band',
        },
      },
      gradientMesh: {
        enabled: true,
        layers: ['sky', 'far-hills'],
        frameRange: [0, 300],
        visibleContribution: 'Builds volumetric dawn horizon falloff while keeping upper-left copy reserve dark.',
        proofCrop: 'media/proofs/crops/signature-gradient-sky.png',
        parameters: {
          anchors: ['#12324A@0.15,0.20', '#F2A981@0.78,0.62', '#FFF6E5@0.82,0.70'],
          falloff: 'radial-smoothstep-1.4',
          volumeIntent: 'Separate far hills from backlit kite silhouette and preserve 7:1 headline contrast.',
        },
      },
      depthBlur: {
        enabled: false,
        naReason: 'Crisp vector paper craft direction keeps mid-ground silhouette sharp; foreground haze uses layer blur only.',
        reviewedBy: 'Jamileh',
      },
      lightWrap: {
        enabled: true,
        layers: ['kite'],
        frameRange: [150, 300],
        visibleContribution: 'Wraps warm solar backlight around the kite inner edge and casts spar contact shadow.',
        proofCrop: 'media/proofs/crops/signature-lightwrap-edge.png',
        parameters: {
          sourceDirection: '220deg solar disc behind kite',
          rimWidthPx: 3.5,
          rimColor: '#FFF6E5',
          intensity: 0.65,
          contactShadow: '2px warm-multiply crease shadow under cross-spar',
        },
      },
    },
  };
}

function validProofComparison() {
  return {
    schemaVersion: 1,
    timelineRevision: 'r1',
    timelineFingerprint: `sha256:${'b'.repeat(64)}`,
    round: 1,
    maxRounds: 2,
    deliverySize: { width: 1920, height: 1080 },
    signatureBoard: {
      boardPath: 'media/proofs/board-signature-270.png',
      boardSha256: `sha256:${'c'.repeat(64)}`,
      candidateFrame: 270,
      candidatePath: 'media/proofs/frame-000270.png',
      candidateSha256: `sha256:${'d'.repeat(64)}`,
      referenceIds: ['ref-paper-rim-01'],
      viewed: true,
      viewedBy: 'Jamileh',
      crops: {
        silhouette: 'media/proofs/crops/silhouette-270.png',
        edge: 'media/proofs/crops/edge-270.png',
        material: 'media/proofs/crops/material-270.png',
        light: 'media/proofs/crops/light-270.png',
        type: 'media/proofs/crops/type-270.png',
      },
    },
    motionProofs: [
      {
        id: 'transition-catch-to-signature',
        startFrame: 140,
        endFrame: 165,
        artifactPath: 'media/proofs/clips/catch-to-signature.mp4',
        sha256: `sha256:${'e'.repeat(64)}`,
        viewed: true,
        viewedBy: 'Motion Designer',
        checks: {
          anticipation: 'Tail bow dips 6px over frames 142-148 before solar crossing.',
          reaction: 'Hill parallax and ribbon bows settle 8 frames after kite arrival.',
          depth: 'Three distinct parallax planes verified without copy intersection.',
          continuity: 'Tail spline remains continuous across shot boundary 149->150.',
          readingHold: 'Headline holds static for 75 frames with 8.4:1 contrast.',
        },
      },
    ],
    defects: [
      {
        id: 'defect-tail-tangent-01',
        severity: 'moderate',
        owner: 'Motion Designer',
        frame: 270,
        description: 'Tail ribbon grazed the descender of letter p in spring-drop by 4px.',
        correction: 'Lowered ribbon control point C2 by 18px and reproofed frame 270.',
        status: 'resolved',
      },
    ],
    fullRenderApproved: true,
  };
}

test('a complete causal signature-shot prompt passes and the shipped example is valid in both v1 and craft-gate modes', () => {
  assert.deepEqual(validatePromptSpec(validSpec()), []);
  const example = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
  assert.deepEqual(validatePromptSpec(example), []);
  assert.deepEqual(validatePromptSpec(example, { requireCraftGate: true }), []);
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

test('reference-led craft gate accepts grounded reference frames and material passes and rejects missing, unviewed, link-only, vague or blanket craft specs', () => {
  assert.deepEqual(validatePromptSpec(validCraftSpec(), { requireCraftGate: true }), []);
  assert.ok(validatePromptSpec(validSpec(), { requireCraftGate: true }).some(e => e.code === 'reference.required'));

  const redCases = [
    ['reference.count', spec => { spec.referenceFrames = []; }],
    ['reference.count', spec => { spec.referenceFrames = [spec.referenceFrames[0], { ...spec.referenceFrames[0], id: 'r2' }, { ...spec.referenceFrames[0], id: 'r3' }]; }],
    ['reference.viewed', spec => { spec.referenceFrames[0].viewed = false; }],
    ['reference.viewed', spec => { spec.referenceFrames[0].viewedBy = ''; }],
    ['reference.localPath', spec => { spec.referenceFrames[0].localPath = 'https://x.com/only-a-link.png'; }],
    ['reference.installedSkillOrExample', spec => { spec.referenceFrames[0].localPath = 'registry/skills/motion-design-direction/assets/ref.png'; }],
    ['reference.sha256', spec => { spec.referenceFrames[0].sha256 = 'not-a-hash'; }],
    ['reference.permission', spec => { spec.referenceFrames[0].permissionScope = 'unknown'; }],
    ['reference.analysis', spec => { spec.referenceFrames[0].analysis.silhouetteAndProportions = 'ok'; }],
    ['reference.shotMapping', spec => { spec.referenceFrames[0].shotMapping.shotId = 'nonexistent-shot'; }],
    ['reference.differs', spec => { spec.referenceFrames[0].shotMapping.howOursDiffers = spec.referenceFrames[0].shotMapping.transferablePrinciple; }],
    ['material.passes', spec => { delete spec.materialPasses.lightWrap; }],
    ['material.naReason', spec => { spec.materialPasses.depthBlur = { enabled: false, naReason: 'skip', reviewedBy: '' }; }],
    ['material.grainSeed', spec => { spec.materialPasses.grain.parameters.seed = 'random'; }],
    ['material.layers', spec => { spec.materialPasses.grain.layers = ['all']; }],
    ['material.blanket', spec => {
      const allLayers = ['sky', 'far-hills', 'kite', 'foreground-haze'];
      spec.materialPasses.grain.layers = allLayers;
      spec.materialPasses.gradientMesh.layers = allLayers;
      spec.materialPasses.depthBlur = {
        enabled: true,
        layers: allLayers,
        frameRange: [0, 300],
        visibleContribution: 'Blur applied everywhere across all layers.',
        proofCrop: 'media/proofs/crops/blur.png',
        parameters: { focusPlane: 'kite', maxRadiusPx: 8, occlusionRule: 'depth-order', copyLegible: true },
      };
      spec.materialPasses.lightWrap.layers = allLayers;
      spec.materialPasses.lightWrap.frameRange = [0, 300];
    }],
  ];

  for (const [code, mutate] of redCases) {
    const spec = structuredClone(validCraftSpec());
    mutate(spec);
    const errors = validatePromptSpec(spec, { requireCraftGate: true });
    assert.ok(errors.some(error => error.code === code), `Expected ${code}, got: ${JSON.stringify(errors)}`);
  }
});

test('timeline cross-check catches authored beatGrid-to-cue drift like Pilot 041 Remotion before render', () => {
  const spec = validCraftSpec();
  const alignedTimeline = {
    schemaVersion: 1,
    revision: 'r1',
    fps: 30,
    totalFrames: 300,
    width: 1920,
    height: 1080,
    scenes: [
      { id: 'hook', startFrame: 0, endFrame: 75 },
      { id: 'catch', startFrame: 75, endFrame: 150 },
      { id: 'signature', startFrame: 150, endFrame: 300 },
    ],
    cues: [
      { id: 'cue-bed', startFrame: 0, endFrame: 300, kind: 'music' },
      { id: 'cue-fold', startFrame: 0, endFrame: 15, kind: 'sfx' },
      { id: 'cue-climb', startFrame: 75, endFrame: 95, kind: 'sfx' },
      { id: 'cue-cross', startFrame: 150, endFrame: 180, kind: 'sfx' },
      { id: 'cue-lockup', startFrame: 270, endFrame: 290, kind: 'sfx' },
    ],
  };
  assert.deepEqual(validatePromptSpec(spec, { timeline: alignedTimeline }), []);

  const driftedTimeline = structuredClone(alignedTimeline);
  driftedTimeline.cues.find(c => c.id === 'cue-lockup').startFrame = 250; // 20 frames early like Pilot 041 Remotion
  const driftErrors = validatePromptSpec(spec, { timeline: driftedTimeline });
  assert.ok(driftErrors.some(e => e.code === 'timeline.beatCueDrift'), JSON.stringify(driftErrors));
});

test('proof comparison gate rejects missing side-by-side board, vague "looks good" defect notes, missing motion proofs, unresolved severe defects, and stale revisions', () => {
  const spec = validCraftSpec();
  const timeline = { revision: 'r1', fingerprint: `sha256:${'b'.repeat(64)}`, width: 1920, height: 1080 };
  assert.deepEqual(validateProofComparison(validProofComparison(), { spec, timeline }), []);

  const redProofs = [
    ['proofComparison.signatureBoard', proof => { proof.signatureBoard.viewed = false; }],
    ['proofComparison.signatureBoard', proof => { proof.signatureBoard.candidateFrame = 120; }],
    ['proofComparison.crops', proof => { delete proof.signatureBoard.crops.material; }],
    ['proofComparison.installedSkillOrExample', proof => { proof.signatureBoard.boardPath = '.claude/skills/motion-design-direction/assets/board.png'; }],
    ['proofComparison.motionProofs', proof => { proof.motionProofs = []; }],
    ['proofComparison.vagueDefect', proof => { proof.defects[0].description = 'looks good'; }],
    ['proofComparison.unresolvedSevere', proof => { proof.defects.push({ id: 'd2', severity: 'severe', owner: 'Jamileh', frame: 270, description: 'Crude bird proportions and grass intruding on headline.', correction: 'Pending redraw', status: 'open' }); }],
    ['proofComparison.stale', proof => { proof.timelineFingerprint = `sha256:${'f'.repeat(64)}`; }],
  ];
  for (const [code, mutate] of redProofs) {
    const proof = structuredClone(validProofComparison());
    mutate(proof);
    const errors = validateProofComparison(proof, { spec, timeline });
    assert.ok(errors.some(error => error.code === code), `Expected ${code}, got: ${JSON.stringify(errors)}`);
  }
});

test('the CLI returns structured success and failure without echoing rejected creative content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-prompt-'));
  try {
    const file = path.join(root, 'prompt.json');
    fs.writeFileSync(file, JSON.stringify(validCraftSpec()));
    const pass = spawnSync(process.execPath, [SCRIPT, '--spec', file, '--require-craft-gate'], { encoding: 'utf8', windowsHide: true });
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
