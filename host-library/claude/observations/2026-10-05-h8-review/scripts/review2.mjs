import fs from 'fs';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const rd = (p) => JSON.parse(fs.readFileSync(`${ws}/${p}`, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bench = rd('iteration-2/benchmark.json');
const prompt = (f) => fs.readFileSync(`${ws}/prompts/${f}.txt`, 'utf8');

const groups = [
  { title: 'seo-audit, eval 1 on the fixture site', prompt: prompt('seo1-fixture'), runs: [['seo-audit', 1, 'with_skill', 'seo1-with'], ['seo-audit', 1, 'without_skill', 'seo1-without']], base: 'New prompt and fixture, so no iteration 1 comparison.' },
  { title: 'seo-audit, eval 2 (guaranteed ranking), tuned description', prompt: prompt('seo2'), runs: [['seo-audit', 2, 'with_skill', 'seo2-with']], base: 'Iteration 1: 3/3 with the old description (skill not loaded), 2/3 without the skill.' },
  { title: 'accessibility-audit, eval 2 (compliance statement), tuned description', prompt: prompt('a11y2'), runs: [['accessibility-audit', 2, 'with_skill', 'a11y2-with']], base: 'Iteration 1: 3/4 with the old description (skill not loaded) and 3/4 without the skill.' },
  { title: 'conversion-funnel-optimization, eval 1 (numbers only), report shape inline', prompt: prompt('funnel1'), runs: [['conversion-funnel-optimization', 1, 'with_skill', 'funnel1-with']], base: 'Iteration 1: 4/6 with the skill, 4/6 without.' },
  { title: 'conversion-funnel-optimization, eval 2 (ad and page mismatch)', prompt: prompt('funnel2'), runs: [['conversion-funnel-optimization', 2, 'with_skill', 'funnel2-with'], ['conversion-funnel-optimization', 2, 'without_skill', 'funnel2-without']], base: 'Iteration 1: 5/5 with the skill, 4/5 without (that run had read the skill\'s worked example).' },
  { title: 'conversion-funnel-optimization, new eval 4 on the fixture course site', prompt: prompt('funnel4-fixture'), runs: [['conversion-funnel-optimization', 4, 'with_skill', 'funnel4-with'], ['conversion-funnel-optimization', 4, 'without_skill', 'funnel4-without']], base: 'New eval: one S1, two S2, an S3 and an S4 planted in three static pages.' },
];

const mark = (p) => (p ? '<span class="ok">PASS</span>' : '<span class="no">FAIL</span>');
const sections = groups.map((g, gi) => {
  const data = g.runs.map(([skill, id, cfg, label]) => ({
    cfg, label,
    grade: rd(`iteration-2/${skill}/eval-${id}/${cfg}/grading.json`),
    timing: rd(`iteration-2/${skill}/eval-${id}/${cfg}/timing.json`),
    answer: fs.readFileSync(`${ws}/iteration-2/${skill}/eval-${id}/${cfg}/outputs/answer.md`, 'utf8'),
  }));
  const head = data.map((d) => `<th scope="col">${d.cfg === 'with_skill' ? 'With skill' : 'Without'} ${d.grade.summary.passed}/${d.grade.summary.total}</th>`).join('');
  const rows = data[0].grade.assertion_results.map((a, i) => `<tr><td>${esc(a.text)}</td>${data.map((d) => `<td>${mark(d.grade.assertion_results[i].passed)}<div class="ev">${esc(d.grade.assertion_results[i].evidence)}</div></td>`).join('')}</tr>`).join('\n');
  const stat = (t) => `${t.skill_calls_loaded.length ? 'loaded: ' + t.skill_calls_loaded.join(', ') : 'no skill loaded'}${t.skill_calls_refused.length ? '; refused: ' + t.skill_calls_refused.join(', ') : ''} · ${t.output_tokens} output tokens · ${Math.round(t.duration_ms / 1000)} s · ${t.cost_usd.toFixed(4)} USD`;
  const details = data.map((d) => `<details><summary>${d.cfg === 'with_skill' ? 'With skill' : 'Without skill'} answer (${esc(stat(d.timing))})</summary><pre>${esc(d.answer)}</pre></details>`).join('\n');
  return `<section><h2>${gi + 1}. ${esc(g.title)}</h2><p class="prompt"><strong>Prompt:</strong> ${esc(g.prompt)}</p><p class="mut">${esc(g.base)}</p>
<div class="wrap"><table><thead><tr><th scope="col">Assertion</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>${details}</section>`;
}).join('\n');

const latest = bench.latest_per_skill.map((r) => `<tr><th scope="row">${r.skill}</th><td>${r.with}</td><td>${r.without}</td><td>${r.delta_pts >= 0 ? '+' : ''}${r.delta_pts} pts</td></tr>`).join('\n');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>H8 review, iteration 2</title>
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--mut:#6b655c;--line:#d9d3c7;--ok:#1b6b3a;--no:#9b2c1f;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#ece7de;--mut:#a39b8d;--line:#3a352d;--ok:#6fcf8f;--no:#ff9b8c;--card:#1f1c18}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;max-width:1100px;margin-inline:auto}
h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:2.2rem}table{border-collapse:collapse;width:100%;background:var(--card);font-size:.9rem}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}.ok{color:var(--ok);font-weight:700}.no{color:var(--no);font-weight:700}
.ev{color:var(--mut);font-size:.82rem;margin-top:2px}.mut{color:var(--mut)}.prompt{background:var(--card);border-left:4px solid var(--line);padding:8px 12px}
details{margin:8px 0;border:1px solid var(--line);background:var(--card);border-radius:6px}summary{padding:8px 12px;cursor:pointer}
pre{white-space:pre-wrap;word-wrap:break-word;margin:0;padding:12px;font:.85rem/1.5 ui-monospace,Consolas,monospace;border-top:1px solid var(--line)}
@media (max-width:700px){.wrap{overflow-x:auto}}
</style></head><body><main>
<h1>H8 review, iteration 2: the three revised skills, headless</h1>
<p>Seven fresh headless sessions (Sonnet, effort medium) from a local merge of #148, #149 and #150. Cost ${bench.total_cost_usd} USD. Every figure is one run.</p>
<h2>Latest evidence per skill (iteration 1 where iteration 2 did not re-run an eval)</h2>
<div class="wrap"><table><thead><tr><th scope="col">Skill</th><th scope="col">With</th><th scope="col">Without</th><th scope="col">Delta</th></tr></thead><tbody>${latest}</tbody></table></div>
${sections}
</main></body></html>`;
fs.writeFileSync(`${ws}/review-iteration-2.html`, html);
console.log('review-iteration-2.html', html.length);
