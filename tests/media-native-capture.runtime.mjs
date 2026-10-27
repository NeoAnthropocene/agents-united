import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import * as native from '../registry/skills/native-motion-production/scripts/render-native.mjs';

const timeline = { schemaVersion: 1, revision: 'r1', fps: 60, totalFrames: 3, width: 1920, height: 1080,
  scenes: [{ id: 'scene', startFrame: 0, endFrame: 3 }], cues: [] };
const metadata = () => ({ timelineRevision: timeline.revision, fps: timeline.fps,
  totalFrames: timeline.totalFrames, width: timeline.width, height: timeline.height });
const turn = () => new Promise(setImmediate); // Drain promise reactions, without a timed sleep.
const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {}); // A fixture may reject before the page observes it.
  return { promise, resolve, reject };
}

function pageHarness(options = {}) {
  const events = [], listeners = new Set(), waiters = new Set();
  let context;
  const emit = (type, detail) => {
    events.push({ type, detail });
    for (const listener of [...listeners]) listener();
  };
  // Evaluate the production callback text in one persistent browser-like global scope.
  const execute = (fn, arg) => {
    context.__argument = structuredClone(arg);
    return vm.runInContext(`(${fn.toString()})(__argument)`, context);
  };
  const check = () => {
    for (const waiter of [...waiters]) {
      try {
        if (!execute(waiter.fn, waiter.arg)) continue;
        waiters.delete(waiter);
        waiter.resolve();
      } catch (error) { waiters.delete(waiter); waiter.reject(error); }
    }
  };
  const reactive = value => new Proxy(value, { set(target, key, next) {
    Reflect.set(target, key, next);
    queueMicrotask(check);
    return true;
  } });
  const motion = reactive({
    meta: Object.hasOwn(options, 'meta') ? options.meta : metadata(),
    get ready() { emit('ready-observed'); return Object.hasOwn(options, 'ready') ? options.ready : Promise.resolve(); },
    seek: Object.hasOwn(options, 'seek') ? options.seek : async seconds => emit('seek', seconds),
  });
  const window = reactive({ motion: options.absent ? null : motion });
  const document = { fonts: { get ready() {
    emit('fonts-observed');
    return Object.hasOwn(options, 'fonts') ? options.fonts : Promise.resolve();
  } }, images: options.images ?? [] };
  context = vm.createContext({ window, document });
  const page = {
    async evaluate(fn, arg) { emit('evaluate'); return await execute(fn, arg); },
    waitForFunction(fn, arg, settings) {
      assert.equal(settings.timeout, 15000);
      if (execute(fn, arg)) return Promise.resolve();
      emit('waiting');
      return new Promise((resolve, reject) => waiters.add({ fn, arg, resolve, reject }));
    },
    async screenshot(settings) {
      assert.equal(window.__motionReady, true, 'Readiness callback must have finished.');
      assert.equal(window.__motionSeekDone, true, 'Seek callback must have finished.');
      emit('shot', settings);
      return Buffer.from('mock screenshot; no image rendered');
    },
    on() {}, async goto() { emit('goto'); },
  };
  return { page, window, motion, events, emit,
    until(type, detail) {
      const found = () => events.some(event => event.type === type && (detail === undefined || event.detail === detail));
      if (found()) return Promise.resolve();
      return new Promise(resolve => {
        const listener = () => { if (found()) { listeners.delete(listener); resolve(); } };
        listeners.add(listener);
      });
    },
    expireWaits() {
      for (const waiter of waiters) waiter.reject(new Error('Mock waitForFunction timed out'));
      waiters.clear();
    },
  };
}

function renderHarness(harness) {
  const calls = [], files = [];
  const browser = { async newContext() { return { async route() {}, async newPage() { return harness.page; } }; },
    async close() { calls.push('browser closed'); } };
  // Execute render's unchanged body with IO-only fakes. Real captureFrames and all page
  // callback bodies still run; no browser, process, HTTP server or filesystem is started.
  const context = vm.createContext({
    path, URL, readTimeline: async () => structuredClone(timeline), planRender: native.planRender,
    readRenderPreferences: async () => null,
    captureFrames: native.captureFrames, encodeArgs: native.encodeArgs, randomUUID: () => 'fixture',
    run: (_executable, args) => calls.push({ args: Array.from(args), shots: harness.events.filter(e => e.type === 'shot').length }),
    createRequire: () => () => ({ chromium: { async launch() { return browser; } } }),
    startServer: async () => ({ origin: 'http://127.0.0.1:3100', server: { close(done) { calls.push('server closed'); done(); } } }),
    fs: { async mkdir() {}, async readFile() { return Buffer.from('mock first frame'); },
      async copyFile(from, to) { files.push({ from, to }); },
      async writeFile(file, body) { files.push({ file, body }); } },
  });
  return { calls, files, run: () => vm.runInContext(`(${native.render.toString()})('mock-project')`, context) };
}

test('VM callbacks reject each metadata mismatch before any frame is captured', { timeout: 5000 }, async () => {
  for (const [key, value, expected] of [['fps', 30, /fps differs/], ['totalFrames', 4, /totalFrames differs/],
    ['width', 1280, /width differs/], ['height', 720, /height differs/], ['timelineRevision', 'stale', /timeline revision differs/]]) {
    const h = pageHarness({ meta: { ...metadata(), [key]: value } });
    await assert.rejects(native.captureFrames(h.page, timeline, 'frames'), expected);
    assert.equal(h.events.filter(e => e.type === 'shot' || e.type === 'seek').length, 0);
  }
});

test('VM callbacks await composition, fonts, image decode and each asynchronous seek in order', { timeout: 5000 }, async () => {
  const ready = deferred(), fonts = deferred(), decoded = deferred();
  const seeks = [deferred(), deferred(), deferred()];
  let h;
  h = pageHarness({ ready: ready.promise, fonts: fonts.promise,
    images: [{ naturalWidth: 40, decode() { h.emit('decode'); return decoded.promise; } }],
    seek(seconds) {
      h.emit('seek-start', seconds);
      return seeks[Math.round(seconds * timeline.fps)].promise.then(() => h.emit('seek-end', seconds));
    } });
  const capture = native.captureFrames(h.page, timeline, 'frames');
  await h.until('ready-observed');
  assert.equal(h.events.some(e => e.type === 'fonts-observed' || e.type === 'shot'), false);
  ready.resolve();
  await h.until('fonts-observed');
  assert.equal(h.events.some(e => e.type === 'decode' || e.type === 'shot'), false);
  fonts.resolve();
  await h.until('decode');
  assert.equal(h.events.some(e => e.type === 'seek-start' || e.type === 'shot'), false);
  decoded.resolve();
  for (let frame = 0; frame < 3; frame++) {
    await h.until('seek-start', frame / 60);
    assert.equal(h.events.filter(e => e.type === 'shot').length, frame);
    seeks[frame].resolve();
  }
  await capture;
  assert.deepEqual(h.events.filter(e => e.type === 'seek-start').map(e => e.detail), [0, 1 / 60, 2 / 60]);
  assert.deepEqual(h.events.filter(e => e.type === 'shot').map(e => path.basename(e.detail.path)),
    ['frame-000000.png', 'frame-000001.png', 'frame-000002.png']);
  const ordered = h.events.filter(e => ['seek-start', 'seek-end', 'shot'].includes(e.type)).map(e => e.type);
  assert.deepEqual(ordered, Array(3).fill(['seek-start', 'seek-end', 'shot']).flat());
});

test('VM callbacks require actual composition and font readiness promises', { timeout: 5000 }, async () => {
  for (const bad of [undefined, null, true, () => Promise.resolve()]) {
    for (const field of ['ready', 'fonts']) {
      const h = pageHarness({ [field]: bad });
      await assert.rejects(native.captureFrames(h.page, timeline, 'frames'), /ready.*promise/i);
      assert.equal(h.events.some(e => e.type === 'seek' || e.type === 'shot'), false);
    }
  }
});

test('VM readiness rejection aborts even when startup has not populated metadata or seek', { timeout: 5000 }, async () => {
  const ready = deferred();
  const h = pageHarness({ ready: ready.promise, meta: null, seek: null });
  const result = outcome(native.captureFrames(h.page, timeline, 'frames'));
  ready.reject(new Error('Composition startup failed'));
  await turn();
  // Simulate the browser wait deadline only if rejection was never observed.
  h.expireWaits();
  const settled = await result;
  assert.match(String(settled.error), /Composition startup failed/);
  assert.equal(h.events.some(e => e.type === 'shot'), false);
});

test('VM wait predicates observe delayed API availability in the same persistent context', { timeout: 5000 }, async () => {
  const ready = deferred();
  const h = pageHarness({ absent: true, ready: ready.promise, meta: null, seek: null });
  const capture = native.captureFrames(h.page, timeline, 'frames');
  await h.until('waiting');
  assert.equal(h.events.some(e => e.type === 'evaluate' || e.type === 'shot'), false);
  h.window.motion = h.motion;
  h.motion.meta = metadata();
  h.motion.seek = async seconds => h.emit('seek', seconds);
  ready.resolve();
  await capture;
  assert.equal(h.events.filter(e => e.type === 'shot').length, 3);
});

test('VM rejects readiness, font, image and seek failures without capturing later frames', { timeout: 5000 }, async () => {
  const rejection = () => { const gate = deferred(); gate.reject(new Error('Fixture failure')); return gate.promise; };
  for (const [options, expected, shots] of [
    [{ ready: rejection() }, /Fixture failure/, 0],
    [{ fonts: rejection() }, /Fixture failure/, 0],
    [{ images: [{ naturalWidth: 10, decode: rejection }] }, /Fixture failure/, 0],
    [{ images: [{ naturalWidth: 0, decode: async () => {} }] }, /Image failed readiness/, 0],
    [{ seek() { throw new Error('Fixture failure'); } }, /Fixture failure/, 0],
    [{ seek(seconds) { return seconds === 0 ? Promise.resolve() : rejection(); } }, /Fixture failure/, 1],
  ]) {
    const h = pageHarness(options);
    await assert.rejects(native.captureFrames(h.page, timeline, 'frames'), expected);
    assert.equal(h.events.filter(e => e.type === 'shot').length, shots);
  }
});

test('Render body never encodes after actual VM metadata, readiness, seek or screenshot failure', { timeout: 5000 }, async () => {
  for (const failure of ['metadata', 'ready', 'seek', 'screenshot']) {
    const ready = deferred();
    const h = pageHarness({ ready: ready.promise,
      meta: failure === 'metadata' ? { ...metadata(), fps: 30 } : metadata(),
      seek: async () => { if (failure === 'seek') throw new Error('Fixture capture failed'); } });
    if (failure === 'ready') ready.reject(new Error('Fixture capture failed')); else ready.resolve();
    if (failure === 'screenshot') h.page.screenshot = async () => { throw new Error('Fixture capture failed'); };
    const rendering = renderHarness(h);
    await assert.rejects(rendering.run(), failure === 'metadata' ? /fps differs/ : /Fixture capture failed/);
    assert.deepEqual(rendering.calls.filter(call => typeof call === 'object').map(call => call.args), [['-version']]);
    assert.deepEqual(rendering.calls.filter(call => typeof call === 'string'), ['browser closed', 'server closed']);
    assert.deepEqual(rendering.files, []);
  }
});

test('Render body reaches mocked encoding only after all VM frames complete', { timeout: 5000 }, async () => {
  const h = pageHarness();
  const rendering = renderHarness(h);
  const report = await rendering.run();
  const executions = rendering.calls.filter(call => typeof call === 'object');
  assert.equal(executions.length, 3); // version probe, video encode, contact sheet
  assert.equal(executions[1].shots, 3);
  assert.ok(executions[1].args.includes('libx264'));
  assert.equal(rendering.files.length, 4); // three still copies and evidence
  assert.equal(report.frameCount, 3);
});

test('Render rejects a composition-declared loop mismatch before encoding without extending the timeline', { timeout: 5000 }, async () => {
  const h = pageHarness({ meta: { ...metadata(), loop: true } });
  const rendering = renderHarness(h);
  await assert.rejects(rendering.run(), /Loop boundary mismatch/);
  assert.ok(h.events.some(event => event.type === 'seek' && event.detail === timeline.totalFrames / timeline.fps));
  assert.deepEqual(rendering.calls.filter(call => typeof call === 'object').map(call => call.args), [['-version']]);
  assert.deepEqual(rendering.files, []);
});
