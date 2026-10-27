import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateTimeline, timelineFingerprint, validateAudioManifest, validatePreferences, readInput } from '../../audiovisual-review/scripts/review.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = 'Usage: node render-native.mjs scaffold|plan|render --project <absolute-project> [--audio-manifest <project-relative.json>] [--ffmpeg <executable>] [--browser <executable>]\nNode >=24. scaffold never overwrites; render uses project-local Playwright and FFmpeg. Render honors media/project.json when present; absent preferences use the timeline and shared default audio preset without creating a file. No package installation or network generation occurs.';

function requireValidContract(errors) {
  if (!errors.length) return;
  // Shared findings contain controlled messages/field paths, never rejected content values.
  const error = new Error(errors.map(issue => `${issue.code} at ${issue.path}: ${issue.message}`).join('\n'));
  error.code = 'MEDIA_CONTRACT_INVALID';
  error.errors = errors;
  throw error;
}

export function planRender(timeline) {
  requireValidContract(validateTimeline(timeline));
  return {timelineRevision:timeline.revision,timelineFingerprint:timelineFingerprint(timeline),frameCount:timeline.totalFrames,lastFrame:timeline.totalFrames-1,
    durationSeconds:timeline.totalFrames/timeline.fps,lastTime:(timeline.totalFrames-1)/timeline.fps,loopProbeTime:timeline.totalFrames/timeline.fps};
}

export function validateAudio(timeline, manifest, preset) {
  requireValidContract(validateAudioManifest(timeline, manifest, preset));
  // Normalize separators for the existing file resolver without changing the manifest.
  return manifest.master.replaceAll('\\', '/');
}

export function encodeArgs(timeline, frames, output, audio) {
  planRender(timeline);
  const args=['-hide_banner','-loglevel','error','-n','-framerate',String(timeline.fps),'-start_number','0','-i',path.join(frames,'frame-%06d.png')];
  if (audio) args.push('-i',audio);
  args.push('-map','0:v:0','-frames:v',String(timeline.totalFrames),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p');
  if (audio) args.push('-map','1:a:0','-af',`apad,atrim=duration=${timeline.totalFrames/timeline.fps}`,'-c:a','aac','-b:a','320k','-ar','48000','-ac','2');
  else args.push('-an');
  args.push('-t',String(timeline.totalFrames/timeline.fps),'-movflags','+faststart',output);
  return args;
}

async function containedFile(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p=>p==='..'||p.startsWith('.'))) throw new Error('Use a nonsecret project-relative file path with forward slashes');
  const actualRoot = await fs.realpath(root);
  const resolved = await fs.realpath(path.resolve(root,relative));
  const rel = path.relative(actualRoot,resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('File escapes project root');
  return resolved;
}

async function readTimeline(project) {
  return JSON.parse(await fs.readFile(await containedFile(project,'media/timeline.json'),'utf8'));
}

export async function readRenderPreferences(project, timeline) {
  const root = await fs.realpath(project);
  const file = 'media/project.json';
  try { await fs.lstat(path.join(root, file)); }
  catch (error) {
    // Standalone use is allowed only when no preference file is recorded.
    if (error.code === 'ENOENT') return null;
    requireValidContract([{ code: 'input.read', path: 'preferences', message: 'Project preferences are unreadable.' }]);
  }
  const errors = [];
  const preferences = await readInput(file, 'json', errors, 'preferences', root);
  if (!errors.length) errors.push(...validatePreferences(preferences)); // Includes validatePreset.
  if (!errors.length) {
    if (preferences.renderer !== 'native') errors.push({ code: 'preferences.rendererMismatch', path: 'preferences.renderer',
      message: 'The project selects Remotion. Confirm and record a native choice before using this renderer.' });
    for (const key of ['fps', 'width', 'height']) {
      if (preferences.output[key] !== timeline[key]) errors.push({ code: 'preferences.timelineMismatch', path: `preferences.output.${key}`,
        message: `Project output ${key} differs from the approved timeline; reconcile the recorded choices before rendering.` });
    }
  }
  requireValidContract(errors);
  return preferences;
}

export async function scaffold(project) {
  const timeline=await readTimeline(project);
  planRender(timeline);
  const target=path.join(project,'media/native');
  await fs.mkdir(target); // An existing source directory is never replaced.
  await fs.copyFile(path.join(skillRoot,'assets/index.html'),path.join(target,'index.html'));
  await fs.writeFile(path.join(target,'content.json'),JSON.stringify({brand:'Sample brand',loop:false,accent:'#b94930',background:'#f1ede3',foreground:'#18372e',scenes:Object.fromEntries(timeline.scenes.map(s=>[s.id,{eyebrow:'APPROVED COPY GOES HERE',headline:s.id,detail:'Replace starter content before review.'}]))},null,2)+'\n');
  await fs.writeFile(path.join(target,'package.json'),JSON.stringify({name:'agency-native-motion',private:true,type:'module',devDependencies:{playwright:'1.62.1'}},null,2)+'\n');
  return target;
}

export async function captureFrames(page,timeline,frames) {
  planRender(timeline);
  await page.waitForFunction(()=>Boolean(window.motion),null,{timeout:15000});
  await page.evaluate((expected)=>{
    const ready=window.motion.ready;
    if (!ready || typeof ready.then !== 'function') throw new Error('Page motion.ready must be a promise');
    window.__motionReady = false;
    window.__motionError = null;
    // Readiness may initialize metadata and seek; observe its rejection immediately.
    Promise.resolve(ready).then(async()=>{
      const meta=window.motion.meta;
      for (const key of ['fps','totalFrames','width','height']) if (meta[key] !== expected[key]) throw new Error(`Page ${key} differs from timeline`);
      if (meta.timelineRevision !== expected.revision) throw new Error('Page timeline revision differs');
      const fontsReady=document.fonts?.ready;
      if (!fontsReady || typeof fontsReady.then !== 'function') throw new Error('Page document.fonts.ready must be a promise');
      await fontsReady;
      for (const img of document.images) { await img.decode(); if (!img.naturalWidth) throw new Error('Image failed readiness'); }
      window.__motionReady = true;
    }).catch(error=>{window.__motionError=String(error);});
  },timeline);
  await page.waitForFunction(()=>window.__motionReady || window.__motionError,null,{timeout:15000});
  await page.evaluate(()=>{if(window.__motionError) throw new Error(window.__motionError);});
  for (let frame=0;frame<timeline.totalFrames;frame++) {
    await page.evaluate((seconds)=>{
      window.__motionSeekDone=false;
      Promise.resolve(window.motion.seek(seconds)).then(()=>{window.__motionSeekDone=true;}).catch(error=>{window.__motionError=String(error);});
    },frame/timeline.fps);
    await page.waitForFunction(()=>window.__motionSeekDone || window.__motionError,null,{timeout:15000});
    await page.evaluate(()=>{if(window.__motionError) throw new Error(window.__motionError);});
    await page.screenshot({path:path.join(frames,`frame-${String(frame).padStart(6,'0')}.png`),animations:'disabled',timeout:15000});
  }
}

const contentTypes={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'};

export async function startServer(project) {
  const projectRoot = await fs.realpath(project);
  const exactRoutes = new Map([
    ['/', ['media/native', 'index.html']],
    ['/index.html', ['media/native', 'index.html']],
    ['/content.json', ['media/native', 'content.json']],
    ['/timeline.json', ['media', 'timeline.json']],
  ]);
  const server=http.createServer(async(req,res)=>{
    const unavailable = status => {
      res.writeHead(status, status === 405 ? { Allow: 'GET, HEAD' } : {});
      res.end('Asset not available');
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return unavailable(405);
    // Inspect the original request target; URL parsing would erase dot segments.
    const rawPath = (req.url ?? '').split('?')[0];
    if (!rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('#')) return unavailable(400);
    let requested;
    try { requested = decodeURIComponent(rawPath); } catch { return unavailable(400); }
    if (/[\u0000-\u001f\u007f]/.test(requested)) return unavailable(400);
    if (requested.includes('\\') || requested.includes(':') || requested.split('/').some(part => part.startsWith('.'))) return unavailable(403);

    const exact = exactRoutes.get(requested);
    const route = exact
      ? { root: path.join(projectRoot, exact[0]), relative: exact[1], exact: true }
      : requested.startsWith('/assets/')
        ? { root: path.join(projectRoot, 'media/assets'), relative: requested.slice('/assets/'.length), exact: false }
        : null;
    if (!route) return unavailable(404);
    const mime = contentTypes[path.extname(route.relative).toLowerCase()];
    if (!mime) return unavailable(404);
    if (path.isAbsolute(route.relative)) return unavailable(403);
    try {
      const actualRoot = await fs.realpath(route.root);
      // A public root (or its parent) cannot redirect to a different project directory.
      if (path.relative(route.root, actualRoot) !== '') return unavailable(403);
      const candidate = path.resolve(actualRoot, route.relative);
      const file = await fs.realpath(candidate);
      const relative = path.relative(actualRoot, file);
      if (!relative || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) return unavailable(403);
      // Exact endpoints must not alias another file, even within their public root.
      if (route.exact && path.relative(candidate, file) !== '') return unavailable(403);
      if (!(await fs.stat(file)).isFile()) return unavailable(404);
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const status = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404
        : ['EACCES', 'EPERM', 'ELOOP'].includes(error.code) ? 403 : 500;
      unavailable(status);
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {server,origin:`http://127.0.0.1:${server.address().port}`};
}

function run(executable,args,cwd) {
  const result=spawnSync(executable,args,{cwd,shell:false,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
  if (result.error) throw new Error(`Cannot start ${path.basename(executable)}: ${result.error.code}. Install locally or provide its executable path.`);
  if (result.status !== 0) throw new Error(`${path.basename(executable)} exited ${result.status}: ${(result.stderr??'').slice(-2000)}`);
  return result;
}

export async function render(project,options={}) {
  const timeline=await readTimeline(project);
  const plan=planRender(timeline);
  const preferences=await readRenderPreferences(project,timeline);
  let audio;
  if (options.audioManifest) {
    const manifest=JSON.parse(await fs.readFile(await containedFile(project,options.audioManifest),'utf8'));
    audio=await containedFile(project,validateAudio(timeline,manifest,preferences?.output.loudness));
  }
  const ffmpeg=options.ffmpeg??'ffmpeg';
  run(ffmpeg,['-version'],project);
  let chromium;
  try {chromium=createRequire(path.join(project,'media/native/package.json'))('playwright').chromium;}
  catch {throw new Error('Playwright is missing in media/native. Install the scoped package.json and its Chromium browser after project setup approval.');}
  const outputDir=path.join(project,'media/renders',`native-${timeline.revision}-${randomUUID()}`);
  const frames=path.join(outputDir,'frames');
  await fs.mkdir(frames,{recursive:true});
  const {server,origin}=await startServer(project);
  let browser,loop=false;
  try {
    browser=await chromium.launch({headless:true,...(options.browser?{executablePath:options.browser}:{})});
    const context=await browser.newContext({viewport:{width:timeline.width,height:timeline.height},deviceScaleFactor:1,serviceWorkers:'block'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(String(error)));
    await page.goto(origin,{waitUntil:'load',timeout:15000});
    await captureFrames(page,timeline,frames);
    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join('; ')}`);
    loop=await page.evaluate(()=>window.motion.meta.loop === true);
    if (loop) {
      await page.evaluate(seconds=>window.motion.seek(seconds),plan.loopProbeTime);
      const end=await page.screenshot({animations:'disabled'});
      const start=await fs.readFile(path.join(frames,'frame-000000.png'));
      if (!start.equals(end)) throw new Error('Loop boundary mismatch: seek(duration) differs from seek(0)');
    }
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
  const output=path.join(outputDir,'video.mp4');
  run(ffmpeg,encodeArgs(timeline,frames,output,audio),project);
  const stills=[0,Math.floor((timeline.totalFrames-1)/2),timeline.totalFrames-1];
  for(let i=0;i<stills.length;i++) await fs.copyFile(path.join(frames,`frame-${String(stills[i]).padStart(6,'0')}.png`),path.join(outputDir,`still-${i+1}.png`));
  run(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',path.join(outputDir,'still-%d.png'),'-vf','scale=480:-1,tile=3x1','-frames:v','1',path.join(outputDir,'contact-sheet.png')],project);
  const evidence={renderer:'native',...plan,fps:timeline.fps,width:timeline.width,height:timeline.height,projectPreferences:preferences?'media/project.json':null,loopBoundary:loop?'matched-first-frame':'not-requested',audioManifest:options.audioManifest??null,output:path.relative(project,output).replaceAll('\\','/'),visualReview:'unverified',listeningReview:'unverified'};
  await fs.writeFile(path.join(outputDir,'render-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  return evidence;
}

async function main(args) {
  if(args.includes('--help') || !args.length){console.log(help);return;}
  const [command,...rest]=args;
  const options={};
  for(let i=0;i<rest.length;i+=2){if(!['--project','--audio-manifest','--ffmpeg','--browser'].includes(rest[i])||!rest[i+1])throw new Error(help);options[rest[i].slice(2)]=rest[i+1];}
  if(!options.project || !path.isAbsolute(options.project))throw new Error('--project must be an absolute project folder');
  if(command==='scaffold') console.log(JSON.stringify({directory:await scaffold(options.project)}));
  else if(command==='plan') console.log(JSON.stringify(planRender(await readTimeline(options.project)),null,2));
  else if(command==='render')console.log(JSON.stringify(await render(options.project,{audioManifest:options['audio-manifest'],ffmpeg:options.ffmpeg,browser:options.browser}),null,2));
  else throw new Error(help);
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
