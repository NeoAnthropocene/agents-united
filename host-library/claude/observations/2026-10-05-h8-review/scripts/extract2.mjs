import fs from 'fs';
import os from 'os';
import path from 'path';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const out = `${ws}/runs-iter2`;
const proj = (d) => path.join(os.homedir(), '.claude/projects', `C--github-scratch-pilot-${d}`);
const dirOf = { 'seo1-with': 'h8-iter2-with', 'seo1-without': 'h8-iter2-noseo', 'seo2-with': 'h8-iter2-with', 'a11y2-with': 'h8-iter2-with', 'funnel1-with': 'h8-iter2-with', 'funnel2-with': 'h8-iter2-with', 'funnel2-without': 'h8-iter2-nofunnel', 'funnel4-with': 'h8-iter3-with', 'funnel4-without': 'h8-iter3-nofunnel' };

for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.json') && !x.endsWith('.meta.json')).sort()) {
  const label = f.replace('.json', '');
  let res;
  try { res = JSON.parse(fs.readFileSync(`${out}/${f}`, 'utf8')); } catch { console.log(label, 'not finished or unparsed'); continue; }
  const file = path.join(proj(dirOf[label]), `${res.session_id}.jsonl`);
  const L = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const seen = new Set(); const skillIds = {}; const refused = []; const loaded = []; const tools = {}; const reads = [];
  let tin = 0, tout = 0, tcr = 0, tcc = 0, t0, t1;
  for (const e of L) {
    if (e.timestamp) { t0 ??= e.timestamp; t1 = e.timestamp; }
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    if (e.type === 'user') for (const x of c) if (x.type === 'tool_result' && skillIds[x.tool_use_id] && x.is_error) refused.push(skillIds[x.tool_use_id]);
    if (e.type === 'assistant') {
      for (const x of c) {
        if (x.type !== 'tool_use') continue;
        tools[x.name] = (tools[x.name] || 0) + 1;
        if (x.name === 'Skill') { skillIds[x.id] = x.input.skill; loaded.push(x.input.skill); }
        if (x.name === 'Read') reads.push(String(x.input.file_path).replace(/.*h8-iter2-[a-z]+[\\/]/, ''));
      }
      const u = seen.has(e.message.id) ? {} : (seen.add(e.message.id), e.message.usage || {});
      tin += u.input_tokens || 0; tout += u.output_tokens || 0; tcr += u.cache_read_input_tokens || 0; tcc += u.cache_creation_input_tokens || 0;
    }
  }
  const meta = { label, session: res.session_id, cost_usd: res.total_cost_usd, turns: res.num_turns, wall_s: (Date.parse(t1) - Date.parse(t0)) / 1000,
    in: tin, out: tout, cache_read: tcr, cache_create: tcc, tools, skillCalls: loaded.filter((k) => !refused.includes(k)), skillRefused: refused, reads };
  fs.writeFileSync(`${out}/${label}.meta.json`, JSON.stringify(meta, null, 1));
  fs.writeFileSync(`${out}/${label}.answer.md`, res.result ?? '');
  console.log(label, JSON.stringify({ cost: meta.cost_usd, wall: meta.wall_s, out: tout, tools, loaded: meta.skillCalls, refused, reads }));
}
