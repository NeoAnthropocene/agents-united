#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const VALID_TYPES = new Set(['photo', 'vector', 'illustration', 'video']);
const VALID_ORIENTATIONS = new Set(['landscape', 'portrait', 'square']);
const VALID_PROVIDERS = new Set(['auto', 'pexels', 'pixabay', 'openverse']);

/**
 * Redacts any API keys from log or error strings so secrets never leak to stdout/stderr/files.
 */
export function redactSecrets(text, env = process.env) {
  let out = String(text ?? '');
  for (const keyName of ['PEXELS_API_KEY', 'PIXABAY_API_KEY']) {
    const val = env[keyName];
    if (val && val.length >= 4) {
      out = out.split(val).join('[REDACTED]');
    }
  }
  out = out.replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
  return out;
}

/**
 * Parses and validates CLI arguments.
 */
export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      query: { type: 'string', short: 'q' },
      type: { type: 'string', short: 't', default: 'photo' },
      orientation: { type: 'string', short: 'o', default: 'landscape' },
      limit: { type: 'string', short: 'l', default: '3' },
      output: { type: 'string', default: './assets/stock-candidates' },
      provider: { type: 'string', default: 'auto' },
    },
    strict: false,
  });

  const query = typeof values.query === 'string' ? values.query.trim() : '';
  if (!query) {
    throw new Error(
      'Missing required argument: --query "<search terms>". Usage: node fetch-stock.mjs --query "pour over coffee" [--type photo|vector|illustration|video] [--orientation landscape|portrait|square] [--limit 3] [--output ./assets/stock-candidates]',
    );
  }

  const type = String(values.type ?? 'photo').toLowerCase();
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid --type "${type}". Allowed values: photo, vector, illustration, video.`);
  }

  const orientation = String(values.orientation ?? 'landscape').toLowerCase();
  if (!VALID_ORIENTATIONS.has(orientation)) {
    throw new Error(`Invalid --orientation "${orientation}". Allowed values: landscape, portrait, square.`);
  }

  const limitNum = Number.parseInt(String(values.limit ?? '3'), 10);
  if (!Number.isFinite(limitNum) || limitNum < 1 || limitNum > 10) {
    throw new Error(`Invalid --limit "${values.limit}". Must be an integer between 1 and 10.`);
  }

  const provider = String(values.provider ?? 'auto').toLowerCase();
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`Invalid --provider "${provider}". Allowed values: auto, pexels, pixabay, openverse.`);
  }

  const output = String(values.output ?? './assets/stock-candidates');

  return {
    query,
    type,
    orientation,
    limit: limitNum,
    output,
    provider,
  };
}

/**
 * Determines the ordered list of providers to try based on media type, requested provider, and available API keys.
 */
export function resolveProviderChain(type, provider = 'auto', env = process.env) {
  const hasPexels = Boolean(env.PEXELS_API_KEY && env.PEXELS_API_KEY.trim());
  const hasPixabay = Boolean(env.PIXABAY_API_KEY && env.PIXABAY_API_KEY.trim());

  if (provider !== 'auto') {
    if (provider === 'pexels') {
      if (type === 'vector' || type === 'illustration') {
        throw new Error(`Provider "pexels" does not support --type ${type}. Use pixabay or openverse.`);
      }
      if (!hasPexels) {
        throw new Error('Provider "pexels" requested but PEXELS_API_KEY is not set.');
      }
      return ['pexels'];
    }
    if (provider === 'pixabay') {
      if (!hasPixabay) {
        throw new Error('Provider "pixabay" requested but PIXABAY_API_KEY is not set.');
      }
      return ['pixabay'];
    }
    if (provider === 'openverse') {
      if (type === 'video') {
        throw new Error(
          'Provider "openverse" does not support --type video. Set PEXELS_API_KEY or PIXABAY_API_KEY for video sourcing.',
        );
      }
      return ['openverse'];
    }
  }

  if (type === 'photo') {
    const chain = [];
    if (hasPexels) chain.push('pexels');
    if (hasPixabay) chain.push('pixabay');
    chain.push('openverse');
    return chain;
  }

  if (type === 'vector' || type === 'illustration') {
    const chain = [];
    if (hasPixabay) chain.push('pixabay');
    chain.push('openverse');
    return chain;
  }

  if (type === 'video') {
    const chain = [];
    if (hasPexels) chain.push('pexels');
    if (hasPixabay) chain.push('pixabay');
    return chain;
  }

  return [];
}

function getEndpoints(env = process.env) {
  const base = env.STOCK_API_BASE_URL ? env.STOCK_API_BASE_URL.replace(/\/+$/, '') : '';
  return {
    pexelsPhotos: `${base ? `${base}/pexels` : 'https://api.pexels.com'}/v1/search`,
    pexelsVideos: `${base ? `${base}/pexels` : 'https://api.pexels.com'}/videos/search`,
    pixabayImages: `${base ? `${base}/pixabay` : 'https://pixabay.com'}/api/`,
    pixabayVideos: `${base ? `${base}/pixabay` : 'https://pixabay.com'}/api/videos/`,
    openverseImages: `${base ? `${base}/openverse` : 'https://api.openverse.org'}/v1/images/`,
  };
}

async function fetchPexels(opts, env) {
  const endpoints = getEndpoints(env);
  const apiKey = env.PEXELS_API_KEY;
  if (opts.type === 'video') {
    const url = new URL(endpoints.pexelsVideos);
    url.searchParams.set('query', opts.query);
    url.searchParams.set('orientation', opts.orientation);
    url.searchParams.set('per_page', String(opts.limit));
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`Pexels Videos HTTP ${res.status}`);
    const data = await res.json();
    const videos = Array.isArray(data.videos) ? data.videos.slice(0, opts.limit) : [];
    return videos.map((v, idx) => {
      const files = Array.isArray(v.video_files) ? v.video_files : [];
      const chosen =
        files.find(f => f.file_type === 'video/mp4' && f.quality === 'hd' && (f.width ?? 0) <= 1920) ||
        files.find(f => f.file_type === 'video/mp4') ||
        files[0];
      if (!chosen || !chosen.link) throw new Error('Pexels video entry had no downloadable video_files link');
      return {
        id: `cand_${idx + 1}`,
        ext: 'mp4',
        downloadUrl: chosen.link,
        provider: 'pexels',
        sourceId: String(v.id ?? idx + 1),
        title: `Pexels video ${v.id ?? idx + 1} (${opts.query})`,
        creator: v.user?.name ?? 'Unknown Creator',
        creatorUrl: v.user?.url ?? '',
        sourceUrl: v.url ?? '',
        license: 'Pexels License (Commercial Safe)',
        width: chosen.width ?? v.width ?? null,
        height: chosen.height ?? v.height ?? null,
        duration: v.duration ?? null,
      };
    });
  }

  const url = new URL(endpoints.pexelsPhotos);
  url.searchParams.set('query', opts.query);
  url.searchParams.set('orientation', opts.orientation);
  url.searchParams.set('per_page', String(opts.limit));
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels Photos HTTP ${res.status}`);
  const data = await res.json();
  const photos = Array.isArray(data.photos) ? data.photos.slice(0, opts.limit) : [];
  return photos.map((p, idx) => {
    const downloadUrl = p.src?.large2x || p.src?.large || p.src?.original;
    if (!downloadUrl) throw new Error('Pexels photo entry had no src URL');
    return {
      id: `cand_${idx + 1}`,
      ext: 'jpg',
      downloadUrl,
      provider: 'pexels',
      sourceId: String(p.id ?? idx + 1),
      title: p.alt || `Pexels photo ${p.id ?? idx + 1}`,
      creator: p.photographer ?? 'Unknown Photographer',
      creatorUrl: p.photographer_url ?? '',
      sourceUrl: p.url ?? '',
      license: 'Pexels License (Commercial Safe)',
      width: p.width ?? null,
      height: p.height ?? null,
      duration: null,
    };
  });
}

async function fetchPixabay(opts, env) {
  const endpoints = getEndpoints(env);
  const apiKey = env.PIXABAY_API_KEY;
  const pixabayOrientation =
    opts.orientation === 'landscape' ? 'horizontal' : opts.orientation === 'portrait' ? 'vertical' : 'all';

  if (opts.type === 'video') {
    const url = new URL(endpoints.pixabayVideos);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('q', opts.query);
    url.searchParams.set('per_page', String(Math.max(3, opts.limit)));
    url.searchParams.set('safesearch', 'true');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay Videos HTTP ${res.status}`);
    const data = await res.json();
    const hits = Array.isArray(data.hits) ? data.hits.slice(0, opts.limit) : [];
    return hits.map((h, idx) => {
      const vid = h.videos?.medium || h.videos?.large || h.videos?.small || h.videos?.tiny;
      if (!vid || !vid.url) throw new Error('Pixabay video hit had no video URL');
      return {
        id: `cand_${idx + 1}`,
        ext: 'mp4',
        downloadUrl: vid.url,
        provider: 'pixabay',
        sourceId: String(h.id ?? idx + 1),
        title: h.tags ? `Pixabay video: ${h.tags}` : `Pixabay video ${h.id ?? idx + 1}`,
        creator: h.user ?? 'Unknown Creator',
        creatorUrl: h.pageURL ?? '',
        sourceUrl: h.pageURL ?? '',
        license: 'Pixabay Content License (Commercial Safe)',
        width: vid.width ?? null,
        height: vid.height ?? null,
        duration: h.duration ?? null,
      };
    });
  }

  const url = new URL(endpoints.pixabayImages);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', opts.query);
  url.searchParams.set('image_type', opts.type === 'vector' ? 'vector' : opts.type === 'illustration' ? 'illustration' : 'photo');
  url.searchParams.set('orientation', pixabayOrientation);
  url.searchParams.set('per_page', String(Math.max(3, opts.limit)));
  url.searchParams.set('safesearch', 'true');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay Images HTTP ${res.status}`);
  const data = await res.json();
  const hits = Array.isArray(data.hits) ? data.hits.slice(0, opts.limit) : [];
  return hits.map((h, idx) => {
    const isSvg = Boolean(opts.type === 'vector' && h.vectorURL);
    const downloadUrl = isSvg ? h.vectorURL : h.largeImageURL || h.webformatURL || h.previewURL;
    if (!downloadUrl) throw new Error('Pixabay hit had no image URL');
    const ext = isSvg ? 'svg' : downloadUrl.includes('.png') ? 'png' : 'jpg';
    return {
      id: `cand_${idx + 1}`,
      ext,
      downloadUrl,
      provider: 'pixabay',
      sourceId: String(h.id ?? idx + 1),
      title: h.tags ? `Pixabay ${opts.type}: ${h.tags}` : `Pixabay ${opts.type} ${h.id ?? idx + 1}`,
      creator: h.user ?? 'Unknown Creator',
      creatorUrl: h.pageURL ?? '',
      sourceUrl: h.pageURL ?? '',
      license: 'Pixabay Content License (Commercial Safe)',
      width: h.imageWidth ?? null,
      height: h.imageHeight ?? null,
      duration: null,
    };
  });
}

async function fetchOpenverse(opts, env) {
  const endpoints = getEndpoints(env);
  const url = new URL(endpoints.openverseImages);
  url.searchParams.set('q', opts.query);
  url.searchParams.set('license_type', 'commercial');
  url.searchParams.set('license', 'cc0,pdm');
  url.searchParams.set('page_size', String(opts.limit));
  const aspect =
    opts.orientation === 'landscape' ? 'wide' : opts.orientation === 'portrait' ? 'tall' : 'square';
  url.searchParams.set('aspect_ratio', aspect);

  if (opts.type === 'vector') {
    url.searchParams.set('extension', 'svg');
  } else if (opts.type === 'illustration') {
    url.searchParams.set('category', 'illustration');
  } else {
    url.searchParams.set('category', 'photograph');
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'agents-united-commercial-stock-sourcer/1.0' },
  });
  if (!res.ok) throw new Error(`Openverse Images HTTP ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results.slice(0, opts.limit) : [];
  return results.map((r, idx) => {
    const downloadUrl = r.url || r.thumbnail;
    if (!downloadUrl) throw new Error('Openverse result had no image URL');
    const filetype = String(r.filetype || '').toLowerCase();
    const ext =
      opts.type === 'vector' || filetype === 'svg' || downloadUrl.includes('.svg')
        ? 'svg'
        : filetype === 'png'
          ? 'png'
          : 'jpg';
    const lic = String(r.license || 'cc0').toUpperCase();
    const ver = r.license_version ? ` ${r.license_version}` : '';
    return {
      id: `cand_${idx + 1}`,
      ext,
      downloadUrl,
      provider: 'openverse',
      sourceId: String(r.id ?? idx + 1),
      title: r.title || `Openverse ${opts.type} ${idx + 1}`,
      creator: r.creator ?? 'Unknown Creator',
      creatorUrl: r.creator_url ?? '',
      sourceUrl: r.foreign_landing_url || downloadUrl,
      license: `${lic}${ver} / Public Domain (Commercial Safe)`,
      width: r.width ?? null,
      height: r.height ?? null,
      duration: null,
    };
  });
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'agents-united-commercial-stock-sourcer/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Media download HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

export async function fetchStockCandidates(opts, env = process.env) {
  const chain = resolveProviderChain(opts.type, opts.provider, env);
  if (chain.length === 0) {
    throw new Error(
      'Video sourcing (--type video) requires PEXELS_API_KEY or PIXABAY_API_KEY in the environment because Openverse does not host a video API. Ask the user or lead to configure PEXELS_API_KEY or PIXABAY_API_KEY, or fall back to an animated SVG / static photo.',
    );
  }

  const errors = [];
  for (const prov of chain) {
    try {
      let rawCandidates = [];
      if (prov === 'pexels') rawCandidates = await fetchPexels(opts, env);
      else if (prov === 'pixabay') rawCandidates = await fetchPixabay(opts, env);
      else if (prov === 'openverse') rawCandidates = await fetchOpenverse(opts, env);

      if (!rawCandidates || rawCandidates.length === 0) {
        errors.push(`${prov}: 0 results returned`);
        continue;
      }

      const outDir = path.resolve(opts.output);
      fs.mkdirSync(outDir, { recursive: true });

      const savedCandidates = [];
      for (const cand of rawCandidates) {
        const localFile = `${cand.id}.${cand.ext}`;
        const destPath = path.join(outDir, localFile);
        await downloadFile(cand.downloadUrl, destPath);
        savedCandidates.push({
          id: cand.id,
          localFile,
          provider: cand.provider,
          sourceId: cand.sourceId,
          title: cand.title,
          creator: cand.creator,
          creatorUrl: cand.creatorUrl,
          sourceUrl: cand.sourceUrl,
          license: cand.license,
          width: cand.width,
          height: cand.height,
          duration: cand.duration,
        });
      }

      const manifest = {
        query: opts.query,
        mediaType: opts.type,
        orientation: opts.orientation,
        provider: prov,
        fetchedAt: new Date().toISOString(),
        candidates: savedCandidates,
      };

      const manifestPath = path.join(outDir, 'manifest.json');
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      return { manifestPath, manifest };
    } catch (err) {
      const safeMsg = redactSecrets(err instanceof Error ? err.message : String(err), env);
      errors.push(`${prov}: ${safeMsg}`);
    }
  }

  throw new Error(`All configured stock providers failed (${errors.join('; ')})`);
}

async function main() {
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    const { manifestPath, manifest } = await fetchStockCandidates(opts, process.env);
    process.stdout.write(
      `Downloaded ${manifest.candidates.length} ${manifest.mediaType} candidate(s) from ${manifest.provider} to ${path.dirname(manifestPath)}\nManifest: ${manifestPath}\n`,
    );
  } catch (err) {
    const safeMsg = redactSecrets(err instanceof Error ? err.message : String(err), process.env);
    process.stderr.write(`Error: ${safeMsg}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
