// For each shell-less teammate of R4: the order of Write / Edit / Read calls with the time and the assistant message id, to see that the last Write or Edit is followed by a Read in a LATER response.
// usage: node r4-reread.mjs <subagents-folder>
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const wanted = ['aava-c16947af0052c53b', 'ajale-', 'ajamileh-', 'akaan-', 'ayavuz-'];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl') && wanted.some(w => f.includes(w)));
for (const f of files.sort()) {
  const records = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const steps = [];
  for (const r of records) {
    const content = Array.isArray(r.message?.content) ? r.message.content : [];
    for (const b of content) {
      if (b.type === 'tool_use' && ['Write', 'Edit', 'Read', 'SendMessage', 'TaskUpdate'].includes(b.name)) {
        const detail = b.name === 'SendMessage' ? (typeof b.input?.message === 'object' ? b.input.message.type : 'text') : b.name === 'TaskUpdate' ? (b.input?.status ?? 'update') : path.basename(String(b.input?.file_path ?? ''));
        steps.push({ t: (r.timestamp ?? '').slice(11, 23), msg: String(r.message?.id ?? '').slice(-6), name: b.name, detail });
      }
    }
  }
  const lastWrite = steps.map(s => s.name).lastIndexOf('Write') > steps.map(s => s.name).lastIndexOf('Edit') ? steps.map(s => s.name).lastIndexOf('Write') : steps.map(s => s.name).lastIndexOf('Edit');
  const readAfter = steps.findIndex((s, i) => i > lastWrite && s.name === 'Read');
  console.log(`${f.slice(0, 40)}  last write/edit: ${steps[lastWrite]?.t} msg ${steps[lastWrite]?.msg}  next Read: ${steps[readAfter]?.t} msg ${steps[readAfter]?.msg}  later response: ${readAfter > -1 && steps[readAfter].msg !== steps[lastWrite].msg}`);
  console.log('   ' + steps.map(s => `${s.name}(${s.detail})@${s.msg}`).join(' > '));
}
