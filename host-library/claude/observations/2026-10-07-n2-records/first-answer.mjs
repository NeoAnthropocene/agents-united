// Reads a stream-json run of `claude -p` and reports how the lead opened: the blocks of its first messages in order,
// whether a `Mode:` line is the first line of a text block, which calls came before it, and whether it has the four fields.
import fs from 'node:fs';

const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
const events = [];
for (const l of lines) { try { events.push(JSON.parse(l)); } catch { /* a partial line */ } }

const init = events.find(e => e.type === 'system' && e.subtype === 'init');
const result = events.find(e => e.type === 'result');
const assistants = events.filter(e => e.type === 'assistant');

const out = [];
out.push(`file: ${file}`);
out.push(`model: ${init?.model ?? '?'} | mcp servers: ${(init?.mcp_servers ?? []).map(s => `${s.name}:${s.status}`).join(', ') || 'none'}`);
out.push(`assistant messages: ${assistants.length} | cost: ${result?.total_cost_usd ?? '?'} | subtype: ${result?.subtype ?? '?'}`);

let modeAt = -1;
let callsBefore = [];
let modeLine = '';
let seen = [];
assistants.forEach((a, i) => {
  const blocks = a.message?.content ?? [];
  for (const b of blocks) {
    if (b.type === 'text') {
      const first = b.text.split('\n')[0];
      if (modeAt < 0 && /^Mode:/.test(first)) { modeAt = i; modeLine = first; callsBefore = [...seen]; }
      if (i < 6) out.push(`  #${i} text: ${JSON.stringify(b.text.slice(0, 220))}`);
    } else if (b.type === 'tool_use') {
      seen.push(b.name);
      if (i < 6) out.push(`  #${i} call: ${b.name} ${JSON.stringify(b.input).slice(0, 110)}`);
    }
  }
});

const shape = /^Mode: (Fully|Limited) Operational\. Callable: .+\. Missing: .+\. Extras: .+\.$/;
out.push('');
out.push(`mode line found: ${modeAt >= 0 ? `yes, in assistant message #${modeAt}` : 'NO (in the whole run)'}`);
if (modeAt >= 0) {
  out.push(`  line: ${modeLine}`);
  out.push(`  four-field shape: ${shape.test(modeLine)}`);
  out.push(`  calls before it: ${callsBefore.length ? callsBefore.join(', ') : 'none'}`);
  out.push(`  only ToolSearch before it: ${callsBefore.every(n => n === 'ToolSearch')}`);
}
console.log(out.join('\n'));
