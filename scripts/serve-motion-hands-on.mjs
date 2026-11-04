import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] || path.join(repo, 'scratch/motion-hands-on'));
const native = path.join(root, 'native/media/native');
const routes = new Map([
  ['/scene', path.join(native, 'index.html')], ['/timeline.json', path.join(root, 'native/media/timeline.json')],
  ['/content.json', path.join(native, 'content.json')], ['/native.mp4', path.join(root, 'native/media/out/chicken-lifecycle.mp4')],
  ['/remotion.mp4', path.join(root, 'remotion/media/out/chicken-lifecycle-r4.mp4')],
]);
const page = `<!doctype html><meta charset="utf-8"><title>Motion hands-on preview</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:1rem}button,input[type=range]{min-height:44px}button{padding:0 1rem}button:focus-visible,input:focus-visible,video:focus-visible{outline:3px solid #005fcc;outline-offset:2px}video{max-width:100%;height:auto}</style><h1>Native source preview</h1><p>Silent source preview; no audio. Use arrows on the frame slider to scrub.</p><button id="play" disabled>Play</button> <button id="reset">Reset</button> <label>Frame <input type="range" id="frame" min="0" value="0"><output id="value">0</output></label><div id="viewport" style="width:100%;overflow:hidden"><iframe id="scene" src="/scene" title="Native scene" style="border:0;transform-origin:top left"></iframe></div><h2>Historical encoded exports</h2><p>These are copied pilot exports, not evidence of approval for new work.</p><label>Native <video controls preload="metadata" width="480" src="/native.mp4"></video></label><label> Remotion <video controls preload="metadata" width="480" src="/remotion.mp4"></video></label><script>const f=document.querySelector('#frame'),v=document.querySelector('#value'),s=document.querySelector('#scene'),p=document.querySelector('#play');let m,playing=false,last=0;async function seek(){v.textContent=f.value;await s.contentWindow.motion.seek(Number(f.value)/m.fps)}s.onload=async()=>{await s.contentWindow.motion.ready;m=s.contentWindow.motion.meta;f.max=m.totalFrames-1;f.oninput=seek;p.disabled=false;const fit=()=>{const viewport=document.querySelector('#viewport'),scale=viewport.clientWidth/m.width;s.style.width=m.width+'px';s.style.height=m.height+'px';s.style.transform='scale('+scale+')';viewport.style.height=(m.height*scale)+'px'};fit();window.addEventListener('resize',fit)};p.onclick=()=>{playing=!playing;p.textContent=playing?'Pause':'Play';last=0;if(playing)requestAnimationFrame(tick)};document.querySelector('#reset').onclick=()=>{playing=false;p.textContent='Play';f.value=0;if(m)seek()};function tick(t){if(!playing||!m)return;if(!last)last=t;let step=Math.floor((t-last)*m.fps/1000);if(step){last+=step*1000/m.fps;f.value=(Number(f.value)+step)%m.totalFrames;seek()}requestAnimationFrame(tick)}</script>`;
const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); res.end('Bad request'); return; }
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page); return; }
  const file = routes.get(url.pathname);
  let size; try { if (!file) throw Error(); const realRoot=fs.realpathSync(root), realFile=fs.realpathSync(file), rel=path.relative(realRoot, realFile); if (rel === '..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) throw Error(); const info=fs.statSync(realFile); if (!info.isFile()) throw Error(); size=info.size; } catch { res.writeHead(404); res.end('Not found'); return; }
  const video = url.pathname.endsWith('.mp4');
  const send = (options) => { const stream=fs.createReadStream(file, options); stream.on('error', () => res.destroy()); stream.pipe(res); };
  const headers = { 'content-type': video ? 'video/mp4' : url.pathname === '/scene' ? 'text/html; charset=utf-8' : 'application/json', 'accept-ranges': 'bytes' };
  const match = video && /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  if (match) { const start = Number(match[1]), end = Math.min(match[2] ? Number(match[2]) : size - 1, size - 1); if (start > end) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; } res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end-start+1 }); send({ start, end }); return; }
  res.writeHead(200, { ...headers, 'content-length': size }); send();
});
server.listen(0, '127.0.0.1', () => console.log(`Motion preview: http://127.0.0.1:${server.address().port}/ (PID ${process.pid})`));
