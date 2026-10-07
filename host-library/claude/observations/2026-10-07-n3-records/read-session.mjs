// Prints a compact, time-ordered view of one Claude Code session record (.jsonl): the assistant text blocks,
// the tool calls (name and a short input), and the tool results (first characters, with the error flag).
// Usage: node read-session.mjs <file.jsonl> [maxText]
import fs from 'node:fs';

const file = process.argv[2];
const max = Number(process.argv[3] ?? 400);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
const clip = (s, n = max) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + ' ...' : t;
};
const stamp = (r) => (r.timestamp ? r.timestamp.slice(11, 23) : '            ');
let n = 0;
for (const line of lines) {
  let r;
  try { r = JSON.parse(line); } catch { continue; }
  n++;
  const t = r.type;
  const content = r.message?.content;
  if (t === 'assistant' && Array.isArray(content)) {
    for (const b of content) {
      if (b.type === 'text' && b.text) console.log(`${stamp(r)} A-TEXT   ${clip(b.text)}`);
      else if (b.type === 'tool_use') console.log(`${stamp(r)} A-CALL   ${b.name} ${clip(JSON.stringify(b.input), 220)}`);
      else if (b.type === 'thinking') console.log(`${stamp(r)} A-THINK  (thinking block)`);
    }
  } else if (t === 'user') {
    if (typeof content === 'string') console.log(`${stamp(r)} U-TEXT   ${clip(content, 300)}`);
    else if (Array.isArray(content)) {
      for (const b of content) {
        if (b.type === 'tool_result') {
          const body = Array.isArray(b.content) ? b.content.map((c) => c.text ?? '').join(' ') : b.content;
          console.log(`${stamp(r)} U-RESULT ${b.is_error ? '[error] ' : ''}${clip(body, 260)}`);
        } else if (b.type === 'text') console.log(`${stamp(r)} U-TEXT   ${clip(b.text, 300)}`);
      }
    }
  } else if (t === 'attachment') {
    const a = r.attachment;
    if (a?.type && /hook/i.test(a.type)) console.log(`${stamp(r)} HOOK     ${a.type} ${clip(JSON.stringify(a), 240)}`);
  }
}
console.error(`(${n} records read)`);
