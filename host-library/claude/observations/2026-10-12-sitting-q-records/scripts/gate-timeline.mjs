// gate-timeline.mjs: prints the conversation of one session record, in order, and nothing else: the user's messages, the lead's text, its reasoning summaries, its tool calls
// and the results (an error is marked). It skips every other kind of record (attachments, settings, account and bridge records), so the output holds no account detail.
// It reads one file and prints; it writes nothing and starts nothing.
//
// usage: node scripts/gate-timeline.mjs <session.jsonl>
//
// Written for Sitting Q (2026-10-12), to show what the mode-line hook held and what the lead did between the holds (docs/live-test-protocol.md, H10k).
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/gate-timeline.mjs <session.jsonl>');
  process.exit(2);
}
const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
  try { return JSON.parse(line); } catch { return null; }
}).filter(Boolean);
const mask = text => String(text).replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key-shaped string hidden]').replace(/\b(?:sk|AQ)\.[0-9A-Za-z_-]{20,}/g, '[key-shaped string hidden]');
const cut = (text, n) => (text.length > n ? `${text.slice(0, n)} ...[+${text.length - n} characters]` : text);
const indent = text => text.replace(/\n/g, '\n            ');
const t0 = Date.parse(rows.find(r => r.type === 'user' && r.timestamp)?.timestamp ?? rows.find(r => r.timestamp)?.timestamp);
let seen = 0;
for (const row of rows) {
  if (row.type !== 'assistant' && row.type !== 'user') continue;
  const message = row.message;
  if (!message) continue;
  const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : Array.isArray(message.content) ? message.content : [];
  const rel = row.timestamp ? `+${((Date.parse(row.timestamp) - t0) / 1000).toFixed(1).padStart(5)}s` : '       ';
  const who = row.type === 'assistant' ? `lead ${String(message.id ?? '').slice(-6)}` : 'user';
  for (const block of blocks) {
    seen += 1;
    if (block.type === 'text') console.log(`${rel} ${who} text: ${indent(mask(cut(block.text, 2500)))}`);
    else if (block.type === 'thinking') {
      const text = String(block.thinking ?? '').trim();
      console.log(`${rel} ${who} reasoning summary: ${text ? indent(mask(cut(text, 1200))) : '(empty in the record)'}`);
    } else if (block.type === 'tool_use') console.log(`${rel} ${who} call ${block.name} ${mask(cut(JSON.stringify(block.input ?? {}), 300))}`);
    else if (block.type === 'tool_result') {
      const content = block.content;
      const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map(c => c.text ?? (c.type === 'tool_reference' ? `[tool: ${c.tool_name}]` : `[${c.type}]`)).join(' ') : '';
      console.log(`${rel} ${who} result${block.is_error ? ' (ERROR)' : ''}: ${indent(mask(cut(text.replace(/\s+/g, ' ').trim() || '(empty)', 420)))}`);
    }
  }
}
console.log(`\n${seen} conversation block(s)`);
