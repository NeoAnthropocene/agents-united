// Writes the AskUserQuestion calls of one session record, each with the answer that came back, as JSON: { calls: [ { call, answer } ] }. Reads one file, prints JSON; changes nothing.
import fs from 'node:fs';
const file = process.argv[2];
const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const uses = new Map();
const results = new Map();
for (const r of rows) {
  const c = r.message?.content;
  if (!Array.isArray(c)) continue;
  for (const b of c) {
    if (b.type === 'tool_use' && b.name === 'AskUserQuestion') uses.set(b.id, b.input);
    if (b.type === 'tool_result') results.set(b.tool_use_id, typeof b.content === 'string' ? b.content : (b.content ?? []).map(x => x.text ?? '').join('\n'));
  }
}
const calls = [...uses].map(([id, call]) => ({ call, answer: results.get(id) ?? null }));
console.log(JSON.stringify({ calls }, null, 1));
