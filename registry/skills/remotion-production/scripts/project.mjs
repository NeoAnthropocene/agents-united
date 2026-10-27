import { constants } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, lstat, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  contained, parseFlags, projectRoot, readInput, resultReport, safeRelativePath,
  timelineFingerprint, validateAudioManifest, validateMediaFiles, validatePreferences, validateTimeline,
} from '../../audiovisual-review/scripts/review.mjs';

export const REMOTION_VERSION = '4.0.538';
export const LICENSE_URL = `https://github.com/remotion-dev/remotion/blob/v${REMOTION_VERSION}/LICENSE.md`;
export const DEPENDENCIES = Object.freeze({
  remotion: REMOTION_VERSION, '@remotion/bundler': REMOTION_VERSION,
  '@remotion/renderer': REMOTION_VERSION, '@remotion/cli': REMOTION_VERSION,
  react: '19.0.0', 'react-dom': '19.0.0',
});
const issue = (code, field, message) => ({ code, path: field, message });
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 10000;
function requireValid(errors) {
  if (!errors.length) return;
  const error = new Error(errors.map(row => `${row.code} at ${row.path}: ${row.message}`).join('\n'));
  error.errors = errors;
  throw error;
}

/** A scoped evaluation or owner declaration is never automated proof of entitlement. */
export function preflight(preferences, license, { purpose = 'evaluation' } = {}) {
  const fields = ['schemaVersion', 'remotionVersion', 'status', 'purpose', 'reviewedOn', 'reviewedBy',
    'reviewerRole', 'entity', 'basis', 'evidence', 'commercialUse', 'licenseUrl', 'evaluationScope'];
  const object = license && typeof license === 'object' && !Array.isArray(license);
  requireValid(!object ? [issue('license.required', 'license', 'Record scoped evaluation or authorized owner eligibility in media/remotion-license.json before scaffolding.')] : []);
  const errors = [];
  if (Object.keys(license).some(key => !fields.includes(key)) || license.schemaVersion !== 1 ||
      license.remotionVersion !== REMOTION_VERSION || license.licenseUrl !== LICENSE_URL ||
      !['evaluation', 'free-license', 'company-license'].includes(license.status) ||
      !['evaluation', 'production'].includes(license.purpose) ||
      !['project-owner', 'authorized-representative', 'automated-evaluation'].includes(license.reviewerRole) ||
      (license.evaluationScope !== undefined && license.evaluationScope !== 'internal-suitability-test') ||
      typeof license.commercialUse !== 'boolean') {
    errors.push(issue('license.record', 'license', 'Use the documented versioned eligibility record and scoped reviewer role; a license field alone is insufficient.'));
  }
  for (const key of ['reviewedBy', 'entity', 'basis', 'evidence']) {
    if (!text(license[key])) errors.push(issue('license.review', `license.${key}`, 'Record the actual reviewer, evaluation subject or owner, basis and specific nonsecret evidence.'));
  }
  if (typeof license.reviewedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(license.reviewedOn) ||
      !Number.isFinite(Date.parse(license.reviewedOn)) || new Date(license.reviewedOn).toISOString().slice(0, 10) !== license.reviewedOn) {
    errors.push(issue('license.date', 'license.reviewedOn', 'Record the actual review date as YYYY-MM-DD.'));
  }
  if (!['evaluation', 'production'].includes(purpose)) errors.push(issue('license.purpose', 'purpose', 'Select evaluation or production explicitly.'));
  if (license.reviewerRole === 'automated-evaluation' && (license.status !== 'evaluation' ||
      license.purpose !== 'evaluation' || purpose !== 'evaluation' || license.commercialUse !== false ||
      license.evaluationScope !== 'internal-suitability-test')) {
    errors.push(issue('license.evaluation', 'license', 'Automated evaluation covers isolated internal suitability tests only; it cannot assert production or commercial eligibility.'));
  }
  if (license.status === 'evaluation' && (license.commercialUse !== false || license.purpose !== 'evaluation' || purpose !== 'evaluation')) {
    errors.push(issue('license.evaluation', 'license', 'Evaluation is for suitability assessment without commercial use; it cannot authorize production.'));
  }
  if (purpose === 'production' && license.purpose !== 'production') errors.push(issue('license.purpose', 'license.purpose', 'Production requires a separate owner review for production.'));
  requireValid(errors);
  requireValid(validatePreferences(preferences));
  requireValid(preferences.renderer !== 'remotion' ? [issue('preferences.renderer', 'preferences.renderer', 'The selected project must explicitly choose remotion.')] : []);
  return { allowed: true, purpose, licenseStatus: license.status, remotionVersion: REMOTION_VERSION,
    entitlementVerified: false, productionAuthorized: false, dependencies: { ...DEPENDENCIES } };
}

async function input(root, relative, field) {
  const errors = [];
  if (!safeRelativePath(relative)) requireValid([issue('input.path', field, 'Use a nonprivate project-relative JSON path.')]);
  const value = await readInput(relative, 'json', errors, field, root);
  requireValid(errors);
  return value;
}

async function localFile(root, relative, field) {
  try {
    if (!safeRelativePath(relative)) throw new Error('path');
    const file = await realpath(path.resolve(root, relative.replaceAll('\\', '/')));
    if (!contained(root, file) || !(await stat(file)).isFile()) throw new Error('path');
    return file;
  } catch { requireValid([issue('file.local', field, 'Required file is missing or resolves outside the selected project.')]); }
}
async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return `sha256:${hash.digest('hex')}`;
}
async function audioProvenance(root, manifest, manifestPath) {
  if (!manifest) return null;
  return { manifestPath: manifestPath.replaceAll('\\', '/'),
    manifestSha256: await fileHash(await localFile(root, manifestPath, 'audio.manifest')),
    masterPath: manifest.master.replaceAll('\\', '/'),
    masterSha256: await fileHash(await localFile(root, manifest.master, 'audio.master')) };
}

/** Dependency-free planning: no installation, browser, renderer, provider or env reads. */
export async function inspectProject(directory, { purpose = 'evaluation', audioManifest } = {}) {
  const errors = [];
  const root = await projectRoot(directory, errors);
  requireValid(errors);
  const media = path.join(root, 'media');
  try {
    if (!contained(root, await realpath(media))) requireValid([issue('file.outsideProject', 'media', 'The media directory resolves outside the selected project.')]);
    if (!(await lstat(await realpath(media))).isDirectory()) throw new Error('directory');
  } catch (error) {
    if (error.errors) throw error;
    requireValid([issue('project.directory', 'media', 'Select an existing project media directory.')]);
  }
  const preferences = await input(root, 'media/project.json', 'preferences');
  const license = await input(root, 'media/remotion-license.json', 'license');
  const permission = preflight(preferences, license, { purpose });
  const timeline = await input(root, 'media/timeline.json', 'timeline');
  requireValid(validateTimeline(timeline));
  requireValid(['fps', 'width', 'height'].some(key => timeline[key] !== preferences.output[key])
    ? [issue('preferences.timebase', 'preferences.output', 'Preferences and timeline fps/width/height must match; explicitly review drift.')] : []);
  let manifest = null;
  if (audioManifest !== undefined) {
    manifest = await input(root, audioManifest, 'audio');
    requireValid(validateAudioManifest(timeline, manifest, preferences.output.loudness));
    requireValid(await validateMediaFiles(root, manifest));
  } else if (timeline.cues.length) {
    requireValid([issue('audio.required', 'audio', 'Timeline cues require an explicit validated --audio-manifest; silent cue loss is not accepted.')]);
  }
  return { root, media, permission, preferences, timeline, manifest };
}

export async function scaffold(directory, options = {}) {
  const { root, media, permission, timeline, manifest } = await inspectProject(directory, options);
  const templates = ['index.jsx', 'Root.jsx', 'Composition.jsx', 'frame-state.mjs'];
  const source = await Promise.all(templates.map(name => readFile(new URL(`../templates/${name}`, import.meta.url), 'utf8')));
  const destination = path.join(media, 'remotion');
  // Reserve a new directory only after every input has passed. Existing files/links survive.
  if (!contained(root, await realpath(media))) requireValid([issue('file.outsideProject', 'media', 'The media directory moved outside the selected project.')]);
  try { await mkdir(destination); }
  catch (error) {
    requireValid([issue(error.code === 'EEXIST' ? 'scaffold.exists' : 'scaffold.directory', 'media/remotion',
      error.code === 'EEXIST' ? 'Destination already exists; preserve it and choose a fresh project.' : 'Cannot create the scaffold directory.')]);
  }
  const data = { timeline, timelineFingerprint: timelineFingerprint(timeline),
    sceneText: Object.fromEntries(timeline.scenes.map(scene => [scene.id, `Scene ${scene.id}`])),
    theme: { background: '#111820', foreground: '#f3f5ed', accent: '#dbe770' },
    audioSrc: manifest ? 'audio/master.wav' : null };
  const provenance = { schemaVersion: 1, timelineFingerprint: data.timelineFingerprint,
    audio: await audioProvenance(root, manifest, options.audioManifest) };
  const files = {
    ...Object.fromEntries(templates.map((name, index) => [name, source[index]])),
    'package.json': `${JSON.stringify({ name: 'agency-motion-project', version: '0.1.0', private: true,
      type: 'module', engines: { node: '>=24' }, dependencies: DEPENDENCIES }, null, 2)}\n`,
    'input-props.json': `${JSON.stringify(data, null, 2)}\n`,
    '.gitignore': 'node_modules/\nout/\n',
  };
  try {
    for (const [name, content] of Object.entries(files)) await writeFile(path.join(destination, name), content, { flag: 'wx' });
    await mkdir(path.join(destination, 'public'));
    if (manifest) {
      const master = await realpath(path.resolve(root, manifest.master.replaceAll('\\', '/')));
      if (!contained(root, master)) requireValid([issue('file.outsideProject', 'audio.master', 'The audio master moved outside the selected project.')]);
      await mkdir(path.join(destination, 'public/audio'));
      await copyFile(master, path.join(destination, 'public/audio/master.wav'), constants.COPYFILE_EXCL);
      const copiedHash = await fileHash(path.join(destination, 'public/audio/master.wav'));
      requireValid(copiedHash !== provenance.audio.masterSha256
        ? [issue('audio.changed', 'audio.master', 'Audio changed while scaffolding; inspect the preserved partial scaffold.')] : []);
    }
    await writeFile(path.join(destination, 'scaffold-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error.errors) throw error;
    requireValid([issue('scaffold.write', 'media/remotion', 'Scaffold write failed; partial files are preserved for inspection. No inputs were replaced.')]);
  }
  return { ...permission, written: [...Object.keys(files), 'scaffold-provenance.json'].map(file => `media/remotion/${file}`),
    timelineRevision: timeline.revision, timelineFingerprint: data.timelineFingerprint,
    audioCopied: Boolean(manifest), mediaDecoded: false, renderVerified: false };
}

function snapshotAudioAsset(provenance, hasAudio) {
  const asset = Object.hasOwn(provenance, 'audioAsset') ? provenance.audioAsset : hasAudio ? 'audio/master.wav' : null;
  requireValid((hasAudio ? typeof asset !== 'string' || !/^audio\/master(?:-[a-f0-9]{64})?\.wav$/.test(asset) : asset !== null)
    ? [issue('snapshot.audio', 'snapshot.audio', 'Snapshot must identify its owned audio asset without a custom path.')] : []);
  return asset;
}

async function plainPath(root, relative, directory = false, optional = false) {
  const absolute = path.resolve(root, relative);
  const info = await lstat(absolute).catch(error => { if (optional && error.code === 'ENOENT') return null; throw error; });
  if (!info) return null;
  requireValid(info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile()) ||
      !contained(root, await realpath(absolute))
    ? [issue('refresh.path', relative, 'Refresh refuses ambiguous files, directory links or paths outside the project.')] : []);
  return absolute;
}

/** Accept an explicitly approved handoff; source, dependencies and previous assets stay intact. */
export async function refresh(directory, options = {}) {
  const project = await inspectProject(directory, options);
  const { root, timeline, manifest, permission } = project;
  requireValid(options.approvedRevision !== timeline.revision
    ? [issue('refresh.approval', 'approvedRevision', 'Explicitly acknowledge the approved current handoff with --approved-revision equal to timeline.revision.')] : []);
  const lane = await plainPath(root, 'media/remotion', true);
  const propsFile = await plainPath(root, 'media/remotion/input-props.json');
  const provenanceFile = await plainPath(root, 'media/remotion/scaffold-provenance.json');
  const props = await input(root, 'media/remotion/input-props.json', 'snapshot');
  const before = await input(root, 'media/remotion/scaffold-provenance.json', 'provenance');
  requireValid(validateTimeline(props.timeline));
  requireValid(before.schemaVersion !== 1 || before.timelineFingerprint !== props.timelineFingerprint ||
      timelineFingerprint(props.timeline) !== before.timelineFingerprint || !props.sceneText ||
      typeof props.sceneText !== 'object' || Array.isArray(props.sceneText)
    ? [issue('refresh.snapshot', 'snapshot', 'Previous owned snapshot/provenance is ambiguous; do not repair it by inventing provenance.')] : []);
  const previousAsset = snapshotAudioAsset(before, Boolean(before.audio));
  requireValid(props.audioSrc !== previousAsset
    ? [issue('refresh.audio', 'snapshot.audio', 'Customized audio routing is ambiguous; refresh will not replace it.')] : []);
  await plainPath(root, 'media/remotion/public', true);
  if (previousAsset) {
    await plainPath(root, 'media/remotion/public/audio', true);
    const copied = await plainPath(root, `media/remotion/public/${previousAsset}`);
    requireValid(await fileHash(copied) !== before.audio.masterSha256
      ? [issue('refresh.audio', 'snapshot.audio', 'Previous copied audio was customized; refresh refuses to replace its handoff.')] : []);
  }
  const declared = await input(root, 'media/remotion/package.json', 'runtime.package');
  requireValid(Object.entries(DEPENDENCIES).some(([name, version]) => declared.dependencies?.[name] !== version)
    ? [issue('refresh.pin', 'runtime.package', 'Keep the exact package pins; refresh never rewrites packages or dependencies.')] : []);
  const historyParent = path.join(lane, 'handoff-history');
  await plainPath(root, 'media/remotion/handoff-history', true, true);
  const audio = await audioProvenance(root, manifest, options.audioManifest);
  const asset = audio ? `audio/master-${audio.masterSha256.slice(7)}.wav` : null;
  let assetExists = null;
  if (asset) {
    await plainPath(root, 'media/remotion/public/audio', true, true);
    assetExists = await plainPath(root, `media/remotion/public/${asset}`, false, true);
    requireValid(assetExists && await fileHash(assetExists) !== audio.masterSha256
      ? [issue('refresh.audio', 'snapshot.audio', 'The destination audio asset is ambiguous; it will not be overwritten.')] : []);
  }
  const oldPropsBytes = await readFile(propsFile), oldProvenanceBytes = await readFile(provenanceFile);
  const fingerprint = timelineFingerprint(timeline);
  const nextProps = { ...props, timeline, timelineFingerprint: fingerprint,
    sceneText: Object.fromEntries(timeline.scenes.map(scene => [scene.id,
      typeof props.sceneText[scene.id] === 'string' ? props.sceneText[scene.id] : `Scene ${scene.id}`])), audioSrc: asset };
  const nextProvenance = { schemaVersion: 1, timelineFingerprint: fingerprint, audio, audioAsset: asset };
  const lock = path.join(lane, '.handoff-refresh.lock');
  try { await writeFile(lock, `${timeline.revision}\n`, { flag: 'wx' }); }
  catch { requireValid([issue('refresh.lock', 'refresh', 'A refresh is active or interrupted; inspect it before retrying.')]); }
  let history;
  try {
    if (!(await plainPath(root, 'media/remotion/handoff-history', true, true))) await mkdir(historyParent);
    history = path.join(historyParent, `${timeline.revision}-${randomUUID()}`);
    await mkdir(history);
    await writeFile(path.join(history, 'input-props.json'), oldPropsBytes, { flag: 'wx' });
    await writeFile(path.join(history, 'scaffold-provenance.json'), oldProvenanceBytes, { flag: 'wx' });
    if (asset && !assetExists) {
      if (!(await plainPath(root, 'media/remotion/public/audio', true, true))) await mkdir(path.join(lane, 'public/audio'));
      await copyFile(await localFile(root, manifest.master, 'audio.master'), path.join(lane, 'public', asset), constants.COPYFILE_EXCL);
      requireValid(await fileHash(path.join(lane, 'public', asset)) !== audio.masterSha256
        ? [issue('refresh.audio', 'audio.master', 'Audio changed during refresh; existing handoff data was not replaced.')] : []);
    }
    const current = await inspectProject(directory, options);
    requireValid(timelineFingerprint(current.timeline) !== fingerprint ||
        JSON.stringify(await audioProvenance(root, current.manifest, options.audioManifest)) !== JSON.stringify(audio) ||
        !(await readFile(propsFile)).equals(oldPropsBytes) || !(await readFile(provenanceFile)).equals(oldProvenanceBytes)
      ? [issue('refresh.changed', 'refresh', 'Inputs changed during refresh; existing handoff data was not replaced.')] : []);
    const stagedProps = path.join(history, 'next-input-props.json'), stagedProvenance = path.join(history, 'next-provenance.json');
    await writeFile(stagedProps, `${JSON.stringify(nextProps, null, 2)}\n`, { flag: 'wx' });
    await writeFile(stagedProvenance, `${JSON.stringify(nextProvenance, null, 2)}\n`, { flag: 'wx' });
    try {
      await rename(stagedProps, propsFile);
      await rename(stagedProvenance, provenanceFile);
    } catch (error) {
      await writeFile(propsFile, oldPropsBytes); await writeFile(provenanceFile, oldProvenanceBytes);
      throw error;
    }
    await writeFile(path.join(history, 'refresh-record.json'), `${JSON.stringify({ schemaVersion: 1,
      approvedRevision: timeline.revision, previousFingerprint: before.timelineFingerprint,
      timelineFingerprint: fingerprint, audioAsset: asset, approvalVerified: false,
      note: 'Explicit caller acknowledgment; human/creative approval is not established by this command.' }, null, 2)}\n`, { flag: 'wx' });
    return { ...permission, timelineRevision: timeline.revision, timelineFingerprint: fingerprint,
      history: path.relative(root, history).replaceAll('\\', '/'), audioAsset: asset,
      updated: ['media/remotion/input-props.json', 'media/remotion/scaffold-provenance.json'],
      sourceAndDependenciesPreserved: true, previousOutputsPreserved: true, approvalVerified: false };
  } catch (error) {
    if (error.errors) throw error;
    requireValid([issue('refresh.write', 'refresh', 'Refresh failed; inspect retained handoff history and assets. Source, dependencies and previous outputs were not replaced.')]);
  } finally { await unlink(lock); }
}

/** Load only exact, directly installed project packages; never use an ancestor install. */
export async function loadProjectRuntime(directory) {
  const root = await realpath(directory);
  const declared = await input(root, 'package.json', 'runtime.package');
  const require = createRequire(path.join(root, 'package.json'));
  const packages = [];
  try {
    for (const [name, version] of Object.entries(DEPENDENCIES)) {
      requireValid(declared.dependencies?.[name] !== version
        ? [issue('runtime.pin', 'runtime.package', 'Project dependencies must retain the exact scaffold pins.')] : []);
      const metadata = await input(root, `node_modules/${name}/package.json`, 'runtime.installed');
      requireValid(metadata.name !== name || metadata.version !== version
        ? [issue('runtime.version', 'runtime.installed', 'Installed project package version does not match the exact pin.')] : []);
      const packageRoot = await realpath(path.join(root, 'node_modules', name));
      const entry = await realpath(require.resolve(name));
      requireValid(!contained(packageRoot, entry) || !contained(root, packageRoot)
        ? [issue('runtime.local', 'runtime.installed', 'Runtime must resolve to the direct project-local installation.')] : []);
      packages.push({ name, version, entry });
    }
    const bundler = await import(pathToFileURL(packages.find(row => row.name === '@remotion/bundler').entry));
    const renderer = await import(pathToFileURL(packages.find(row => row.name === '@remotion/renderer').entry));
    const runtime = { ...bundler.default, ...bundler, ...renderer.default, ...renderer, packages };
    requireValid(['bundle', 'openBrowser', 'selectComposition', 'renderMedia', 'renderStill'].some(name => typeof runtime[name] !== 'function')
      ? [issue('runtime.api', 'runtime', 'Installed packages do not expose the required Remotion APIs.')] : []);
    return runtime;
  } catch (error) {
    if (error.errors) throw error;
    requireValid([issue('runtime.install', 'runtime', 'Cannot load the exact project-local runtime; install the scaffold dependencies explicitly before rendering.')]);
  }
}

async function renderSnapshot(directory, options) {
  const project = await inspectProject(directory, options);
  const { root, timeline, manifest } = project;
  const props = await input(root, 'media/remotion/input-props.json', 'snapshot');
  const provenance = await input(root, 'media/remotion/scaffold-provenance.json', 'provenance');
  requireValid(validateTimeline(props?.timeline));
  const fingerprint = timelineFingerprint(timeline);
  requireValid(props.timelineFingerprint !== fingerprint || timelineFingerprint(props.timeline) !== fingerprint ||
      provenance.schemaVersion !== 1 || provenance.timelineFingerprint !== fingerprint
    ? [issue('snapshot.timeline', 'snapshot', 'Generated snapshot/provenance is stale or conflicts with the current canonical timeline.')] : []);
  const currentAudio = await audioProvenance(root, manifest, options.audioManifest);
  const asset = snapshotAudioAsset(provenance, Boolean(manifest));
  requireValid(JSON.stringify(provenance.audio) !== JSON.stringify(currentAudio) || props.audioSrc !== asset
    ? [issue('snapshot.audio', 'snapshot.audio', 'Canonical audio handoff differs from the scaffold snapshot; provide its original manifest and rebuild explicitly.')] : []);
  if (manifest) {
    const copied = await localFile(root, `media/remotion/public/${asset}`, 'snapshot.audio');
    requireValid(await fileHash(copied) !== currentAudio.masterSha256
      ? [issue('snapshot.audio', 'snapshot.audio', 'Copied audio differs from the current canonical master.')] : []);
  }
  const scaffoldRoot = await realpath(path.join(root, 'media/remotion'));
  requireValid(!contained(root, scaffoldRoot) ? [issue('file.local', 'snapshot', 'Scaffold resolves outside the selected project.')] : []);
  return { ...project, props, scaffoldRoot, fingerprint, provenance,
    propsSha256: await fileHash(await localFile(root, 'media/remotion/input-props.json', 'snapshot')) };
}

/** Owns an exclusive output directory. Failed/partial exports are retained, never replaced. */
export async function render(directory, options = {}) {
  const snapshot = await renderSnapshot(directory, options);
  const { root, scaffoldRoot, timeline, preferences, props, permission } = snapshot;
  let browserExecutable;
  try {
    if (!path.isAbsolute(options.browserExecutable ?? '')) throw new Error('browser');
    browserExecutable = await realpath(options.browserExecutable);
    if (!(await stat(browserExecutable)).isFile()) throw new Error('browser');
  } catch { requireValid([issue('render.browser', 'browser', 'Select an explicit existing absolute browser executable; automatic downloads are not used.')]); }
  const relativeOutput = options.outputDir ?? 'media/remotion/out';
  requireValid(!safeRelativePath(relativeOutput) ? [issue('render.output', 'output', 'Output must be a safe project-relative new directory.')] : []);
  const output = path.resolve(root, relativeOutput.replaceAll('\\', '/'));
  requireValid(!contained(root, await realpath(path.dirname(output)))
    ? [issue('render.output', 'output', 'Output parent resolves outside the selected project.')] : []);
  const existing = await lstat(output).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  requireValid(existing ? [issue('render.exists', 'output', 'Output directory already exists; existing/partial artifacts are preserved.')] : []);
  const runtime = await (options.runtimeLoader ?? loadProjectRuntime)(scaffoldRoot);
  try { await mkdir(output); }
  catch { requireValid([issue('render.exists', 'output', 'Cannot exclusively reserve output; existing artifacts are preserved.')]); }
  let browser;
  let stage = 'bundle';
  try {
    const entryPoint = await localFile(root, 'media/remotion/index.jsx', 'source');
    const publicDir = await realpath(path.join(scaffoldRoot, 'public'));
    requireValid(!contained(root, publicDir) ? [issue('file.local', 'public', 'Public assets resolve outside the selected project.')] : []);
    const serveUrl = await runtime.bundle({ entryPoint, rootDir: scaffoldRoot, publicDir, outDir: path.join(output, 'bundle') });
    requireValid(!path.isAbsolute(serveUrl) || !contained(output, await realpath(serveUrl))
      ? [issue('render.bundle', 'bundle', 'Bundler must return its local exclusive output directory.')] : []);
    stage = 'browser';
    browser = await runtime.openBrowser('chrome', { browserExecutable });
    const common = { serveUrl, inputProps: props, puppeteerInstance: browser, browserExecutable };
    stage = 'metadata';
    const composition = await runtime.selectComposition({ ...common, id: 'AgencyMotion' });
    requireValid(composition.id !== 'AgencyMotion' || composition.durationInFrames !== timeline.totalFrames ||
        ['fps', 'width', 'height'].some(key => composition[key] !== timeline[key])
      ? [issue('render.metadata', 'composition', 'Actual composition duration/fps/width/height must match the current canonical timeline before encoding.')] : []);
    // Catch edits made while the asynchronous bundle/metadata operations were running.
    const current = await renderSnapshot(directory, options);
    requireValid(current.fingerprint !== snapshot.fingerprint || current.propsSha256 !== snapshot.propsSha256
      ? [issue('snapshot.changed', 'snapshot', 'Inputs changed during runtime setup; encoding was not started.')] : []);
    stage = 'encode';
    const video = path.join(output, 'video.mp4');
    await runtime.renderMedia({ ...common, composition, codec: preferences.output.videoCodec,
      audioCodec: preferences.output.audioCodec, sampleRate: preferences.output.audioSampleRate,
      pixelFormat: 'yuv420p', enforceAudioTrack: true, overwrite: false, outputLocation: video });
    stage = 'stills';
    await mkdir(path.join(output, 'stills'));
    const frames = [...new Set([0, Math.floor(timeline.totalFrames / 2), timeline.totalFrames - 1])];
    const artifacts = [video];
    for (const frame of frames) {
      const file = path.join(output, 'stills', `frame-${String(frame).padStart(6, '0')}.png`);
      await runtime.renderStill({ ...common, composition, output: file, frame, imageFormat: 'png', overwrite: false });
      artifacts.push(file);
    }
    const report = { schemaVersion: 1, ...permission, renderer: 'remotion', timelineRevision: timeline.revision,
      timelineFingerprint: snapshot.fingerprint, inputPropsSha256: snapshot.propsSha256, audio: snapshot.provenance.audio,
      composition: { id: composition.id, durationInFrames: composition.durationInFrames, fps: composition.fps,
        width: composition.width, height: composition.height },
      requestedEncoding: { ...preferences.output }, stillFrames: frames,
      packages: runtime.packages ?? [], artifacts: [], encodedInspection: 'unverified',
      visualReview: 'unverified', listeningReview: 'unverified', asyncFontMediaReadiness: 'unverified' };
    for (const file of artifacts) {
      const relative = path.relative(root, file).replaceAll('\\', '/');
      const resolved = await localFile(root, relative, 'artifact');
      report.artifacts.push({ path: relative, sha256: await fileHash(resolved), bytes: (await stat(resolved)).size });
    }
    await writeFile(path.join(output, 'render-evidence.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    return report;
  } catch (error) {
    await writeFile(path.join(output, 'render-failure.json'), `${JSON.stringify({ schemaVersion: 1, stage, partialArtifactsPreserved: true })}\n`, { flag: 'wx' }).catch(() => {});
    if (error.errors) throw error;
    requireValid([issue('render.failed', stage, 'Remotion export failed; inspect the preserved exclusive output directory. Inputs were not replaced.')]);
  } finally { if (browser) await browser.close({ silent: true }); }
}

async function main(args) {
  const [command, ...rest] = args;
  if (command === '--help') return resultReport([], { help: 'project.mjs preflight|scaffold|refresh|render --project absolute-root [--purpose evaluation|production] [--audio-manifest project-relative.json]. refresh requires --approved-revision matching the explicitly approved canonical handoff; preserves customized source/dependencies/outputs and archives previous handoff data. render requires --browser absolute-existing-executable and optionally --output project-relative-new-directory (default media/remotion/out). Uses exact project-local packages; never installs or downloads a browser. Approval/entitlement/encoded inspection remain unverified.' });
  const errors = [];
  const flags = parseFlags(rest, ['--project', '--purpose', '--audio-manifest', ...(command === 'render' ? ['--browser', '--output'] : command === 'refresh' ? ['--approved-revision'] : [])], errors);
  if (!['preflight', 'scaffold', 'refresh', 'render'].includes(command) || !flags['--project']) errors.push(issue('cli.arguments', 'arguments', 'Use preflight, scaffold, refresh or render with --project; see --help.'));
  requireValid(errors);
  const options = { purpose: flags['--purpose'] ?? 'evaluation', audioManifest: flags['--audio-manifest'] };
  if (command === 'scaffold') return resultReport([], await scaffold(flags['--project'], options));
  if (command === 'refresh') return resultReport([], await refresh(flags['--project'], { ...options, approvedRevision: flags['--approved-revision'] }));
  if (command === 'render') return resultReport([], await render(flags['--project'], { ...options, browserExecutable: flags['--browser'], outputDir: flags['--output'] }));
  const result = await inspectProject(flags['--project'], options);
  return resultReport([], { ...result.permission, timelineRevision: result.timeline.revision,
    timelineFingerprint: timelineFingerprint(result.timeline), mediaDecoded: false, renderVerified: false });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)))); }
  catch (error) {
    console.log(JSON.stringify(resultReport(error.errors ?? [issue('project.internal', '$', 'Remotion planning failed; input contents were not echoed.')])));
    process.exitCode = 2;
  }
}
