// Scratch: counts and copy checks for the re-run of H10h and H10i (Plan 036 Sitting K), against the rules fixed in docs/live-test-protocol.md.
import fs from 'node:fs';

const SCR = 'C:/Users/ozy/AppData/Local/Temp/claude/C--github-agents-united/cfb44c58-b378-40db-b9f1-3cf4692f0726/scratchpad/k-published';
const FIX = 'C:/github/scratch-pilot/wt-k-rerun/tests/fixtures/designer';

// H10h: colours on the boards, copy against hero.ts, board sizes in canvas.json
const tokens = JSON.parse(fs.readFileSync(`${FIX}/design-tokens.json`, 'utf8'));
const palette = new Set();
(function walk(n) { if (n && typeof n === 'object') { if (typeof n.$value === 'string' && /^#[0-9a-fA-F]{6}$/.test(n.$value)) palette.add(n.$value.toUpperCase()); for (const [k, v] of Object.entries(n)) if (!k.startsWith('$')) walk(v); } })(tokens);
console.log('token colours:', [...palette].join(' '));
const hero = fs.readFileSync(`${FIX}/hero.ts`, 'utf8');
console.log('--- hero.ts strings:'); for (const m of hero.matchAll(/['"`]([^'"`\n]{3,})['"`]/g)) console.log('  ', m[1]);

const canvas = JSON.parse(fs.readFileSync(`${SCR}/h10h/project/canvas.json`, 'utf8'));
console.log('--- canvas boards:', Object.entries(canvas.boards).map(([f, b]) => `${f} ${b.w}x${b.h}`).join(', '), '| designSystems:', JSON.stringify(canvas.designSystems), '| createdOnFiles.at:', canvas.createdOnFiles.at);
for (const f of ['Main', 'Story', 'Link']) {
  const html = fs.readFileSync(`${SCR}/h10h/project/${f}.dc.html`, 'utf8');
  const hexes = [...new Set([...html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toUpperCase()))];
  const off = hexes.filter(h => !palette.has(h));
  const texts = [...html.matchAll(/>([^<>\n]{2,})</g)].map(m => m[1].trim()).filter(Boolean);
  console.log(`--- ${f}: hex colours ${hexes.join(' ')} | outside tokens: ${off.length ? off.join(' ') : 'none'}`);
  console.log('    visible strings:', JSON.stringify(texts));
  console.log('    not in hero.ts:', JSON.stringify(texts.filter(t => !hero.includes(t))));
}

// H10i: tokens.json counts and the empty usage notes, against her report
const t = JSON.parse(fs.readFileSync(`${SCR}/h10i/project/tokens.json`, 'utf8'));
const groups = { colour: t.color.tokens, spacing: t.spacing.tokens, radius: t.radius.tokens };
let total = 0, empty = 0;
for (const [k, list] of Object.entries(groups)) {
  const e = list.filter(x => x.usage === '').length;
  console.log(`--- ${k}: ${list.length} tokens, ${e} empty usage, ${list.length - e} with usage (${list.filter(x => x.usage !== '').map(x => x.name).join(', ') || 'none'})`);
  total += list.length; empty += e;
}
const styles = t.type.groups.flatMap(g => g.styles);
console.log(`colour+spacing+radius: ${total} tokens, ${empty} empty usage notes (she reported "15 of 18"); type styles ${styles.length}, with usage ${styles.filter(s => s.usage).length}; families ${Object.keys(t.type.families).length}; nested $value anywhere: ${JSON.stringify(t).includes('$value')}`);
const roles = t.color.tokens.filter(x => /^\{.+\}$/.test(x.value));
console.log(`colour tokens: ${t.color.tokens.length} (palette ${t.color.tokens.length - roles.length}, aliases ${roles.length}); aliases resolve: ${roles.every(r => t.color.tokens.some(x => x.name === r.value.slice(1, -1)))}`);
const readme = fs.readFileSync(`${SCR}/h10i/project/README.md`, 'utf8');
console.log('README says "only three" usage notes in the source; source usage fields:', JSON.stringify(JSON.stringify(tokens).match(/"\$?usage"[^,}]*|"description"[^,}]*/g)));
