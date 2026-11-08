import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
it('prepares supplied original web input and provenance without a runtime',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'3d-web-positive-'));
 try {const ref=path.join(root,'ref'),dest=path.join(root,'kit');
  for(const f of ['media/3d.json','media/provenance.json','media/rights.md','media/used-assets.md','media/budgets.json','media/scene.json','media/timeline.json','media/bottle.glb','media/source/create-bottle.mjs','media/3d-runtime/package.json','media/3d-runtime/package-lock.json',...['three','playwright','playwright-core','gltf-validator'].map(p=>`media/3d-runtime/node_modules/${p}/package.json`)]) {const p=path.join(ref,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,`fixture-${f}`);}
  const cli=path.join(root,'cli.mjs');fs.writeFileSync(cli,'');
  const result=spawnSync(process.execPath,[path.resolve('scripts/prepare-3d-hands-on.mjs'),'--destination',dest,'--cli',cli,'--reference',ref],{encoding:'utf8'});expect(result.status,result.stderr).toBe(0);
  const web=path.join(dest,'eval1-web');for(const f of ['media/bottle.glb','media/rights.md','media/provenance.json','media/budgets.json','media/source/create-bottle.mjs'])expect(fs.readFileSync(path.join(web,f),'utf8'),f).toBe(`fixture-${f}`);
  expect(fs.readFileSync(path.join(web,'media/supplied-copy.txt'),'utf8')).toBe('Original product study\n');
  expect(fs.existsSync(path.join(web,'media/3d-runtime'))).toBe(false);
  const brief=fs.readFileSync(path.join(web,'BRIEF.md'),'utf8');expect(brief).not.toMatch(/no supplied GLB/);expect(brief).toMatch(/personal-private/i);expect(brief).toMatch(/not public or commercial clearance/i);expect(brief).toMatch(/project.local[\s\S]*setup/i);expect(brief).toMatch(/without asking again/i);expect(brief).not.toMatch(/do not install tools/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});




