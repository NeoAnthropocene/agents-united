// Per session: the lead's assistant MESSAGES in order (a message = one message.id, many blocks). For each: did it carry a MODE LINE text block (T), and the outcome of each gated call in it (HOLD / PASS). ToolSearch is not gated and is left out.
import fs from 'node:fs';
import path from 'node:path';
const LINE = /^\s*Mode: (?:Fully|Limited) Operational\./;
for (const folder of process.argv.slice(2)) {
  for (const f of fs.readdirSync(folder)) {
    if (!f.endsWith('.jsonl')) continue;
    const rows = fs.readFileSync(path.join(folder, f), 'utf8').split('\n').filter(Boolean).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    const t0 = Math.min(...rows.filter(r => r.timestamp).map(r => Date.parse(r.timestamp)));
    const msgs = []; const byId = new Map(); const callMsg = new Map();
    for (const r of rows) {
      if (r.isSidechain || r.agentId || !r.message || !Array.isArray(r.message.content)) continue;
      if (r.type === 'assistant') {
        const id = r.message.id || r.uuid;
        let m = byId.get(id);
        if (!m) { m = { id, t: (Date.parse(r.timestamp) - t0) / 1000, line: false, texts: 0, calls: [] }; byId.set(id, m); msgs.push(m); }
        for (const p of r.message.content) {
          if (p.type === 'text') { m.texts++; if (LINE.test(p.text || '')) m.line = true; }
          if (p.type === 'tool_use' && p.name !== 'ToolSearch') { const c = { name: p.name, out: '?' }; m.calls.push(c); callMsg.set(p.id, c); }
        }
      } else if (r.type === 'user') {
        for (const p of r.message.content) if (p.type === 'tool_result' && callMsg.has(p.tool_use_id)) {
          const txt = typeof p.content === 'string' ? p.content : JSON.stringify(p.content);
          callMsg.get(p.tool_use_id).out = p.is_error && /mode-line-gate/.test(txt) ? 'HOLD' : 'PASS';
        }
      }
    }
    const gated = msgs.filter(m => m.calls.length || m.line);
    if (!gated.some(m => m.line)) continue;
    console.log(path.basename(folder).replace('C--github-scratch-pilot-h10d-local-test-', '') + '/' + f.slice(0, 8));
    let n = 0;
    for (const m of msgs) {
      n++;
      if (!m.calls.length && !m.line) continue;
      console.log(`   msg ${String(n).padStart(3)} +${m.t.toFixed(1).padStart(6)}s  ${m.line ? 'LINE' : '    '}  ${m.calls.map(c => c.name + ':' + c.out).join(' ') || '(text only)'}`);
      if (gated.indexOf(m) > 14) break;
    }
  }
}
