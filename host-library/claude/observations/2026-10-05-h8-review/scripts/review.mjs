import fs from 'fs';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const evals = JSON.parse(fs.readFileSync(`${ws}/evals-first-two.json`, 'utf8'));
const bench = JSON.parse(fs.readFileSync(`${ws}/iteration-1/benchmark.json`, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const rows = Object.entries(bench.per_skill).map(([s, v]) => `<tr><th scope="row">${s}</th>
<td>${v.with_skill.pass_rate.assertions}</td><td>${v.without_skill.pass_rate.assertions}</td>
<td>${v.delta.pass_rate >= 0 ? '+' : ''}${Math.round(v.delta.pass_rate * 100)} pts</td>
<td>${v.with_skill.output_tokens.mean} / ${v.without_skill.output_tokens.mean}</td>
<td>${v.with_skill.cost_usd.total} / ${v.without_skill.cost_usd.total}</td>
<td>${v.with_skill.time_seconds.mean} / ${v.without_skill.time_seconds.mean}</td></tr>`).join('\n');

const sections = evals.map((ev) => {
  const w = read(`${ws}/iteration-1/${ev.skill}/eval-${ev.id}/with_skill/grading.json`);
  const o = read(`${ws}/iteration-1/${ev.skill}/eval-${ev.id}/without_skill/grading.json`);
  const tw = read(`${ws}/iteration-1/${ev.skill}/eval-${ev.id}/with_skill/timing.json`);
  const to = read(`${ws}/iteration-1/${ev.skill}/eval-${ev.id}/without_skill/timing.json`);
  const aw = fs.readFileSync(`${ws}/iteration-1/${ev.skill}/eval-${ev.id}/with_skill/outputs/answer.md`, 'utf8');
  const ao = fs.readFileSync(`${ws}/iteration-1/${ev.skill}/eval-${ev.id}/without_skill/outputs/answer.md`, 'utf8');
  const mark = (p) => (p ? '<span class="ok" aria-label="pass">PASS</span>' : '<span class="no" aria-label="fail">FAIL</span>');
  const arows = w.assertion_results.map((a, i) => `<tr><td>${esc(a.text)}</td>
<td>${mark(a.passed)}<div class="ev">${esc(a.evidence)}</div></td>
<td>${mark(o.assertion_results[i].passed)}<div class="ev">${esc(o.assertion_results[i].evidence)}</div></td></tr>`).join('\n');
  const stat = (t) => `${t.skill_calls_loaded.length ? 'loaded: ' + t.skill_calls_loaded.join(', ') : 'no skill loaded'}${t.skill_calls_refused.length ? '; refused: ' + t.skill_calls_refused.join(', ') : ''} · ${t.output_tokens} output tokens · ${Math.round(t.duration_ms / 1000)} s · ${t.cost_usd} USD`;
  return `<section id="r${ev.n}"><h2>${ev.n}. ${ev.skill} (eval ${ev.id}) <small>${ev.role}</small></h2>
<p class="prompt"><strong>Prompt:</strong> ${esc(ev.prompt)}</p>
<p><strong>Expected output:</strong> ${esc(ev.expected_output)}</p>
<table><thead><tr><th scope="col">Assertion</th><th scope="col">With skill ${w.summary.passed}/${w.summary.total}</th><th scope="col">Without ${o.summary.passed}/${o.summary.total}</th></tr></thead><tbody>
${arows}
</tbody></table>
${o.notes ? `<p class="warn">${esc(o.notes)}</p>` : ''}
<details><summary>With skill answer (${esc(stat(tw))})</summary><pre>${esc(aw)}</pre></details>
<details><summary>Without skill answer (${esc(stat(to))})</summary><pre>${esc(ao)}</pre></details>
</section>`;
}).join('\n');

const toc = evals.map((e) => `<a href="#r${e.n}">${e.n}</a>`).join(' ');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>H8 review, iteration 1</title>
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--mut:#6b655c;--line:#d9d3c7;--ok:#1b6b3a;--no:#9b2c1f;--card:#fff;--warn:#7a4b00}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#ece7de;--mut:#a39b8d;--line:#3a352d;--ok:#6fcf8f;--no:#ff9b8c;--card:#1f1c18;--warn:#f0c070}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;max-width:1100px;margin-inline:auto}
h1{font-size:1.5rem}h2{font-size:1.15rem;margin-top:2.5rem}h2 small{color:var(--mut);font-weight:400}
table{border-collapse:collapse;width:100%;background:var(--card);font-size:.9rem}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}
.ok{color:var(--ok);font-weight:700}.no{color:var(--no);font-weight:700}.ev{color:var(--mut);font-size:.82rem;margin-top:2px}
.warn{color:var(--warn)}.prompt{background:var(--card);border-left:4px solid var(--line);padding:8px 12px}
details{margin:8px 0;border:1px solid var(--line);background:var(--card);border-radius:6px}summary{padding:8px 12px;cursor:pointer}
pre{white-space:pre-wrap;word-wrap:break-word;margin:0;padding:12px;font:.85rem/1.5 ui-monospace,Consolas,monospace;border-top:1px solid var(--line)}
nav a{margin-right:8px}
@media (max-width:700px){.wrap{overflow-x:auto}}
</style></head><body><main>
<h1>H8 review, iteration 1: six skills against no skill</h1>
<p>Sonnet, effort medium, 12 prompts each way, fresh session each. 65 assertions in all (derived from each eval's expected output before any without-skill answer was read). With skill ${bench.run_summary.with_skill.pass_rate.assertions} (${Math.round(bench.run_summary.with_skill.pass_rate.mean * 100)}%), without ${bench.run_summary.without_skill.pass_rate.assertions} (${Math.round(bench.run_summary.without_skill.pass_rate.mean * 100)}%). Cost ${bench.run_summary.with_skill.cost_usd.total} USD with, ${bench.run_summary.without_skill.cost_usd.total} USD without.</p>
<div class="wrap"><table><thead><tr><th scope="col">Skill</th><th scope="col">With</th><th scope="col">Without</th><th scope="col">Delta</th><th scope="col">Output tokens (with / without)</th><th scope="col">Cost USD (with / without)</th><th scope="col">Seconds (with / without)</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<nav aria-label="Runs">Jump to run: ${toc}</nav>
${sections}
</main></body></html>`;
fs.writeFileSync(`${ws}/review.html`, html);
console.log('review.html', html.length, 'bytes');
