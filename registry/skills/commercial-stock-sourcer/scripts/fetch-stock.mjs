#!/usr/bin/env node
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

dns.setDefaultResultOrder('ipv4first');

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

async function fetchWithRetry(url, init = {}, retries = 2, baseDelayMs = 600) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export function normalizeShootTitle(title) {
  return String(title || '')
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/^\d{4}[-_]\d{2}[-_]\d{2}\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

export function dedupeByCreator(items, limit, getCreator, options = {}) {
  const { getTitle = null, allowBackfill = true } = options;
  if (items.length <= limit && allowBackfill) return items;
  const chosen = [];
  const usedCreators = new Set();
  const usedTitles = new Set();
  const remainder = [];
  for (const item of items) {
    const c = String(getCreator(item) || '').trim().toLowerCase();
    const rawTitle = getTitle ? getTitle(item) : item?.title;
    const tKey = rawTitle ? normalizeShootTitle(rawTitle) : '';
    const creatorSeen = Boolean(c && usedCreators.has(c));
    const titleSeen = Boolean(tKey && tKey.length >= 6 && usedTitles.has(tKey));
    if (!creatorSeen && !titleSeen) {
      if (c) usedCreators.add(c);
      if (tKey && tKey.length >= 6) usedTitles.add(tKey);
      chosen.push(item);
      if (chosen.length === limit) return chosen;
    } else {
      remainder.push(item);
    }
  }
  if (allowBackfill) {
    for (const item of remainder) {
      chosen.push(item);
      if (chosen.length === limit) break;
    }
  }
  return chosen;
}

export function matchesOrientation(width, height, orientation) {
  if (!width || !height) return true;
  if (orientation === 'landscape') return width > height * 1.05;
  if (orientation === 'portrait') return height > width * 1.05;
  if (orientation === 'square') return Math.abs(width - height) / Math.max(width, height) <= 0.18;
  return true;
}

export function scoreCandidate(cand, opts) {
  let score = 0;
  const lic = String(cand.license || '');
  if (/\b(cc0|public domain|pdm|pd\b)/i.test(lic)) {
    score += 50;
  } else if (/\bcc[- ]by(?!-sa|-nc|-nd)/i.test(lic)) {
    score += 20;
  } else if (/\b(nc|nd)\b/i.test(lic)) {
    score -= 200;
  }

  if (opts.type !== 'vector') {
    if (matchesOrientation(cand.width, cand.height, opts.orientation)) {
      score += 35;
    } else {
      score -= 60;
    }
    const effectiveW = cand.origWidth || cand.width || 0;
    if (effectiveW >= 2000) score += 20;
    else if (effectiveW >= 1200) score += 12;
    else if (effectiveW > 0 && effectiveW < 800) score -= 25;
  }

  const title = String(cand.title || '');
  if (/\b(camera app|project indigo|test photo)\b/i.test(title) || /^\d{4}-\d{2}-\d{2}\b/.test(title)) {
    score -= 45;
  }
  if (/\b(unsplash|pixabay)\b/i.test(`${title} ${cand.creatorUrl || ''}`)) {
    score += 10;
  }
  return score;
}

async function fetchWikimediaCommons(opts) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const filetypeFilter = opts.type === 'vector' ? 'filetype:drawing' : 'filetype:bitmap';
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${filetypeFilter} ${opts.query}`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', String(Math.max(30, opts.limit * 15)));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|dimensions|extmetadata');
  url.searchParams.set('iiurlwidth', '1280');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const res = await fetchWithRetry(
    url,
    {
      headers: { 'User-Agent': 'agents-united-commercial-stock-sourcer/1.0 (https://github.com/agents-united)' },
      signal: AbortSignal.timeout(8000),
    },
    2,
  );
  if (!res.ok) throw new Error(`Wikimedia Commons HTTP ${res.status}`);
  const data = await res.json();
  const allPages = Object.values(data.query?.pages || {});

  const mapped = [];
  for (let idx = 0; idx < allPages.length; idx++) {
    const p = allPages[idx];
    const ii = p.imageinfo?.[0] || {};
    const downloadUrl = opts.type === 'vector' ? ii.url : ii.thumburl || ii.url;
    if (!downloadUrl) continue;
    const lowerUrl = String(ii.url || downloadUrl).toLowerCase();
    if (/\.(tif|tiff|pdf|djvu|webm|ogv|ogg)$/i.test(lowerUrl)) continue;
    if (opts.type === 'photo' && lowerUrl.endsWith('.webp')) continue;

    const ext =
      opts.type === 'vector' || downloadUrl.toLowerCase().endsWith('.svg')
        ? 'svg'
        : downloadUrl.toLowerCase().endsWith('.png')
          ? 'png'
          : 'jpg';
    const rawArtist = ii.extmetadata?.Artist?.value || 'Wikimedia Commons Contributor';
    const creator = String(rawArtist).replace(/<[^>]+>/g, '').trim() || 'Wikimedia Commons Contributor';
    const licShort = ii.extmetadata?.LicenseShortName?.value || 'CC0 / Public Domain';
    const cand = {
      id: `cand_${idx + 1}`,
      ext,
      downloadUrl,
      fallbackDownloadUrl: ii.url || null,
      provider: 'openverse',
      sourceId: String(p.pageid ?? idx + 1),
      title: String(p.title || `Commons ${opts.type} ${idx + 1}`).replace(/^File:/i, ''),
      creator,
      creatorUrl: ii.descriptionurl || '',
      sourceUrl: ii.descriptionurl || downloadUrl,
      license: `${licShort} (Commercial Safe — Wikimedia Commons)`,
      width: ii.thumbwidth || ii.width || null,
      height: ii.thumbheight || ii.height || null,
      origWidth: ii.width || ii.thumbwidth || null,
      duration: null,
    };
    mapped.push(cand);
  }

  mapped.sort((a, b) => scoreCandidate(b, opts) - scoreCandidate(a, opts));
  const diverse = dedupeByCreator(mapped, opts.limit, c => c.creator, {
    getTitle: c => c.title,
    allowBackfill: false,
  });
  return diverse.slice(0, opts.limit).map((c, idx) => ({ ...c, id: `cand_${idx + 1}` }));
}

async function fetchOpenverseOnly(opts, env) {
  const endpoints = getEndpoints(env);
  const isMock = Boolean(env.STOCK_API_BASE_URL);
  const url = new URL(endpoints.openverseImages);
  url.searchParams.set('q', opts.query);
  url.searchParams.set('license_type', 'commercial');
  url.searchParams.set('license', 'cc0,pdm');
  url.searchParams.set('page_size', String(isMock ? opts.limit : Math.min(20, Math.max(opts.limit * 5, 20))));
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

  const res = await fetchWithRetry(
    url,
    {
      headers: { 'User-Agent': 'agents-united-commercial-stock-sourcer/1.0 (https://github.com/agents-united)' },
      signal: AbortSignal.timeout(5000),
    },
    isMock ? 0 : 2,
  );
  if (!res.ok) throw new Error(`Openverse Images HTTP ${res.status}`);
  const data = await res.json();
  const rawResults = Array.isArray(data.results) ? data.results : [];
  if (rawResults.length === 0 && !isMock) {
    throw new Error('Openverse returned 0 results');
  }
  const results = isMock
    ? rawResults.slice(0, opts.limit)
    : dedupeByCreator(rawResults, opts.limit, r => r.creator || r.id, {
        getTitle: r => r.title,
        allowBackfill: false,
      });
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
      fallbackDownloadUrl: r.thumbnail || null,
      provider: 'openverse',
      sourceId: String(r.id ?? idx + 1),
      title: r.title || `Openverse ${opts.type} ${idx + 1}`,
      creator: r.creator ?? 'Unknown Creator',
      creatorUrl: r.creator_url ?? '',
      sourceUrl: r.foreign_landing_url || downloadUrl,
      license: `${lic}${ver} / Public Domain (Commercial Safe)`,
      width: r.width ?? null,
      height: r.height ?? null,
      origWidth: r.width ?? null,
      duration: null,
    };
  });
}

async function fetchOpenverse(opts, env) {
  const isMock = Boolean(env.STOCK_API_BASE_URL);
  if (isMock) {
    return await fetchOpenverseOnly(opts, env);
  }

  const [ovSettled, wmSettled] = await Promise.allSettled([
    fetchOpenverseOnly(opts, env),
    fetchWikimediaCommons(opts),
  ]);

  const ovCandidates = ovSettled.status === 'fulfilled' ? ovSettled.value : [];
  const wmCandidates = wmSettled.status === 'fulfilled' ? wmSettled.value : [];

  if (ovCandidates.length === 0 && wmCandidates.length === 0) {
    const err = ovSettled.status === 'rejected' ? ovSettled.reason : wmSettled.reason;
    throw err || new Error('Openverse and Wikimedia Commons returned 0 results');
  }

  const combined = [...ovCandidates, ...wmCandidates];
  combined.sort((a, b) => scoreCandidate(b, opts) - scoreCandidate(a, opts));
  const diverse = dedupeByCreator(combined, opts.limit, c => c.creator, {
    getTitle: c => c.title,
    allowBackfill: true,
  });
  return diverse.slice(0, opts.limit).map((c, idx) => ({ ...c, id: `cand_${idx + 1}` }));
}

async function downloadFile(url, destPath, fallbackUrl = null, isMock = false) {
  try {
    const res = await fetchWithRetry(
      url,
      {
        headers: { 'User-Agent': 'agents-united-commercial-stock-sourcer/1.0 (https://github.com/agents-united)' },
        signal: AbortSignal.timeout(8000),
      },
      isMock ? 0 : 1,
    );
    if (!res.ok) {
      throw new Error(`Media download HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
  } catch (primaryErr) {
    if (fallbackUrl && fallbackUrl !== url) {
      const res = await fetchWithRetry(
        fallbackUrl,
        {
          headers: { 'User-Agent': 'agents-united-commercial-stock-sourcer/1.0 (https://github.com/agents-united)' },
          signal: AbortSignal.timeout(8000),
        },
        isMock ? 0 : 1,
      );
      if (!res.ok) {
        throw new Error(`Media download HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      return;
    }
    throw primaryErr;
  }
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

      const isMock = Boolean(env.STOCK_API_BASE_URL);
      let savedCandidates = [];
      try {
        for (const cand of rawCandidates) {
          const localFile = `${cand.id}.${cand.ext}`;
          const destPath = path.join(outDir, localFile);
          await downloadFile(cand.downloadUrl, destPath, cand.fallbackDownloadUrl || null, isMock);
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
      } catch (dlErr) {
        if (prov === 'openverse' && !isMock) {
          const commonsCandidates = await fetchWikimediaCommons(opts);
          savedCandidates = [];
          for (const cand of commonsCandidates) {
            const localFile = `${cand.id}.${cand.ext}`;
            const destPath = path.join(outDir, localFile);
            await downloadFile(cand.downloadUrl, destPath, cand.fallbackDownloadUrl || null, isMock);
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
        } else {
          throw dlErr;
        }
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
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
