import fs from 'node:fs';

// Prints a Claude Code session record as a short trace: who said or called what, with truncation. Read-only.
const [, , file, textMax = '700', resultMax = '260', from = '', to = ''] = process.argv;
const T = Number(textMax), R = Number(resultMax);
const clip = (s, n) => { const t = String(s).replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + ' ...[' + (t.length - n) + ' more]' : t; };
const flat = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text ?? (x.type === 'image' ? '[image]' : JSON.stringify(x))).join(' ') : JSON.stringify(c);
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
let n = 0;
for (const l of lines) {
  let o; try { o = JSON.parse(l); } catch { continue; }
  const ts = (o.timestamp || '').slice(11, 19);
  if (from && ts && ts < from) continue;
  if (to && ts && ts > to) continue;
  const out = (who, text) => { console.log(`${ts} ${who.padEnd(7)} ${text}`); n++; };
  if (o.type === 'user' || o.type === 'assistant') {
    const c = o.message?.content;
    const parts = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [];
    for (const p of parts) {
      if (p.type === 'text') out(o.type === 'user' ? 'USER' : 'LEAD', clip(p.text, T));
      else if (p.type === 'tool_use') out('CALL', `${p.name} ${clip(JSON.stringify(p.input), R)}`);
      else if (p.type === 'tool_result') out('RESULT', clip(flat(p.content), R));
    }
  } else if (o.type === 'system' && o.subtype && !/^(init|stop_hook|api_)/.test(o.subtype)) out('SYS:' + o.subtype, clip(o.content ?? '', R));
}
console.log(`-- ${n} lines`);
