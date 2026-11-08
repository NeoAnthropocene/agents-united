import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const pins = { three: "0.180.0", playwright: "1.62.1", "gltf-validator": "2.0.0-dev.3.10" };
function setupArgs(prefix) {
  if (!path.isAbsolute(prefix)) throw Error("absolute prefix required");
  return ["install", `--prefix=${prefix}`, "--global=false", "--workspaces=false", "--save-exact", `three@${pins.three}`, `playwright@${pins.playwright}`, `gltf-validator@${pins["gltf-validator"]}`];
}
async function setup(prefix, npmCli) {
  if (!path.isAbsolute(prefix) || !path.isAbsolute(npmCli)) throw Error("absolute paths required");
  await fs.mkdir(prefix, { recursive: true });
  const actual = await fs.realpath(prefix);
  if (actual !== path.resolve(prefix)) throw Error("runtime prefix must not contain symlinks");
  const manifest = path.join(prefix, "package.json");
  try {
    const existing = JSON.parse(await fs.readFile(manifest, "utf8"));
    if (existing.name !== "agency-3d-runtime" || existing.private !== true || !existing.dependencies || Object.keys(existing.dependencies).length !== Object.keys(pins).length || Object.entries(pins).some(([name, version]) => existing.dependencies[name] !== version)) throw Error("existing runtime manifest does not match pins");
    const lock = JSON.parse(await fs.readFile(path.join(prefix, "package-lock.json"), "utf8"));
    for (const [name, version] of Object.entries(pins)) {
      const file = path.join(prefix, "node_modules", name, "package.json");
      const resolved = await fs.realpath(file);
      const relative = path.relative(actual, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw Error("runtime dependency escapes prefix");
      const installed = JSON.parse(await fs.readFile(resolved, "utf8"));
      if (installed.version !== version || lock.packages?.["node_modules/" + name]?.version !== version) throw Error("runtime dependency differs from lock");
    }
    return { installed: true, reused: true, pins };
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    try {
      await fs.lstat(manifest);
      throw Error("existing runtime manifest is incomplete");
    } catch (check) {
      if (check.code !== "ENOENT") throw check;
    }
  }
  await fs.writeFile(manifest, JSON.stringify({ name: "agency-3d-runtime", private: true, dependencies: pins }, null, 2) + "\n", { flag: "wx" });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, ...setupArgs(prefix)], { cwd: prefix, stdio: ["ignore", "ignore", "inherit"], shell: false, windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(Error("npm installation failed")));
  });
  return { installed: true, reused: false, pins };
}
const validRel = (s) => typeof s === "string" && !!s && !path.isAbsolute(s) && !/[\\:?#\x00-\x1f]/.test(s) && s.split("/").every((x) => x && !x.startsWith("."));
const sha = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");
async function rendererIdentity() {
  const own = await fs.realpath(fileURLToPath(import.meta.url));
  const directory = path.dirname(own);
  const files = ['shared-3d-runtime.mjs', 'render-three.mjs'];
  const result = [];
  for (const file of files) {
    const resolved = await fs.realpath(path.join(directory, file));
    result.push({file, sha256: sha(await fs.readFile(resolved))});
  }
  return result;
}
async function checked(root, rel) {
  if (!validRel(rel)) throw Error("invalid project path");
  const base = await fs.realpath(root), target = await fs.realpath(path.join(base, rel));
  const r = path.relative(base, target);
  if (!r || r.startsWith("..") || path.isAbsolute(r)) throw Error("path escapes project");
  return target;
}
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}canvas{display:block}#help{display:none;position:fixed;bottom:0;left:0;margin:0;padding:8px;background:#fff;color:#111;font:14px sans-serif}</style><p id="help">Drag or use the left and right arrow keys to rotate. If the viewer is unavailable, use the supplied PNG proof.</p><script type="importmap">{"imports":{"three":"/three.js","three/addons/":"/addons/"}}<\/script><script type="module">
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
window.viewer={ready:(async()=>{const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0xffffff,1);document.body.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D model viewer. Drag or use left and right arrow keys to rotate.');renderer.domElement.addEventListener('webglcontextlost',()=>{window.viewer.failure='WebGL context lost'});const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,5,4);scene.add(light);const model=(await new GLTFLoader().loadAsync('/asset.glb')).scene;const pivot=new THREE.Group();scene.add(pivot);pivot.add(model);const box=new THREE.Box3().setFromObject(model);if(box.isEmpty())throw Error('empty scene');const center=box.getCenter(new THREE.Vector3());model.position.sub(center);const size=box.getSize(new THREE.Vector3()).length();const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,Math.max(size/1000,0.001),size*100);camera.position.set(size*1.3,size*.8,size*1.8);camera.lookAt(0,0,0);await document.fonts.ready;await renderer.compileAsync(scene,camera);renderer.render(scene,camera);const gl=renderer.getContext();window.viewer.camera={projection:'perspective',fovDegrees:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,position:camera.position.toArray(),target:[0,0,0],up:camera.up.toArray(),modelOffset:model.position.toArray()};window.viewer.conventions={colorSpace:renderer.outputColorSpace,range:'full',alpha:renderer.getClearAlpha()<1,background:'#'+renderer.getClearColor(new THREE.Color()).getHexString(THREE.SRGBColorSpace),units:'meters',origin:'default-scene-bounds-center',sourceOrigin:'gltf-default-scene',axes:'right-handed-y-up-z-forward'};const ext=gl.getExtension('WEBGL_debug_renderer_info');window.viewer.backend={contextAlpha:gl.getContextAttributes().alpha,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};const draw=()=>renderer.render(scene,camera);renderer.domElement.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();pivot.rotation.y+=event.key==='ArrowRight'?0.1:-0.1;draw();}});let previousX=null;renderer.domElement.addEventListener('pointerdown',event=>{previousX=event.clientX;renderer.domElement.setPointerCapture(event.pointerId);});renderer.domElement.addEventListener('pointermove',event=>{if(previousX===null)return;pivot.rotation.y+=(event.clientX-previousX)*0.01;previousX=event.clientX;draw();});for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,()=>{previousX=null;});window.viewer.seek=(seconds,speed)=>{pivot.rotation.y=seconds*speed;draw();const err=gl.getError();if(err!==gl.NO_ERROR)throw Error('WebGL error '+err);};})()};<\/script>`;
async function render(options) {
  let server, browser, timer, expired = false;
  const errors = [], frames = [];
  try {
    const deadlineMs = options.deadlineMs ?? 3e4;
    if (!Number.isInteger(deadlineMs) || deadlineMs < 1e3 || deadlineMs > 6e5) throw Error("invalid deadline");
    timer = setTimeout(() => {
      expired = true;
      if (browser) void browser.close();
    }, deadlineMs);
    const { project, asset, outputDir, width, height, fps, startFrame, frameCount, browser: executablePath, rotationRadiansPerSecond = 0 } = options;
    const rendererFiles = await rendererIdentity();
    if (!path.isAbsolute(project) || !validRel(asset) || !validRel(outputDir)) throw Error("invalid project path");
    if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 4096) || !Number.isFinite(fps) || fps <= 0 || fps > 240 || !Number.isSafeInteger(startFrame) || startFrame < 0 || !Number.isInteger(frameCount) || frameCount < 1 || frameCount > 1e4 || !Number.isSafeInteger(startFrame + frameCount - 1) || !Number.isFinite(rotationRadiansPerSecond)) throw Error("invalid capture parameters");
    const root = await fs.realpath(project), assetFile = await checked(root, asset), runtime = await checked(root, "media/3d-runtime"), outParent = await checked(root, path.posix.dirname(outputDir));
    if (path.basename(outputDir).startsWith(".")) throw Error("invalid output");
    const output = path.join(outParent, path.basename(outputDir));
    await fs.mkdir(output);
    const require2 = createRequire(path.join(runtime, "package.json"));
    let threeEntry, playwrightEntry;
    try {
      threeEntry = require2.resolve("three");
      playwrightEntry = require2.resolve("playwright");
    } catch {
      throw Error("project-local pinned Three.js and Playwright required");
    }
    const threeRoot = path.resolve(path.dirname(threeEntry), "..");
    for (const packageFile of [threeEntry, playwrightEntry]) {
      const actual = await fs.realpath(packageFile);
      const rel = path.relative(runtime, actual);
      if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw Error("runtime dependency escapes project-local runtime");
    }
    const threeVersion = JSON.parse(await fs.readFile(path.join(threeRoot, "package.json"), "utf8")).version;
    const playwrightVersion = JSON.parse(await fs.readFile(require2.resolve("playwright/package.json"), "utf8")).version;
    if (threeVersion !== pins.three || playwrightVersion !== pins.playwright) throw Error("runtime version differs from pinned version");
    const coreEntry = createRequire(playwrightEntry).resolve("playwright-core");
    const coreReal = await fs.realpath(coreEntry);
    const coreRel = path.relative(runtime, coreReal);
    if (!coreRel || coreRel.startsWith("..") || path.isAbsolute(coreRel)) throw Error("playwright-core escapes project-local runtime");
    const chromium = require2("playwright").chromium;
    for (const rel of ["build/three.module.js", "build/three.core.js", "examples/jsm/loaders/GLTFLoader.js", "examples/jsm/utils/BufferGeometryUtils.js", "LICENSE"]) {
      const real = await fs.realpath(path.join(threeRoot, rel));
      const inside = path.relative(runtime, real);
      if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) throw Error("runtime resource escapes project-local runtime");
    }
    const glb = await fs.readFile(assetFile);
    const routes = /* @__PURE__ */ new Map([["/", [Buffer.from(html), "text/html"]], ["/asset.glb", [glb, "model/gltf-binary"]], ["/three.js", [await fs.readFile(path.join(threeRoot, "build/three.module.js")), "text/javascript"]], ["/three.core.js", [await fs.readFile(path.join(threeRoot, "build/three.core.js")), "text/javascript"]]]);
    server = http.createServer(async (req, res) => {
      try {
        let entry = routes.get(req.url);
        if (!entry && ["/addons/loaders/GLTFLoader.js", "/addons/utils/BufferGeometryUtils.js"].includes(req.url)) entry = [await fs.readFile(path.join(threeRoot, "examples/jsm", req.url.slice(8))), "text/javascript"];
        if (!entry) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "Content-Type": entry[1] });
        res.end(entry[0]);
      } catch {
        res.writeHead(500).end();
      }
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, timeout: 15e3, ...executablePath ? { executablePath } : {} });
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block" });
    const problems = [];
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      problems.push("remote request blocked");
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => problems.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(m.text());
    });
    await page.goto(origin, { waitUntil: "load", timeout: 15e3 });
    await page.waitForFunction(() => Boolean(window.viewer?.ready), null, { timeout: 15e3 });
    await page.evaluate(() => Promise.race([window.viewer.ready, new Promise((_, reject) => setTimeout(() => reject(Error("readiness deadline exceeded")), 15e3))]));
    for (let i = 0; i < frameCount; i++) {
      if (expired) throw Error("capture deadline exceeded");
      const frame = startFrame + i;
      await page.evaluate(({ seconds, speed }) => {
        if (window.viewer.failure) throw Error(window.viewer.failure);
        window.viewer.seek(seconds, speed);
      }, { seconds: frame / fps, speed: rotationRadiansPerSecond });
      const data = await page.screenshot({ animations: "disabled", omitBackground:false, timeout: 15e3 });
      const name = `frame-${String(frame).padStart(6, "0")}.png`;
      await fs.writeFile(path.join(output, name), data, { flag: "wx" });
      frames.push({ path: `${outputDir}/${name}`, sha256: sha(data), frame });
    }
    if (expired) throw Error("capture deadline exceeded");
    if (problems.length) throw Error(problems.join("; "));
    const backend = await page.evaluate(() => window.viewer.backend);
    const camera = await page.evaluate(() => window.viewer.camera);
    const conventions = await page.evaluate(() => window.viewer.conventions);
    await fs.mkdir(path.join(output, "addons", "loaders"), { recursive: true });
    await fs.mkdir(path.join(output, "addons", "utils"), { recursive: true });
    for (const [source, dest] of [["build/three.module.js", "three.js"], ["build/three.core.js", "three.core.js"], ["examples/jsm/loaders/GLTFLoader.js", "addons/loaders/GLTFLoader.js"], ["examples/jsm/utils/BufferGeometryUtils.js", "addons/utils/BufferGeometryUtils.js"]]) await fs.copyFile(path.join(threeRoot, source), path.join(output, dest));
    await fs.copyFile(path.join(threeRoot, "LICENSE"), path.join(output, "THREE-LICENSE.txt"));
    await fs.writeFile(path.join(output, "asset.glb"), glb, { flag: "wx" });
    await fs.writeFile(path.join(output, "viewer.html"), html.replace("#help{display:none;", "#help{display:block;").replaceAll('"/three.js"', '"./three.js"').replaceAll('"/addons/"', '"./addons/"').replaceAll("'/asset.glb'", "'./asset.glb'"), { flag: "wx" });
    const viewerFiles = [];
    for (const file of ["viewer.html", "asset.glb", "three.js", "three.core.js", "addons/loaders/GLTFLoader.js", "addons/utils/BufferGeometryUtils.js", "THREE-LICENSE.txt"]) viewerFiles.push({ path: `${outputDir}/${file}`, sha256: sha(await fs.readFile(path.join(output, file))) });
    if (viewerFiles.find((entry) => entry.path === `${outputDir}/asset.glb`).sha256 !== sha(glb)) throw Error("viewer asset differs from captured asset");
    if (expired) throw Error("capture deadline exceeded");
    if (JSON.stringify(await rendererIdentity()) !== JSON.stringify(rendererFiles)) throw Error("renderer files changed during capture");
    const receipt = { conventions, rendererFiles, schemaVersion: 1, ok: true, errors, frames, runtime: { three: threeVersion, playwright: playwrightVersion, browser: browser.version(), backend }, parameters: { width, height, fps, startFrame, frameCount, rotationRadiansPerSecond, camera, deviceScaleFactor: 1 }, source: { path: asset, sha256: sha(glb) }, viewer: `${outputDir}/viewer.html`, viewerFiles, visualReview: "unverified" };
    if (options.out) {
      if (!validRel(options.out)) throw Error("invalid receipt path");
      const parent = await checked(root, path.posix.dirname(options.out));
      await fs.writeFile(path.join(parent, path.basename(options.out)), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    }
    return receipt;
  } catch (e) {
    errors.push({ code: "render.failed", path: "render", message: expired ? "capture deadline exceeded" : String(e.message).replace(/https?:\/\/[^\s"']+/g, "[redacted URL]") });
    return { ok: false, errors, frames: [], runtime: null, parameters: null };
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}
export {
  pins,
  render,
  setup,
  setupArgs,
  rendererIdentity
};
