import { pathToFileURL } from 'node:url';
import { REMOTION_VERSION } from './project.mjs';

export const RELEASE_PACKAGES = Object.freeze([
  'remotion',
  '@remotion/bundler',
  '@remotion/renderer',
  '@remotion/cli',
]);
export const RELEASE_URLS = Object.freeze({
  remotion: 'https://registry.npmjs.org/remotion/latest',
  '@remotion/bundler': 'https://registry.npmjs.org/@remotion%2fbundler/latest',
  '@remotion/renderer': 'https://registry.npmjs.org/@remotion%2frenderer/latest',
  '@remotion/cli': 'https://registry.npmjs.org/@remotion%2fcli/latest',
});

/** Pure comparison used by the test suite and the CLI. Mismatches are sorted and duplicate-free. */
export function compareReleaseVersions(pinned, latest) {
  const mismatches = RELEASE_PACKAGES.filter(name => latest?.[name] !== pinned).sort();
  return {
    pinned,
    latest: Object.fromEntries(RELEASE_PACKAGES.map(name => [name, latest?.[name] ?? null])),
    upToDate: mismatches.length === 0,
    mismatches,
  };
}

export async function fetchLatestVersions({ fetchImpl = globalThis.fetch } = {}) {
  const latest = {};
  await Promise.all(RELEASE_PACKAGES.map(async name => {
    const response = await fetchImpl(RELEASE_URLS[name], { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const body = await response.json();
    if (typeof body.version !== 'string') throw new Error(`${name}: response has no version`);
    latest[name] = body.version;
  }));
  return latest;
}

async function main() {
  try {
    const latest = await fetchLatestVersions();
    const report = compareReleaseVersions(REMOTION_VERSION, latest);
    console.log(JSON.stringify(report, null, 2));
    if (!report.upToDate) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ pinned: REMOTION_VERSION, upToDate: false, error: String(error?.message ?? error) }, null, 2));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
