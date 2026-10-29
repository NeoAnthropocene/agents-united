import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Shared, dependency-free v1 contracts. These checks never decode or measure media.
export const DEFAULT_PRESET = Object.freeze({ integratedLufs: -16, toleranceLu: 1, truePeakDbtp: -1 });
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const KINDS = ['vo', 'music', 'sfx'];
const PROVIDERS = ['higgsfield', 'kling', 'elevenlabs', 'fish-audio', 'kie', 'byteplus'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 10000;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const issue = (errors, code, field, message) => errors.push({ code, path: field, message });

function object(value, allowed, field, errors) {
  if (!isObject(value)) { issue(errors, 'schema.object', field, 'Expected an object.'); return false; }
  if (Object.keys(value).some(key => !allowed.includes(key))) issue(errors, 'schema.fields', field, 'Unexpected fields; use the documented nonsecret schema.');
  return true;
}
function version(value, field, errors) {
  if (value.schemaVersion !== 1) issue(errors, 'schema.version', field, 'schemaVersion must be 1.');
}
function array(value, field, errors, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.length > 10000) {
    issue(errors, 'schema.array', field, `Expected an array with ${minimum} to 10000 entries.`); return [];
  }
  return value;
}
function frameRange(row, totalFrames) {
  return integer(row.startFrame, 0, totalFrames - 1) && integer(row.endFrame, 1, totalFrames) && row.startFrame < row.endFrame;
}
function textFields(value, fields, field, errors) {
  for (const key of fields) if (!nonempty(value[key])) issue(errors, 'schema.text', `${field}.${key}`, 'Expected nonempty text of at most 10000 characters.');
}

/** Portable relative paths: Windows separators work; drives, URLs, ADS and env paths do not. */
export function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || /[\x00-\x1f<>:"|?*%]/.test(value)) return false;
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/')) return false;
  return normalized.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part)
    && !/^\.env(?:\.|$)/i.test(part) && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part));
}
function localPath(value, field, errors) {
  if (!safeRelativePath(value)) issue(errors, 'path.unsafe', field, 'Use a nonprivate project-relative file path without traversal, drive, URL or stream syntax.');
}

export function validateTimeline(timeline) {
  const errors = [];
  if (!object(timeline, ['schemaVersion', 'revision', 'fps', 'totalFrames', 'width', 'height', 'scenes', 'cues'], 'timeline', errors)) return errors;
  version(timeline, 'timeline.schemaVersion', errors);
  if (typeof timeline.revision !== 'string' || !ID.test(timeline.revision)) issue(errors, 'timeline.revision', 'timeline.revision', 'Use a nonempty stable revision identifier.');
  for (const [key, maximum] of [['fps', 240], ['totalFrames', 2160000], ['width', 8192], ['height', 8192]]) {
    if (!integer(timeline[key], 1, maximum) || (['width', 'height'].includes(key) && timeline[key] % 2 !== 0)) issue(errors, 'timeline.bounds', `timeline.${key}`, `Expected a positive integer <=${maximum}; dimensions must be even for H264 yuv420p.`);
  }
  const scenes = array(timeline.scenes, 'timeline.scenes', errors, 1);
  const cues = array(timeline.cues, 'timeline.cues', errors);
  const ids = new Set();
  let cursor = 0;
  for (const [kind, rows] of [['scenes', scenes], ['cues', cues]]) {
    rows.forEach((row, index) => {
      const field = `timeline.${kind}[${index}]`;
      if (!object(row, kind === 'scenes' ? ['id', 'startFrame', 'endFrame'] : ['id', 'startFrame', 'endFrame', 'kind', 'text'], field, errors)) return;
      if (typeof row.id !== 'string' || !ID.test(row.id)) issue(errors, 'timeline.id', `${field}.id`, 'Use a stable identifier.');
      else if (ids.has(row.id)) issue(errors, 'timeline.duplicateId', `${field}.id`, 'Scene and cue identifiers must be globally unique.');
      else ids.add(row.id);
      if (!frameRange(row, timeline.totalFrames)) issue(errors, 'timeline.frameRange', field, 'Frames must be integers in a nonempty half-open range within totalFrames.');
      if (kind === 'scenes') {
        if (row.startFrame !== cursor) issue(errors, 'timeline.coverage', field, 'Scenes must cover the timeline in order without gaps or overlaps.');
        cursor = row.endFrame;
      } else {
        if (!KINDS.includes(row.kind)) issue(errors, 'timeline.cueKind', `${field}.kind`, 'Cue kind must be vo, music or sfx.');
        if (row.kind === 'vo' && !nonempty(row.text)) issue(errors, 'timeline.speechText', `${field}.text`, 'Speech cues require their approved transcript.');
        else if (row.text !== undefined && !nonempty(row.text)) issue(errors, 'schema.text', `${field}.text`, 'Optional text must be nonempty.');
      }
    });
  }
  if (cursor !== timeline.totalFrames) issue(errors, 'timeline.coverage', 'timeline.scenes', 'The final scene must end at totalFrames.');
  return errors;
}

/** Explicit canonical field order and cue ID sort; independent of source JSON property order. */
export function timelineFingerprint(timeline) {
  if (validateTimeline(timeline).length) throw new Error('Cannot fingerprint an invalid timeline.');
  const canonical = {
    schemaVersion: 1, revision: timeline.revision, fps: timeline.fps, totalFrames: timeline.totalFrames,
    width: timeline.width, height: timeline.height,
    scenes: timeline.scenes.map(({ id, startFrame, endFrame }) => ({ id, startFrame, endFrame })),
    cues: [...timeline.cues].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      .map(({ id, kind, startFrame, endFrame, text }) => ({ id, kind, startFrame, endFrame, text: text ?? null })),
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex')}`;
}

export function validatePreset(preset) {
  const errors = [];
  if (!object(preset, ['integratedLufs', 'toleranceLu', 'truePeakDbtp'], 'preset', errors)) return errors;
  if (!finite(preset.integratedLufs, -70, -5) || !finite(preset.toleranceLu, 0, 10) || !finite(preset.truePeakDbtp, -20, 0)) issue(errors, 'audio.preset', 'preset', 'Use finite loudness -70..-5 LUFS, tolerance 0..10 LU, true peak -20..0 dBTP.');
  return errors;
}

export function validateAudioManifest(timeline, manifest, preset = DEFAULT_PRESET) {
  const errors = [...validateTimeline(timeline), ...validatePreset(preset)];
  if (errors.length) return errors;
  if (!object(manifest, ['schemaVersion', 'timelineRevision', 'timelineFingerprint', 'fps', 'totalFrames', 'sampleRate', 'channels', 'master', 'stems', 'cues', 'measurements', 'provenance', 'review', 'stemPolicy'], 'audio', errors)) return errors;
  version(manifest, 'audio.schemaVersion', errors);
  if (manifest.timelineRevision !== timeline.revision) issue(errors, 'audio.revision', 'audio.timelineRevision', 'Audio revision differs from the approved timeline; rebuild or obtain a revised handoff.');
  if (manifest.timelineFingerprint !== timelineFingerprint(timeline)) issue(errors, 'audio.fingerprint', 'audio.timelineFingerprint', 'Audio timing fingerprint is missing or stale; regenerate after timing/copy changes.');
  if (manifest.fps !== timeline.fps || manifest.totalFrames !== timeline.totalFrames) issue(errors, 'audio.timebase', 'audio', 'Audio fps and totalFrames must equal the approved timeline.');
  if (manifest.sampleRate !== 48000 || manifest.channels !== 2 || typeof manifest.master !== 'string' || !/\.wav$/i.test(manifest.master)) issue(errors, 'audio.format', 'audio.master', 'The declared master must be a stereo 48000 Hz WAV path string.');
  localPath(manifest.master, 'audio.master', errors);
  const stems = array(manifest.stems, 'audio.stems', errors, timeline.cues.length ? 1 : 0);
  const stemPaths = new Set(), stemIds = new Set();
  stems.forEach((stem, i) => {
    const field = `audio.stems[${i}]`;
    if (!object(stem, ['id', 'kind', 'path'], field, errors)) return;
    if (!KINDS.includes(stem.kind)) issue(errors, 'audio.stemKind', `${field}.kind`, 'Stem kind must be vo, music or sfx.');
    localPath(stem.path, `${field}.path`, errors);
    const normalized = typeof stem.path === 'string' ? stem.path.replaceAll('\\', '/') : '';
    const masterPath = typeof manifest.master === 'string' ? manifest.master.replaceAll('\\', '/') : '';
    if (!/\.wav$/i.test(normalized) || stemPaths.has(normalized) || normalized === masterPath) issue(errors, 'audio.stemPath', field, 'Each stem needs its own WAV path, separate from the master.');
    stemPaths.add(normalized);
    if (stem.id !== undefined) {
      if (typeof stem.id !== 'string' || !ID.test(stem.id) || stemIds.has(stem.id)) issue(errors, 'audio.stemId', `${field}.id`, 'Optional stem IDs must be stable and unique.');
      stemIds.add(stem.id);
    }
  });
  const cues = array(manifest.cues, 'audio.cues', errors);
  const cueIds = new Set();
  cues.forEach((cue, i) => {
    const field = `audio.cues[${i}]`;
    if (!object(cue, ['id', 'path', 'startFrame', 'endFrame'], field, errors)) return;
    const expected = timeline.cues.find(row => row.id === cue.id);
    if (!expected || cueIds.has(cue.id)) issue(errors, 'audio.cueCoverage', `${field}.id`, 'Each approved cue must appear exactly once, without extra IDs.');
    cueIds.add(cue.id);
    if (!expected || !frameRange(cue, timeline.totalFrames) || cue.startFrame !== expected.startFrame || cue.endFrame !== expected.endFrame) issue(errors, 'audio.cueAlignment', field, 'Cue placement must match the approved half-open frame range.');
    localPath(cue.path, `${field}.path`, errors);
    if (!stems.some(stem => isObject(stem) && stem.kind === expected?.kind && typeof stem.path === 'string' && typeof cue.path === 'string' && stem.path.replaceAll('\\', '/') === cue.path.replaceAll('\\', '/'))) issue(errors, 'audio.cueStem', `${field}.path`, 'Cue path must identify an aligned stem of the matching kind.');
  });
  if (timeline.cues.some(cue => !cueIds.has(cue.id))) issue(errors, 'audio.cueCoverage', 'audio.cues', 'Audio handoff is missing an approved cue.');
  const measurements = manifest.measurements;
  if (!isObject(measurements) || measurements.scope !== 'master' || !finite(measurements.integratedLufs, -100, 10) || !finite(measurements.truePeakDbtp, -200, 20)) issue(errors, 'audio.measurements', 'audio.measurements', 'Supply finite reported master integratedLufs and truePeakDbtp with scope master.');
  else {
    object(measurements, ['scope', 'integratedLufs', 'truePeakDbtp', 'loudnessRange', 'threshold', 'offset', 'evidence'], 'audio.measurements', errors);
    for (const key of ['loudnessRange', 'threshold', 'offset']) if (measurements[key] !== undefined && !finite(measurements[key], -200, 200)) issue(errors, 'audio.measurements', `audio.measurements.${key}`, 'Optional measurement must be finite.');
    if (measurements.evidence !== undefined) localPath(measurements.evidence, 'audio.measurements.evidence', errors);
    if (Math.abs(measurements.integratedLufs - preset.integratedLufs) > preset.toleranceLu) issue(errors, 'audio.loudness', 'audio.measurements.integratedLufs', 'Reported master loudness is outside the selected preset.');
    if (measurements.truePeakDbtp > preset.truePeakDbtp) issue(errors, 'audio.truePeak', 'audio.measurements.truePeakDbtp', 'Reported master true peak exceeds the selected ceiling.');
  }
  const provenance = array(manifest.provenance, 'audio.provenance', errors);
  const provenanceIds = new Set();
  provenance.forEach((row, i) => {
    const field = `audio.provenance[${i}]`;
    if (!object(row, ['cueId', 'source', 'evidence'], field, errors)) return;
    if (!cueIds.has(row.cueId) || provenanceIds.has(row.cueId) || !nonempty(row.evidence)) issue(errors, 'audio.provenance', field, 'Each cue needs one provenance record naming its source and rights/process evidence.');
    provenanceIds.add(row.cueId);
    localPath(row.source, `${field}.source`, errors);
  });
  if (timeline.cues.some(cue => !provenanceIds.has(cue.id))) issue(errors, 'audio.provenance', 'audio.provenance', 'Provenance is missing for an approved cue.');
  // Legacy mixer review/stemPolicy are descriptive, never proof of measured verification.
  if (manifest.stemPolicy !== undefined && !nonempty(manifest.stemPolicy)) issue(errors, 'schema.text', 'audio.stemPolicy', 'stemPolicy must be descriptive text.');
  if (manifest.review !== undefined && object(manifest.review, ['numerical', 'listening', 'muxedAudio'], 'audio.review', errors)) {
    if (manifest.review.numerical !== undefined && typeof manifest.review.numerical !== 'boolean') issue(errors, 'audio.review', 'audio.review.numerical', 'Optional reported numerical status must be boolean.');
    for (const key of ['listening', 'muxedAudio']) if (manifest.review[key] !== undefined && !nonempty(manifest.review[key])) issue(errors, 'audio.review', `audio.review.${key}`, 'Optional reported review status must be text.');
  }
  return errors;
}

export function validateMuxSyncReview(timeline, manifest, sync) {
  const errors = [...validateTimeline(timeline), ...validateAudioManifest(timeline, manifest)];
  if (errors.length) return errors;
  const allowed = [
    'schemaVersion', 'timelineRevision', 'timelineFingerprint', 'videoPath', 'videoSha256',
    'masterPath', 'masterSha256', 'method', 'command', 'pixelFormat', 'colorRange', 'colorSpace',
    'colorRangeApproval', 'muxLagMs', 'toleranceFrames', 'cueOffsets', 'listeningReview', 'perceivedSyncReview',
  ];
  if (!object(sync, allowed, 'sync', errors)) return errors;
  version(sync, 'sync.schemaVersion', errors);
  if (sync.timelineRevision !== timeline.revision) issue(errors, 'sync.revision', 'sync.timelineRevision', 'Sync review revision differs from the approved timeline.');
  if (sync.timelineFingerprint !== timelineFingerprint(timeline)) issue(errors, 'sync.fingerprint', 'sync.timelineFingerprint', 'Sync review fingerprint is stale against the approved timeline.');
  localPath(sync.videoPath, 'sync.videoPath', errors);
  localPath(sync.masterPath, 'sync.masterPath', errors);
  if (typeof sync.videoSha256 !== 'string' || !SHA256.test(sync.videoSha256)) issue(errors, 'sync.hash', 'sync.videoSha256', 'Require sha256:<64-hex> for the inspected MP4.');
  if (typeof sync.masterSha256 !== 'string' || !SHA256.test(sync.masterSha256)) issue(errors, 'sync.hash', 'sync.masterSha256', 'Require sha256:<64-hex> for the reference master WAV.');
  if (!nonempty(sync.method) || /^(?:timeline-arithmetic|manifest-frames|visual-guess|unmeasured|none|assumed)$/i.test(sync.method.trim())) {
    issue(errors, 'sync.arithmeticOnly', 'sync.method', 'Sync cannot be claimed from timeline arithmetic alone; record a decoded waveform/correlation measurement method.');
  }
  if (!nonempty(sync.command)) issue(errors, 'sync.command', 'sync.command', 'Retain the exact decode/measurement command.');
  const fullRangeOrNonStandard = sync.pixelFormat !== 'yuv420p' || (sync.colorRange !== undefined && !['tv', 'limited'].includes(sync.colorRange));
  if (fullRangeOrNonStandard) {
    const approval = sync.colorRangeApproval;
    if (!isObject(approval) || !nonempty(approval.approvedBy) || !nonempty(approval.targetPlayerTested) || !nonempty(approval.reason)) {
      issue(errors, 'video.colorRange', 'sync.pixelFormat', 'Encoded pixelFormat must be limited-range yuv420p unless colorRangeApproval records approvedBy, targetPlayerTested and reason.');
    }
  }
  const defaultToleranceFrames = sync.toleranceFrames === undefined ? 1 : sync.toleranceFrames;
  if (!finite(defaultToleranceFrames, 0.01, 10)) issue(errors, 'sync.tolerance', 'sync.toleranceFrames', 'Specify finite toleranceFrames.');
  if (!finite(sync.muxLagMs, -5000, 5000)) issue(errors, 'sync.muxLag', 'sync.muxLagMs', 'Specify finite measured muxLagMs.');
  else if (finite(defaultToleranceFrames, 0.01, 10) && Math.abs(sync.muxLagMs) > (defaultToleranceFrames * 1000) / timeline.fps + 0.5) {
    issue(errors, 'sync.muxLag', 'sync.muxLagMs', 'Measured mux stream lag exceeds frame tolerance.');
  }
  const offsets = array(sync.cueOffsets, 'sync.cueOffsets', errors);
  const seenCues = new Set();
  offsets.forEach((row, index) => {
    const field = `sync.cueOffsets[${index}]`;
    if (!object(row, ['cueId', 'kind', 'targetFrame', 'measuredOnsetFrame', 'measuredOnsetMs', 'signedOffsetFrames', 'signedOffsetMs', 'toleranceFrames', 'ambient'], field, errors)) return;
    const expected = timeline.cues.find(c => c.id === row.cueId);
    if (!expected || seenCues.has(row.cueId)) issue(errors, 'sync.cueCoverage', `${field}.cueId`, 'Each measured cue offset must reference a unique approved timeline cue.');
    seenCues.add(row.cueId);
    if (!finite(row.targetFrame, 0, timeline.totalFrames) || !finite(row.measuredOnsetFrame, 0, timeline.totalFrames + 120) || !finite(row.signedOffsetFrames, -timeline.totalFrames, timeline.totalFrames)) {
      issue(errors, 'sync.offsetBounds', field, 'Cue targetFrame, measuredOnsetFrame and signedOffsetFrames must be finite.');
      return;
    }
    if (Math.abs(row.signedOffsetFrames - (row.measuredOnsetFrame - row.targetFrame)) > 0.05) {
      issue(errors, 'sync.offsetMath', `${field}.signedOffsetFrames`, 'signedOffsetFrames must equal measuredOnsetFrame minus targetFrame.');
    }
    if (['sfx', 'vo'].includes(expected?.kind ?? row.kind) && row.ambient !== true) {
      const tol = row.toleranceFrames ?? defaultToleranceFrames;
      if (!finite(tol, 0.01, 1) || Math.abs(row.signedOffsetFrames) > tol) {
        issue(errors, 'sync.cueDrift', `${field}.signedOffsetFrames`, `Discrete cue ${row.cueId} offset (${row.signedOffsetFrames} frames) exceeds the 1-frame sync tolerance.`);
      }
    }
  });
  if (timeline.cues.some(cue => ['sfx', 'vo'].includes(cue.kind) && !seenCues.has(cue.id))) {
    issue(errors, 'sync.cueCoverage', 'sync.cueOffsets', 'Every discrete vo/sfx cue in the timeline requires a measured cue offset entry.');
  }
  for (const key of ['listeningReview', 'perceivedSyncReview']) {
    if (!['unverified', 'accepted', 'rejected'].includes(sync[key])) {
      issue(errors, 'sync.reviewState', `sync.${key}`, `${key} must be unverified, accepted or rejected.`);
    } else if (sync[key] === 'rejected') {
      issue(errors, 'sync.rejected', `sync.${key}`, `Human ${key} rejected the export.`);
    }
  }
  return errors;
}

export function validateCaptions(timeline, srt = '') {
  const errors = validateTimeline(timeline);
  if (errors.length) return errors;
  const speech = timeline.cues.filter(cue => cue.kind === 'vo').sort((a, b) => a.startFrame - b.startFrame);
  if (typeof srt !== 'string') return [{ code: 'captions.syntax', path: 'captions', message: 'Captions must be SRT text.' }];
  const normalized = srt.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trim();
  if (!normalized) return speech.length ? [{ code: 'captions.missing', path: 'captions', message: 'Approved speech requires aligned SRT captions.' }] : [];
  const stamp = '(\\d{2,}):([0-5]\\d):([0-5]\\d),(\\d{3})';
  const timecode = new RegExp(`^${stamp} --> ${stamp}$`);
  const seconds = parts => Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]) + Number(parts[3]) / 1000;
  const blocks = [];
  for (const [i, block] of normalized.split(/\n\s*\n/).entries()) {
    const [index, timing, ...words] = block.split('\n');
    const match = timing?.match(timecode);
    if (index !== String(i + 1) || !match || !words.join(' ').trim()) { issue(errors, 'captions.syntax', `captions[${i}]`, 'Use numbered SRT blocks with valid timestamps and text.'); continue; }
    const start = seconds(match.slice(1, 5)), end = seconds(match.slice(5, 9));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > timeline.totalFrames / timeline.fps + 0.001) issue(errors, 'captions.bounds', `captions[${i}]`, 'Caption interval must be nonempty and within the film.');
    if (blocks.length && start < blocks.at(-1).end) issue(errors, 'captions.overlap', `captions[${i}]`, 'SRT intervals must be ordered and non-overlapping.');
    blocks.push({ start, end, text: words.join(' ') });
  }
  if (errors.length) return errors;
  const tolerance = 1 / timeline.fps + 0.001;
  const text = value => value.replace(/\s+/g, ' ').trim();
  const used = new Set();
  speech.forEach((cue, i) => {
    const start = cue.startFrame / timeline.fps, end = cue.endFrame / timeline.fps;
    const pieces = blocks.filter(block => block.start >= start - tolerance && block.end <= end + tolerance);
    if (!pieces.length || Math.abs(pieces[0].start - start) > tolerance || Math.abs(pieces.at(-1).end - end) > tolerance) issue(errors, 'captions.alignment', `captions.speech[${i}]`, 'Caption group must match speech cue timing within one frame.');
    if (pieces.length && text(pieces.map(block => block.text).join(' ')) !== text(cue.text)) issue(errors, 'captions.text', `captions.speech[${i}]`, 'Caption words differ from approved speech.');
    for (const piece of pieces) {
      if (used.has(piece)) issue(errors, 'captions.alignment', `captions.speech[${i}]`, 'Overlapping speech needs an explicitly revised caption/timeline handoff.');
      used.add(piece);
    }
  });
  if (used.size !== blocks.length) issue(errors, 'captions.alignment', 'captions', 'Caption blocks do not map to approved speech cues.');
  return errors;
}

export function validateMediaRequest(request) {
  const errors = [];
  if (!object(request, ['schemaVersion', 'id', 'requester', 'placement', 'audience', 'purpose', 'priority', 'assets', 'copyRefs', 'brandRefs', 'durationSeconds', 'ratio', 'format', 'accessibility', 'dependencies', 'proposedRoute', 'costCeilingUsd', 'acceptance', 'decision'], 'request', errors)) return errors;
  version(request, 'request.schemaVersion', errors);
  if (typeof request.id !== 'string' || !ID.test(request.id)) issue(errors, 'request.id', 'request.id', 'Use a stable request identifier.');
  textFields(request, ['requester', 'placement', 'audience', 'purpose'], 'request', errors);
  if (!['required', 'optional'].includes(request.priority)) issue(errors, 'request.priority', 'request.priority', 'Classify the request as required or optional.');
  if (!['pending', 'include', 'defer', 'decline'].includes(request.decision)) issue(errors, 'request.decision', 'request.decision', 'Chris records pending, include, defer or decline after the human decision.');
  for (const key of ['assets', 'copyRefs', 'brandRefs']) array(request[key], `request.${key}`, errors).forEach((value, i) => localPath(value, `request.${key}[${i}]`, errors));
  if (!finite(request.durationSeconds, 0.001, 36000) || typeof request.ratio !== 'string' || !/^[1-9]\d{0,4}:[1-9]\d{0,4}$/.test(request.ratio) || !['mp4', 'webm', 'wav'].includes(request.format)) issue(errors, 'request.output', 'request', 'Specify positive duration, numeric aspect ratio and mp4/webm/wav delivery format.');
  if (object(request.accessibility, ['captions', 'transcript', 'reducedMotion'], 'request.accessibility', errors)) {
    for (const key of ['captions', 'transcript', 'reducedMotion']) if (typeof request.accessibility[key] !== 'boolean') issue(errors, 'request.accessibility', `request.accessibility.${key}`, 'Accessibility choices must be booleans.');
  }
  const dependencies = array(request.dependencies, 'request.dependencies', errors);
  if (dependencies.some(value => typeof value !== 'string' || !ID.test(value)) || new Set(dependencies).size !== dependencies.length) issue(errors, 'request.dependencies', 'request.dependencies', 'Use unique dependency identifiers.');
  if (array(request.acceptance, 'request.acceptance', errors, 1).some(value => !nonempty(value))) issue(errors, 'request.acceptance', 'request.acceptance', 'Acceptance criteria must be nonempty text.');
  if (object(request.proposedRoute, ['renderer', 'audio', 'generatedFootage'], 'request.proposedRoute', errors)) {
    if (!['native', 'remotion', null].includes(request.proposedRoute.renderer) || !['none', 'local', 'api', 'hybrid'].includes(request.proposedRoute.audio) || typeof request.proposedRoute.generatedFootage !== 'boolean') issue(errors, 'request.route', 'request.proposedRoute', 'Use native/remotion (or null for audio only), none/local/api/hybrid audio, and an explicit footage boolean.');
    if (request.format !== 'wav' && request.proposedRoute.renderer === null) issue(errors, 'request.route', 'request.proposedRoute.renderer', 'Video requests need a proposed renderer.');
  }
  if (!finite(request.costCeilingUsd, 0, 1000000)) issue(errors, 'request.cost', 'request.costCeilingUsd', 'Cost ceiling must be a finite nonnegative USD amount.');
  return errors;
}

export function defaultPreferences(renderer, audioRoute, generatedFootage, ceilingUsd) {
  return { schemaVersion: 1, renderer, audioRoute, generatedFootage, providers: [],
    output: { fps: 60, width: 1920, height: 1080, videoCodec: 'h264', audioCodec: 'aac', audioSampleRate: 48000, audioChannels: 2, loudness: { ...DEFAULT_PRESET } },
    spend: { currency: 'USD', ceilingUsd, approval: 'per-job' } };
}

export function validatePreferences(preferences) {
  const errors = [];
  if (!object(preferences, ['schemaVersion', 'renderer', 'audioRoute', 'generatedFootage', 'providers', 'output', 'spend'], 'preferences', errors)) return errors;
  version(preferences, 'preferences.schemaVersion', errors);
  if (!['native', 'remotion'].includes(preferences.renderer)) issue(errors, 'preferences.renderer', 'preferences.renderer', 'Select native or remotion.');
  if (!['local', 'api', 'hybrid'].includes(preferences.audioRoute)) issue(errors, 'preferences.audioRoute', 'preferences.audioRoute', 'Select local, api or hybrid.');
  if (typeof preferences.generatedFootage !== 'boolean') issue(errors, 'preferences.footage', 'preferences.generatedFootage', 'Generated footage requires an explicit boolean choice.');
  const modalities = new Set();
  array(preferences.providers, 'preferences.providers', errors).forEach((provider, i) => {
    const field = `preferences.providers[${i}]`;
    if (!object(provider, ['provider', 'model', 'modality', 'route'], field, errors)) return;
    if (!PROVIDERS.includes(provider.provider) || !['audio', 'video'].includes(provider.modality) || !['api', 'mcp'].includes(provider.route)) issue(errors, 'preferences.provider', field, 'Select a documented provider, audio/video modality and api/mcp route.');
    if (typeof provider.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(provider.model) || /^(?:sk[-_]|Bearer\b)/i.test(provider.model)) issue(errors, 'preferences.model', `${field}.model`, 'Store only a nonsecret model identifier.');
    if (modalities.has(provider.modality)) issue(errors, 'preferences.provider', field, 'Store one selected provider per modality.');
    modalities.add(provider.modality);
    if (['kie', 'byteplus'].includes(provider.provider) && provider.route !== 'api') issue(errors, 'preferences.provider', `${field}.route`, 'This provider has no verified official generation MCP; select its API route.');
    if ((provider.modality === 'video' && !preferences.generatedFootage) || (provider.modality === 'audio' && preferences.audioRoute === 'local')) issue(errors, 'preferences.providerConsent', field, 'The selected external provider conflicts with the local/footage preference.');
  });
  if (object(preferences.output, ['fps', 'width', 'height', 'videoCodec', 'audioCodec', 'audioSampleRate', 'audioChannels', 'loudness'], 'preferences.output', errors)) {
    const out = preferences.output;
    if (!integer(out.fps, 1, 240) || !integer(out.width, 2, 8192) || out.width % 2 || !integer(out.height, 2, 8192) || out.height % 2 || out.videoCodec !== 'h264' || out.audioCodec !== 'aac' || out.audioSampleRate !== 48000 || out.audioChannels !== 2) issue(errors, 'preferences.output', 'preferences.output', 'Use bounded integer fps/even dimensions, H264/AAC and stereo48k audio.');
    errors.push(...validatePreset(out.loudness));
  }
  if (object(preferences.spend, ['currency', 'ceilingUsd', 'approval'], 'preferences.spend', errors)) {
    if (preferences.spend.currency !== 'USD' || !finite(preferences.spend.ceilingUsd, 0, 1000000) || preferences.spend.approval !== 'per-job') issue(errors, 'preferences.spend', 'preferences.spend', 'Store a finite nonnegative USD ceiling with per-job approval. Preferences do not authorize a paid call.');
  }
  return errors;
}

export function resultReport(errors, extra = {}) { return { schemaVersion: 1, ok: errors.length === 0, errors, ...extra }; }
export function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
export async function readInput(file, type, errors, field, root) {
  const privatePath = value => value.replaceAll('\\', '/').split('/').some(segment => /^\.env(?:\.|$)/i.test(segment));
  if (typeof file !== 'string' || !file.toLowerCase().endsWith(`.${type}`) || privatePath(file)) {
    issue(errors, 'input.path', field, `Select an explicit nonprivate .${type} input file.`); return null;
  }
  try {
    const absolute = path.resolve(root ?? process.cwd(), file);
    const resolved = await realpath(absolute);
    if (privatePath(resolved)) { issue(errors, 'input.path', field, 'Private env inputs must not be read by this helper.'); return null; }
    if (root && (!contained(root, absolute) || !contained(root, resolved))) { issue(errors, 'file.outsideProject', field, 'Input escapes the selected project.'); return null; }
    const info = await stat(absolute);
    if (!info.isFile() || info.size > 1048576) { issue(errors, 'input.size', field, 'Input must be a regular file of at most 1 MiB.'); return null; }
    const content = await readFile(absolute, 'utf8');
    if (type !== 'json') return content;
    try { return JSON.parse(content.replace(/^\uFEFF/, '')); }
    catch { issue(errors, 'input.json', field, 'Input is not valid JSON; contents were not echoed.'); return null; }
  } catch { issue(errors, 'input.read', field, 'Input file is missing or unreadable.'); return null; }
}
export async function projectRoot(directory, errors) {
  try {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('root');
    const root = await realpath(directory);
    if (!(await stat(root)).isDirectory()) throw new Error('root');
    return root;
  } catch { issue(errors, 'project.root', 'project', 'Select an existing absolute project directory.'); return null; }
}
export async function validateMediaFiles(root, manifest) {
  const errors = [];
  const files = [manifest.master, ...manifest.stems.map(stem => stem.path), ...manifest.cues.map(cue => cue.path), ...manifest.provenance.map(row => row.source)];
  if (manifest.measurements.evidence) files.push(manifest.measurements.evidence);
  for (const [index, file] of [...new Set(files)].entries()) {
    const field = `audio.files[${index}]`;
    if (!safeRelativePath(file)) { localPath(file, field, errors); continue; }
    const absolute = path.resolve(root, file.replaceAll('\\', '/'));
    try {
      if (!contained(root, absolute) || !contained(root, await realpath(absolute))) { issue(errors, 'file.outsideProject', field, 'Referenced media file resolves outside the selected project.'); continue; }
      if (!(await stat(absolute)).isFile()) issue(errors, 'file.notRegular', field, 'Referenced media must be a regular file.');
    } catch { issue(errors, 'file.missing', field, 'Referenced media or evidence file is missing or unreadable.'); }
  }
  return errors;
}
export function parseFlags(args, allowed, errors) {
  const options = Object.create(null);
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!allowed.includes(flag) || options[flag] !== undefined || args[i + 1] === undefined || args[i + 1].startsWith('--')) {
      issue(errors, 'cli.arguments', 'arguments', 'Unknown, duplicate or incomplete option; use --help.'); return options;
    }
    options[flag] = args[i + 1];
  }
  return options;
}

async function main(args) {
  const errors = [];
  const [command, ...rest] = args;
  if (command === '--help') return resultReport([], { help: 'review.mjs timeline --timeline file.json | request --request file.json | contract --timeline file.json --manifest file.json [--captions file.srt] [--project absolute-root] [--target-lufs -16 --tolerance-lu 1 --max-true-peak -1] | mux-sync --timeline file.json --manifest file.json --sync file.json [--project absolute-root]. No media decoding or measurement occurs.' });
  const options = parseFlags(rest, ['--timeline', '--manifest', '--captions', '--request', '--sync', '--project', '--target-lufs', '--tolerance-lu', '--max-true-peak'], errors);
  const required = command === 'request' ? ['--request'] : command === 'timeline' ? ['--timeline'] : command === 'contract' ? ['--timeline', '--manifest'] : command === 'mux-sync' ? ['--timeline', '--manifest', '--sync'] : [];
  if (!required.length || required.some(flag => !options[flag])) issue(errors, 'cli.arguments', 'arguments', 'Select timeline, request, contract or mux-sync and supply its required files.');
  if (errors.length) return resultReport(errors);
  const root = options['--project'] ? await projectRoot(options['--project'], errors) : undefined;
  if (errors.length) return resultReport(errors);
  if (command === 'request') {
    const request = await readInput(options['--request'], 'json', errors, 'request', root);
    if (!errors.length) errors.push(...validateMediaRequest(request));
    return resultReport(errors, { productionAuthorized: false });
  }
  const timeline = await readInput(options['--timeline'], 'json', errors, 'timeline', root);
  if (!errors.length) errors.push(...validateTimeline(timeline));
  if (errors.length) return resultReport(errors);
  const extra = { timelineFingerprint: timelineFingerprint(timeline), durationSeconds: timeline.totalFrames / timeline.fps };
  if (command === 'timeline') return resultReport(errors, extra);
  const manifest = await readInput(options['--manifest'], 'json', errors, 'audio', root);
  if (command === 'mux-sync') {
    const sync = await readInput(options['--sync'], 'json', errors, 'sync', root);
    if (!errors.length) errors.push(...validateMuxSyncReview(timeline, manifest, sync));
    return resultReport(errors, {
      ...extra,
      visualListeningReview: sync?.listeningReview === 'accepted' && sync?.perceivedSyncReview === 'accepted' ? 'accepted' : 'unverified',
      verification: {
        contract: errors.length ? 'failed' : 'valid',
        muxedAudio: errors.length ? 'failed' : 'measured-within-tolerance',
        colorRange: sync?.pixelFormat === 'yuv420p' && ['tv', 'limited', undefined].includes(sync?.colorRange) ? 'limited-yuv420p' : 'custom-approved',
        listeningReview: sync?.listeningReview ?? 'unverified',
        perceivedSyncReview: sync?.perceivedSyncReview ?? 'unverified',
      },
    });
  }
  const preset = {
    integratedLufs: options['--target-lufs'] === undefined ? DEFAULT_PRESET.integratedLufs : Number(options['--target-lufs']),
    toleranceLu: options['--tolerance-lu'] === undefined ? DEFAULT_PRESET.toleranceLu : Number(options['--tolerance-lu']),
    truePeakDbtp: options['--max-true-peak'] === undefined ? DEFAULT_PRESET.truePeakDbtp : Number(options['--max-true-peak']),
  };
  if (!errors.length) errors.push(...validateAudioManifest(timeline, manifest, preset));
  const captions = options['--captions'] ? await readInput(options['--captions'], 'srt', errors, 'captions', root) : '';
  if (captions !== null) errors.push(...validateCaptions(timeline, captions));
  let filesChecked = false;
  if (root && !errors.length) { errors.push(...await validateMediaFiles(root, manifest)); filesChecked = errors.length === 0; }
  return resultReport(errors, { ...extra, preset, visualListeningReview: 'unverified', verification: {
    contract: errors.length ? 'failed' : 'valid', measurements: 'reported-only',
    mediaFiles: filesChecked ? 'present-within-project' : 'unverified', audioDecode: 'unverified',
    muxedAudio: 'unverified', visualReview: 'unverified', listeningReview: 'unverified',
  } });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await main(process.argv.slice(2)); console.log(JSON.stringify(report)); process.exitCode = report.ok ? 0 : 2; }
  catch { console.log(JSON.stringify(resultReport([{ code: 'validation.internal', path: '$', message: 'Validation could not complete; no input contents were echoed.' }]))); process.exitCode = 2; }
}
