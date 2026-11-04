import fs from 'node:fs';

// Installed resources resolve from this file, never from a production workspace.
const library = JSON.parse(fs.readFileSync(new URL('../assets/techniques.json', import.meta.url), 'utf8'));
const gates = [
  'Fill the existing motion-prompt.json: signatureShot, visualSystem, depthLayers, shots, beatGrid and proofPlan; selected cards are direction only.',
  'Require actual viewed local referenceFrames, explicit materialPasses and viewed proofComparison; inspiration links and installed cards are not view evidence.',
  'Run check-prompt-spec.mjs --require-craft-gate --timeline before animation, then --proof-comparison before full render.',
  'Sound owns assets and measured master/stems; use canonical timeline cue IDs/frames, final-mux sync measurement and separate human listening/creative acceptance.',
  'Keep renderer approval, budget, rights and Remotion entitlement/redistribution hold; no installation, model calls or paid work is authorized by selection.',
];

export function listTechniques(query = '') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return library.techniques.filter(card => {
    const searchable = [card.id, card.name, ...card.tags, card.useWhen, card.composition].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  }).map(({ id, name, tags, useWhen }) => ({ id, name, tags, useWhen }));
}

export function selectTechnique(id, renderer) {
  if (!['native', 'remotion'].includes(renderer)) throw new Error('renderer');
  const card = library.techniques.find(item => item.id === id);
  if (!card) throw new Error('technique');
  return {
    schemaVersion: 1, disposition: 'original', evidenceStatus: 'inspiration-only',
    renderer, card, mapping: card[renderer],
    sources: library.sources.filter(source => card.inspirations.includes(source.id)),
    gates, creativeAcceptance: 'unverified',
  };
}

export function main(args) {
  if (args.length === 1 && args[0] === 'list') return { schemaVersion: 1, techniques: listTechniques() };
  if (args.length === 2 && args[0] === 'search' && args[1].trim()) return { schemaVersion: 1, techniques: listTechniques(args[1]) };
  if (args.length === 4 && args[0] === 'select' && args[2] === '--renderer') return selectTechnique(args[1], args[3]);
  throw new Error('arguments');
}

// The CLI emits only static library content. It never reads/writes the user's media project.
import { pathToFileURL } from 'node:url';
let isEntry = false;
try { isEntry = Boolean(process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url); }
catch { /* Imported modules may receive non-file node -e arguments. */ }
if (isEntry) {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
  } catch {
    process.stderr.write('techniques: use list | search "terms" | select <id> --renderer native|remotion\n');
    process.exitCode = 1;
  }
}
