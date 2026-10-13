// For every lead session record under the given project folders: each MODE LINE text block (entry timestamp), the hook holds (error results) that came AFTER it, and the first gated call that passed after it.
// A hold after the line means the hook did not see the line yet: lower bound of the host's save lag = hold time - line time. The first pass after the line is an upper bound (the lead may have called later).
import fs from 'node:fs';
import path from 'node:path';
const LINE = /^\s*Mode: (?:Fully|Limited) Operational\./;
const roots = process.argv.slice(2);
const files = [];
for (const root of roots) for (const f of fs.readdirSync(root, { withFileTypes: true })) if (f.isFile() && f.name.endsWith('.jsonl')) files.push(path.join(root, f.name));
for (const file of files) {
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  const calls = new Map(); // tool_use id -> {name, t}
  const lines = [];        // times of MODE LINE texts
  const events = [];       // {t, kind: 'hold'|'pass', name}
  for (const r of rows) {
    if (!r.timestamp || !r.message || !Array.isArray(r.message.content)) continue;
    const t = Date.parse(r.timestamp);
    for (const p of r.message.content) {
      if (r.type === 'assistant' && p.type === 'text' && LINE.test(p.text || '') && !r.isSidechain && !r.agentId) lines.push(t);
      if (r.type === 'assistant' && p.type === 'tool_use' && !r.isSidechain && !r.agentId) calls.set(p.id, { name: p.name, t });
      if (r.type === 'user' && p.type === 'tool_result' && calls.has(p.tool_use_id)) {
        const c = calls.get(p.tool_use_id);
        const txt = typeof p.content === 'string' ? p.content : JSON.stringify(p.content);
        const hold = p.is_error && /agents-united-mode-line-gate/.test(txt);
        if (c.name !== 'ToolSearch') events.push({ t: Date.parse(r.timestamp), at: c.t, kind: hold ? 'hold' : 'pass', name: c.name });
      }
    }
  }
  if (!lines.length) continue;
  const holds = events.filter(e => e.kind === 'hold');
  const out = [];
  for (const lt of lines) {
    const laterHolds = holds.filter(h => h.at > lt).map(h => ((h.at - lt) / 1000).toFixed(1));
    const firstPass = events.find(e => e.kind === 'pass' && e.at > lt);
    out.push(`line@${new Date(lt).toISOString().slice(11, 19)}  holds after it (s after the line): [${laterHolds.join(', ')}]  first passed call after it: ${firstPass ? ((firstPass.at - lt) / 1000).toFixed(1) + 's ' + firstPass.name : 'none'}`);
  }
  console.log(path.basename(path.dirname(file)).replace('C--github-scratch-pilot-', '') + '/' + path.basename(file).slice(0, 8) + `  holds ${holds.length}, lines ${lines.length}`);
  for (const o of out) console.log('   ' + o);
}
