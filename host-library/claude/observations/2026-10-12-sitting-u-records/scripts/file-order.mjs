// Prints the FILE ORDER of a session record (what the hook could read at each moment): line index, entry type, entry timestamp relative to the first user text, block kinds. No tool results are printed except the first 70 characters of an error.
import fs from 'node:fs';
const file = process.argv[2];
const from = Number(process.argv[3] || 0), to = Number(process.argv[4] || 9999);
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((r, i) => { try { return { i, r: JSON.parse(r) }; } catch { return { i, r: null }; } });
const t0 = rows.map(x => x.r && x.r.timestamp).filter(Boolean).map(t => Date.parse(t)).sort((a, b) => a - b)[0];
for (const { i, r } of rows) {
  if (!r || !r.timestamp) continue;
  const t = (Date.parse(r.timestamp) - t0) / 1000;
  if (t < from || t > to) continue;
  const c = r.message && r.message.content;
  let kinds = '';
  if (Array.isArray(c)) kinds = c.map(p => {
    if (p.type === 'text') return 'text' + (/^\s*Mode: (Fully|Limited) Operational\./.test(p.text || '') ? '(MODE LINE)' : '');
    if (p.type === 'tool_use') return 'tool_use:' + p.name;
    if (p.type === 'tool_result') return 'tool_result' + (p.is_error ? '(ERROR ' + String(typeof p.content === 'string' ? p.content : JSON.stringify(p.content)).slice(0, 70).replace(/\s+/g, ' ') + ')' : '');
    return p.type;
  }).join(',');
  else if (typeof c === 'string') kinds = 'string';
  console.log(`line ${String(i).padStart(3)}  +${t.toFixed(1).padStart(5)}s  ${(r.type || '').padEnd(10)} ${r.message && r.message.id ? r.message.id.slice(-6) : '      '}  ${kinds}`);
}
