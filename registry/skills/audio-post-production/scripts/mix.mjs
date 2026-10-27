import { writeFile, mkdir, realpath, lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_PRESET, contained, projectRoot, readInput, safeRelativePath, timelineFingerprint,
  validateAudioManifest, validateMediaFiles, validatePreferences, validatePreset, validateTimeline } from '../../audiovisual-review/scripts/review.mjs';

const RATE = 48000;
function finite(n, label) { if (!Number.isFinite(n)) throw new Error(`${label} must be finite`); return n; }
function requireValid(errors) {
  if (!errors.length) return;
  const error = new Error(errors.map(issue => `${issue.code} at ${issue.path}: ${issue.message}`).join('\n'));
  error.code = 'MEDIA_CONTRACT_INVALID';
  error.errors = errors;
  throw error;
}
function localFile(file) {
  if (!safeRelativePath(file)) throw new Error('audio paths must be nonprivate project-relative paths');
  return file.replaceAll('\\', '/');
}
export function validateMix(timeline, mix) {
  requireValid(validateTimeline(timeline));
  if (!mix || typeof mix !== 'object' || Array.isArray(mix)) throw new Error('supply a mix object');
  if (Object.keys(mix).some(key => !['timelineRevision', 'timelineFingerprint', 'tracks', 'targetLufs', 'truePeakDbtp'].includes(key))) throw new Error('unexpected mix fields');
  if (mix.timelineRevision !== timeline.revision) throw new Error('timeline revision mismatch');
  if (mix.timelineFingerprint !== undefined && mix.timelineFingerprint !== timelineFingerprint(timeline)) throw new Error('timeline fingerprint mismatch');
  if (!Array.isArray(mix.tracks) || mix.tracks.length < 1 || mix.tracks.length > 64) throw new Error('supply 1 to 64 audio tracks');
  const ids = new Set();
  for (const track of mix.tracks) {
    if (!track || typeof track !== 'object' || Array.isArray(track)) throw new Error('supply track objects');
    if (Object.keys(track).some(key => !['id', 'kind', 'path', 'startFrame', 'endFrame', 'gainDb', 'trimStartSeconds', 'provenance'].includes(key))) throw new Error('unexpected track fields');
    if (ids.has(track.id)) throw new Error('duplicate cue id');
    ids.add(track.id);
    if (!['vo','music','sfx'].includes(track.kind)) throw new Error('unknown track kind');
    localFile(track.path);
    if (!Number.isInteger(track.startFrame) || !Number.isInteger(track.endFrame) || track.startFrame < 0 || track.endFrame <= track.startFrame || track.endFrame > timeline.totalFrames) throw new Error('invalid cue range');
    const cue = timeline.cues.find(c => c.id === track.id);
    if (!cue || cue.kind !== track.kind || cue.startFrame !== track.startFrame || cue.endFrame !== track.endFrame) throw new Error('track must match approved timeline cue');
    const gain = track.gainDb === undefined ? 0 : track.gainDb, trim = track.trimStartSeconds === undefined ? 0 : track.trimStartSeconds;
    if (finite(gain, 'gain') > 12 || gain < -96 || finite(trim,'trim') < 0) throw new Error('invalid trim or gain');
    if (typeof track.provenance !== 'string' || !track.provenance.trim() || track.provenance.length > 10000) throw new Error('every source requires nonempty provenance text');
  }
  if (timeline.cues.some(cue => !ids.has(cue.id))) throw new Error('mix is missing an approved cue; supply every approved cue exactly once');
}
export function buildStemFilter(track, fps, totalSamples) {
  const start = Math.round((track.trimStartSeconds ?? 0) * RATE);
  const delay = Math.round(track.startFrame * RATE / fps);
  const duration = Math.round(track.endFrame * RATE / fps) - delay;
  return `aresample=${RATE},aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=start_sample=${start}:end_sample=${start + duration},asetpts=PTS-STARTPTS,volume=${track.gainDb ?? 0}dB,adelay=${delay}S:all=1,apad=whole_len=${totalSamples},atrim=end_sample=${totalSamples}`;
}
export function parseLoudness(stderr) {
  const candidates = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!candidates?.length) throw new Error('finite loudness measurement unavailable');
  const value = JSON.parse(candidates.at(-1));
  return { integratedLufs: finite(Number(value.input_i),'integrated loudness'), truePeakDbtp: finite(Number(value.input_tp),'true peak'), loudnessRange: finite(Number(value.input_lra),'loudness range'), threshold: finite(Number(value.input_thresh),'threshold'), offset: finite(Number(value.target_offset),'offset') };
}
export function masteringFilter(measured, target = -16, peak = -1) {
  for (const value of [target,peak,...Object.values(measured)]) finite(value,'mastering parameter');
  requireSupportedPreset({ integratedLufs: target, toleranceLu: DEFAULT_PRESET.toleranceLu, truePeakDbtp: peak });
  return `loudnorm=I=${target}:TP=${peak}:LRA=11:measured_I=${measured.integratedLufs}:measured_TP=${measured.truePeakDbtp}:measured_LRA=${measured.loudnessRange}:measured_thresh=${measured.threshold}:offset=${measured.offset}:linear=true:print_format=json`;
}
function requireSupportedPreset(preset) {
  requireValid(validatePreset(preset));
  if (preset.truePeakDbtp < -9) throw new Error('Local FFmpeg loudnorm supports true peak -9..0 dBTP; this valid shared preset needs another approved processor or an explicitly revised project preset.');
}
function ffmpeg(args, binary, run) {
  const result = run(binary, ['-hide_banner','-nostdin',...args], { encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024 });
  if (result.error || result.status !== 0) throw new Error(`FFmpeg failed (${result.error?.code ?? result.status}); select a suitable local FFmpeg with amix normalize and loudnorm support, and check the approved inputs.`);
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}
function preflightFFmpeg(binary, run) {
  const amix = ffmpeg(['-h', 'filter=amix'], binary, run);
  if (!/\bnormalize\s+<boolean>/.test(amix)) throw new Error('FFmpeg amix normalize support is required to preserve relative gains; select a suitable modern local FFmpeg executable.');
  const loudnorm = ffmpeg(['-h', 'filter=loudnorm'], binary, run);
  if (!/\bI\s+<double>[^\n]*from -70 to -5/.test(loudnorm) || !/\bTP\s+<double>[^\n]*from -9 to 0/.test(loudnorm)) throw new Error('FFmpeg loudnorm I -70..-5 / TP -9..0 support is required; select a suitable modern local FFmpeg executable.');
}
async function sourceFile(root, relative) {
  const resolved = await realpath(path.resolve(root, localFile(relative)));
  if (!contained(root, resolved)) throw new Error('audio path resolves outside project');
  if (!(await stat(resolved)).isFile()) throw new Error('audio input must be a regular file');
  return resolved;
}
async function selectedPreset(root, timeline, mix) {
  let preferences;
  try { await lstat(path.join(root, 'media/project.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; else return standalonePreset(mix); }
  const errors = [];
  preferences = await readInput('media/project.json', 'json', errors, 'preferences', root);
  if (!errors.length) errors.push(...validatePreferences(preferences));
  requireValid(errors);
  for (const key of ['fps', 'width', 'height']) {
    if (preferences.output[key] !== timeline[key]) throw new Error(`preferences output ${key} differs from the approved timeline; reconcile the recorded choices before mixing`);
  }
  const approved = preferences.output.loudness;
  const preset = { ...approved, truePeakDbtp: mix.truePeakDbtp === undefined ? approved.truePeakDbtp : mix.truePeakDbtp };
  if ((mix.targetLufs !== undefined && mix.targetLufs !== approved.integratedLufs) || preset.truePeakDbtp > approved.truePeakDbtp) throw new Error('mix loudness override conflicts with saved project preferences; obtain an explicit preference change');
  requireSupportedPreset(preset);
  return preset;
}
function standalonePreset(mix) {
  const preset = { ...DEFAULT_PRESET,
    integratedLufs: mix.targetLufs === undefined ? DEFAULT_PRESET.integratedLufs : mix.targetLufs,
    truePeakDbtp: mix.truePeakDbtp === undefined ? DEFAULT_PRESET.truePeakDbtp : mix.truePeakDbtp };
  requireSupportedPreset(preset);
  return preset;
}
async function newDestination(root, outputFolder) {
  const destination = path.resolve(root, localFile(outputFolder));
  try { await lstat(destination); throw new Error('output folder already exists; select a new revision folder'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Check the nearest existing ancestor before mkdir, including nested output
  // paths beneath junctions. Invalid paths must not create directories outside root.
  let parent = path.dirname(destination);
  for (;;) {
    try {
      await lstat(parent);
      const resolved = await realpath(parent);
      if (!contained(root, resolved)) throw new Error('output parent resolves outside project');
      if (!(await stat(resolved)).isDirectory()) throw new Error('output parent must be a directory');
      return destination;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    parent = path.dirname(parent);
  }
}
export async function renderMix(project, timeline, mix, outputFolder = 'media/audio-final', binary = 'ffmpeg', { run = spawnSync } = {}) {
  validateMix(timeline,mix);
  const errors = [], root = await projectRoot(project, errors);
  requireValid(errors);
  const preset = await selectedPreset(root, timeline, mix);
  const destination = await newDestination(root, outputFolder);
  const inputs = await Promise.all(mix.tracks.map(t => sourceFile(root,t.path)));
  preflightFFmpeg(binary, run);
  await mkdir(path.dirname(destination),{recursive:true});
  const parent = await realpath(path.dirname(destination));
  if (!contained(root, parent)) throw new Error('output parent resolves outside project');
  await mkdir(destination);
  const samples = Math.round(timeline.totalFrames * RATE / timeline.fps);
  const stems = [];
  for (let i=0;i<mix.tracks.length;i++) {
    const track=mix.tracks[i], file=path.join(destination,`cue-${i + 1}-${track.id}.wav`);
    ffmpeg(['-i',inputs[i],'-af',buildStemFilter(track,timeline.fps,samples),'-ar',String(RATE),'-ac','2','-c:a','pcm_s24le','-n',file],binary,run);
    stems.push({id:track.id,kind:track.kind,path:path.relative(root,file).replaceAll('\\','/')});
  }
  const premaster=path.join(destination,'premaster.wav');
  const args=stems.flatMap(stem=>['-i',path.resolve(root,stem.path)]);
  const labels=stems.map((_,i)=>`[${i}:a]`).join('');
  ffmpeg([...args,'-filter_complex',`${labels}amix=inputs=${stems.length}:normalize=0:dropout_transition=0[mix]`,'-map','[mix]','-ar',String(RATE),'-ac','2','-c:a','pcm_f32le','-n',premaster],binary,run);
  const target=preset.integratedLufs, peak=preset.truePeakDbtp;
  const measured=parseLoudness(ffmpeg(['-i',premaster,'-af',`loudnorm=I=${target}:TP=${peak}:LRA=11:print_format=json`,'-f','null','-'],binary,run));
  const master=path.join(destination,'master.wav');
  ffmpeg(['-i',premaster,'-af',masteringFilter(measured,target,peak),'-ar',String(RATE),'-ac','2','-c:a','pcm_s24le','-n',master],binary,run);
  const measurements={scope:'master',...parseLoudness(ffmpeg(['-i',master,'-af',`loudnorm=I=${target}:TP=${peak}:LRA=11:print_format=json`,'-f','null','-'],binary,run))};
  const manifest={schemaVersion:1,timelineRevision:timeline.revision,timelineFingerprint:timelineFingerprint(timeline),fps:timeline.fps,totalFrames:timeline.totalFrames,sampleRate:RATE,channels:2,master:path.relative(root,master).replaceAll('\\','/'),stems,cues:mix.tracks.map(t=>({id:t.id,path:stems.find(s=>s.id===t.id).path,startFrame:t.startFrame,endFrame:t.endFrame})),measurements,provenance:mix.tracks.map(t=>({cueId:t.id,source:t.path,evidence:t.provenance})),review:{numerical:true,listening:'unverified',muxedAudio:'unverified'},stemPolicy:'Full-duration aligned pre-master cue stems retain relative mix gains; nonlinear master processing is not reproduced by their sum. No independent stem loudness normalization.'};
  requireValid(validateAudioManifest(timeline, manifest, preset));
  requireValid(await validateMediaFiles(root, manifest));
  await writeFile(path.join(destination,'audio-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [project,timelineFile,mixFile,output,binary] = process.argv.slice(2);
  if (!project || project==='--help' || !timelineFile || !mixFile) console.log('Usage: node mix.mjs <absolute-project-root> <relative-timeline.json> <relative-mix.json> [new-relative-output-folder] [ffmpeg-executable]\nOffline alignment, pre-master cue stems, stereo48k WAV master and validated manifest. Honors media/project.json and never rewrites preferences, source or output revisions. Select a modern local FFmpeg with amix normalize and loudnorm support.');
  else try {
    const errors=[], root=await projectRoot(project,errors); requireValid(errors);
    localFile(timelineFile); localFile(mixFile);
    const timeline=await readInput(timelineFile.replaceAll('\\','/'),'json',errors,'timeline',root);
    const mix=await readInput(mixFile.replaceAll('\\','/'),'json',errors,'mix',root); requireValid(errors);
    const manifest=await renderMix(root,timeline,mix,output,binary);
    console.log(JSON.stringify({master:manifest.master,review:manifest.review}));
  }
  catch(error){console.error(error.message);process.exitCode=1;}
}
