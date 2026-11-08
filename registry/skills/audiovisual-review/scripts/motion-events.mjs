import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contained, parseFlags, projectRoot, readInput, resultReport, safeRelativePath, timelineFingerprint, validateTimeline } from './review.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
const issue = (errors, code, field, message) => errors.push({ code, path: field, message });
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function fields(value, allowed, name, errors) {
  if (!object(value)) { issue(errors, 'schema.object', name, 'Expected an object.'); return false; }
  if (Object.keys(value).some(k => !allowed.includes(k))) issue(errors, 'schema.fields', name, 'Unexpected field.');
  return true;
}
function relative(value, name, errors, json = false) {
  if (!safeRelativePath(value) || (json && !value.toLowerCase().endsWith('.json'))) { issue(errors, 'path.unsafe', name, 'Use a nonprivate project-relative path.'); return false; }
  return true;
}
function eventsCheck(events, timeline, errors) {
  if (!Array.isArray(events) || !events.length || events.length > 10000) { issue(errors, 'events.array', 'events', 'Supply 1 to 10000 events.'); return; }
  const ids = new Set();
  events.forEach((event, i) => {
    const field = `events[${i}]`;
    if (!fields(event, ['id', 'frame', 'kind', 'cueId'], field, errors)) return;
    if (typeof event.id !== 'string' || !ID.test(event.id) || ids.has(event.id)) issue(errors, 'events.id', `${field}.id`, 'Event IDs must be stable and unique.');
    ids.add(event.id);
    if (!Number.isSafeInteger(event.frame) || event.frame < 0 || event.frame >= timeline.totalFrames) issue(errors, 'events.frame', `${field}.frame`, 'Frame must be an integer within the timeline.');
    if (typeof event.kind !== 'string' || !ID.test(event.kind)) issue(errors, 'events.kind', `${field}.kind`, 'Use a stable event kind.');
    if (event.cueId !== undefined && (typeof event.cueId !== 'string' || !timeline.cues.some(cue => cue.id === event.cueId))) issue(errors, 'events.cue', `${field}.cueId`, 'Cue ID must exist in the current timeline.');
  });
}
async function sourceHashes(root, sources, errors, artifact = false) {
  if (!Array.isArray(sources) || !sources.length || sources.length > 1000) { issue(errors, 'sources.array', 'motionSources', 'Supply 1 to 1000 motion source paths.'); return []; }
  const seen = new Set(); const result = [];
  for (const [i, entry] of sources.entries()) {
    const field = `motionSources[${i}]`;
    if (artifact && !fields(entry, ['path', 'sha256'], field, errors)) continue;
    const file = artifact ? entry.path : entry;
    if (!relative(file, field, errors)) continue;
    const normalized = file.replaceAll('\\', '/');
    if (seen.has(normalized.toLowerCase())) { issue(errors, 'sources.duplicate', field, 'Source paths must be unique.'); continue; }
    seen.add(normalized.toLowerCase());
    if (artifact && (typeof entry.sha256 !== 'string' || !HASH.test(entry.sha256))) { issue(errors, 'sources.hash', field, 'Expected a SHA-256 hash.'); continue; }
    try {
      const absolute = path.resolve(root, normalized), resolved = await realpath(absolute);
      if (!contained(root, absolute) || !contained(root, resolved) || !safeRelativePath(path.relative(root, resolved)) || !(await stat(resolved)).isFile()) throw new Error('unsafe');
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(resolved)) hash.update(chunk);
      const sha256 = `sha256:${hash.digest('hex')}`;
      if (artifact && entry.sha256 !== sha256) issue(errors, 'sources.stale', field, 'Motion source changed; recapture events.');
      result.push({ path: normalized, sha256 });
    } catch { issue(errors, 'sources.read', field, 'Motion source is missing, unreadable or outside the project.'); }
  }
  return result;
}
async function input(root, file, field, errors) {
  if (!relative(file, field, errors, true)) return null;
  return readInput(file, 'json', errors, field, root);
}
async function outputPath(root, file, errors) {
  if (!relative(file, 'out', errors, true)) return null;
  try {
    const absolute = path.resolve(root, file.replaceAll('\\', '/'));
    const parent = await realpath(path.dirname(absolute));
    if (!contained(root, absolute) || !contained(root, parent) || !(await stat(parent)).isDirectory()) throw new Error('unsafe');
    return path.join(parent, path.basename(absolute));
  } catch { issue(errors, 'output.path', 'out', 'Output parent must exist inside the project.'); return null; }
}
/** Capture Motion-authored event frames; success is not evidence of frame accuracy. */
export async function capture({ project, timeline: timelinePath, input: inputPath, out }) {
  const errors = []; const root = await projectRoot(project, errors); if (!root) return resultReport(errors);
  const timeline = await input(root, timelinePath, 'timeline', errors);
  const draft = await input(root, inputPath, 'input', errors);
  const target = await outputPath(root, out, errors);
  if (!errors.length) errors.push(...validateTimeline(timeline));
  if (errors.length || !fields(draft, ['events', 'motionSources'], 'input', errors)) return resultReport(errors);
  eventsCheck(draft.events, timeline, errors);
  const sources = await sourceHashes(root, draft.motionSources, errors);
  if (errors.length) return resultReport(errors);
  const artifact = { schemaVersion: 1, timelineRevision: timeline.revision, timelineFingerprint: timelineFingerprint(timeline), fps: timeline.fps, totalFrames: timeline.totalFrames, frameAccuracy: 'unverified', motionSources: sources, events: draft.events };
  const content = `${JSON.stringify(artifact, null, 2)}\n`;
  if (Buffer.byteLength(content, 'utf8') > 1048576) { issue(errors, 'output.size', 'out', 'Captured JSON must not exceed 1 MiB.'); return resultReport(errors); }
  try { await writeFile(target, content, { flag: 'wx' }); }
  catch { issue(errors, 'output.write', 'out', 'Output already exists or cannot be created.'); }
  return resultReport(errors, { frameAccuracy: 'unverified', ...(errors.length ? {} : { output: out }) });
}
/** Validate source identity and timeline freshness; does not inspect rendered movement. */
export async function validate({ project, timeline: timelinePath, events: eventPath }) {
  const errors = []; const root = await projectRoot(project, errors); if (!root) return resultReport(errors);
  const timeline = await input(root, timelinePath, 'timeline', errors);
  const artifact = await input(root, eventPath, 'events', errors);
  if (!errors.length) errors.push(...validateTimeline(timeline));
  if (errors.length || !fields(artifact, ['schemaVersion', 'timelineRevision', 'timelineFingerprint', 'fps', 'totalFrames', 'frameAccuracy', 'motionSources', 'events'], 'artifact', errors)) return resultReport(errors);
  if (artifact.schemaVersion !== 1 || artifact.frameAccuracy !== 'unverified') issue(errors, 'artifact.version', 'artifact', 'Expected version 1 and unverified frame accuracy.');
  if (artifact.timelineRevision !== timeline.revision || artifact.timelineFingerprint !== timelineFingerprint(timeline) || artifact.fps !== timeline.fps || artifact.totalFrames !== timeline.totalFrames) issue(errors, 'artifact.stale', 'artifact', 'Timeline revision, fingerprint or timebase changed.');
  eventsCheck(artifact.events, timeline, errors);
  await sourceHashes(root, artifact.motionSources, errors, true);
  return resultReport(errors, { frameAccuracy: 'unverified' });
}
async function main(args) {
  const [command, ...rest] = args; const errors = [];
  if (command === '--help' && rest.length === 0) return resultReport([], { help: 'capture --project absolute --timeline relative.json --input relative.json --out new-relative.json | validate --project absolute --timeline relative.json --events relative.json' });
  const allowed = command === 'capture' ? ['--project', '--timeline', '--input', '--out'] : command === 'validate' ? ['--project', '--timeline', '--events'] : [];
  const opts = parseFlags(rest, allowed, errors);
  if (!allowed.length || allowed.some(flag => !opts[flag])) issue(errors, 'cli.arguments', 'arguments', 'Choose capture or validate and supply all required flags.');
  if (errors.length) return resultReport(errors);
  return command === 'capture' ? capture({ project: opts['--project'], timeline: opts['--timeline'], input: opts['--input'], out: opts['--out'] }) : validate({ project: opts['--project'], timeline: opts['--timeline'], events: opts['--events'] });
}
const invokedPath = process.argv[1] ? await realpath(path.resolve(process.argv[1])).catch(() => null) : null;
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try { const report = await main(process.argv.slice(2)); console.log(JSON.stringify(report)); process.exitCode = report.ok ? 0 : 2; }
  catch { console.log(JSON.stringify(resultReport([{ code: 'validation.internal', path: '$', message: 'Unable to complete; input contents were not echoed.' }]))); process.exitCode = 2; }
}
