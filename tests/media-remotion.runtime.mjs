import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { defaultPreferences, timelineFingerprint } from '../registry/skills/audiovisual-review/scripts/review.mjs';

const remotion = await import(pathToFileURL(path.resolve('registry/skills/remotion-production/scripts/project.mjs')));
const release = await import(pathToFileURL(path.resolve('registry/skills/remotion-production/scripts/check-release.mjs')));
const timeline = {schemaVersion:1, revision:'r1', fps:60, totalFrames:120, width:1920, height:1080,
  scenes:[{id:'intro',startFrame:0,endFrame:60},{id:'end',startFrame:60,endFrame:120}], cues:[]};
const preferences = () => defaultPreferences('remotion', 'local', false, 0);
// Illustrative test data only. This is not a real review, entitlement or authorization.
const eligibility = () => ({schemaVersion:1,remotionVersion:'4.0.539',status:'evaluation',purpose:'evaluation',
  reviewedOn:'2026-10-24',reviewedBy:'Illustrative test owner',reviewerRole:'project-owner',
  entity:'Fictional test organization',basis:'Testing suitability only; no commercial use.',
  evidence:'Synthetic unit-test record; no real license entitlement is represented.',commercialUse:false,
  licenseUrl:'https://github.com/remotion-dev/remotion/blob/v4.0.539/LICENSE.md'});

async function fixture(project, {prefs=preferences(),clock=timeline,license=eligibility()} = {}) {
  await fs.mkdir(path.join(project,'media'),{recursive:true});
  await fs.writeFile(path.join(project,'media/timeline.json'),JSON.stringify(clock));
  await fs.writeFile(path.join(project,'media/project.json'),JSON.stringify(prefs));
  if(license) await fs.writeFile(path.join(project,'media/remotion-license.json'),JSON.stringify(license));
}

test('Remotion preflight requires recorded eligibility and pinned matching runtime packages', () => {
  assert.throws(()=>remotion.preflight({renderer:'remotion'}),/licen/i);
  assert.throws(()=>remotion.preflight(preferences(),{status:'assumed-free'}),/licen/i);
  const result=remotion.preflight(preferences(),eligibility());
  assert.equal(result.allowed,true);
  assert.equal(result.entitlementVerified,false);
  assert.equal(result.productionAuthorized,false);
  for(const key of ['reviewedBy','reviewerRole','reviewedOn','entity','basis','evidence','licenseUrl']) {
    const record=eligibility(); delete record[key];
    assert.throws(()=>remotion.preflight(preferences(),record),/licen/i,key);
  }
  assert.throws(()=>remotion.preflight(preferences(),{...eligibility(),reviewedOn:'2026-02-30'}),/licen/i);
  assert.throws(()=>remotion.preflight(preferences(),{...eligibility(),remotionVersion:'4.0.1'}),/licen/i);
  assert.throws(()=>remotion.preflight(preferences(),{...eligibility(),commercialUse:true}),/evaluat/i);
  assert.throws(()=>remotion.preflight(preferences(),eligibility(),{purpose:'production'}),/evaluat/i);
  assert.throws(()=>remotion.preflight({renderer:'remotion'},eligibility()),/preferences/i);
  assert.throws(()=>remotion.preflight({...preferences(),renderer:'native'},eligibility()),/remotion/i);
});

test('production-purpose owner records are checked without claiming verified entitlement or authorizing production', () => {
  for(const status of ['free-license','company-license']) {
    const record={...eligibility(),status,purpose:'production',commercialUse:true,
      basis:'Illustrative test-only production eligibility basis.',evidence:'Fictional evidence reference; no real entitlement.'};
    const result=remotion.preflight(preferences(),record,{purpose:'production'});
    assert.equal(result.allowed,true);
    assert.equal(result.purpose,'production');
    assert.equal(result.entitlementVerified,false);
    assert.equal(result.productionAuthorized,false);
    assert.throws(()=>remotion.preflight(preferences(),{...record,purpose:'evaluation'},{purpose:'production'}),/production/i);
  }
});

test('automated internal suitability evaluation records never authorize production or commercial use', () => {
  // Describes this automated test scope only; it asserts no owner or company facts.
  const record={...eligibility(),reviewerRole:'automated-evaluation',reviewedBy:'Codex (/root)',
    entity:'agents-united isolated internal test project',evaluationScope:'internal-suitability-test',
    basis:'Isolated internal smoke tests to evaluate whether Remotion fits this integration; no commercial use.',
    evidence:'Pinned 4.0.539 LICENSE.md, Free License / Eligibility, noncommercial suitability evaluation.'};
  const result=remotion.preflight(preferences(),record);
  assert.equal(result.allowed,true);
  assert.equal(result.entitlementVerified,false);
  assert.equal(result.productionAuthorized,false);
  for(const change of [{evaluationScope:undefined},{evaluationScope:'client-delivery'},{commercialUse:true},{status:'free-license'},
    {status:'company-license'},{purpose:'production'}]) {
    assert.throws(()=>remotion.preflight(preferences(),{...record,...change}),/license|evaluat/i);
  }
  assert.throws(()=>remotion.preflight(preferences(),record,{purpose:'production'}),/evaluat/i);
});

test('Remotion scaffold keeps dependencies scoped and refuses destructive replacement', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'remotion media '));
  try {
    await fixture(project);
    const original=await fs.readFile(path.join(project,'media/project.json'));
    await remotion.scaffold(project);
    const pkg=JSON.parse(await fs.readFile(path.join(project,'media/remotion/package.json'),'utf8'));
    assert.equal(pkg.dependencies.remotion,pkg.dependencies['@remotion/renderer']);
    assert.equal(pkg.dependencies.remotion,pkg.dependencies['@remotion/bundler']);
    assert.equal(pkg.dependencies.remotion,pkg.dependencies['@remotion/cli']);
    assert.equal(pkg.dependencies.remotion,'4.0.539');
    assert.equal(pkg.scripts.studio,'remotion studio index.jsx');
    assert.match(pkg.dependencies.remotion,/^\d+\.\d+\.\d+$/);
    assert.ok(!pkg.dependencies.playwright);
    await assert.rejects(remotion.scaffold(project),/exists/i);
    assert.match(await fs.readFile(path.join(project,'media/remotion/Composition.jsx'),'utf8'),/useCurrentFrame/);
    assert.deepEqual(await fs.readFile(path.join(project,'media/project.json')),original);
    await assert.rejects(fs.stat(path.join(project,'package.json')),/ENOENT/);
    const props=JSON.parse(await fs.readFile(path.join(project,'media/remotion/input-props.json'),'utf8'));
    assert.deepEqual(props.timeline,timeline);
    assert.equal(props.timelineFingerprint,timelineFingerprint(timeline));
    const {frameState}=await import(pathToFileURL(path.join(project,'media/remotion/frame-state.mjs')));
    assert.deepEqual(frameState(0,60),{opacity:0,translateY:28});
    assert.deepEqual(frameState(12,60),{opacity:1,translateY:0});
    assert.deepEqual(frameState(59,60),frameState(12,60));
    assert.deepEqual(frameState(0,1),{opacity:1,translateY:0});
  } finally { await fs.rm(project,{recursive:true,force:true}); }
});

test('Remotion scaffold rejects invalid shared contracts, missing review and timebase drift before writing', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'remotion contracts '));
  try {
    for(const options of [{license:null},{prefs:{renderer:'remotion'}},{clock:{...timeline,totalFrames:119}},
      {prefs:{...preferences(),output:{...preferences().output,fps:30}}}]) {
      await fs.rm(path.join(project,'media'),{recursive:true,force:true});
      await fixture(project,options);
      await assert.rejects(remotion.scaffold(project),/license|preferences|timeline|timebase/i);
      await assert.rejects(fs.stat(path.join(project,'media/remotion')),/ENOENT/);
    }
  } finally { await fs.rm(project,{recursive:true,force:true}); }
});

test('Remotion audio uses the shared manifest and copies only the validated master for staticFile', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'remotion audio '));
  try {
    await fixture(project);
    await fs.mkdir(path.join(project,'audio'));
    await fs.writeFile(path.join(project,'audio/master.wav'),'illustrative bytes, not decoded audio');
    const manifest={schemaVersion:1,timelineRevision:'r1',timelineFingerprint:timelineFingerprint(timeline),
      fps:60,totalFrames:120,sampleRate:48000,channels:2,master:'audio/master.wav',stems:[],cues:[],
      measurements:{scope:'master',integratedLufs:-16,truePeakDbtp:-1.2},provenance:[]};
    await fs.writeFile(path.join(project,'media/audio.json'),JSON.stringify({...manifest,timelineRevision:'stale'}));
    await assert.rejects(remotion.scaffold(project,{audioManifest:'media/audio.json'}),/audio|revision/i);
    await assert.rejects(fs.stat(path.join(project,'media/remotion')),/ENOENT/);
    await fs.writeFile(path.join(project,'media/audio.json'),JSON.stringify(manifest));
    await remotion.scaffold(project,{audioManifest:'media/audio.json'});
    assert.equal(await fs.readFile(path.join(project,'media/remotion/public/audio/master.wav'),'utf8'),
      'illustrative bytes, not decoded audio');
    const props=JSON.parse(await fs.readFile(path.join(project,'media/remotion/input-props.json'),'utf8'));
    assert.equal(props.audioSrc,'audio/master.wav');
  } finally { await fs.rm(project,{recursive:true,force:true}); }
});

test('Remotion scaffold preserves existing directories and rejects escaping media junctions', async () => {
  const project=await fs.mkdtemp(path.join(os.tmpdir(),'remotion confinement '));
  const outside=await fs.mkdtemp(path.join(os.tmpdir(),'remotion outside '));
  try {
    await fixture(project);
    await fs.mkdir(path.join(project,'media/remotion'));
    await fs.writeFile(path.join(project,'media/remotion/keep.txt'),'keep');
    await assert.rejects(remotion.scaffold(project),/exists/i);
    assert.equal(await fs.readFile(path.join(project,'media/remotion/keep.txt'),'utf8'),'keep');
    await fs.rm(path.join(project,'media'),{recursive:true,force:true});
    await fs.symlink(outside,path.join(project,'media'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(remotion.scaffold(project),/outside|escap/i);
    assert.deepEqual(await fs.readdir(outside),[]);
  } finally {
    await fs.rm(project,{recursive:true,force:true});
    await fs.rm(outside,{recursive:true,force:true});
  }
});

test('release drift checker compares every Remotion runtime package to the pinned release', () => {
  const same = release.compareReleaseVersions('4.0.539', {
    remotion: '4.0.539', '@remotion/bundler': '4.0.539', '@remotion/renderer': '4.0.539', '@remotion/cli': '4.0.539',
  });
  assert.equal(same.upToDate, true);
  assert.deepEqual(same.mismatches, []);
  const drift = release.compareReleaseVersions('4.0.539', {
    remotion: '4.0.540', '@remotion/bundler': '4.0.540', '@remotion/renderer': '4.0.539', '@remotion/cli': '4.0.539',
  });
  assert.equal(drift.upToDate, false);
  assert.deepEqual(drift.mismatches, ['@remotion/bundler', 'remotion']);
});
