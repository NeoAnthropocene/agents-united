import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve('registry/skills/commercial-stock-sourcer/scripts/fetch-stock.mjs');

interface MockState {
  requests: Array<{ method: string; url: string; headers: http.IncomingHttpHeaders }>;
  failProvider: string | null;
  failStatus: number;
}

const state: MockState = {
  requests: [],
  failProvider: null,
  failStatus: 500,
};

let server: http.Server;
let baseUrl = '';

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const SVG_BYTES = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>', 'utf8');
const MP4_BYTES = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const reqUrl = req.url ?? '/';
    state.requests.push({ method: req.method ?? 'GET', url: reqUrl, headers: req.headers });

    if (reqUrl.startsWith('/media/photo.jpg')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(JPEG_BYTES);
      return;
    }
    if (reqUrl.startsWith('/media/vector.svg')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(SVG_BYTES);
      return;
    }
    if (reqUrl.startsWith('/media/video.mp4')) {
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      res.end(MP4_BYTES);
      return;
    }

    if (reqUrl.startsWith('/pexels/v1/search')) {
      if (state.failProvider === 'pexels') {
        res.writeHead(state.failStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          photos: [
            {
              id: 101,
              width: 1920,
              height: 1080,
              url: 'https://www.pexels.com/photo/coffee-101/',
              photographer: 'Ada Lovelace',
              photographer_url: 'https://www.pexels.com/@ada',
              alt: 'Pour over coffee in ceramic dripper',
              src: {
                large2x: `${baseUrl}/media/photo.jpg?id=101`,
                large: `${baseUrl}/media/photo.jpg?id=101`,
                original: `${baseUrl}/media/photo.jpg?id=101`,
              },
            },
          ],
        }),
      );
      return;
    }

    if (reqUrl.startsWith('/pexels/videos/search')) {
      if (state.failProvider === 'pexels') {
        res.writeHead(state.failStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pexels video failure' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          videos: [
            {
              id: 202,
              width: 1920,
              height: 1080,
              duration: 14,
              url: 'https://www.pexels.com/video/coffee-202/',
              user: { name: 'Grace Hopper', url: 'https://www.pexels.com/@grace' },
              video_files: [
                {
                  id: 1,
                  quality: 'hd',
                  file_type: 'video/mp4',
                  width: 1920,
                  height: 1080,
                  link: `${baseUrl}/media/video.mp4?id=202`,
                },
              ],
            },
          ],
        }),
      );
      return;
    }

    if (reqUrl.startsWith('/pixabay/api/videos')) {
      if (state.failProvider === 'pixabay') {
        res.writeHead(state.failStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pixabay video failure' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          hits: [
            {
              id: 303,
              pageURL: 'https://pixabay.com/videos/id-303/',
              duration: 12,
              user: 'AlanTuring',
              tags: 'coffee, espresso, cafe',
              videos: {
                medium: {
                  url: `${baseUrl}/media/video.mp4?id=303`,
                  width: 1920,
                  height: 1080,
                },
              },
            },
          ],
        }),
      );
      return;
    }

    if (reqUrl.startsWith('/pixabay/api/')) {
      if (state.failProvider === 'pixabay') {
        res.writeHead(state.failStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pixabay failure' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          hits: [
            {
              id: 404,
              pageURL: 'https://pixabay.com/vectors/id-404/',
              type: 'vector/svg',
              tags: 'coffee, minimal, icon',
              user: 'MargaretHamilton',
              imageWidth: 1200,
              imageHeight: 1200,
              largeImageURL: `${baseUrl}/media/photo.jpg?id=404`,
              vectorURL: `${baseUrl}/media/vector.svg?id=404`,
            },
          ],
        }),
      );
      return;
    }

    if (reqUrl.startsWith('/openverse/v1/images/')) {
      if (state.failProvider === 'openverse') {
        res.writeHead(state.failStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Openverse failure' }));
        return;
      }
      const parsed = new URL(reqUrl, baseUrl);
      const ext = parsed.searchParams.get('extension');
      const isSvg = ext === 'svg';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          results: [
            {
              id: 'ov-505',
              title: 'Artisanal Coffee Dripper',
              foreign_landing_url: 'https://openverse.org/image/ov-505',
              creator: 'Katherine Johnson',
              creator_url: 'https://example.org/@katherine',
              license: 'cc0',
              license_version: '1.0',
              filetype: isSvg ? 'svg' : 'jpg',
              width: 1600,
              height: 1067,
              url: isSvg ? `${baseUrl}/media/vector.svg?id=ov-505` : `${baseUrl}/media/photo.jpg?id=ov-505`,
            },
          ],
        }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', url: reqUrl }));
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function runScript(
  args: string[],
  envOverrides: Record<string, string | undefined> = {},
): Promise<{ status: number; stdout: string; stderr: string }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    STOCK_API_BASE_URL: baseUrl,
  };
  delete env.PEXELS_API_KEY;
  delete env.PIXABAY_API_KEY;
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return new Promise(resolve => {
    execFile(process.execPath, [SCRIPT_PATH, ...args], { env, encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: unknown }).code === 'number' ? ((error as { code: number }).code) : error ? 1 : 0;
      resolve({ status: code, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

describe('Tier 1 — Unit: CLI argument parsing & provider routing', () => {
  it('exports parseCliArgs and resolveProviderChain with clean defaults and validation', async () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
    const mod = (await import(pathToFileURL(SCRIPT_PATH).href)) as {
      parseCliArgs: (argv: string[]) => {
        query: string;
        type: string;
        orientation: string;
        limit: number;
        output: string;
        provider: string;
      };
      resolveProviderChain: (
        type: string,
        provider: string,
        env: Record<string, string | undefined>,
      ) => string[];
    };

    const parsed = mod.parseCliArgs(['--query', 'pour over coffee']);
    expect(parsed).toEqual({
      query: 'pour over coffee',
      type: 'photo',
      orientation: 'landscape',
      limit: 3,
      output: './assets/stock-candidates',
      provider: 'auto',
    });

    expect(mod.resolveProviderChain('photo', 'auto', { PEXELS_API_KEY: 'px', PIXABAY_API_KEY: 'pb' })).toEqual([
      'pexels',
      'pixabay',
      'openverse',
    ]);
    expect(mod.resolveProviderChain('photo', 'auto', {})).toEqual(['openverse']);
    expect(mod.resolveProviderChain('vector', 'auto', { PIXABAY_API_KEY: 'pb' })).toEqual(['pixabay', 'openverse']);
    expect(mod.resolveProviderChain('illustration', 'auto', {})).toEqual(['openverse']);
    expect(mod.resolveProviderChain('video', 'auto', { PEXELS_API_KEY: 'px', PIXABAY_API_KEY: 'pb' })).toEqual([
      'pexels',
      'pixabay',
    ]);
    expect(mod.resolveProviderChain('video', 'auto', {})).toEqual([]);
  });

  it('exits 1 with an actionable error when --query is missing or --type is invalid', async () => {
    const missingQuery = await runScript([]);
    expect(missingQuery.status).toBe(1);
    expect(missingQuery.stderr).toMatch(/--query/i);

    const badType = await runScript(['--query', 'coffee', '--type', 'audio']);
    expect(badType.status).toBe(1);
    expect(badType.stderr).toMatch(/--type/i);
  });
});

describe('Tier 2 — Integration (Mock HTTP): photo, vector, illustration, video & fallback matrix', () => {
  it('1. type=photo with PEXELS_API_KEY downloads cand_1.jpg and writes manifest.json', async () => {
    state.requests = [];
    state.failProvider = null;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-photo-pexels-'));
    try {
      const res = await runScript(['--query', 'coffee', '--type', 'photo', '--limit', '1', '--output', tmp], {
        PEXELS_API_KEY: 'test_pexels_key',
      });
      expect(res.status, res.stderr).toBe(0);
      expect(fs.existsSync(path.join(tmp, 'cand_1.jpg'))).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
      expect(manifest.provider).toBe('pexels');
      expect(manifest.mediaType).toBe('photo');
      expect(manifest.candidates).toHaveLength(1);
      expect(manifest.candidates[0]).toMatchObject({
        id: 'cand_1',
        localFile: 'cand_1.jpg',
        provider: 'pexels',
        creator: 'Ada Lovelace',
        license: 'Pexels License (Commercial Safe)',
      });
      expect(state.requests.some(r => r.url.startsWith('/pexels/v1/search'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('2. type=photo with NO API keys falls back to Openverse CC0/PDM and writes manifest.json', async () => {
    state.requests = [];
    state.failProvider = null;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-photo-ov-'));
    try {
      const res = await runScript(['--query', 'coffee', '--type', 'photo', '--limit', '1', '--output', tmp]);
      expect(res.status, res.stderr).toBe(0);
      expect(fs.existsSync(path.join(tmp, 'cand_1.jpg'))).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
      expect(manifest.provider).toBe('openverse');
      expect(manifest.candidates[0].license).toMatch(/CC0|Public Domain/i);
      const ovReq = state.requests.find(r => r.url.startsWith('/openverse/v1/images/'));
      expect(ovReq).toBeDefined();
      expect(ovReq!.url).toContain('license_type=commercial');
      expect(ovReq!.url).toMatch(/license=cc0(%2C|,)pdm/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('3. type=vector with PIXABAY_API_KEY queries Pixabay image_type=vector and downloads candidate', async () => {
    state.requests = [];
    state.failProvider = null;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-vector-pb-'));
    try {
      const res = await runScript(['--query', 'coffee icon', '--type', 'vector', '--limit', '1', '--output', tmp], {
        PIXABAY_API_KEY: 'test_pixabay_key',
      });
      expect(res.status, res.stderr).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
      expect(manifest.provider).toBe('pixabay');
      expect(manifest.mediaType).toBe('vector');
      expect(fs.existsSync(path.join(tmp, manifest.candidates[0].localFile))).toBe(true);
      const pbReq = state.requests.find(r => r.url.startsWith('/pixabay/api/'));
      expect(pbReq).toBeDefined();
      expect(pbReq!.url).toContain('image_type=vector');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('4. type=vector and type=illustration with NO API keys fall back to Openverse with extension=svg / category=illustration', async () => {
    state.requests = [];
    state.failProvider = null;
    const tmpVec = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-vec-ov-'));
    const tmpIll = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-ill-ov-'));
    try {
      const vecRes = await runScript(['--query', 'coffee', '--type', 'vector', '--limit', '1', '--output', tmpVec]);
      expect(vecRes.status, vecRes.stderr).toBe(0);
      expect(fs.existsSync(path.join(tmpVec, 'cand_1.svg'))).toBe(true);
      const vecReq = state.requests.find(r => r.url.startsWith('/openverse/v1/images/'));
      expect(vecReq!.url).toContain('extension=svg');

      state.requests = [];
      const illRes = await runScript(['--query', 'coffee', '--type', 'illustration', '--limit', '1', '--output', tmpIll]);
      expect(illRes.status, illRes.stderr).toBe(0);
      const illReq = state.requests.find(r => r.url.startsWith('/openverse/v1/images/'));
      expect(illReq!.url).toContain('category=illustration');
    } finally {
      fs.rmSync(tmpVec, { recursive: true, force: true });
      fs.rmSync(tmpIll, { recursive: true, force: true });
    }
  });

  it('5. type=video with PEXELS_API_KEY downloads cand_1.mp4 and records duration, width, height', async () => {
    state.requests = [];
    state.failProvider = null;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-video-pexels-'));
    try {
      const res = await runScript(['--query', 'coffee pour', '--type', 'video', '--limit', '1', '--output', tmp], {
        PEXELS_API_KEY: 'test_pexels_key',
      });
      expect(res.status, res.stderr).toBe(0);
      expect(fs.existsSync(path.join(tmp, 'cand_1.mp4'))).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
      expect(manifest.provider).toBe('pexels');
      expect(manifest.mediaType).toBe('video');
      expect(manifest.candidates[0]).toMatchObject({
        id: 'cand_1',
        localFile: 'cand_1.mp4',
        duration: 14,
        width: 1920,
        height: 1080,
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('6. type=video with PIXABAY_API_KEY downloads cand_1.mp4 from Pixabay Videos', async () => {
    state.requests = [];
    state.failProvider = null;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-video-pb-'));
    try {
      const res = await runScript(['--query', 'coffee pour', '--type', 'video', '--limit', '1', '--output', tmp], {
        PIXABAY_API_KEY: 'test_pixabay_key',
      });
      expect(res.status, res.stderr).toBe(0);
      expect(fs.existsSync(path.join(tmp, 'cand_1.mp4'))).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
      expect(manifest.provider).toBe('pixabay');
      expect(manifest.candidates[0].duration).toBe(12);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('7. type=video with NO API keys exits 1 with clear message explaining Openverse has no video API', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-video-nokey-'));
    try {
      const res = await runScript(['--query', 'coffee', '--type', 'video', '--output', tmp]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/PEXELS_API_KEY|PIXABAY_API_KEY/);
      expect(res.stderr).toMatch(/Openverse/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('8. HTTP 429 on primary provider (Pexels) automatically falls back to Pixabay/Openverse and never leaks secrets', async () => {
    state.requests = [];
    state.failProvider = 'pexels';
    state.failStatus = 429;
    const secretPexels = 'super_secret_pexels_token_999';
    const secretPixabay = 'super_secret_pixabay_token_888';
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-fallback-429-'));
    try {
      const res = await runScript(['--query', 'coffee', '--type', 'photo', '--limit', '1', '--output', tmp], {
        PEXELS_API_KEY: secretPexels,
        PIXABAY_API_KEY: secretPixabay,
      });
      expect(res.status, res.stderr).toBe(0);
      const manifestText = fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestText);
      expect(manifest.provider).toBe('pixabay');
      expect(res.stdout).not.toContain(secretPexels);
      expect(res.stderr).not.toContain(secretPexels);
      expect(res.stdout).not.toContain(secretPixabay);
      expect(res.stderr).not.toContain(secretPixabay);
      expect(manifestText).not.toContain(secretPexels);
      expect(manifestText).not.toContain(secretPixabay);
    } finally {
      state.failProvider = null;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
