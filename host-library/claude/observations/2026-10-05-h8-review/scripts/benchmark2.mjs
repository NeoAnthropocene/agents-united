import fs from 'fs';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const rd = (p) => JSON.parse(fs.readFileSync(`${ws}/${p}`, 'utf8'));
const A1 = rd('assertions.json');
const A2 = rd('assertions-iter2.json');
const G2 = rd('grade-iter2.json');
const spec = {
  'seo1-with': { skill: 'seo-audit', eval: 1, cfg: 'with_skill', asserts: A2['seo1-fixture'], note: 'eval 1 now audits the fixture site (new prompt)' },
  'seo1-without': { skill: 'seo-audit', eval: 1, cfg: 'without_skill', asserts: A2['seo1-fixture'], note: 'skill folder removed from the scratch project; technical-seo-audit still installed' },
  'seo2-with': { skill: 'seo-audit', eval: 2, cfg: 'with_skill', asserts: A1['12'], note: 'tuned description; the skill was not loaded' },
  'a11y2-with': { skill: 'accessibility-audit', eval: 2, cfg: 'with_skill', asserts: A1['10'], note: 'tuned description; the skill was not loaded' },
  'funnel1-with': { skill: 'conversion-funnel-optimization', eval: 1, cfg: 'with_skill', asserts: A1['5'], note: 'report shape inline; a site/ folder of another product was in the project' },
  'funnel2-with': { skill: 'conversion-funnel-optimization', eval: 2, cfg: 'with_skill', asserts: A1['6'], note: 'report shape inline; a site/ folder of another product was in the project' },
  'funnel4-with': { skill: 'conversion-funnel-optimization', eval: 4, cfg: 'with_skill', asserts: A2['funnel4-fixture'], note: 'new eval 4 on the fixture course site' },
  'funnel4-without': { skill: 'conversion-funnel-optimization', eval: 4, cfg: 'without_skill', asserts: A2['funnel4-fixture'], note: 'skill folder removed; ab-test-setup and responsive-design-audit loaded instead' },
  'funnel2-without': { skill: 'conversion-funnel-optimization', eval: 2, cfg: 'without_skill', asserts: A1['6'], note: 'clean baseline: skill folder removed, no read of its files' },
};

const runs = {};
for (const [label, s] of Object.entries(spec)) {
  const meta = rd(`runs-iter2/${label}.meta.json`);
  const g = G2[label];
  if (g.length !== s.asserts.length) throw new Error(`${label}: ${g.length} grades for ${s.asserts.length} assertions`);
  const items = s.asserts.map((text, i) => ({ text, passed: !!g[i][0], evidence: g[i][1] }));
  const passed = items.filter((x) => x.passed).length;
  const dir = `${ws}/iteration-2/${s.skill}/eval-${s.eval}/${s.cfg}`;
  fs.mkdirSync(`${dir}/outputs`, { recursive: true });
  fs.copyFileSync(`${ws}/runs-iter2/${label}.answer.md`, `${dir}/outputs/answer.md`);
  fs.writeFileSync(`${dir}/grading.json`, JSON.stringify({ eval_id: s.eval, skill: s.skill, configuration: s.cfg, session: meta.session, note: s.note, assertion_results: items, summary: { passed, failed: items.length - passed, total: items.length, pass_rate: Number((passed / items.length).toFixed(3)) } }, null, 1));
  fs.writeFileSync(`${dir}/timing.json`, JSON.stringify({ total_tokens: meta.in + meta.out + meta.cache_read + meta.cache_create, output_tokens: meta.out, duration_ms: Math.round(meta.wall_s * 1000), cost_usd: meta.cost_usd, skill_calls_loaded: meta.skillCalls, skill_calls_refused: meta.skillRefused, mode: 'headless claude -p, sonnet, effort medium' }, null, 1));
  runs[label] = { ...s, passed, total: items.length, cost: meta.cost_usd, out: meta.out, wall: meta.wall_s, loaded: meta.skillCalls };
}

// Latest evidence per skill: iteration 1 for everything the second iteration did not re-run.
const it1 = rd('iteration-1/benchmark.json');
const g1 = {}; // skill -> eval id -> {with:[p,t], without:[p,t]}
for (const skill of Object.keys(it1.per_skill)) {
  g1[skill] = {};
  for (const id of [1, 2]) {
    for (const cfg of ['with_skill', 'without_skill']) {
      const gr = rd(`iteration-1/${skill}/eval-${id}/${cfg}/grading.json`);
      (g1[skill][id] ??= {})[cfg] = [gr.summary.passed, gr.summary.total];
    }
  }
}
const latest = JSON.parse(JSON.stringify(g1));
latest['conversion-funnel-optimization'][4] = {};
for (const r of Object.values(runs)) latest[r.skill][r.eval][r.cfg] = [r.passed, r.total];
const rows = [];
for (const [skill, evs] of Object.entries(latest)) {
  const sum = (cfg) => Object.values(evs).reduce((a, e) => [a[0] + e[cfg][0], a[1] + e[cfg][1]], [0, 0]);
  const w = sum('with_skill'); const o = sum('without_skill');
  rows.push({ skill, with: `${w[0]}/${w[1]}`, without: `${o[0]}/${o[1]}`, delta_pts: Math.round((w[0] / w[1] - o[0] / o[1]) * 100) });
}
const total = fs.readdirSync(`${ws}/runs-iter2`).filter((f) => f.endsWith('.meta.json')).reduce((a, f) => a + rd(`runs-iter2/${f}`).cost_usd, 0);
fs.writeFileSync(`${ws}/iteration-2/benchmark.json`, JSON.stringify({ iteration: 2, date: '2026-10-05', mode: 'headless claude -p on the subscription, sonnet, effort medium, built from the combined local branch of the three pull requests', total_cost_usd: Number(total.toFixed(4)), runs, latest_per_skill: rows }, null, 1));
for (const [l, r] of Object.entries(runs)) console.log(l.padEnd(16), `${r.passed}/${r.total}`, 'loaded:', r.loaded.join(',') || 'none', '| out', r.out, '| s', r.wall, '| usd', r.cost.toFixed(4));
console.log('total iteration-2 cost', total.toFixed(4));
console.table(rows);
