import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

it('prepares isolated cold and locked exercises without unknown files, host runs, or overwrite', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '3d hands-on & '));
  try {
    const reference = path.join(root, 'reference'), destination = path.join(root, 'kit');
    for (const file of ['media/3d.json','media/provenance.json','media/rights.md','media/used-assets.md','media/budgets.json','media/scene.json','media/source/create-bottle.mjs','media/timeline.json','media/bottle.glb','media/3d-runtime/package.json','media/3d-runtime/package-lock.json',...['three','playwright','playwright-core','gltf-validator'].map(p=>`media/3d-runtime/node_modules/${p}/package.json`)]) {
      const p = path.join(reference,file); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,'{}');
    }
    fs.writeFileSync(path.join(reference,'media/3d-runtime/.env'),'secret');
    fs.writeFileSync(path.join(reference,'media/3d-runtime/node_modules/three/credentials.json'),'secret');
    fs.writeFileSync(path.join(reference,'media/unrelated.txt'),'unknown');
    const cli=path.join(root,'cli.mjs'); fs.writeFileSync(cli,"import fs from 'node:fs'; fs.appendFileSync('installs.txt', process.argv[3]+'\\n');");
    const script=path.resolve('scripts/prepare-3d-hands-on.mjs');
    const run=(dest:string, ref?:string)=>spawnSync(process.execPath,[script,'--destination',dest,'--cli',cli,...(ref?['--reference',ref]:[])],{encoding:'utf8'});
    const result=run(destination,reference); expect(result.status,result.stderr).toBe(0);
    const web=path.join(destination,'eval1-web'), motion=path.join(destination,'eval2-motion'), negative=path.join(destination,'eval3-negative');
    expect(fs.readFileSync(path.join(web,'installs.txt'),'utf8')).toContain('agency-3d-production');
    expect(fs.readFileSync(path.join(web,'installs.txt'),'utf8')).not.toContain('digital-agency');
    expect(fs.readFileSync(path.join(motion,'installs.txt'),'utf8')).toContain('digital-agency');
    expect(fs.readFileSync(path.join(negative,'installs.txt'),'utf8')).toContain('agency-3d-production');
    expect(fs.existsSync(path.join(web,'media/3d-runtime'))).toBe(false);
    expect(fs.existsSync(path.join(motion,'media/3d-runtime/node_modules/three/package.json'))).toBe(true);
    const brief = fs.readFileSync(path.join(motion,'BRIEF.md'),'utf8');
    expect(brief).toMatch(/personal-private/i);
    expect(brief).toMatch(/jade[\s\S]*brass[\s\S]*white/i);
    expect(brief).not.toMatch(/approved brand tokens/i);
    expect(brief).toMatch(/Motion[\s\S]*validate[\s\S]*Shot Handoff/i);
    expect(brief).toMatch(/\[0,\s*6\)[\s\S]*30\s*fps[\s\S]*hold frame 5[\s\S]*\[6,\s*30\)/i);
    expect(brief).toMatch(/cues.{0,30}empty[\s\S]*add[\s\S]*cue[\s\S]*same revision[\s\S]*restore/i);
    expect(brief).toMatch(/signature frame[\s\S]*preview[\s\S]*(view|watch)/i);
    expect(brief).toMatch(/no new installs/i);
    for(const f of ['media/3d-runtime/.env','media/3d-runtime/node_modules/three/credentials.json','media/unrelated.txt'])expect(fs.existsSync(path.join(motion,f))).toBe(false);
    expect(fs.readFileSync(path.join(negative,'BRIEF.md'),'utf8')).toMatch(/do not download, install or spend/i);
    expect(run(destination,reference).status).not.toBe(0);
    expect(run(path.join(reference,'nested'),reference).status).not.toBe(0);
    const noReference=path.join(root,'no-reference'); expect(run(noReference).status).toBe(0);
    expect(fs.readFileSync(path.join(noReference,'eval2-motion/BRIEF.md'),'utf8')).toMatch(/unverified/i);
    const link=path.join(root,'link');fs.symlinkSync(reference,link,'junction');expect(run(path.join(root,'linked'),link).status).not.toBe(0);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

it.skipIf(!process.env.AGENTS_3D_BUILT_CLI)('installs actual native resources and excludes maintainer evals in a fresh kit', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'3d kit real '));
  try {
    const destination=path.join(root,'kit'); const script=path.resolve('scripts/prepare-3d-hands-on.mjs');
    const result=await promisify(execFile)(process.execPath,[script,'--destination',destination,'--cli',process.env.AGENTS_3D_BUILT_CLI!],{encoding:'utf8',timeout:120000});
    expect(JSON.parse(result.stdout).hostLaunched).toBe(false);
    for(const lane of ['eval1-web','eval2-motion','eval3-negative']) {
      const base=path.join(destination,lane,'.claude/skills');
      expect(fs.existsSync(path.join(base,'3d-asset-review/scripts/inspect-glb.mjs'))).toBe(true);
      expect(fs.existsSync(path.join(base,'threejs-scene-production/scripts/shot-handoff.mjs'))).toBe(true);
      expect(fs.existsSync(path.join(base,'3d-asset-review/evals'))).toBe(false);
    }
    expect(fs.existsSync(path.join(destination,'eval1-web/.claude/agents/orchestrator-digital-agency.md'))).toBe(false);
    expect(fs.existsSync(path.join(destination,'eval2-motion/.claude/agents/orchestrator-digital-agency.md'))).toBe(true);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
},150000);
it('rejects a reference with an incomplete locked runtime before creating the kit',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'3d incomplete '));try{const ref=path.join(root,'ref'),dest=path.join(root,'kit'),cli=path.join(root,'cli.mjs');for(const f of ['media/3d.json','media/provenance.json','media/timeline.json','media/bottle.glb','media/3d-runtime/package.json','media/3d-runtime/package-lock.json']){const p=path.join(ref,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'{}');}fs.writeFileSync(cli,'');const result=spawnSync(process.execPath,[path.resolve('scripts/prepare-3d-hands-on.mjs'),'--destination',dest,'--cli',cli,'--reference',ref]);expect(result.status).not.toBe(0);expect(fs.existsSync(dest)).toBe(false);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

