import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import * as remotion from '../registry/skills/remotion-production/scripts/project.mjs';
import { defaultPreferences, timelineFingerprint } from '../registry/skills/audiovisual-review/scripts/review.mjs';

const timeline = {schemaVersion:1,revision:'r1',fps:60,totalFrames:120,width:1920,height:1080,
  scenes:[{id:'first',startFrame:0,endFrame:60},{id:'last',startFrame:60,endFrame:120}],cues:[]};
const metadata = () => ({id:'AgencyMotion',durationInFrames:120,fps:60,width:1920,height:1080,props:{}});
const put = (root,file,value) => fs.writeFile(path.join(root,file),JSON.stringify(value));
const read = async (root,file) => JSON.parse(await fs.readFile(path.join(root,file),'utf8'));

async function fixture(audio = true) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'remotion pipeline '));
  await fs.mkdir(path.join(root,'media'));
  await put(root,'media/project.json',defaultPreferences('remotion','local',false,0));
  await put(root,'media/timeline.json',timeline);
  // Truthful scope for isolated tests only; no human, commercial or entitlement claim.
  await put(root,'media/remotion-license.json',{schemaVersion:1,remotionVersion:remotion.REMOTION_VERSION,status:'evaluation',
    purpose:'evaluation',reviewedOn:'2026-10-24',reviewedBy:'Automated Node unit-test harness',
    reviewerRole:'automated-evaluation',entity:'Isolated temporary unit-test fixture',
    evaluationScope:'internal-suitability-test',basis:'Internal noncommercial suitability test with fake IO/runtime.',
    evidence:'This test file; no browser or actual media renderer is invoked.',commercialUse:false,licenseUrl:remotion.LICENSE_URL});
  const options={browserExecutable:process.execPath}; // Only statted; fake browser never executes it.
  if(audio) {
    await fs.mkdir(path.join(root,'audio'));
    await fs.writeFile(path.join(root,'audio/master.wav'),'TEST BYTES: not decoded audio');
    await put(root,'audio/manifest.json',{schemaVersion:1,timelineRevision:'r1',timelineFingerprint:timelineFingerprint(timeline),
      fps:60,totalFrames:120,sampleRate:48000,channels:2,master:'audio/master.wav',stems:[],cues:[],
      measurements:{scope:'master',integratedLufs:-16,truePeakDbtp:-1.2},provenance:[]});
    options.audioManifest='audio/manifest.json';
  }
  await remotion.scaffold(root,options);
  return {root,options,clean:()=>fs.rm(root,{recursive:true,force:true})};
}

function fakeRuntime({composition=metadata(),failMedia=false}={}) {
  const calls={load:0,bundle:[],open:[],select:[],media:[],stills:[],close:0};
  const browser={close:async()=>{calls.close++;}};
  const runtime={
    bundle:async options=>{calls.bundle.push(options);await fs.mkdir(options.outDir);return options.outDir;},
    openBrowser:async (...args)=>{calls.open.push(args);return browser;},
    selectComposition:async options=>{calls.select.push(options);return {...composition,props:options.inputProps};},
    renderMedia:async options=>{calls.media.push(options);await fs.writeFile(options.outputLocation,'fake mp4 bytes');if(failMedia)throw new Error('Fake encoding failure');},
    renderStill:async options=>{calls.stills.push(options);await fs.writeFile(options.output,`fake PNG frame ${options.frame}`);},
  };
  return {calls,loader:async()=>{calls.load++;return runtime;}};
}

test('public render pipeline preserves editable parameters, requests H264/AAC, writes PNGs/evidence and closes its browser',async()=>{
  const f=await fixture();const fake=fakeRuntime();
  try {
    const props=await read(f.root,'media/remotion/input-props.json');props.sceneText.first='Edited scene copy';props.theme.accent='#ffff00';
    await put(f.root,'media/remotion/input-props.json',props);
    const report=await remotion.render(f.root,{...f.options,runtimeLoader:fake.loader});
    assert.equal(fake.calls.bundle.length,1);assert.equal(fake.calls.open.length,1);assert.equal(fake.calls.close,1);
    assert.equal(fake.calls.media.length,1);assert.equal(fake.calls.media[0].inputProps.sceneText.first,'Edited scene copy');
    assert.equal(fake.calls.media[0].inputProps.theme.accent,'#ffff00');
    assert.equal(fake.calls.media[0].codec,'h264');assert.equal(fake.calls.media[0].audioCodec,'aac');
    assert.equal(fake.calls.media[0].sampleRate,48000);assert.equal(fake.calls.media[0].pixelFormat,'yuv420p');
    assert.equal(fake.calls.media[0].overwrite,false);assert.equal(fake.calls.media[0].enforceAudioTrack,true);
    assert.deepEqual(fake.calls.stills.map(row=>row.frame),[0,60,119]);
    assert.ok(fake.calls.stills.every(row=>row.imageFormat==='png'));
    assert.equal(report.timelineFingerprint,timelineFingerprint(timeline));
    assert.equal(report.entitlementVerified,false);assert.equal(report.productionAuthorized,false);
    assert.equal(report.encodedInspection,'unverified');
    assert.equal(report.mode,'full-export');assert.deepEqual(report.frameRange,[0,119]);
    assert.equal(report.expectedFrames,120);assert.equal(report.expectedDurationSeconds,2);
    const saved=await read(f.root,'media/remotion/out/render-evidence.json');
    assert.equal(saved.composition.durationInFrames,120);assert.equal(saved.artifacts.length,4);
    assert.ok(saved.artifacts.every(row=>/^sha256:[a-f0-9]{64}$/.test(row.sha256)));
  } finally {await f.clean();}
});

test('missing/stale/conflicting canonical inputs and snapshots fail before runtime work or output creation',async()=>{
  const mutations=[
    root=>fs.unlink(path.join(root,'media/remotion/input-props.json')),
    root=>fs.unlink(path.join(root,'media/remotion/scaffold-provenance.json')),
    root=>put(root,'media/timeline.json',{...timeline,revision:'r2'}),
    async root=>{const p=await read(root,'media/remotion/input-props.json');p.timeline.fps=30;await put(root,'media/remotion/input-props.json',p);},
    async root=>{const p=await read(root,'media/remotion/input-props.json');p.timelineFingerprint='sha256:stale';await put(root,'media/remotion/input-props.json',p);},
    root=>put(root,'media/project.json',{...defaultPreferences('remotion','local',false,0),renderer:'native'}),
    root=>fs.unlink(path.join(root,'media/remotion-license.json')),
    async root=>{const p=await read(root,'media/remotion/input-props.json');p.audioSrc=null;await put(root,'media/remotion/input-props.json',p);},
  ];
  for(const mutate of mutations){const f=await fixture();const fake=fakeRuntime();try{
    await mutate(f.root);
    await assert.rejects(remotion.render(f.root,{...f.options,runtimeLoader:fake.loader}),/snapshot|provenance|input|timeline|license|renderer|audio/i);
    assert.equal(fake.calls.load,0);assert.equal(fake.calls.media.length,0);
    await assert.rejects(fs.stat(path.join(f.root,'media/remotion/out')),/ENOENT/);
  }finally{await f.clean();}}
});

test('reviewed version or runtime declaration changes during setup reject encoding', async () => {
  for (const target of ['license', 'package']) {
    const f = await fixture(false); const fake = fakeRuntime();
    try {
      const loader = async (_directory, version) => {
        assert.equal(version, '4.0.541');
        if (target === 'license') {
          const record = await read(f.root,'media/remotion-license.json');
          record.remotionVersion = '4.0.539';
          record.licenseUrl = 'https://github.com/remotion-dev/remotion/blob/v4.0.539/LICENSE.md';
          await put(f.root,'media/remotion-license.json',record);
        } else {
          const pkg = await read(f.root,'media/remotion/package.json');
          pkg.dependencies.remotion = '4.0.539';
          await put(f.root,'media/remotion/package.json',pkg);
        }
        return fake.loader();
      };
      await assert.rejects(remotion.render(f.root,{...f.options,runtimeLoader:loader}), /changed|pin|version/i);
      assert.equal(fake.calls.media.length, 0);
      assert.equal(fake.calls.close, 1);
    } finally { await f.clean(); }
  }
});

test('optional dev dependency Remotion packages must align with the reviewed version', async () => {
  const f = await fixture(false); const directory = path.join(f.root,'media/remotion');
  try {
    const pkg = await read(f.root,'media/remotion/package.json');
    pkg.devDependencies = {'@remotion/google-fonts':'4.0.539'};
    await put(directory,'package.json',pkg);
    await fakePackages(directory);
    await assert.rejects(remotion.loadProjectRuntime(directory, '4.0.540'), /pin/i);
  } finally { await f.clean(); }
});

test('changed manifest/master/copied audio or omitted canonical handoff cannot silently render',async()=>{
  const mutations=[
    root=>fs.appendFile(path.join(root,'audio/manifest.json'),'\n'),
    root=>fs.appendFile(path.join(root,'audio/master.wav'),' changed'),
    root=>fs.appendFile(path.join(root,'media/remotion/public/audio/master.wav'),' changed'),
  ];
  for(const mutate of mutations){const f=await fixture();const fake=fakeRuntime();try{
    await mutate(f.root);
    await assert.rejects(remotion.render(f.root,{...f.options,runtimeLoader:fake.loader}),/audio|snapshot|provenance/i);
    assert.equal(fake.calls.load,0);assert.equal(fake.calls.media.length,0);
  }finally{await f.clean();}}
  const f=await fixture();const fake=fakeRuntime();try{
    await assert.rejects(remotion.render(f.root,{browserExecutable:process.execPath,runtimeLoader:fake.loader}),/audio|snapshot/i);
    assert.equal(fake.calls.load,0);
  }finally{await f.clean();}
});

test('actual selected duration/fps/width/height disagreement rejects encoding and still rendering',async()=>{
  for(const key of ['durationInFrames','fps','width','height']){const f=await fixture(false);const fake=fakeRuntime({composition:{...metadata(),[key]:metadata()[key]+1}});try{
    await assert.rejects(remotion.render(f.root,{...f.options,runtimeLoader:fake.loader}),/metadata|composition/i);
    assert.equal(fake.calls.media.length,0);assert.equal(fake.calls.stills.length,0);assert.equal(fake.calls.close,1);
    assert.equal((await read(f.root,'media/remotion/out/render-failure.json')).stage,'metadata');
  }finally{await f.clean();}}
});

test('failed runtime keeps exclusive partial output intact and later attempts cannot replace it',async()=>{
  const f=await fixture(false);const fake=fakeRuntime({failMedia:true});try{
    await assert.rejects(remotion.render(f.root,{...f.options,runtimeLoader:fake.loader}),/render|encod/i);
    const movie=path.join(f.root,'media/remotion/out/video.mp4');
    assert.equal(await fs.readFile(movie,'utf8'),'fake mp4 bytes');assert.equal(fake.calls.close,1);
    const next=fakeRuntime();
    await assert.rejects(remotion.render(f.root,{...f.options,runtimeLoader:next.loader}),/exists/i);
    assert.equal(next.calls.bundle.length,0);assert.equal(await fs.readFile(movie,'utf8'),'fake mp4 bytes');
    assert.equal((await read(f.root,'media/remotion/out/render-failure.json')).stage,'encode');
  }finally{await f.clean();}
});

async function fakePackages(directory, selectedVersion = remotion.REMOTION_VERSION) {
  for(const [name,version] of Object.entries(remotion.dependenciesForVersion(selectedVersion))) {
    const target=path.join(directory,'node_modules',name);await fs.mkdir(target,{recursive:true});
    await put(target,'package.json',{name,version,type:'module',exports:'./index.mjs'});
    await fs.writeFile(path.join(target,'index.mjs'),name==='@remotion/bundler'?'export const bundle=async()=>{};':
      name==='@remotion/renderer'?'export const openBrowser=async()=>{};export const selectComposition=async()=>{};export const renderMedia=async()=>{};export const renderStill=async()=>{};':'export const fixture=true;');
  }
}

test('runtime loader verifies exact installed versions and direct project location instead of ancestor packages',async()=>{
  const f=await fixture(false);const directory=path.join(f.root,'media/remotion');try{
    await fakePackages(directory);
    const runtime=await remotion.loadProjectRuntime(directory);
    assert.equal(typeof runtime.bundle,'function');assert.equal(typeof runtime.renderMedia,'function');
    await assert.rejects(remotion.loadProjectRuntime(directory, '4.0.539'), /pin/i);
    await assert.rejects(remotion.loadProjectRuntime(directory, '4.0.542'), /unsupported/i);
    await put(directory,'node_modules/@remotion/renderer/package.json',{name:'@remotion/renderer',version:'4.0.1',type:'module',exports:'./index.mjs'});
    await assert.rejects(remotion.loadProjectRuntime(directory),/version|pin/i);
    await fs.rm(path.join(directory,'node_modules/@remotion/renderer'),{recursive:true,force:true});
    await fakePackages(f.root); // A valid ancestor copy must not satisfy the missing local package.
    await assert.rejects(remotion.loadProjectRuntime(directory),/local|install|missing/i);
  }finally{await f.clean();}
});

test('legacy 539 and 540 runtimes load only with their matching reviewed project version', async () => {
  for (const version of ['4.0.539', '4.0.540']) {
    const f = await fixture(false); const directory = path.join(f.root,'media/remotion');
    try {
      await put(directory,'package.json',{dependencies:remotion.dependenciesForVersion(version)});
      await fakePackages(directory, version);
      const runtime = await remotion.loadProjectRuntime(directory, version);
      assert.equal(runtime.packages.find(row => row.name === 'remotion').version, version);
      await assert.rejects(remotion.loadProjectRuntime(directory, '4.0.541'), /pin/i);
    } finally { await f.clean(); }
  }
});

test('render CLI rejects a missing explicit existing browser without opening runtime or writing outputs',async()=>{
  const f=await fixture(false);try{
    const result=spawnSync(process.execPath,['registry/skills/remotion-production/scripts/project.mjs','render','--project',f.root],{encoding:'utf8'});
    assert.equal(result.status,2);const report=JSON.parse(result.stdout);assert.equal(report.ok,false);
    assert.ok(report.errors.some(row=>/browser/.test(row.code)));
    await assert.rejects(fs.stat(path.join(f.root,'media/remotion/out')),/ENOENT/);
  }finally{await f.clean();}
});

test('runtime accepts an optional import-only or subpath-only Remotion package', async () => {
  for (const exports of [{'.': {import: './index.mjs'}}, {'./feature': './index.mjs'}]) {
    const f = await fixture(false); const directory = path.join(f.root, 'media/remotion');
    try {
      const pkg = await read(directory, 'package.json');
      pkg.dependencies['@remotion/extra'] = remotion.REMOTION_VERSION;
      await put(directory, 'package.json', pkg);
      await fakePackages(directory);
      const target = path.join(directory, 'node_modules/@remotion/extra');
      await fs.mkdir(target, {recursive:true});
      await put(target, 'package.json', {name:'@remotion/extra', version:remotion.REMOTION_VERSION, type:'module', exports});
      await fs.writeFile(path.join(target, 'index.mjs'), 'throw new Error("optional package must not execute");');
      const runtime = await remotion.loadProjectRuntime(directory);
      assert.equal(runtime.packages.find(row => row.name === '@remotion/extra').version, remotion.REMOTION_VERSION);
      assert.equal(runtime.packages.find(row => row.name === '@remotion/extra').resolution, 'metadata-only');
      assert.equal(runtime.packages.find(row => row.name === '@remotion/bundler').resolution, 'entry');
      assert.equal(typeof runtime.renderMedia, 'function');
    } finally { await f.clean(); }
  }
});

test('optional runtime metadata and resolved entries cannot escape the project package', async () => {
  for (const mode of ['package-escape', 'metadata-escape', 'entry-escape', 'name', 'version', 'missing-api']) {
    const f = await fixture(false); const directory = path.join(f.root, 'media/remotion');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'remotion-outside-'));
    try {
      const pkg = await read(directory, 'package.json');
      pkg.dependencies['@remotion/extra'] = remotion.REMOTION_VERSION;
      await put(directory, 'package.json', pkg);
      await fakePackages(directory);
      const target = path.join(directory, 'node_modules/@remotion/extra');
      await fs.mkdir(target, {recursive:true});
      const meta = {name:'@remotion/extra', version:remotion.REMOTION_VERSION, type:'module', exports:{'./feature':'./index.mjs'}};
      if (mode === 'name') meta.name = '@remotion/other';
      if (mode === 'version') meta.version = '4.0.1';
      await put(target, 'package.json', meta);
      await fs.writeFile(path.join(target, 'index.mjs'), 'export const fixture=true;');
      if (mode === 'package-escape') {
        await put(outside, 'package.json', meta);
        await fs.rm(target, {recursive:true});
        await fs.symlink(outside, target, 'junction');
      }
      if (mode === 'metadata-escape') {
        await put(outside, 'package.json', meta);
        await fs.unlink(path.join(target, 'package.json'));
        await fs.symlink(path.join(outside, 'package.json'), path.join(target, 'package.json'), 'file');
      }
      if (mode === 'entry-escape') {
        meta.exports = './index.mjs'; await put(target, 'package.json', meta);
        await fs.writeFile(path.join(outside, 'index.mjs'), 'export const fixture=true;');
        await fs.unlink(path.join(target, 'index.mjs'));
        await fs.symlink(path.join(outside, 'index.mjs'), path.join(target, 'index.mjs'), 'file');
      }
      if (mode === 'missing-api') await fs.writeFile(path.join(directory,'node_modules/@remotion/renderer/index.mjs'), 'export const renderMedia=async()=>{};');
      const expected = mode === 'name' || mode === 'version' ? 'runtime.version' : mode === 'missing-api' ? 'runtime.api' : 'runtime.local';
      await assert.rejects(remotion.loadProjectRuntime(directory), error => error.errors?.[0]?.code === expected, mode);
    } finally { await f.clean(); await fs.rm(outside, {recursive:true,force:true}); }
  }
});

test('runtime loads CommonJS core entries and rejects unavailable required exports', async () => {
  for (const invalid of [false, true]) {
    const f = await fixture(false); const directory = path.join(f.root, 'media/remotion');
    try {
      await fakePackages(directory);
      const target = path.join(directory, 'node_modules/@remotion/bundler');
      await put(target, 'package.json', {name:'@remotion/bundler', version:remotion.REMOTION_VERSION,
        exports: invalid ? {'./feature':'./index.cjs'} : './index.cjs'});
      await fs.writeFile(path.join(target, 'index.cjs'), 'exports.bundle=async()=>{};');
      if (invalid) await assert.rejects(remotion.loadProjectRuntime(directory), e => e.errors?.[0]?.code === 'runtime.install');
      else assert.equal(typeof (await remotion.loadProjectRuntime(directory)).bundle, 'function');
    } finally { await f.clean(); }
  }
});

test('runtime rejects invalid optional package names', async () => {
  const f = await fixture(false); const directory = path.join(f.root, 'media/remotion');
  try {
    const pkg = await read(directory, 'package.json');
    pkg.dependencies['@remotion/../../escape'] = remotion.REMOTION_VERSION;
    await put(directory, 'package.json', pkg);
    await assert.rejects(remotion.loadProjectRuntime(directory), e => e.errors?.[0]?.code === 'runtime.package');
  } finally { await f.clean(); }
});

test('bounded previews record inclusive frame scope and selected canonical stills', async () => {
  const f=await fixture(false); const fake=fakeRuntime();
  try {
    const report=await remotion.render(f.root,{...f.options,runtimeLoader:fake.loader,frameRange:[20,30],stillFrames:[2,119]});
    assert.deepEqual(fake.calls.media[0].frameRange,[20,30]);
    assert.deepEqual(fake.calls.stills.map(row=>row.frame),[2,119]);
    assert.equal(report.mode,'preview'); assert.deepEqual(report.frameRange,[20,30]);
    assert.equal(report.expectedFrames,11); assert.equal(report.expectedDurationSeconds,11/60);
    assert.equal(report.encodedInspection,'unverified');
    assert.deepEqual(report.artifacts.map(row=>path.basename(row.path)),['video.mp4','frame-000002.png','frame-000119.png']);
    assert.ok(report.artifacts.every(row=>/^sha256:[a-f0-9]{64}$/.test(row.sha256)));
  } finally { await f.clean(); }
});

test('stills-only preview skips encoding and records only selected artifacts', async () => {
  const f=await fixture(false); const fake=fakeRuntime();
  try {
    const report=await remotion.render(f.root,{...f.options,runtimeLoader:fake.loader,stillsOnly:true,stillFrames:[5,90]});
    assert.equal(fake.calls.media.length,0); assert.deepEqual(fake.calls.stills.map(row=>row.frame),[5,90]);
    assert.equal(report.mode,'preview'); assert.equal(report.frameRange,null);
    assert.equal(report.expectedFrames,null); assert.equal(report.expectedDurationSeconds,null);
    assert.equal(report.artifacts.length,2); assert.equal(fake.calls.close,1);
    assert.ok(report.artifacts.every(row=>row.path.endsWith('.png') && /^sha256:[a-f0-9]{64}$/.test(row.sha256)));
  } finally { await f.clean(); }
});

test('invalid preview requests fail before runtime or output reservation', async () => {
  const cases=[{frameRange:[-1,3]},{frameRange:[1.5,3]},{frameRange:[3,2]},{frameRange:[0,120]},
    {frameRange:[NaN,3]},{frameRange:[]},{stillFrames:[]},{stillFrames:[-1]},{stillFrames:[1.5]},
    {stillFrames:[NaN]},{stillFrames:[120]},{stillFrames:[2,2]},{stillsOnly:true,frameRange:[0,2]},
    {stillsOnly:'true'}];
  for(const options of cases){const f=await fixture(false);const fake=fakeRuntime();try{
    await assert.rejects(remotion.render(f.root,{...f.options,...options,runtimeLoader:fake.loader}), /render\.scope/);
    assert.equal(fake.calls.load,0);await assert.rejects(fs.stat(path.join(f.root,'media/remotion/out')),/ENOENT/);
  }finally{await f.clean();}}
});

test('preview CLI parses its value flags and rejects malformed or conflicting scopes', async () => {
  const f=await fixture(false);
  try {
    for (const flags of [['--frames','2-x'],['--still-frames','1,,2'],['--stills-only','yes'],
      ['--frames','1-2','--stills-only','true'],['--still-frames','1,1']]) {
      const result=spawnSync(process.execPath,['registry/skills/remotion-production/scripts/project.mjs','render','--project',f.root,...flags],{encoding:'utf8'});
      assert.equal(result.status,2);assert.equal(JSON.parse(result.stdout).errors[0].code,'render.scope');
      await assert.rejects(fs.stat(path.join(f.root,'media/remotion/out')),/ENOENT/);
    }
    const valid=spawnSync(process.execPath,['registry/skills/remotion-production/scripts/project.mjs','render','--project',f.root,
      '--still-frames','1,2','--stills-only','true'],{encoding:'utf8'});
    assert.equal(valid.status,2);assert.equal(JSON.parse(valid.stdout).errors[0].code,'render.browser');
  } finally { await f.clean(); }
});

test('CLI runs through a skill directory junction and imports remain inert', async () => {
  const f=await fixture(false);
  try {
    const link=path.join(f.root,'installed-skill');
    const source=path.resolve('registry/skills/remotion-production');
    await fs.symlink(source,link,'junction');
    const cli=spawnSync(process.execPath,[path.join(link,'scripts/project.mjs'),'--help'],{cwd:f.root,encoding:'utf8'});
    assert.equal(cli.status,0);const report=JSON.parse(cli.stdout);assert.equal(report.ok,true);assert.match(report.help,/preflight/);
    const script=`process.argv[1]='not-a-file'; await import(${JSON.stringify(new URL('../registry/skills/remotion-production/scripts/project.mjs', import.meta.url).href)});`;
    const imported=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:f.root,encoding:'utf8'});
    assert.equal(imported.status,0);assert.equal(imported.stdout,'');
  } finally { await f.clean(); }
});
