import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CAMERA_MOVES = Object.freeze([
  'dolly', 'push-in', 'pull-back', 'crane-up', 'crane-down', 'orbit',
  'pan', 'tilt', 'tracking', 'rack-focus', 'locked-off',
]);

export const MATERIAL_PASS_KEYS = Object.freeze([
  'grain', 'gradientMesh', 'depthBlur', 'lightWrap',
]);

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VAGUE_NOTE_RE = /^(?:looks\s+good|lgtm|ok|okay|fine|good|pass|passed|none|n\/a|nice)$/i;
const FORBIDDEN_EVIDENCE_SEGMENT_RE = /^(?:\.claude|\.agents|registry|node_modules)$/i;

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, minimum = 1) => typeof value === 'string' && value.trim().length >= minimum;
const integer = value => Number.isInteger(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);

function safeRelativeFile(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1024 || /[\x00-\x1f<>:"|?*%]/.test(value)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false;
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/')) return false;
  return normalized.split('/').every(part => part && part !== '.' && part !== '..' && !/^\.env(?:\.|$)/i.test(part));
}

function isInstalledSkillOrExamplePath(value) {
  if (typeof value !== 'string') return false;
  const parts = value.replaceAll('\\', '/').split('/');
  return parts.some(part => FORBIDDEN_EVIDENCE_SEGMENT_RE.test(part) || /example/i.test(part));
}

export function validatePromptSpec(spec, options = {}) {
  const errors = [];
  const add = (code, field, message) => errors.push({ code, path: field, message });
  const requireText = (value, field, code = 'text.required', minimum = 1) => {
    if (!text(value, minimum)) add(code, field, `Require a descriptive string of at least ${minimum} characters.`);
  };
  if (!object(spec)) return [{ code: 'schema.type', path: '$', message: 'Require a JSON object.' }];
  if (spec.schemaVersion !== 1 && spec.schemaVersion !== 2) add('schema.version', 'schemaVersion', 'Require schemaVersion 1 or 2.');
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
  const layerIds = new Set();
  if (!Array.isArray(spec.depthLayers) || spec.depthLayers.length < 3) {
    add('depth.layers', 'depthLayers', 'Declare at least three depth layers.');
  } else {
    spec.depthLayers.forEach((layer, index) => {
      const field = `depthLayers[${index}]`;
      if (!object(layer)) { add('depth.layer', field, 'Require a layer object.'); return; }
      requireText(layer.id, `${field}.id`, 'depth.id');
      if (text(layer.id)) layerIds.add(layer.id);
      if (!finite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) add('depth.opacity', `${field}.opacity`, 'Require opacity from 0 to 1.');
      if (!finite(layer.blur) || layer.blur < 0) add('depth.blur', `${field}.blur`, 'Require a nonnegative blur value.');
      if (!finite(layer.parallax)) add('depth.parallax', `${field}.parallax`, 'Require a numeric parallax factor.');
    });
  }

  const shotIds = new Set();
  if (!Array.isArray(spec.shots) || spec.shots.length === 0) {
    add('shots.required', 'shots', 'Require an ordered shot list.');
  } else {
    let cursor = 0;
    spec.shots.forEach((shot, index) => {
      const field = `shots[${index}]`;
      if (!object(shot)) { add('shot.type', field, 'Require a shot object.'); return; }
      requireText(shot.id, `${field}.id`, 'shot.id');
      if (shotIds.has(shot.id)) add('shot.id', `${field}.id`, 'Shot ids must be unique.');
      shotIds.add(shot.id);
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

  const craftGate = Boolean(options.requireCraftGate || spec.schemaVersion === 2 || spec.referenceFrames !== undefined || spec.materialPasses !== undefined);
  if (craftGate) {
    if (spec.referenceFrames === undefined) {
      add('reference.required', 'referenceFrames', 'Require 1 to 2 actual viewed reference frames with provenance, SHA-256 and shot mapping.');
    } else if (!Array.isArray(spec.referenceFrames) || spec.referenceFrames.length < 1 || spec.referenceFrames.length > 2) {
      add('reference.count', 'referenceFrames', 'Provide 1 or 2 actual reference frames.');
    } else {
      spec.referenceFrames.forEach((ref, index) => {
        const field = `referenceFrames[${index}]`;
        if (!object(ref)) { add('reference.object', field, 'Require a reference frame record.'); return; }
        requireText(ref.id, `${field}.id`, 'reference.id', 2);
        if (!text(ref.sourceUrl, 6) && !text(ref.sourceRef, 6)) add('reference.source', `${field}.sourceUrl`, 'Record the reference source URL or owner reference identifier.');
        requireText(ref.author, `${field}.author`, 'reference.author', 2);
        requireText(ref.sourceFrameOrTimestamp, `${field}.sourceFrameOrTimestamp`, 'reference.timestamp', 2);
        if (typeof ref.capturedAt !== 'string' || !DATE_RE.test(ref.capturedAt)) add('reference.capturedAt', `${field}.capturedAt`, 'Record capturedAt as YYYY-MM-DD.');
        if (!safeRelativeFile(ref.localPath) || !/\.(?:png|jpe?g|webp|avif)$/i.test(ref.localPath)) {
          add('reference.localPath', `${field}.localPath`, 'Require a local project-relative image file path; a URL or link alone is not view evidence.');
        } else if (isInstalledSkillOrExamplePath(ref.localPath)) {
          add('reference.installedSkillOrExample', `${field}.localPath`, 'Shipped examples and installed Skill trees must never count as reference evidence.');
        }
        if (typeof ref.sha256 !== 'string' || !SHA256_RE.test(ref.sha256)) add('reference.sha256', `${field}.sha256`, 'Require a lowercase sha256:<64-hex> digest of the local reference frame.');
        if (!text(ref.permissionScope, 6) || /^(?:none|unknown|unverified|missing|n\/a)$/i.test(ref.permissionScope.trim())) {
          add('reference.permission', `${field}.permissionScope`, 'Record explicit permission/use scope (e.g. private-analysis-only or owner-supplied).');
        }
        if (ref.viewed !== true || !text(ref.viewedBy, 2)) {
          add('reference.viewed', `${field}.viewed`, 'Reference frame must be actually viewed (viewed: true) with viewedBy recorded.');
        }
        if (!object(ref.analysis)) {
          add('reference.analysis', `${field}.analysis`, 'Require structured craft analysis for the reference frame.');
        } else {
          for (const key of ['composition', 'silhouetteAndProportions', 'paletteAndContrast', 'materialAndSurface', 'lightDirection', 'edgeAndContact', 'typeHierarchy', 'memorableFeature']) {
            if (!text(ref.analysis[key], 8) || VAGUE_NOTE_RE.test(ref.analysis[key].trim())) {
              add('reference.analysis', `${field}.analysis.${key}`, `Provide a concrete ${key} observation of at least 8 characters.`);
            }
          }
        }
        if (!object(ref.shotMapping)) {
          add('reference.shotMapping', `${field}.shotMapping`, 'Map the reference principle to a target shot and state how our work differs.');
        } else {
          if (!text(ref.shotMapping.shotId) || (shotIds.size > 0 && !shotIds.has(ref.shotMapping.shotId))) {
            add('reference.shotMapping', `${field}.shotMapping.shotId`, 'Map the reference to an existing shot id in shots[].');
          }
          requireText(ref.shotMapping.transferablePrinciple, `${field}.shotMapping.transferablePrinciple`, 'reference.shotMapping', 12);
          if (!text(ref.shotMapping.howOursDiffers, 12) || ref.shotMapping.howOursDiffers.trim() === (ref.shotMapping.transferablePrinciple ?? '').trim()) {
            add('reference.differs', `${field}.shotMapping.howOursDiffers`, 'State concretely how the new shot differs from the reference.');
          }
        }
      });
    }

    if (!object(spec.materialPasses)) {
      add('material.passes', 'materialPasses', 'Declare all four material pass decisions: grain, gradientMesh, depthBlur and lightWrap.');
    } else {
      let enabledOnAllLayersCount = 0;
      for (const key of MATERIAL_PASS_KEYS) {
        const pass = spec.materialPasses[key];
        const field = `materialPasses.${key}`;
        if (!object(pass) || typeof pass.enabled !== 'boolean') {
          add('material.passes', field, `Require an explicit decision object with boolean enabled for ${key}.`);
          continue;
        }
        if (pass.enabled === false) {
          if (!text(pass.naReason, 15) || VAGUE_NOTE_RE.test(pass.naReason.trim()) || !text(pass.reviewedBy, 2)) {
            add('material.naReason', field, `Disabled ${key} pass requires a reviewed naReason (>=15 chars) and reviewedBy.`);
          }
          continue;
        }
        if (!Array.isArray(pass.layers) || pass.layers.length === 0 || pass.layers.some(l => !text(l) || /^(?:all|everything|\*)$/i.test(l.trim()) || (layerIds.size > 0 && !layerIds.has(l)))) {
          add('material.layers', `${field}.layers`, 'Name specific declared depthLayers ids; never apply a pass to "all".');
        }
        if (!Array.isArray(pass.frameRange) || pass.frameRange.length !== 2 || !integer(pass.frameRange[0]) || !integer(pass.frameRange[1]) || pass.frameRange[0] < 0 || pass.frameRange[1] <= pass.frameRange[0] || (totalFrames !== null && pass.frameRange[1] > totalFrames)) {
          add('material.frameRange', `${field}.frameRange`, 'Specify a valid [startFrame, endFrame] range within the film.');
        }
        if (!text(pass.visibleContribution, 12) || VAGUE_NOTE_RE.test(pass.visibleContribution.trim())) {
          add('material.contribution', `${field}.visibleContribution`, 'Describe the expected visible contribution (>=12 chars).');
        }
        if (!safeRelativeFile(pass.proofCrop) || isInstalledSkillOrExamplePath(pass.proofCrop)) {
          add('material.proofCrop', `${field}.proofCrop`, 'Specify a project-relative proof crop image path.');
        }
        if (Array.isArray(pass.layers) && layerIds.size > 0 && pass.layers.length >= layerIds.size && Array.isArray(pass.frameRange) && pass.frameRange[0] === 0 && pass.frameRange[1] === totalFrames) {
          enabledOnAllLayersCount += 1;
        }
        const params = pass.parameters;
        if (!object(params)) {
          add('material.parameters', `${field}.parameters`, `Provide pass parameters for enabled ${key}.`);
          continue;
        }
        if (key === 'grain') {
          if (!integer(params.seed)) add('material.grainSeed', `${field}.parameters.seed`, 'Grain requires an integer deterministic seed.');
          if (!finite(params.scale) || params.scale <= 0 || !finite(params.opacity) || params.opacity <= 0 || params.opacity > 0.35 || !text(params.surfacePlacement, 4) || /^(?:global-noise|hide-edges|all)$/i.test(params.surfacePlacement.trim())) {
            add('material.parameters', `${field}.parameters`, 'Grain requires positive scale, opacity in (0, 0.35] and specific surfacePlacement.');
          }
        } else if (key === 'gradientMesh') {
          if (!Array.isArray(params.anchors) || params.anchors.length < 2 || !params.anchors.every(a => text(a, 4)) || !text(params.falloff, 4) || !text(params.volumeIntent, 8)) {
            add('material.parameters', `${field}.parameters`, 'Gradient mesh requires 2+ colour anchors, falloff and volumeIntent.');
          }
        } else if (key === 'depthBlur') {
          if (!text(params.focusPlane, 3) || !finite(params.maxRadiusPx) || params.maxRadiusPx <= 0 || params.maxRadiusPx > 24 || !text(params.occlusionRule, 4) || params.copyLegible !== true) {
            add('material.parameters', `${field}.parameters`, 'Depth blur requires focusPlane, maxRadiusPx in (0, 24], occlusionRule and copyLegible: true.');
          }
        } else if (key === 'lightWrap') {
          if (!text(params.sourceDirection, 4) || !finite(params.rimWidthPx) || params.rimWidthPx <= 0 || !text(params.rimColor, 3) || !finite(params.intensity) || params.intensity <= 0 || params.intensity > 1 || !text(params.contactShadow, 4)) {
            add('material.parameters', `${field}.parameters`, 'Light wrap requires sourceDirection, positive rimWidthPx, rimColor, intensity in (0, 1] and contactShadow.');
          }
        }
      }
      if (enabledOnAllLayersCount === MATERIAL_PASS_KEYS.length) {
        add('material.blanket', 'materialPasses', 'Applying all four material passes across every layer and frame is a decorative checklist, not craft.');
      }
    }
  }

  if (object(options.timeline)) {
    const tl = options.timeline;
    if (integer(tl.fps) && spec.fps !== tl.fps) add('timeline.timebase', 'fps', 'Prompt spec fps must match timeline.fps.');
    if (integer(tl.totalFrames) && spec.totalFrames !== tl.totalFrames) add('timeline.timebase', 'totalFrames', 'Prompt spec totalFrames must match timeline.totalFrames.');
    if (Array.isArray(tl.cues) && Array.isArray(spec.beatGrid?.events)) {
      const cuesById = new Map(tl.cues.filter(c => object(c) && text(c.id)).map(c => [c.id, c]));
      spec.beatGrid.events.forEach((ev, index) => {
        if (!object(ev) || !text(ev.cueId)) return;
        const cue = cuesById.get(ev.cueId);
        if (!cue || !integer(cue.startFrame) || Math.abs(ev.frame - cue.startFrame) > 1) {
          add('timeline.beatCueDrift', `beatGrid.events[${index}]`, `Beat event frame ${ev.frame} for ${ev.cueId} drifts from timeline cue startFrame by more than 1 frame.`);
        }
      });
      tl.cues.forEach((cue, index) => {
        if (!object(cue) || !['sfx', 'vo'].includes(cue.kind) || !integer(cue.startFrame)) return;
        const matched = spec.beatGrid.events.some(ev => object(ev) && integer(ev.frame) && (ev.cueId ? ev.cueId === cue.id : true) && Math.abs(ev.frame - cue.startFrame) <= 1);
        if (!matched) {
          add('timeline.beatCueDrift', `timeline.cues[${index}]`, `Discrete timeline cue ${cue.id} at frame ${cue.startFrame} has no aligned beatGrid event within 1 frame.`);
        }
      });
    }
  }

  return errors;
}

export function validateProofComparison(proof, { spec, timeline } = {}) {
  const errors = [];
  const add = (code, field, message) => errors.push({ code, path: field, message });
  if (!object(proof)) return [{ code: 'proofComparison.type', path: '$', message: 'Require a JSON object for proof comparison.' }];
  if (proof.schemaVersion !== 1) add('proofComparison.schema', 'schemaVersion', 'Require schemaVersion 1.');
  if (!text(proof.timelineRevision, 1)) add('proofComparison.stale', 'timelineRevision', 'Record the current timelineRevision.');
  if (typeof proof.timelineFingerprint !== 'string' || !SHA256_RE.test(proof.timelineFingerprint)) {
    add('proofComparison.stale', 'timelineFingerprint', 'Record the canonical sha256 timelineFingerprint.');
  }
  if (object(timeline)) {
    const expectedFp = timeline.fingerprint ?? timeline.timelineFingerprint;
    if ((text(timeline.revision) && proof.timelineRevision !== timeline.revision) || (text(expectedFp) && proof.timelineFingerprint !== expectedFp)) {
      add('proofComparison.stale', 'timelineFingerprint', 'Proof comparison is stale against the current timeline revision or fingerprint; reproof after edits.');
    }
  }
  if (!integer(proof.round) || proof.round < 1 || !integer(proof.maxRounds) || proof.maxRounds < proof.round) {
    add('proofComparison.rounds', 'round', 'Record valid bounded reproof round <= maxRounds.');
  }
  const board = proof.signatureBoard;
  if (!object(board)) {
    add('proofComparison.signatureBoard', 'signatureBoard', 'Require a side-by-side signature comparison board.');
  } else {
    if (board.viewed !== true || !text(board.viewedBy, 2) || typeof board.boardSha256 !== 'string' || !SHA256_RE.test(board.boardSha256) || typeof board.candidateSha256 !== 'string' || !SHA256_RE.test(board.candidateSha256) || !Array.isArray(board.referenceIds) || board.referenceIds.length === 0) {
      add('proofComparison.signatureBoard', 'signatureBoard', 'Signature board requires viewed: true, viewedBy, referenceIds and SHA-256 hashes.');
    }
    if (!integer(board.candidateFrame) || (object(spec?.signatureShot) && integer(spec.signatureShot.frame) && board.candidateFrame !== spec.signatureShot.frame)) {
      add('proofComparison.signatureBoard', 'signatureBoard.candidateFrame', 'Candidate frame must equal signatureShot.frame.');
    }
    for (const key of ['boardPath', 'candidatePath']) {
      if (!safeRelativeFile(board[key])) add('proofComparison.signatureBoard', `signatureBoard.${key}`, 'Use a safe project-relative image path.');
      else if (isInstalledSkillOrExamplePath(board[key])) add('proofComparison.installedSkillOrExample', `signatureBoard.${key}`, 'Installed Skill files or examples cannot satisfy proof comparison.');
    }
    if (!object(board.crops)) {
      add('proofComparison.crops', 'signatureBoard.crops', 'Require detail crops for silhouette, edge, material, light and type.');
    } else {
      for (const cropKey of ['silhouette', 'edge', 'material', 'light', 'type']) {
        if (!safeRelativeFile(board.crops[cropKey]) || isInstalledSkillOrExamplePath(board.crops[cropKey])) {
          add('proofComparison.crops', `signatureBoard.crops.${cropKey}`, `Require a project-relative detail crop for ${cropKey}.`);
        }
      }
    }
  }

  if (!Array.isArray(proof.motionProofs) || proof.motionProofs.length === 0) {
    add('proofComparison.motionProofs', 'motionProofs', 'Require at least one short transition or secondary-motion proof clip; a still cannot approve choreography.');
  } else {
    proof.motionProofs.forEach((clip, index) => {
      const field = `motionProofs[${index}]`;
      if (!object(clip) || !text(clip.id, 2) || !integer(clip.startFrame) || !integer(clip.endFrame) || clip.endFrame <= clip.startFrame || !safeRelativeFile(clip.artifactPath) || typeof clip.sha256 !== 'string' || !SHA256_RE.test(clip.sha256) || clip.viewed !== true || !text(clip.viewedBy, 2)) {
        add('proofComparison.motionProofs', field, 'Each motion proof requires id, valid frame range, project-relative artifactPath, sha256 and view evidence.');
        return;
      }
      if (isInstalledSkillOrExamplePath(clip.artifactPath)) {
        add('proofComparison.installedSkillOrExample', `${field}.artifactPath`, 'Installed Skill files or examples cannot satisfy motion proof.');
      }
      if (!object(clip.checks) || ['anticipation', 'reaction', 'depth', 'continuity', 'readingHold'].some(k => !text(clip.checks[k], 8) || VAGUE_NOTE_RE.test(clip.checks[k].trim()))) {
        add('proofComparison.motionProofs', `${field}.checks`, 'Motion proof checks must describe anticipation, reaction, depth, continuity and readingHold (>=8 chars each).');
      }
    });
  }

  if (!Array.isArray(proof.defects)) {
    add('proofComparison.defects', 'defects', 'Provide the reviewed defects array.');
  } else {
    proof.defects.forEach((defect, index) => {
      const field = `defects[${index}]`;
      if (!object(defect) || !text(defect.id, 2) || !['minor', 'moderate', 'severe'].includes(defect.severity) || !['Jamileh', 'Motion Designer', 'Sound Designer', 'Kaan'].includes(defect.owner) || !integer(defect.frame) || !text(defect.correction, 6) || !['resolved', 'open', 'escalated'].includes(defect.status)) {
        add('proofComparison.defects', field, 'Each defect requires id, severity, owner, frame, correction and status.');
        return;
      }
      if (!text(defect.description, 12) || VAGUE_NOTE_RE.test(defect.description.trim())) {
        add('proofComparison.vagueDefect', `${field}.description`, 'Describe specific visual gaps (>=12 chars), never "looks good".');
      }
      if (defect.severity === 'severe' && defect.status !== 'resolved') {
        add('proofComparison.unresolvedSevere', `${field}.status`, 'Unresolved severe craft defect blocks full render.');
      }
      if (proof.fullRenderApproved === true && defect.status === 'open') {
        add('proofComparison.unresolvedSevere', `${field}.status`, 'Open defects must be resolved or escalated before approving full render.');
      }
    });
  }
  return errors;
}

function parseCliArgs(args) {
  const opts = { specPath: null, requireCraftGate: false, timelinePath: null, proofPath: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--require-craft-gate') {
      opts.requireCraftGate = true;
    } else if (arg === '--spec' && i + 1 < args.length) {
      opts.specPath = args[++i];
    } else if (arg === '--timeline' && i + 1 < args.length) {
      opts.timelinePath = args[++i];
    } else if (arg === '--proof-comparison' && i + 1 < args.length) {
      opts.proofPath = args[++i];
    } else {
      return null;
    }
  }
  return opts.specPath ? opts : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const parsed = parseCliArgs(process.argv.slice(2));
  let result;
  if (!parsed) {
    result = { schemaVersion: 1, ok: false, errors: [{ code: 'cli.arguments', path: 'arguments', message: 'Use --spec <motion-prompt.json> [--require-craft-gate] [--timeline <timeline.json>] [--proof-comparison <proof-comparison.json>].' }] };
  } else {
    try {
      const spec = JSON.parse(fs.readFileSync(parsed.specPath, 'utf8'));
      const timeline = parsed.timelinePath ? JSON.parse(fs.readFileSync(parsed.timelinePath, 'utf8')) : undefined;
      const errors = validatePromptSpec(spec, { requireCraftGate: parsed.requireCraftGate, timeline });
      if (parsed.proofPath) {
        const proof = JSON.parse(fs.readFileSync(parsed.proofPath, 'utf8'));
        errors.push(...validateProofComparison(proof, { spec, timeline }));
      }
      result = { schemaVersion: 1, ok: errors.length === 0, errors };
    } catch {
      result = { schemaVersion: 1, ok: false, errors: [{ code: 'input.json', path: 'spec', message: 'The prompt spec and optional linked records must be readable valid JSON.' }] };
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}
