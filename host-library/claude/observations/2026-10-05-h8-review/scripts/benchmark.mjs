import fs from 'fs';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const evals = JSON.parse(fs.readFileSync(`${ws}/evals-first-two.json`, 'utf8'));
const assertions = JSON.parse(fs.readFileSync(`${ws}/assertions.json`, 'utf8'));
const grades = {
  with_skill: JSON.parse(fs.readFileSync(`${ws}/grade-with.json`, 'utf8')),
  without_skill: JSON.parse(fs.readFileSync(`${ws}/grade-without.json`, 'utf8')),
};
const cfgDir = { with_skill: 'with', without_skill: 'without' };
const pad = (n) => String(n).padStart(2, '0');
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => (xs.length < 2 ? 0 : Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)) * xs.length / (xs.length - 1)));
const r = (x, d = 3) => Number(x.toFixed(d));

const runs = [];
for (const ev of evals) {
  for (const cfg of ['with_skill', 'without_skill']) {
    const base = `${ws}/runs-${cfgDir[cfg]}/${pad(ev.n)}-${ev.skill}`;
    const meta = JSON.parse(fs.readFileSync(`${base}.meta.json`, 'utf8'));
    const g = grades[cfg][ev.n];
    const items = assertions[ev.n].map((text, i) => ({ text, passed: !!g[i][0], evidence: g[i][1] }));
    const passed = items.filter((x) => x.passed).length;
    const total = meta.in + meta.out + meta.cache_read + meta.cache_create;
    const dir = `${ws}/iteration-1/${ev.skill}/eval-${ev.id}/${cfg}`;
    fs.mkdirSync(`${dir}/outputs`, { recursive: true });
    fs.copyFileSync(`${base}.answer.md`, `${dir}/outputs/answer.md`);
    fs.writeFileSync(`${dir}/grading.json`, JSON.stringify({
      eval_id: ev.id, skill: ev.skill, configuration: cfg, session: meta.session,
      assertion_results: items,
      summary: { passed, failed: items.length - passed, total: items.length, pass_rate: r(passed / items.length) },
      notes: ev.skill === 'conversion-funnel-optimization' && ev.id === 2 && cfg === 'without_skill'
        ? 'Contaminated: the role read the disabled skill\'s examples/worked-example.md (the override blocks invocation, not reads).' : undefined,
    }, null, 1));
    fs.writeFileSync(`${dir}/timing.json`, JSON.stringify({
      total_tokens: total, output_tokens: meta.out, cache_read_tokens: meta.cache_read,
      duration_ms: Math.round(meta.wall_s * 1000), cost_usd: meta.cost_usd,
      skill_calls_loaded: meta.skillCalls, skill_calls_refused: meta.skillRefused,
    }, null, 1));
    runs.push({ skill: ev.skill, id: ev.id, n: ev.n, cfg, passed, total: items.length, out: meta.out, tokens: total, wall: meta.wall_s, cost: meta.cost_usd, loaded: meta.skillCalls, items });
  }
}

const agg = (rs) => {
  const rates = rs.map((x) => x.passed / x.total);
  return {
    pass_rate: { mean: r(mean(rates)), stddev: r(sd(rates)), assertions: `${rs.reduce((a, x) => a + x.passed, 0)}/${rs.reduce((a, x) => a + x.total, 0)}` },
    time_seconds: { mean: r(mean(rs.map((x) => x.wall)), 1), stddev: r(sd(rs.map((x) => x.wall)), 1) },
    output_tokens: { mean: Math.round(mean(rs.map((x) => x.out))), stddev: Math.round(sd(rs.map((x) => x.out))) },
    total_tokens: { mean: Math.round(mean(rs.map((x) => x.tokens))), stddev: Math.round(sd(rs.map((x) => x.tokens))) },
    cost_usd: { mean: r(mean(rs.map((x) => x.cost)), 4), total: r(rs.reduce((a, x) => a + x.cost, 0), 4) },
  };
};
const delta = (a, b) => ({
  pass_rate: r(a.pass_rate.mean - b.pass_rate.mean),
  time_seconds: r(a.time_seconds.mean - b.time_seconds.mean, 1),
  output_tokens: a.output_tokens.mean - b.output_tokens.mean,
  total_tokens: a.total_tokens.mean - b.total_tokens.mean,
  cost_usd: r(a.cost_usd.mean - b.cost_usd.mean, 4),
});

const out = { iteration: 1, date: '2026-10-05', model: 'sonnet (claude-sonnet-5-5), effort medium', per_skill: {}, both_pass: {}, both_fail: {} };
for (const skill of [...new Set(evals.map((e) => e.skill))]) {
  const w = agg(runs.filter((x) => x.skill === skill && x.cfg === 'with_skill'));
  const o = agg(runs.filter((x) => x.skill === skill && x.cfg === 'without_skill'));
  out.per_skill[skill] = { with_skill: w, without_skill: o, delta: delta(w, o) };
  out.both_pass[skill] = []; out.both_fail[skill] = [];
  for (const ev of evals.filter((e) => e.skill === skill)) {
    const a = runs.find((x) => x.n === ev.n && x.cfg === 'with_skill');
    const b = runs.find((x) => x.n === ev.n && x.cfg === 'without_skill');
    a.items.forEach((it, i) => {
      const label = `eval ${ev.id}: ${it.text}`;
      if (it.passed && b.items[i].passed) out.both_pass[skill].push(label);
      if (!it.passed && !b.items[i].passed) out.both_fail[skill].push(label);
    });
  }
}
const W = agg(runs.filter((x) => x.cfg === 'with_skill'));
const O = agg(runs.filter((x) => x.cfg === 'without_skill'));
out.run_summary = { with_skill: W, without_skill: O, delta: delta(W, O) };
fs.writeFileSync(`${ws}/iteration-1/benchmark.json`, JSON.stringify(out, null, 1));

const f = (x) => (x >= 0 ? '+' : '') + x;
console.log('skill | with pass | without pass | delta pass | out tok w/wo | cost w/wo | time w/wo');
for (const [s, v] of Object.entries(out.per_skill)) {
  console.log(`${s} | ${v.with_skill.pass_rate.assertions} (${v.with_skill.pass_rate.mean}) | ${v.without_skill.pass_rate.assertions} (${v.without_skill.pass_rate.mean}) | ${f(v.delta.pass_rate)} | ${v.with_skill.output_tokens.mean}/${v.without_skill.output_tokens.mean} | ${v.with_skill.cost_usd.total}/${v.without_skill.cost_usd.total} | ${v.with_skill.time_seconds.mean}/${v.without_skill.time_seconds.mean}`);
}
console.log('ALL', JSON.stringify(out.run_summary.with_skill.pass_rate), JSON.stringify(out.run_summary.without_skill.pass_rate), JSON.stringify(out.run_summary.delta));
console.log('both_pass counts', Object.entries(out.both_pass).map(([k, v]) => `${k}:${v.length}`).join(' '));
console.log('both_fail counts', Object.entries(out.both_fail).map(([k, v]) => `${k}:${v.length}`).join(' '));
