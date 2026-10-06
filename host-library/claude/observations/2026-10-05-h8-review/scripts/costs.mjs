import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const ws = 'C:/github/scratch-pilot/h8-workspace';
const project = path.join(os.homedir(), '.claude/projects/C--github-scratch-pilot-h8-skills');
const rows = [];
for (const cfg of ['with', 'without']) {
  const dir = `${ws}/runs-${cfg}`;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.meta.json')).sort()) {
    const meta = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    const out = execFileSync('npm', ['run', '-s', 'hostlib:session', '--', meta.session, '--project', project], {
      cwd: 'C:/github/agents-united',
      encoding: 'utf8',
      shell: true,
    });
    const m = out.match(/^cost ([0-9.]+) USD/m);
    meta.cost_usd = m ? Number(m[1]) : null;
    fs.writeFileSync(`${dir}/${f}`, JSON.stringify(meta, null, 1));
    rows.push({ cfg, n: meta.n, cost: meta.cost_usd });
  }
}
const sum = (c) => rows.filter((r) => r.cfg === c).reduce((a, r) => a + (r.cost ?? 0), 0);
for (const r of rows) console.log(r.cfg, r.n, r.cost);
console.log('TOTAL with', sum('with').toFixed(4), 'without', sum('without').toFixed(4));
