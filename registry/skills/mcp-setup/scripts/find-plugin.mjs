import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Read-only search over the two plugin catalogs that Claude Code keeps on disk. `claude plugin` has no search command (2.1.291), so this is how
// the lead finds out whether a plugin exists for an integration. It prints what it finds and the install command the lead may run after the
// user's yes. It writes nothing, opens no connection and runs nothing.
//
//   node find-plugin.mjs <word> [<word>...] [--json] [--limit N] [--official FILE] [--directory FILE]
//
// Exit 0: at least one match. Exit 1: no match. Exit 2: a usage error, or neither catalog could be read.

const OFFICIAL_MARKETPLACE = 'claude-plugins-official';
const OFFICIAL_REPO = 'github.com/anthropics/claude-plugins-official';
const USAGE = 'Usage: node find-plugin.mjs <word> [<word>...] [--json] [--limit N] [--official FILE] [--directory FILE]';
const REFRESH = 'run `claude plugin marketplace update` to refresh the catalogs';

const configDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const defaultOfficial = () => path.join(configDir(), 'plugins', 'marketplaces', OFFICIAL_MARKETPLACE, '.claude-plugin', 'marketplace.json');
const defaultDirectory = () => path.join(configDir(), 'plugins', 'plugin-directory-cache-v2.json');

function parseArgs(argv) {
  const options = { words: [], json: false, limit: 10, official: defaultOfficial(), directory: defaultDirectory(), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--limit') {
      const value = Number(argv[(i += 1)]);
      if (!Number.isInteger(value) || value < 1) return { error: '--limit needs a whole number of at least 1' };
      options.limit = value;
    } else if (arg === '--official' || arg === '--directory') {
      const value = argv[(i += 1)];
      if (!value) return { error: `${arg} needs a file` };
      options[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    else options.words.push(arg);
  }
  return options;
}

function readCatalog(file) {
  try {
    return { data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
}

const repoKey = url => String(url ?? '').toLowerCase().replace(/^[a-z+]+:\/\//, '').replace(/^git@github\.com:/, 'github.com/').replace(/\.git$/, '').replace(/\/+$/, '');
const pathKey = value => String(value ?? '').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');

function formatRepo(url, repoPath, commit) {
  const where = repoPath ? `${url} (${pathKey(repoPath)})` : String(url ?? 'unknown');
  return commit ? `${where} @ ${String(commit).slice(0, 7)}` : where;
}

function officialLocation(source) {
  if (typeof source === 'string') return { repo: OFFICIAL_REPO, path: pathKey(source) };
  if (source && typeof source === 'object') return { repo: repoKey(source.url), path: pathKey(source.path) };
  return { repo: '', path: '' };
}

function officialSource(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object') return formatRepo(source.url, source.path, source.sha);
  return 'unknown';
}

function listingLocation(listing) {
  const repository = listing?.source?.repository ?? {};
  return { repo: repoKey(repository.url), path: pathKey(repository.path) };
}

/** One entry per plugin: a marketplace plugin joined to the directory listing of the same repository and path, then the listings no plugin claims. */
function buildEntries(official, directory) {
  const listings = Array.isArray(directory?.listings) ? directory.listings : [];
  const byName = new Map();
  for (const listing of listings) {
    const key = String(listing?.name ?? '').toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), listing]);
  }
  const claimed = new Set();
  const entries = [];
  for (const plugin of Array.isArray(official?.plugins) ? official.plugins : []) {
    const where = officialLocation(plugin.source);
    const match = (byName.get(String(plugin.name).toLowerCase()) ?? []).find(listing => {
      const there = listingLocation(listing);
      return there.repo === where.repo && there.path === where.path;
    });
    if (match) claimed.add(match);
    entries.push({
      name: plugin.name,
      catalogs: match ? ['official', 'directory'] : ['official'],
      surfaces: match && Array.isArray(match.surfaces) ? [...match.surfaces] : [],
      source: officialSource(plugin.source),
      install: `claude plugin install ${plugin.name}@${OFFICIAL_MARKETPLACE} --scope project`,
      description: String(plugin.description ?? match?.summary ?? ''),
    });
  }
  for (const listing of listings) {
    if (claimed.has(listing)) continue;
    const repository = listing?.source?.repository ?? {};
    entries.push({
      name: String(listing?.name ?? ''),
      catalogs: ['directory'],
      surfaces: Array.isArray(listing?.surfaces) ? [...listing.surfaces] : [],
      source: formatRepo(repository.url, repository.path, repository.reviewed_commit),
      install: null,
      description: String(listing?.summary ?? ''),
    });
  }
  return entries;
}

/** 0 for the exact name, 1 when every word is in the name, 2 when the words are spread over the name and the description, null for no match. */
function rank(entry, words) {
  const name = entry.name.toLowerCase();
  if (!words.every(word => `${name} ${entry.description.toLowerCase()}`.includes(word))) return null;
  if (words.length === 1 && name === words[0]) return 0;
  return words.every(word => name.includes(word)) ? 1 : 2;
}

function search(entries, words, limit) {
  const lowered = words.map(word => word.toLowerCase());
  return entries
    .map(entry => ({ entry, rank: rank(entry, lowered) }))
    .filter(item => item.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.entry.name.length - b.entry.name.length || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(item => item.entry);
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

function renderHits(hits, query) {
  const lines = [`${hits.length} ${hits.length === 1 ? 'match' : 'matches'} for "${query}"`, ''];
  for (const hit of hits) {
    lines.push(hit.name);
    lines.push(`  catalogs: ${hit.catalogs.map(name => (name === 'official' ? 'official marketplace' : 'built-in directory')).join(', ')}`);
    lines.push(`  surfaces: ${hit.catalogs.includes('directory') ? hit.surfaces.join(', ') : 'unknown (not in the directory cache)'}`);
    lines.push(`  source: ${hit.source}${hit.source.startsWith('./') ? ' (inside the marketplace clone)' : ''}`);
    lines.push(`  install: ${hit.install ?? 'none, not in the official marketplace'}`);
    if (hit.description) lines.push(`  ${truncate(hit.description, 200)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.error) {
    console.error(`${options.error}\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.words.length === 0) {
    console.error(USAGE);
    return 2;
  }

  const official = readCatalog(options.official);
  const directory = readCatalog(options.directory);
  if (official.reason && directory.reason) {
    console.error(`cannot read the official marketplace at ${options.official} (${official.reason})\ncannot read the directory cache at ${options.directory} (${directory.reason})\n${REFRESH}`);
    return 2;
  }
  if (official.reason) console.error(`warning: cannot read the official marketplace at ${options.official} (${official.reason}); ${REFRESH}`);
  if (directory.reason) console.error(`warning: cannot read the directory cache at ${options.directory} (${directory.reason}); ${REFRESH}`);

  const query = options.words.join(' ');
  const hits = search(buildEntries(official.data, directory.data), options.words, options.limit);
  if (hits.length === 0) {
    if (options.json) console.log('[]');
    console.error(`no plugin matches "${query}"`);
    return 1;
  }
  console.log(options.json ? JSON.stringify(hits, null, 2) : renderHits(hits, query));
  return 0;
}

process.exitCode = main(process.argv.slice(2));
