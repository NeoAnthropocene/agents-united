// extract-loaded-text.mjs: prints, from the files that a Sitting Q folder held, the sentences that the grading of the run turns on:
// the lead's rule about reads that are held (the Photographs paragraph), its section on the mode line (the part about holds), the message of the mode-line hook, and the designer's
// sentence about the record. It reads files and prints; it writes nothing.
//
// usage: node scripts/extract-loaded-text.mjs <folder holding the install, e.g. h10k2-gemini> [<folder of the designer's install, e.g. h10d3-outside>]
import fs from 'node:fs';
import path from 'node:path';

const lead = process.argv[2];
const designerFolder = process.argv[3] ?? lead;
const read = rel => fs.readFileSync(rel, 'utf8').replace(/\r\n/g, '\n');
const sentences = text => text.split(/(?<=[.!?:])\s+(?=[A-Z`*"(])/).map(s => s.trim()).filter(Boolean);
const show = (title, items) => {
  console.log(`== ${title}`);
  if (!items.length) console.log('(not found)');
  for (const item of items) console.log(`- ${item}`);
  console.log('');
};

const leadText = read(path.join(lead, '.claude', 'agents', 'orchestrator-digital-agency.md'));
const leadSentences = sentences(leadText.replace(/\n+/g, ' '));
show('The lead, Photographs paragraph: what it says about reads of the prices that are held', leadSentences.filter(s => /reads? of the prices/.test(s)));
show('The lead, "The first message" section: what it says about a hold and a retry', leadSentences.filter(s => /(hook holds|retry can be held|elapsed time alone|Mode line first|the host cannot see)/.test(s)));
show('The lead, "The first message" section: what it says to do with a hold, by what the lead has written', leadSentences.filter(s => /(text block|repeat the call|write it in your next message|never write the line a second time|even if you believe)/.test(s) && !/Under the line|Write the line once/.test(s)));
show('The lead, "The first message" section: any sentence that says not to stop, not to ask or not to wait on a hold', leadSentences.filter(s => /(not a reason to stop|do not end your turn)/.test(s)));

const hookText = read(path.join(lead, '.claude', 'hooks', 'agents-united-mode-line-gate.js'));
const message = /const MESSAGE = \[([\s\S]*?)\]\.join/.exec(hookText)?.[1] ?? '';
show('The mode-line hook: the message the lead gets with a hold (one line of the message each)', [...message.matchAll(/^\s*"((?:[^"\\]|\\.)*)",?$/gm)].map(m => m[1].replace(/\\"/g, '"')));

const designerText = read(path.join(designerFolder, '.claude', 'agents', 'agency-creative-designer.md')).replace(/\n+/g, ' ');
const at = designerText.indexOf('write `<image>.provenance.json`');
const clause = at >= 0 ? designerText.slice(at, designerText.indexOf(';', at)) : '';
show('The designer, "Generated pictures": the clause about the record (and whether it says what an `inputImages` entry carries)', clause ? [clause, `says what an inputImages entry carries: ${/inputImages/.test(clause) ? 'yes' : 'no'}`] : []);
