import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CAMERA_MOVES = Object.freeze([
  'dolly', 'push-in', 'pull-back', 'crane-up', 'crane-down', 'orbit',
  'pan', 'tilt', 'tracking', 'rack-focus', 'locked-off',
]);

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, minimum = 1) => typeof value === 'string' && value.trim().length >= minimum;
const integer = value => Number.isInteger(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function validatePromptSpec(spec) {
  const errors = [];
  const add = (code, field, message) => errors.push({ code, path: field, message });
  const requireText = (value, field, code = 'text.required', minimum = 1) => {
    if (!text(value, minimum)) add(code, field, `Require a descriptive string of at least ${minimum} characters.`);
  };
  if (!object(spec)) return [{ code: 'schema.type', path: '$', message: 'Require a JSON object.' }];
  if (spec.schemaVersion !== 1) add('schema.version', 'schemaVersion', 'Require schemaVersion 1.');
  requireText(spec.blueprint, 'blueprint', 'blueprint.required');
  requireText(spec.concept, 'concept', 'concept.required', 12);
  if (!integer(spec.fps) || spec.fps <= 0) add('time.fps', 'fps', 'Require a positive integer frame rate.');
  if (!integer(spec.totalFrames) || spec.totalFrames <= 0) add('time.frames', 'totalFrames', 'Require a positive integer frame count.');
  const totalFrames = integer(spec.totalFrames) && spec.totalFrames > 0 ? spec.totalFrames : null;
  const inRange = frame => integer(frame) && totalFrames !== null && frame >= 0 && frame < totalFrames;

  if (!object(spec.signatureShot)) add('signature.required', 'signatureShot', 'Require one signature shot.');
  else {
    if (!inRange(spec.signatureShot.frame)) add('signature.frame', 'signatureShot.frame', 'Place the signature frame inside the film.');
    requireText(spec.signatureShot.description, 'signatureShot.description', 'signature.description', 20);
    requireText(spec.signatureShot.memorableBecause, 'signatureShot.memorableBecause', 'signature.reason', 12);
  }

  if (!object(spec.visualSystem)) add('visual.required', 'visualSystem', 'Require the shared visual system.');
  else {
    for (const key of ['typeface', 'cameraLanguage', 'materialTreatment', 'negativeSpace']) {
      requireText(spec.visualSystem[key], `visualSystem.${key}`, `visual.${key}`, 8);
    }
    if (!Array.isArray(spec.visualSystem.palette) || spec.visualSystem.palette.length < 2 || spec.visualSystem.palette.length > 6 || !spec.visualSystem.palette.every(value => text(value))) {
      add('visual.palette', 'visualSystem.palette', 'Use two to six named or hexadecimal colours.');
    }
  }
  if (!object(spec.copyContrast)) add('copy.required', 'copyContrast', 'Require a copy-contrast strategy.');
  else {
    requireText(spec.copyContrast.strategy, 'copyContrast.strategy', 'copy.strategy', 12);
    if (spec.copyContrast.noPlaceholderPanels !== true) add('copy.panels', 'copyContrast.noPlaceholderPanels', 'Reject placeholder rectangles; compose negative space instead.');
  }
  if (!Array.isArray(spec.depthLayers) || spec.depthLayers.length < 3) {
    add('depth.layers', 'depthLayers', 'Declare at least three depth layers.');
  } else {
    spec.depthLayers.forEach((layer, index) => {
      const field = `depthLayers[${index}]`;
      if (!object(layer)) { add('depth.layer', field, 'Require a layer object.'); return; }
      requireText(layer.id, `${field}.id`, 'depth.id');
      if (!finite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) add('depth.opacity', `${field}.opacity`, 'Require opacity from 0 to 1.');
      if (!finite(layer.blur) || layer.blur < 0) add('depth.blur', `${field}.blur`, 'Require a nonnegative blur value.');
      if (!finite(layer.parallax)) add('depth.parallax', `${field}.parallax`, 'Require a numeric parallax factor.');
    });
  }

  if (!Array.isArray(spec.shots) || spec.shots.length === 0) {
    add('shots.required', 'shots', 'Require an ordered shot list.');
  } else {
    let cursor = 0;
    const ids = new Set();
    spec.shots.forEach((shot, index) => {
      const field = `shots[${index}]`;
      if (!object(shot)) { add('shot.type', field, 'Require a shot object.'); return; }
      requireText(shot.id, `${field}.id`, 'shot.id');
      if (ids.has(shot.id)) add('shot.id', `${field}.id`, 'Shot ids must be unique.');
      ids.add(shot.id);
      if (!integer(shot.startFrame) || shot.startFrame !== cursor) add('shot.contiguous', `${field}.startFrame`, `Shot must start at frame ${cursor}.`);
      if (!integer(shot.endFrame) || !integer(shot.startFrame) || shot.endFrame <= shot.startFrame) add('shot.range', `${field}.endFrame`, 'Require an increasing half-open frame range.');
      cursor = integer(shot.endFrame) ? shot.endFrame : cursor;
      for (const key of ['framing', 'primaryMotion', 'secondaryReaction', 'lightAndMaterial', 'textTreatment']) {
        requireText(shot[key], `${field}.${key}`, `shot.${key}`, 6);
      }
      if (!object(shot.cameraMove) || !CAMERA_MOVES.includes(shot.cameraMove.name)) {
        add('shot.camera', `${field}.cameraMove.name`, `Use one named camera move: ${CAMERA_MOVES.join(', ')}.`);
      } else {
        for (const key of ['start', 'end', 'easing']) requireText(shot.cameraMove[key], `${field}.cameraMove.${key}`, 'shot.cameraParameter');
      }
      if (!object(shot.stateChange) || !text(shot.stateChange.from) || !text(shot.stateChange.to) || shot.stateChange.from === shot.stateChange.to) {
        add('shot.state', `${field}.stateChange`, 'Require different from/to visual states.');
      }
      if (!object(shot.transition) || !text(shot.transition.mechanism) || !text(shot.transition.inheritedElement)) {
        add('shot.transition', `${field}.transition`, 'Name the transition mechanism and inherited visual element.');
      }
    });
    if (totalFrames !== null && cursor !== totalFrames) add('shot.total', 'shots', `Shot coverage must end at totalFrames ${totalFrames}.`);
  }
  if (!object(spec.beatGrid) || !finite(spec.beatGrid.bpm) || spec.beatGrid.bpm <= 0) {
    add('beat.bpm', 'beatGrid.bpm', 'Require the approved musical tempo.');
  } else {
    if (!Array.isArray(spec.beatGrid.events) || spec.beatGrid.events.length === 0) add('beat.events', 'beatGrid.events', 'Require beat-synced actions.');
    else spec.beatGrid.events.forEach((event, index) => {
      if (!object(event) || !inRange(event.frame) || !text(event.action)) add('beat.event', `beatGrid.events[${index}]`, 'Require an in-range frame and action.');
    });
  }

  if (!object(spec.proofPlan)) add('proof.required', 'proofPlan', 'Require a pre-render proof plan.');
  else {
    if (spec.proofPlan.reviewBeforeFullRender !== true) add('proof.gate', 'proofPlan.reviewBeforeFullRender', 'Review proof frames before the full render.');
    if (!Array.isArray(spec.proofPlan.frames) || spec.proofPlan.frames.length === 0 || !spec.proofPlan.frames.every(inRange) || new Set(spec.proofPlan.frames).size !== spec.proofPlan.frames.length) {
      add('proof.frames', 'proofPlan.frames', 'Require unique in-range proof frames.');
    } else {
      if (!spec.proofPlan.frames.includes(spec.signatureShot?.frame)) add('proof.coverage', 'proofPlan.frames', 'Include the signature frame.');
      if (Array.isArray(spec.shots)) spec.shots.forEach((shot, index) => {
        if (object(shot) && integer(shot.startFrame) && integer(shot.endFrame) && !spec.proofPlan.frames.some(frame => frame >= shot.startFrame && frame < shot.endFrame)) {
          add('proof.coverage', 'proofPlan.frames', `Include at least one frame for shots[${index}].`);
        }
      });
    }
    if (!Array.isArray(spec.proofPlan.rejectIf) || spec.proofPlan.rejectIf.length < 4 || !spec.proofPlan.rejectIf.every(value => text(value))) {
      add('proof.reject', 'proofPlan.rejectIf', 'Name at least four visible reasons to reject a proof.');
    }
  }
  return errors;
}

function report(spec) {
  const errors = validatePromptSpec(spec);
  return { schemaVersion: 1, ok: errors.length === 0, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let result;
  if (args.length !== 2 || args[0] !== '--spec') {
    result = { schemaVersion: 1, ok: false, errors: [{ code: 'cli.arguments', path: 'arguments', message: 'Use --spec <motion-prompt.json>.' }] };
  } else {
    try { result = report(JSON.parse(fs.readFileSync(args[1], 'utf8'))); }
    catch { result = { schemaVersion: 1, ok: false, errors: [{ code: 'input.json', path: 'spec', message: 'The prompt spec must be readable valid JSON.' }] }; }
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}


