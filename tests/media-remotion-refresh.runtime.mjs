import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import * as remotion from '../registry/skills/remotion-production/scripts/project.mjs';
import {defaultPreferences,timelineFingerprint} from '../registry/skills/audiovisual-review/scripts/review.mjs';
const put=(root,file,value)=>fs.writeFile(path.join(root,file),JSON.stringify(value));
const get=async(root,file)=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const oldTimeline={schemaVersion:1,revision:'r1',fps:60,totalFrames:60,width:640,height:360,
  scenes:[{id:'keep',startFrame:0,endFrame:30},{id:'remove',startFrame:30,endFrame:60}],cues:[]};
const revised={...oldTimeline,revision:'r2',totalFrames:90,
  scenes:[{id:'keep',startFrame:0,endFrame:45},{id:'new',startFrame:45,endFrame:90}]};
async function handoff(root,timeline,bytes='test-only audio r1'){
  await put(root,'media/timeline.json',timeline);await fs.writeFile(path.join(root,'audio/master.wav'),bytes);
  await put(root,'audio/manifest.json',{schemaVersion:1,timelineRevision:timeline.revision,timelineFingerprint:timelineFingerprint(timeline),
    fps:60,totalFrames:timeline.totalFrames,sampleRate:48000,channels:2,master:'audio/master.wav',stems:[],cues:[],
    measurements:{scope:'master',integratedLufs:-16,truePeakDbtp:-12},provenance:[]});
}
async function fixture(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'remotion refresh '));
  await fs.mkdir(path.join(root,'media'));await fs.mkdir(path.join(root,'audio'));
  const prefs=defaultPreferences('remotion','local',false,0);Object.assign(prefs.output,{width:640,height:360});
  await put(root,'media/project.json',prefs);
  await put(root,'media/remotion-license.json',{schemaVersion:1,remotionVersion:'4.0.538',status:'evaluation',purpose:'evaluation',
    reviewedOn:'2026-10-24',reviewedBy:'Automated Node test harness',reviewerRole:'automated-evaluation',
    evaluationScope:'internal-suitability-test',entity:'Isolated refresh contract fixture',
    basis:'Internal noncommercial suitability tests with illustrative audio bytes; no real render.',
    evidence:'This automated test scope and pinned license evaluation clause.',commercialUse:false,licenseUrl:remotion.LICENSE_URL});
  await handoff(root,oldTimeline);await remotion.scaffold(root,{audioManifest:'audio/manifest.json'});
  return {root,options:{audioManifest:'audio/manifest.json',approvedRevision:'r2'},clean:()=>fs.rm(root,{recursive:true,force:true})};
}
test('explicit approved refresh preserves customized source/dependencies/outputs and retains valid choices',async()=>{
  const f=await fixture();try{
    const preserved={'Composition.jsx':'// customized React source stays byte-for-byte\n','package-lock.json':'custom lock bytes',
      'node_modules/keep.txt':'installed dependency marker','out/video.mp4':'previous render','out/render-evidence.json':'previous evidence'};
    for(const [file,bytes] of Object.entries(preserved)){await fs.mkdir(path.dirname(path.join(f.root,'media/remotion',file)),{recursive:true});await fs.writeFile(path.join(f.root,'media/remotion',file),bytes);}
    const packageBytes=await fs.readFile(path.join(f.root,'media/remotion/package.json'));
    const props=await get(f.root,'media/remotion/input-props.json');props.sceneText.keep='Retained copy';props.theme.accent='#ffaa00';props.customChoice={kept:true};
    await put(f.root,'media/remotion/input-props.json',props);
    const oldProps=await fs.readFile(path.join(f.root,'media/remotion/input-props.json'));
    const oldAudio=await fs.readFile(path.join(f.root,'media/remotion/public/audio/master.wav'));
    await handoff(f.root,revised,'test-only revised audio bytes');
    const result=await remotion.refresh(f.root,f.options);
    const next=await get(f.root,'media/remotion/input-props.json');
    assert.deepEqual(next.timeline,revised);assert.equal(next.sceneText.keep,'Retained copy');assert.equal(next.sceneText.new,'Scene new');
    assert.equal(next.sceneText.remove,undefined);assert.deepEqual(next.theme,props.theme);assert.deepEqual(next.customChoice,{kept:true});
    assert.equal(next.timelineFingerprint,timelineFingerprint(revised));assert.notEqual(next.audioSrc,'audio/master.wav');
    assert.equal(await fs.readFile(path.join(f.root,'media/remotion/public',next.audioSrc),'utf8'),'test-only revised audio bytes');
    assert.deepEqual(await fs.readFile(path.join(f.root,'media/remotion/public/audio/master.wav')),oldAudio);
    assert.deepEqual(await fs.readFile(path.join(f.root,result.history,'input-props.json')),oldProps);
    for(const [file,bytes] of Object.entries(preserved))assert.equal(await fs.readFile(path.join(f.root,'media/remotion',file),'utf8'),bytes,file);
    assert.deepEqual(await fs.readFile(path.join(f.root,'media/remotion/package.json')),packageBytes);
    assert.equal(result.productionAuthorized,false);
  }finally{await f.clean();}
});
test('refresh refuses missing/wrong approval, invalid current audio or purpose before writing handoff data',async()=>{
  for(const change of [{approvedRevision:undefined},{approvedRevision:'r1'},{purpose:'production'},{staleAudio:true}]){
    const f=await fixture();try{
      const before=await fs.readFile(path.join(f.root,'media/remotion/input-props.json'));
      await handoff(f.root,revised);
      if(change.staleAudio){const manifest=await get(f.root,'audio/manifest.json');manifest.timelineRevision='r1';await put(f.root,'audio/manifest.json',manifest);}
      await assert.rejects(remotion.refresh(f.root,{...f.options,...change}),/approv|audio|revision|evaluat/i);
      assert.deepEqual(await fs.readFile(path.join(f.root,'media/remotion/input-props.json')),before);
      await assert.rejects(fs.stat(path.join(f.root,'media/remotion/handoff-history')),/ENOENT/);
    }finally{await f.clean();}
  }
});
test('ambiguous manually changed snapshot/audio and escaping history links are refused without replacement',async()=>{
  for(const kind of ['snapshot','audio','history']){
    const f=await fixture();const outside=await fs.mkdtemp(path.join(os.tmpdir(),'remotion refresh outside '));try{
      if(kind==='snapshot'){const props=await get(f.root,'media/remotion/input-props.json');props.timeline.revision='manual';await put(f.root,'media/remotion/input-props.json',props);}
      if(kind==='audio')await fs.writeFile(path.join(f.root,'media/remotion/public/audio/master.wav'),'custom unowned bytes');
      if(kind==='history')await fs.symlink(outside,path.join(f.root,'media/remotion/handoff-history'),process.platform==='win32'?'junction':'dir');
      const before=await fs.readFile(path.join(f.root,'media/remotion/input-props.json'));
      await handoff(f.root,revised);
      await assert.rejects(remotion.refresh(f.root,f.options),/snapshot|audio|history|link|outside|ambiguous/i);
      assert.deepEqual(await fs.readFile(path.join(f.root,'media/remotion/input-props.json')),before);
      assert.deepEqual(await fs.readdir(outside),[]);
    }finally{await f.clean();await fs.rm(outside,{recursive:true,force:true});}
  }
});
test('strict render rejects a new handoff until refresh and accepts its actual revised metadata afterward',async()=>{
  const f=await fixture();let calls=0;try{
    await handoff(f.root,revised,'new test-only audio');
    const runtime={bundle:async o=>{await fs.mkdir(o.outDir);return o.outDir;},openBrowser:async()=>({close:async()=>{}}),
      selectComposition:async o=>({id:'AgencyMotion',fps:60,width:640,height:360,durationInFrames:o.inputProps.timeline.totalFrames}),
      renderMedia:async o=>{calls++;await fs.writeFile(o.outputLocation,'fake revised video');},
      renderStill:async o=>fs.writeFile(o.output,'fake still')};
    const options={...f.options,browserExecutable:process.execPath,runtimeLoader:async()=>runtime};
    await assert.rejects(remotion.render(f.root,options),/snapshot|stale/i);assert.equal(calls,0);
    await remotion.refresh(f.root,f.options);
    const report=await remotion.render(f.root,options);assert.equal(calls,1);assert.equal(report.composition.durationInFrames,90);
    assert.equal(report.timelineFingerprint,timelineFingerprint(revised));
  }finally{await f.clean();}
});
