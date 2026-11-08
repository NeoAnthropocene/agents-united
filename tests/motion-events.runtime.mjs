import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
const script = path.resolve('registry/skills/audiovisual-review/scripts/motion-events.mjs');
function fixture(fn) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'motion-events-'));
  try {
    mkdirSync(path.join(root, 'media'));
    const timeline = {schemaVersion:1,revision:'r1',fps:30,totalFrames:60,width:1920,height:1080,scenes:[{id:'scene',startFrame:0,endFrame:60}],cues:[{id:'cue',startFrame:10,endFrame:20,kind:'sfx'}]};
    const draft = {events:[{id:'foot-1',frame:12,kind:'footplant',cueId:'cue'}],motionSources:['media/animation.js']};
    const put = (p, x) => writeFileSync(path.join(root,p), typeof x === 'string' ? x : JSON.stringify(x));
    put('media/timeline.json',timeline); put('media/draft.json',draft); put('media/animation.js','picture-v1');
    const run = (...args) => { const p=spawnSync(process.execPath,[script,...args],{encoding:'utf8'}); let report; try { report=JSON.parse(p.stdout); } catch { report={}; } return {status:p.status, report}; };
    const capture = (out='media/events.json') => run('capture','--project',root,'--timeline','media/timeline.json','--input','media/draft.json','--out',out);
    const validate = () => run('validate','--project',root,'--timeline','media/timeline.json','--events','media/events.json');
    fn({root,timeline,draft,put,run,capture,validate});
  } finally { rmSync(root,{recursive:true,force:true}); }
}
test('capture binds actual source bytes and current timeline; validation is read-only',()=>fixture(({root,capture,validate})=>{
  assert.equal(capture().status,0); const file=path.join(root,'media/events.json'); const before=readFileSync(file,'utf8'); const data=JSON.parse(before);
  assert.equal(data.schemaVersion,1); assert.equal(data.timelineRevision,'r1'); assert.equal(data.fps,30); assert.equal(data.totalFrames,60); assert.match(data.timelineFingerprint,/^sha256:[a-f0-9]{64}$/); assert.match(data.motionSources[0].sha256,/^sha256:[a-f0-9]{64}$/); assert.equal(data.frameAccuracy,'unverified'); assert.equal(data.events[0].frame,12);
  assert.equal(validate().status,0); assert.equal(readFileSync(file,'utf8'),before); assert.notEqual(capture().status,0); assert.equal(readFileSync(file,'utf8'),before);
}));
test('stale timeline and changed or missing picture source fail',()=>fixture(({root,timeline,put,capture,validate})=>{
  assert.equal(capture().status,0); timeline.revision='r2'; put('media/timeline.json',timeline); assert.notEqual(validate().status,0); timeline.revision='r1'; timeline.cues[0].startFrame=11; put('media/timeline.json',timeline); assert.notEqual(validate().status,0); timeline.cues[0].startFrame=10; put('media/timeline.json',timeline); put('media/animation.js','picture-v2'); assert.notEqual(validate().status,0); rmSync(path.join(root,'media/animation.js')); assert.notEqual(validate().status,0);
}));
test('strict events, cue linkage, source paths and CLI inputs fail closed',()=>fixture(({root,draft,put,capture,run})=>{
  for(const events of [[{id:'',frame:1,kind:'impact'}],[{id:'a',frame:1,kind:'impact'},{id:'a',frame:2,kind:'impact'}],[{id:'a',frame:60,kind:'impact'}],[{id:'a',frame:1.5,kind:'impact'}],[{id:'a',frame:1,kind:'impact',cueId:'missing'}],[{id:'a',frame:1,kind:'impact',extra:true}]]) { put('media/draft.json',{...draft,events}); assert.notEqual(capture().status,0); }
  put('media/draft.json',{...draft,motionSources:['../outside']}); assert.notEqual(capture().status,0);
  put('media/draft.json',{...draft,motionSources:['media/missing.js']}); assert.notEqual(capture().status,0);
  put('media/draft.json',draft); assert.notEqual(capture('../escape.json').status,0);
  assert.notEqual(run('capture','--project',root,'--timeline','media/timeline.json','--input','media/draft.json','--out','media/events.json','--bogus','x').status,0);
  assert.notEqual(run('validate','--project','relative','--timeline','media/timeline.json','--events','media/events.json').status,0);
}));
test('artifact tampering and symlink escape are rejected',()=>fixture(({root,put,capture,validate})=>{
  assert.equal(capture().status,0); const file=path.join(root,'media/events.json'); const data=JSON.parse(readFileSync(file,'utf8')); data.fps=24; put('media/events.json',data); assert.notEqual(validate().status,0); data.fps=30; data.events[0].id=''; put('media/events.json',data); assert.notEqual(validate().status,0);
  try { symlinkSync(os.tmpdir(),path.join(root,'media/link'),'junction'); } catch { return; }
  put('media/draft.json',{events:[{id:'a',frame:1,kind:'impact'}],motionSources:['media/link/outside.js']}); assert.notEqual(capture('media/other.json').status,0); assert.notEqual(capture('media/link/escape.json').status,0);
}));

test('null timeline and malformed artifacts cannot report success',()=>fixture(({put,capture,validate})=>{
  put('media/timeline.json','null'); assert.notEqual(capture().status,0);
}));
test('output symlink escape is rejected', t=>fixture(({root,capture})=>{
  try { symlinkSync(os.tmpdir(),path.join(root,'media/link'),'junction'); } catch { t.skip('junction creation unavailable'); return; }
  assert.notEqual(capture('media/link/escape-event-sidecar.json').status,0);
}));
test('unknown artifact fields fail without overwriting',()=>fixture(({root,put,capture,validate})=>{
  assert.equal(capture().status,0); const file=path.join(root,'media/events.json'); const data=JSON.parse(readFileSync(file,'utf8')); data.extra='no'; put('media/events.json',data); const before=readFileSync(file,'utf8'); assert.notEqual(validate().status,0); assert.equal(readFileSync(file,'utf8'),before);
}));
test('aliases cannot expose private source or JSON targets', t=>fixture(({root,put,capture,run})=>{
  for (const dir of ['.env']) {
    mkdirSync(path.join(root,dir)); put(dir+'/secret.json',{events:[{id:'a',frame:1,kind:'impact'}],motionSources:['media/animation.js']}); put(dir+'/secret.js','private');
    try { symlinkSync(path.join(root,dir),path.join(root,'media',dir.slice(1)+'-alias'),'junction'); } catch { t.skip('junction creation unavailable'); return; }
    put('media/draft.json',{events:[{id:'a',frame:1,kind:'impact'}],motionSources:['media/'+dir.slice(1)+'-alias/secret.js']}); assert.notEqual(capture().status,0,dir+' source');
    assert.notEqual(run('capture','--project',root,'--timeline','media/timeline.json','--input','media/'+dir.slice(1)+'-alias/secret.json','--out','media/private.json').status,0,dir+' input');
  }
}));
test('works from a standalone installed skill scripts directory',()=>fixture(({root})=>{
  const installed=path.join(root,'installed','scripts'); mkdirSync(installed,{recursive:true});
  for (const name of ['motion-events.mjs','review.mjs']) writeFileSync(path.join(installed,name),readFileSync(path.join(path.dirname(script),name)));
  const result=spawnSync(process.execPath,[path.join(installed,'motion-events.mjs'),'capture','--project',root,'--timeline','media/timeline.json','--input','media/draft.json','--out','media/installed-events.json'],{encoding:'utf8'});
  assert.equal(result.status,0); assert.equal(JSON.parse(result.stdout).frameAccuracy,'unverified');
}));
test('runs via installed skill junction from another working directory', t=>fixture(({root})=>{
  const installed=path.join(root,'installed','scripts'); mkdirSync(installed,{recursive:true});
  for (const name of ['motion-events.mjs','review.mjs']) writeFileSync(path.join(installed,name),readFileSync(path.join(path.dirname(script),name)));
  const alias=path.join(root,'skill-link'); try { symlinkSync(path.join(root,'installed'),alias,'junction'); } catch { t.skip('junction creation unavailable'); return; }
  const result=spawnSync(process.execPath,[path.join(alias,'scripts','motion-events.mjs'),'capture','--project',root,'--timeline','media/timeline.json','--input','media/draft.json','--out','media/junction-events.json'],{encoding:'utf8',cwd:os.tmpdir()});
  assert.equal(result.status,0); assert.equal(JSON.parse(result.stdout).ok,true); assert.equal(JSON.parse(readFileSync(path.join(root,'media/junction-events.json'),'utf8')).frameAccuracy,'unverified');
}));
