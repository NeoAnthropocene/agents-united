import fs from 'node:fs';
import path from 'node:path';
const [proj, sid] = process.argv.slice(2);
const root = path.join(process.env.HOME, '.claude/projects', proj);
const sub = path.join(root, sid, 'subagents');
const clip = (s, n) => String(s).replace(/\s+/g, ' ').slice(0, n);
for (const f of fs.readdirSync(sub).filter(n => n.endsWith('.jsonl'))) {
  const meta = JSON.parse(fs.readFileSync(path.join(sub, f.replace('.jsonl', '.meta.json')), 'utf8'));
  console.log('--', f.slice(6, 14), meta.agentType ?? meta.type ?? '', meta.name ?? '');
  for (const l of fs.readFileSync(path.join(sub, f), 'utf8').split('\n').filter(Boolean)) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    const ts = (o.timestamp || '').slice(11, 23);
    const c = o.message && o.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type === 'tool_use' && (b.name === 'ToolSearch' || b.name === 'SendMessage')) {
        const m = b.input && b.input.message;
        const shape = b.name === 'SendMessage' ? (typeof m === 'string' ? (m.startsWith('{') ? 'STRING-JSON' : 'text') : 'object') : '';
        console.log('  ', ts, b.name, shape, b.name === 'ToolSearch' ? clip(b.input.query, 60) : clip(typeof m === 'string' ? m : JSON.stringify(m), 70));
      }
      if (b.type === 'tool_result') {
        const t = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        if (/protocol frame/.test(t)) console.log('  ', ts, 'REFUSED');
      }
    }
  }
}
