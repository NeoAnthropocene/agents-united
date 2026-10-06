import fs from 'fs';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const rd = (p) => JSON.parse(fs.readFileSync(`${ws}/${p}`, 'utf8'));
const A = rd('assertions-iter4.json');
const G = rd('grade-iter4.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const prompts = [
  { key: 'D1-growth-nodata', title: 'Growth, no data: "flat SaaS, give me ten experiments"', role: 'agency-growth-strategist', kind: 'data-poor', configs: [['before', 'iter4-D1-before'], ['after v1', 'iter4-D1-after'], ['after v2', 'iter5-D1-after']] },
  { key: 'D2-funnel-numbers', title: 'Funnel audit from four numbers, no page', role: 'agency-conversion-specialist', kind: 'data-poor', configs: [['before', 'iter4-D2-before'], ['after v1', 'iter4-D2-after'], ['after v2', 'iter5-D2-after']] },
  { key: 'C1-growth-data', title: 'Control, data-rich: "what should we test first?" with the funnel counts', role: 'agency-growth-strategist', kind: 'control', configs: [['before', 'iter4-C1-before'], ['after v1', 'iter4-C1-after'], ['after v2', 'iter5-C1-after']] },
  { key: 'L1-lead-signups', title: 'The lead: "we need more signups", nothing else sent', role: 'orchestrator-digital-agency', kind: 'lead', configs: [['before', 'iter4-L1-before'], ['after (lead change)', 'iter4-L1-after']] },
];
const summary = [];
let html = '';
for (const p of prompts) {
  const rows = [];
  const details = [];
  const promptText = fs.readFileSync(`${ws}/prompts-iter4/${p.key}.txt`, 'utf8');
  for (const [cfg, label] of p.configs) {
    const meta = rd(`runs-iter2/${label}.meta.json`);
    const grade = G[label];
    if (grade.length !== A[p.key].length) throw new Error(`${label}: ${grade.length} grades for ${A[p.key].length} assertions`);
    const items = A[p.key].map((text, i) => ({ text, passed: !!grade[i][0], evidence: grade[i][1] }));
    const passed = items.filter((x) => x.passed).length;
    const dir = `${ws}/iteration-3/${p.key}/${cfg.replace(/[^a-z0-9]+/gi, '-')}`;
    fs.mkdirSync(`${dir}/outputs`, { recursive: true });
    fs.copyFileSync(`${ws}/runs-iter2/${label}.answer.md`, `${dir}/outputs/answer.md`);
    fs.writeFileSync(`${dir}/grading.json`, JSON.stringify({ prompt: p.key, configuration: cfg, session: meta.session, assertion_results: items, summary: { passed, total: items.length } }, null, 1));
    fs.writeFileSync(`${dir}/timing.json`, JSON.stringify({ output_tokens: meta.out, duration_ms: Math.round(meta.wall_s * 1000), cost_usd: meta.cost_usd, tools: meta.tools, skill_calls_loaded: meta.skillCalls, mode: 'headless claude -p, sonnet, effort medium' }, null, 1));
    rows.push({ cfg, label, passed, total: items.length, out: meta.out, cost: meta.cost_usd, wall: meta.wall_s, tools: meta.tools, loaded: meta.skillCalls, items, answer: fs.readFileSync(`${ws}/runs-iter2/${label}.answer.md`, 'utf8') });
  }
  summary.push({ prompt: p.key, kind: p.kind, role: p.role, rows: rows.map(({ items, answer, ...r }) => r) });
  const mark = (v) => (v ? '<span class="ok">PASS</span>' : '<span class="no">FAIL</span>');
  const head = rows.map((r) => `<th scope="col">${esc(r.cfg)} ${r.passed}/${r.total}</th>`).join('');
  const body = A[p.key].map((t, i) => `<tr><td>${esc(t)}</td>${rows.map((r) => `<td>${mark(r.items[i].passed)}<div class="ev">${esc(r.items[i].evidence)}</div></td>`).join('')}</tr>`).join('\n');
  const det = rows.map((r) => `<details><summary>${esc(r.cfg)} answer (${r.loaded.length ? 'loaded: ' + r.loaded.join(', ') : 'no skill loaded'} · ${r.out} output tokens · ${Math.round(r.wall)} s · ${r.cost.toFixed(4)} USD)</summary><pre>${esc(r.answer)}</pre></details>`).join('\n');
  html += `<section><h2>${esc(p.title)} <small>${p.kind}, ${p.role}</small></h2><p class="prompt"><strong>Prompt:</strong> ${esc(promptText)}</p><div class="wrap"><table><thead><tr><th scope="col">Assertion</th>${head}</tr></thead><tbody>${body}</tbody></table></div>${det}</section>`;
}
const total = summary.flatMap((s) => s.rows).reduce((a, r) => a + r.cost, 0);
fs.writeFileSync(`${ws}/iteration-3/benchmark.json`, JSON.stringify({ date: '2026-10-06', mode: 'headless claude -p on the subscription, sonnet, effort medium', configs: 'before = dev plus #148 to #150; after v1 = plus the first inputs-first rule and the lead change; after v2 = the rule tightened', total_cost_usd: Number(total.toFixed(4)), summary }, null, 1));

const table = summary.map((s) => `<tr><th scope="row" colspan="5">${esc(s.prompt)} (${s.kind})</th></tr>` + s.rows.map((r) => `<tr><td>${esc(r.cfg)}</td><td>${r.passed}/${r.total}</td><td>${r.out}</td><td>${r.cost.toFixed(4)}</td><td>${r.loaded.length ? esc(r.loaded.join(', ')) : 'no skill loaded'}${r.tools.Write ? ', wrote a file' : ''}</td></tr>`).join('')).join('\n');
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inputs-first review</title>
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--mut:#6b655c;--line:#d9d3c7;--ok:#1b6b3a;--no:#9b2c1f;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#ece7de;--mut:#a39b8d;--line:#3a352d;--ok:#6fcf8f;--no:#ff9b8c;--card:#1f1c18}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;max-width:1100px;margin-inline:auto}
h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:2.2rem}h2 small{color:var(--mut);font-weight:400}table{border-collapse:collapse;width:100%;background:var(--card);font-size:.9rem}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}.ok{color:var(--ok);font-weight:700}.no{color:var(--no);font-weight:700}
.ev{color:var(--mut);font-size:.82rem;margin-top:2px}.prompt{background:var(--card);border-left:4px solid var(--line);padding:8px 12px}
details{margin:8px 0;border:1px solid var(--line);background:var(--card);border-radius:6px}summary{padding:8px 12px;cursor:pointer}
pre{white-space:pre-wrap;word-wrap:break-word;margin:0;padding:12px;font:.85rem/1.5 ui-monospace,Consolas,monospace;border-top:1px solid var(--line)}
@media (max-width:700px){.wrap{overflow-x:auto}}
</style></head><body><main>
<h1>Inputs-first and the lead's data inventory: before and after</h1>
<p>Eleven fresh headless sessions (Sonnet, effort medium), 2026-10-06, ${total.toFixed(4)} USD. One run per cell. <strong>before</strong>: dev plus #148 to #150. <strong>after v1</strong>: the first version of the rule (it stopped the data-rich control). <strong>after v2</strong>: the rule tightened. For the lead, one after run.</p>
<div class="wrap"><table><thead><tr><th scope="col">Configuration</th><th scope="col">Assertions</th><th scope="col">Output tokens</th><th scope="col">Cost USD</th><th scope="col">Skill and files</th></tr></thead><tbody>${table}</tbody></table></div>
${html}
</main></body></html>`;
fs.writeFileSync(`${ws}/review-intake.html`, page);
console.log('total cost', total.toFixed(4));
for (const s of summary) for (const r of s.rows) console.log(s.prompt.padEnd(18), r.cfg.padEnd(20), `${r.passed}/${r.total}`, 'out', String(r.out).padStart(5), 'usd', r.cost.toFixed(4), r.loaded.join(',') || '-', r.tools.Write ? 'WROTE' : '');
