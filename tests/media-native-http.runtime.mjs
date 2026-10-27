import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { startServer } from '../registry/skills/native-motion-production/scripts/render-native.mjs';

// All private files below are harmless fixtures created under this test's temp directory.
const privateSentinel = 'HARMLESS_PRIVATE_HTTP_FIXTURE';
const publicFiles = {
  'media/native/index.html': ['<html>Public composition</html>', 'text/html'],
  'media/native/content.json': ['{"headline":"Approved copy"}', 'application/json'],
  'media/timeline.json': [JSON.stringify({ schemaVersion: 1, revision: 'r1', fps: 60, totalFrames: 120,
    width: 1920, height: 1080, scenes: [{ id: 'scene', startFrame: 0, endFrame: 120 }], cues: [] }), 'application/json'],
  'media/assets/scene.mjs': ['export const frame = 0;', 'text/javascript'],
  'media/assets/style.css': ['body { color: black; }', 'text/css'],
  'media/assets/logo.svg': ['<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml'],
  'media/assets/fonts/Brand Font.woff2': ['Harmless font bytes, not a rendered font', 'font/woff2'],
  'media/assets/clip.mp4': ['Harmless video bytes, not a rendered video', 'video/mp4'],
  'media/assets/music.wav': ['Harmless audio bytes, not decoded audio', 'audio/wav'],
};
const privateFiles = [
  '.env', '.git/config.json', 'package.json', 'private/record.json', 'private/index.html',
  'private/content.json', 'private/timeline.json', 'media/private.json',
  'media/native/.env', 'media/native/.env.json', 'media/native/.git/config.json',
  'media/native/package.json', 'media/assets/.env', 'media/assets/.env.json',
  'media/assets/.git/config.json', 'media/assets-private/record.json',
];

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-http-'));
  const relativeRoot = path.relative(os.tmpdir(), root);
  assert.ok(relativeRoot.startsWith('native-http-') && path.dirname(relativeRoot) === '.');
  const project = path.join(root, 'project');
  let running;
  t.after(async () => {
    try {
      if (running) {
        const closed = new Promise((resolve, reject) => running.server.close(error => error ? reject(error) : resolve()));
        running.server.closeAllConnections();
        await closed;
        assert.equal(running.server.listening, false);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  });
  const files = Object.fromEntries(Object.entries(publicFiles).map(([file, [body]]) => [file, body]));
  for (const file of privateFiles) files[file] = privateSentinel;
  for (const [file, body] of Object.entries(files)) {
    const target = path.join(project, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }
  await fs.mkdir(path.join(project, 'media/assets/directory.json'));
  await fs.mkdir(path.join(root, 'outside'));
  await fs.writeFile(path.join(root, 'outside/record.json'), privateSentinel);
  // Prove denial fixtures exist; a missing private file must not produce a false pass.
  for (const file of privateFiles) assert.equal(await fs.readFile(path.join(project, file), 'utf8'), privateSentinel);
  running = await startServer(project);
  return { root, project, ...running };
}

function request(server, rawPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    // Pass an origin-form path directly: URL/fetch would normalize dot segments first.
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port,
      path: rawPath, method, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Local HTTP fixture timed out')));
    req.end();
  });
}

function unavailable(response, expected) {
  assert.equal(response.status, expected);
  assert.equal(response.body, 'Asset not available');
  assert.ok(!response.body.includes(privateSentinel));
}

async function linkDirectory(target, link) {
  await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}

test('HTTP serves declared composition files and public local assets on loopback', async t => {
  const { server, origin } = await fixture(t);
  assert.equal(server.address().address, '127.0.0.1');
  assert.equal(origin, `http://127.0.0.1:${server.address().port}`);
  for (const [file, [body, mime]] of Object.entries(publicFiles)) {
    const route = file.startsWith('media/native/') ? `/${file.slice('media/native/'.length)}` : `/${file.slice('media/'.length)}`;
    const response = await request(server, encodeURI(route) + '?revision=r1');
    assert.equal(response.status, 200, route);
    assert.equal(response.body, body, route);
    assert.equal(response.headers['content-type'], mime, route);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.equal((await request(server, '/')).body, publicFiles['media/native/index.html'][0]);
  const head = await request(server, '/assets/logo.svg', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('HTTP denies existing hidden and private project files without disclosing values', async t => {
  const { server } = await fixture(t);
  for (const route of ['/.env', '/.env.json', '/.git/config.json', '/%2eenv.json',
    '/assets/.env', '/assets/.env.json', '/assets/%2egit/config.json']) {
    unavailable(await request(server, route), 403);
  }
  for (const route of ['/package.json', '/private/record.json', '/media/private.json', '/native/package.json']) {
    unavailable(await request(server, route), 404);
  }
});

test('HTTP rejects raw and encoded traversal before normalization to existing public files', async t => {
  const { server } = await fixture(t);
  for (const route of ['/assets/../index.html', '/assets/%2e%2e/index.html',
    '/assets/%2E./index.html', '/assets/..%2findex.html', '/assets/%2e%2e%2fcontent.json',
    '/assets/./logo.svg', '/assets\\..\\index.html', '/assets/%2e%2e%5cindex.html',
    '/%2e%2e/timeline.json', '/assets/../../index.html']) {
    unavailable(await request(server, route), 403);
  }
});

test('HTTP returns controlled statuses for malformed paths, unsupported methods and missing files', async t => {
  const { server } = await fixture(t);
  for (const route of ['/assets/%ZZ.svg', '/assets/%00logo.svg', 'http://localhost/index.html', '//index.html']) {
    unavailable(await request(server, route), 400);
  }
  unavailable(await request(server, '/assets/logo.svg:private'), 403);
  for (const route of ['/assets/missing.svg', '/assets/directory.json', '/unknown.txt', '/assets/']) {
    unavailable(await request(server, route), 404);
  }
  const post = await request(server, '/index.html', 'POST');
  unavailable(post, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal((await request(server, '/index.html')).status, 200, 'Errors must leave the server usable.');
});

test('HTTP confines linked assets to their own public root, including inside-project escapes', async t => {
  const { root, project, server } = await fixture(t);
  for (const [name, target, file] of [
    ['private-link', path.join(project, 'private'), 'record.json'],
    ['prefix-link', path.join(project, 'media/assets-private'), 'record.json'],
    ['native-link', path.join(project, 'media/native'), 'content.json'],
    ['outside-link', path.join(root, 'outside'), 'record.json'],
  ]) {
    const link = path.join(project, 'media/assets', name);
    await linkDirectory(target, link);
    assert.equal(await fs.realpath(path.join(link, file)), await fs.realpath(path.join(target, file)));
    unavailable(await request(server, `/assets/${name}/${file}`), 403);
  }
  await linkDirectory(path.join(project, 'media/assets/fonts'), path.join(project, 'media/assets/font-alias'));
  const safe = await request(server, '/assets/font-alias/Brand%20Font.woff2');
  assert.equal(safe.status, 200);
  assert.equal(safe.body, publicFiles['media/assets/fonts/Brand Font.woff2'][0]);
});

test('HTTP denies a public alias to an existing hidden directory within the same asset root', async t => {
  const { project, server } = await fixture(t);
  await linkDirectory(path.join(project, 'media/assets/.git'), path.join(project, 'media/assets/hidden-alias'));
  unavailable(await request(server, '/assets/hidden-alias/config.json'), 403);
});

test('HTTP refuses public roots redirected by junction or symlink into private project directories', async t => {
  for (const [publicRoot, route] of [['media/assets', '/assets/record.json'],
    ['media/native', '/index.html'], ['media', '/timeline.json']]) {
    const { root, project, server } = await fixture(t);
    await fs.rename(path.join(project, publicRoot), path.join(root, 'original-public-root'));
    await linkDirectory(path.join(project, 'private'), path.join(project, publicRoot));
    unavailable(await request(server, route), 403);
  }
});
