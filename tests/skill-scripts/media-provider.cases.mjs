import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, rename, symlink, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { prepareMediaSetup, loadProviderCredential, parseProviderResponse, runJob } from '../../registry/skills/mcp-setup/scripts/media-api.mjs';
import { defaultPreferences } from '../../registry/skills/audiovisual-review/scripts/review.mjs';

const preferences = (provider='kie',modality='audio') => ({...defaultPreferences('native',modality==='audio'?'api':'local',modality==='video',5),
  providers:[{provider,model:'selected-by-user',modality,route:'api'}]});
const selectedJob = () => ({id:'shot-1',provider:'kie',modality:'audio',route:'api',approved:true,ceilingUsd:2,
  payload:{model:'selected-by-user',input:{prompt:'approved brand scene'}},output:'media/assets/shot-1.wav'});
const secret='unit-only-private-value';
const signed='https://cdn.example/asset.wav?signature=private-signed-url';
const wav=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVEfmt '),Buffer.alloc(32)]);
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(32)]);
const response=(body,status=200,type='application/json')=>new Response(typeof body==='object'&&!Buffer.isBuffer(body)?JSON.stringify(body):body,{status,headers:{'content-type':type}});
const created=()=>response({code:200,data:{taskId:'task-1'}});
const ready=()=>response({code:200,data:{taskId:'task-1',state:'success',resultJson:JSON.stringify({resultUrls:[signed]})}});
async function fixture(fn,preference=preferences()) {
  const root=await mkdtemp(path.join(os.tmpdir(),'media provider Windows spaces '));
  try {
    await mkdir(path.join(root,'media'));
    await writeFile(path.join(root,'.env'),`KIE_API_KEY=${secret}\nARK_API_KEY=ark-unit-only\nOTHER_SECRET=never-export\n`);
    await writeFile(path.join(root,'media/project.json'),JSON.stringify(preference));
    await fn(root);
  } finally { await rm(root,{recursive:true,force:true}); }
}
const ledger=root=>readFile(path.join(root,'media/jobs/shot-1.json'),'utf8');

test('setup writes example/ignore only, preserves private .env and makes no calls', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'media provider '));
  try {
    await writeFile(path.join(root,'.env'),'KIE_API_KEY=private-test-value\nOTHER_SECRET=never-export\n');
    await prepareMediaSetup(root,'kie');
    assert.match(await readFile(path.join(root,'.env.example'),'utf8'), /KIE_API_KEY=/);
    assert.match(await readFile(path.join(root,'.gitignore'),'utf8'), /\.env/);
    assert.equal(await readFile(path.join(root,'.env'),'utf8'),'KIE_API_KEY=private-test-value\nOTHER_SECRET=never-export\n');
    assert.deepEqual(await loadProviderCredential(root,'kie'),{name:'KIE_API_KEY',value:'private-test-value'});
    await assert.rejects(loadProviderCredential(root,'byteplus'),/missing ARK_API_KEY/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('body errors, unknown statuses and completed-without-output are not HTTP success', () => {
  assert.throws(()=>parseProviderResponse('kie',{code:400,msg:'never print this'},'create'),/provider rejected/);
  assert.deepEqual(parseProviderResponse('kie',{code:200,data:{taskId:'task-1'}},'create'),{status:'submitted',taskId:'task-1'});
  assert.throws(()=>parseProviderResponse('kie',{code:200,data:{state:'success'}},'status'),/output/);
  assert.throws(()=>parseProviderResponse('kie',{code:200,data:{state:'novel'}},'status'),/unknown/);
  assert.deepEqual(parseProviderResponse('byteplus',{id:'ark-1',status:'running'},'status'),{status:'running',taskId:'ark-1'});
  assert.deepEqual(parseProviderResponse('byteplus',{id:'ark-1',status:'failed',error:{message:'secret'}},'status'),{status:'failed',taskId:'ark-1'});
});

test('timeout reserves budget and blocks duplicate paid submission; status preserves job id', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'media provider '));
  try {
    await mkdir(path.join(root,'media'));
    await writeFile(path.join(root,'.env'),'KIE_API_KEY=private-test-value');
    await writeFile(path.join(root,'media','project.json'),JSON.stringify(preferences()));
    const job=selectedJob();
    let calls=0;
    const timeout=async()=>{calls++;throw new Error('private-test-value');};
    const result=await runJob(root,job,'create',{fetch:timeout});
    assert.equal(result.status,'submission-unknown');
    await assert.rejects(runJob(root,job,'create',{fetch:timeout}),/already reserved/);
    assert.equal(calls,1);
    const ledger=await readFile(path.join(root,'media','jobs','shot-1.json'),'utf8');
    assert.doesNotMatch(ledger,/private-test-value|approved brand scene/);
    await assert.rejects(runJob(root,{...job,id:'shot-2',ceilingUsd:4,output:'media/assets/shot-2.wav'},'create',{fetch:timeout}),/budget/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('decline, missing keys, hostile region and credential-bearing payload fail before submission', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'media provider '));
  try {
    await mkdir(path.join(root,'media'));
    await writeFile(path.join(root,'media','project.json'),JSON.stringify({...preferences(),providers:[]}));
    await assert.rejects(runJob(root,selectedJob(),'create'),/selected/);
    await writeFile(path.join(root,'media','project.json'),JSON.stringify(preferences()));
    await assert.rejects(runJob(root,{...selectedJob(),approved:false},'create'),/per-job approval/);
    await assert.rejects(runJob(root,{...selectedJob(),payload:{model:'selected-by-user',api_key:'private'}},'create'),/credential/);
    await assert.rejects(runJob(root,selectedJob(),'create'),/missing KIE_API_KEY/);
    await writeFile(path.join(root,'media','project.json'),JSON.stringify(preferences('byteplus','video')));
    await assert.rejects(runJob(root,{...selectedJob(),provider:'byteplus',modality:'video',regionBaseUrl:'https://attacker.example'},'create'),/region/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('strict preferences, consent, output and payload guards make zero calls',async()=>fixture(async root=>{
  let calls=0;const fetch=async()=>{calls++;throw new Error('must not call');};
  for(const [patch,error] of [
    [{approved:false},/per-job approval/],[{ceilingUsd:0},/job ceiling/],[{route:'mcp'},/selected/],
    [{regionBaseUrl:'https://attacker.example'},/region/],[{payload:{model:'wrong',input:{}}},/selected/],
    [{payload:{model:'selected-by-user',api_key:'private'}},/credential/],
    [{payload:{model:'selected-by-user',input:{text:'Bearer private'}}},/credential/],
    [{output:'../escape.wav'},/output path/],[{output:'.env'},/output path/]
  ]) await assert.rejects(runJob(root,{...selectedJob(),...patch},'create',{fetch}),error);
  await writeFile(path.join(root,'media/project.json'),JSON.stringify({providers:['kie'],mediaBudgetUsd:5}));
  await assert.rejects(runJob(root,selectedJob(),'create',{fetch}),/preferences/);
  assert.equal(calls,0);
}));

test('selected key comes only from private selected-project env; setup is idempotent',async()=>fixture(async root=>{
  const original=await readFile(path.join(root,'.env'),'utf8');
  await prepareMediaSetup(root,'kie');await prepareMediaSetup(root,'kie');
  assert.equal(await readFile(path.join(root,'.env'),'utf8'),original);
  assert.equal((await readFile(path.join(root,'.gitignore'),'utf8')).match(/^\.env$/gm)?.length,1);
  assert.doesNotMatch(await readFile(path.join(root,'.env.example'),'utf8'),/unit-only|OTHER_SECRET/);
  const inherited=process.env.KIE_API_KEY;process.env.KIE_API_KEY='inherited-must-not-be-used';
  try {
    assert.deepEqual(await loadProviderCredential(root,'kie'),{name:'KIE_API_KEY',value:secret});
    await writeFile(path.join(root,'.env'),'OTHER_SECRET=private');
    await assert.rejects(runJob(root,selectedJob(),'create',{fetch:async()=>assert.fail('network')}),/missing KIE_API_KEY/);
  } finally {if(inherited===undefined)delete process.env.KIE_API_KEY;else process.env.KIE_API_KEY=inherited;}
}));

test('all documented task states, body errors and parsed/string output forms',()=>{
  for(const state of ['waiting','queuing','generating']) assert.equal(parseProviderResponse('kie',{code:200,data:{state}},'status').status,state==='generating'?'running':'queued');
  assert.equal(parseProviderResponse('kie',{code:200,data:{state:'fail',failMsg:secret}},'status').status,'failed');
  for(const state of ['queued','running','failed','cancelled','expired']) assert.equal(parseProviderResponse('byteplus',{id:'ark-1',status:state},'status').status,state);
  assert.throws(()=>parseProviderResponse('byteplus',{id:'ark-1',status:'novel'},'status'),/unknown status/);
  assert.throws(()=>parseProviderResponse('byteplus',{id:'ark-1',status:'succeeded'},'status'),/output/);
  assert.throws(()=>parseProviderResponse('kie',{code:200,data:{state:'success',resultJson:'{bad'}},'status'),/output/);
  for(const resultJson of [JSON.stringify({resultUrls:[signed]}),{resultUrls:[signed]}]) assert.equal(parseProviderResponse('kie',{code:200,data:{state:'success',resultJson}},'status').outputs[0],signed);
});

test('KIE create persists identity then downloads local media with zero CDN credentials',async()=>fixture(async root=>{
  const seen=[];const fetch=async(url,options)=>{
    seen.push({url,options});
    if(seen.length===1)return created();
    if(seen.length===2){assert.equal(JSON.parse(await ledger(root)).taskId,'task-1');return ready();}
    assert.equal(url,signed);assert.deepEqual(options.headers,{});assert.equal(options.redirect,'error');
    return response(wav,200,'audio/wav');
  };
  const result=await runJob(root,selectedJob(),'create',{fetch});
  assert.equal(result.status,'completed');assert.equal(result.taskId,'task-1');
  assert.equal(seen[0].url,'https://api.kie.ai/api/v1/jobs/createTask');
  assert.equal(seen[0].options.headers.Authorization,`Bearer ${secret}`);
  assert.equal(seen[1].url,'https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task-1');
  assert.deepEqual(await readFile(path.join(root,selectedJob().output)),wav);
  assert.equal(result.artifacts[0].bytes,wav.length);assert.match(result.artifacts[0].sha256,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result)+await ledger(root),/unit-only|approved brand scene|signature|cdn\.example/);
  await assert.rejects(runJob(root,selectedJob(),'create',{fetch}),/already reserved/);
  assert.equal((await runJob(root,selectedJob(),'status',{fetch:async()=>assert.fail('completed needs no network')})).status,'completed');
}));

test('BytePlus exact regional endpoint produces local video',async()=>fixture(async root=>{
  const job={...selectedJob(),provider:'byteplus',modality:'video',payload:{model:'selected-by-user',content:[{type:'text',text:'brand scene'}]},output:'media/assets/video.mp4'};
  let calls=0;const fetch=async(url,options)=>{
    calls++;
    if(calls===1){assert.equal(url,'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks');return response({id:'ark-1'});}
    if(calls===2){assert.match(url,/tasks\/ark-1$/);assert.equal(options.headers.Authorization,'Bearer ark-unit-only');return response({id:'ark-1',status:'succeeded',content:{video_url:'https://cdn.example/video.mp4?sig=secret'}});}
    assert.deepEqual(options.headers,{});return response(mp4,200,'video/mp4');
  };
  assert.equal((await runJob(root,job,'create',{fetch})).status,'completed');
  assert.deepEqual(await readFile(path.join(root,job.output)),mp4);
},preferences('byteplus','video')));

test('completed CDN URLs cannot echo the selected credential raw or URL-encoded',async()=>{
  for(const value of [secret,[...secret].map(char=>`%${char.charCodeAt(0).toString(16)}`).join('')]) await fixture(async root=>{
    let calls=0;
    const result=await runJob(root,selectedJob(),'create',{fetch:async()=>{
      calls++;
      if(calls===1)return created();
      if(calls===2)return response({code:200,data:{taskId:'task-1',state:'success',resultJson:{resultUrls:[`https://cdn.example/asset.wav?key=${value}`]}}});
      return response(wav,200,'audio/wav');
    }});
    assert.equal(calls,2,'credential-bearing output must be rejected before any CDN request');
    assert.equal(result.status,'download-failed');
    assert.doesNotMatch(JSON.stringify(result)+await ledger(root),/unit-only|cdn\.example|%75/);
    await assert.rejects(readFile(path.join(root,selectedJob().output)),{code:'ENOENT'});
  });
});

test('unknown submission requires manual reconciliation and never resubmits on status',async()=>fixture(async root=>{
  let calls=0;const fetch=async()=>{calls++;throw new Error(secret);};
  const result=await runJob(root,selectedJob(),'create',{fetch});
  assert.equal(result.status,'submission-unknown');assert.match(result.action,/manual.*reconciliation/);
  const resumed=await runJob(root,selectedJob(),'status',{fetch});assert.equal(resumed.status,'submission-unknown');assert.equal(calls,1);
  assert.doesNotMatch(JSON.stringify(resumed)+await ledger(root),/unit-only|approved brand scene/);
}));

test('concurrent different jobs fail busy and cannot race project budget',async()=>fixture(async root=>{
  let release,entered;const gate=new Promise(resolve=>{release=resolve;});const started=new Promise(resolve=>{entered=resolve;});
  const first=runJob(root,selectedJob(),'create',{fetch:async()=>{entered();await gate;throw new Error('timeout');}});
  await started;
  try {await assert.rejects(runJob(root,{...selectedJob(),id:'shot-2',ceilingUsd:4,output:'media/assets/shot-2.wav'},'create'),/busy/);}
  finally{release();}
  assert.equal((await first).status,'submission-unknown');
}));

test('status timeout, pending and failed download resume without paid resubmission',async()=>fixture(async root=>{
  let calls=0;const fetch=async()=>{calls++;if(calls===1)return created();throw new Error(secret);};
  assert.equal((await runJob(root,selectedJob(),'create',{fetch})).status,'status-unavailable');
  assert.equal((await runJob(root,selectedJob(),'status',{fetch:async()=>response({code:200,data:{state:'waiting'}})})).status,'queued');
  assert.equal((await runJob(root,selectedJob(),'status',{fetch:async(url)=>url===signed?response('<html>error</html>',200,'text/html'):ready()})).status,'download-failed');
  assert.equal((await runJob(root,selectedJob(),'status',{fetch:async(url)=>url===signed?response(wav,200,'audio/wav'):ready()})).status,'completed');
  assert.equal(calls,2);assert.doesNotMatch(await ledger(root),/unit-only|signature|cdn\.example/);
}));

test('HTTP/body errors and terminal failures keep reservations and redact error details',async()=>fixture(async root=>{
  assert.equal((await runJob(root,selectedJob(),'create',{fetch:async()=>response({message:secret},401)})).status,'rejected');
  await assert.rejects(runJob(root,selectedJob(),'create'),/already reserved/);
  assert.doesNotMatch(await ledger(root),/unit-only/);
  let calls=0;
  assert.equal((await runJob(root,{...selectedJob(),id:'shot-2',output:'media/assets/shot-2.wav'},'create',{fetch:async()=>++calls===1?created():response({code:200,data:{state:'fail',failMsg:secret}})})).status,'failed');
}));

test('media type/signature/size/redirect guards and no output overwrite',async()=>{
  for(const [body,type,status,options] of [[Buffer.from('{}'),'audio/wav',200,{}],[wav,'text/html',200,{}],[wav,'audio/wav',302,{}],[wav,'audio/wav',200,{maxBytes:8}]]) await fixture(async root=>{
    let calls=0;const result=await runJob(root,selectedJob(),'create',{...options,fetch:async()=>++calls===1?created():calls===2?ready():response(body,status,type)});
    assert.equal(result.status,'download-failed');assert.doesNotMatch(JSON.stringify(result)+await ledger(root),/signature|unit-only/);
    await assert.rejects(readFile(path.join(root,selectedJob().output)),{code:'ENOENT'});
  });
  await fixture(async root=>{
    await mkdir(path.join(root,'media/assets'));await writeFile(path.join(root,selectedJob().output),'original');
    await assert.rejects(runJob(root,selectedJob(),'create',{fetch:async()=>assert.fail('network')}),/output.*exists/i);
    assert.equal(await readFile(path.join(root,selectedJob().output),'utf8'),'original');
  });
});

test('linked preference and output paths cannot escape selected Windows-spaced project',async()=>fixture(async root=>{
  const outside=await mkdtemp(path.join(os.tmpdir(),'media outside '));
  try{
    await symlink(outside,path.join(root,'media/assets'),'junction');
    await assert.rejects(runJob(root,{...selectedJob(),output:'media/assets/escape.wav'},'create',{fetch:async()=>assert.fail('network')}),/link|outside/i);
    await rename(path.join(root,'media'),path.join(root,'original media'));
    await writeFile(path.join(outside,'project.json'),JSON.stringify(preferences()));
    await symlink(outside,path.join(root,'media'),'junction');
    await assert.rejects(runJob(root,selectedJob(),'create'),/preferences|link|outside/);
  }finally{await rm(outside,{recursive:true,force:true});}
}));

test('saved ledger rejects injected response/private fields and hostile status region',async()=>fixture(async root=>{
  await runJob(root,selectedJob(),'create',{fetch:async()=>{throw new Error('timeout');}});
  await assert.rejects(runJob(root,{id:'shot-1',regionBaseUrl:'https://attacker.example'},'status'),/saved.*region/);
  const file=path.join(root,'media/jobs/shot-1.json');const stored=JSON.parse(await readFile(file,'utf8'));
  await writeFile(file,JSON.stringify({...stored,model:'Bearer private',rawResponse:secret}));
  await assert.rejects(runJob(root,{id:'shot-1'},'status'),/reservation is invalid/);
}));

test('pending output path is reserved across different jobs before another paid call',async()=>fixture(async root=>{
  let calls=0;const fetch=async()=>{calls++;throw new Error('timeout');};
  await runJob(root,selectedJob(),'create',{fetch});
  await assert.rejects(runJob(root,{...selectedJob(),id:'shot-2'},'create',{fetch}),/output.*reserved/i);
  assert.equal(calls,1);
}));

test('a credential echoed as task identity cannot enter ledger or public summary',async()=>fixture(async root=>{
  const result=await runJob(root,selectedJob(),'create',{fetch:async()=>response({code:200,data:{taskId:secret}})});
  assert.equal(result.status,'submission-unknown');assert.doesNotMatch(JSON.stringify(result)+await ledger(root),/unit-only/);
}));

test('private env links and output reservation aliases fail safely',async()=>fixture(async root=>{
  const outside=await mkdtemp(path.join(os.tmpdir(),'media env outside '));
  try{
    await rm(path.join(root,'.env'));await symlink(outside,path.join(root,'.env'),'junction');
    await assert.rejects(loadProviderCredential(root,'kie'),/link|outside/i);
    await prepareMediaSetup(root,'kie');
  }finally{await rm(outside,{recursive:true,force:true});}
}));

test('CLI setup/status and rejected job JSON emit safe summaries without prompts or private errors',async()=>fixture(async root=>{
  const script=fileURLToPath(new URL('../../registry/skills/mcp-setup/scripts/media-api.mjs',import.meta.url));
  const setup=spawnSync(process.execPath,[script,'--project',root,'--mode','setup','--provider','kie'],{encoding:'utf8'});
  assert.equal(setup.status,0,setup.stdout+setup.stderr);assert.equal(JSON.parse(setup.stdout).credentialName,'KIE_API_KEY');
  await writeFile(path.join(root,'job.json'),JSON.stringify({...selectedJob(),approved:false,payload:{model:'selected-by-user',input:{text:secret}}}));
  const decline=spawnSync(process.execPath,[script,'--project',root,'--mode','create','--job','job.json'],{encoding:'utf8'});
  assert.equal(decline.status,1);assert.match(JSON.parse(decline.stdout).error,/per-job approval/);assert.doesNotMatch(decline.stdout+decline.stderr,/unit-only/);
  await runJob(root,selectedJob(),'create',{fetch:async()=>{throw new Error(secret);}});
  await writeFile(path.join(root,'status.json'),JSON.stringify({id:'shot-1'}));
  const status=spawnSync(process.execPath,[script,'--project',root,'--mode','status','--job','status.json'],{encoding:'utf8'});
  assert.equal(status.status,0,status.stdout+status.stderr);assert.equal(JSON.parse(status.stdout).status,'submission-unknown');assert.doesNotMatch(status.stdout+status.stderr,/unit-only|approved brand scene|signature/);
  const source=await mkdtemp(path.join(os.tmpdir(),'media outside input '));
  try{await writeFile(path.join(source,'job.json'),'{}');await symlink(source,path.join(root,'linked'),'junction');
    const linked=spawnSync(process.execPath,[script,'--project',root,'--mode','create','--job','linked/job.json'],{encoding:'utf8'});
    assert.equal(linked.status,1);assert.match(JSON.parse(linked.stdout).error,/link|outside/i);
  }finally{await rm(source,{recursive:true,force:true});}
}));

test('unsupported inherited-property provider names and task states reject explicitly',async()=>fixture(async root=>{
  await assert.rejects(prepareMediaSetup(root,'__proto__'),/documented provider/);
  await assert.rejects(loadProviderCredential(root,'constructor'),/Unsupported credential/);
  await assert.rejects(runJob(root,{...selectedJob(),provider:'__proto__'},'create'),/supported async API/);
  assert.throws(()=>parseProviderResponse('kie',{code:200,data:{state:'constructor'}},'status'),/unknown status/);
}));

test('setup final ignore block wins over existing private-env negation',async()=>fixture(async root=>{
  const before='custom.txt\n.env\n!.env\n!.env.*\n';
  await writeFile(path.join(root,'.gitignore'),before);await prepareMediaSetup(root,'kie');
  const after=await readFile(path.join(root,'.gitignore'),'utf8');assert.ok(after.startsWith(before));
  assert.ok(after.endsWith('.env\n.env.*\n!.env.example\n'));
  await prepareMediaSetup(root,'kie');assert.equal(await readFile(path.join(root,'.gitignore'),'utf8'),after);
}));

test('CLI help is safe, credential-free and needs no project or transport',()=>{
  const script=fileURLToPath(new URL('../../registry/skills/mcp-setup/scripts/media-api.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,'--help'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/setup/);assert.match(result.stdout,/status/);
});

test('standalone mcp-setup keeps help usable and refuses media before project or transport activity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'standalone mcp Windows spaces '));
  try {
    const installed = path.join(root, 'skills/mcp-setup');
    await cp(fileURLToPath(new URL('../../registry/skills/mcp-setup/', import.meta.url)), installed, { recursive: true });
    for (const script of ['find-plugin.mjs', 'media-api.mjs']) {
      const help = spawnSync(process.execPath, [path.join(installed, 'scripts', script), '--help'], { encoding: 'utf8' });
      assert.equal(help.status, 0, help.stdout + help.stderr);
      assert.match(help.stdout, /usage/i);
    }
    const script = path.join(installed, 'scripts/media-api.mjs');
    const attempt = spawnSync(process.execPath, [script, '--project', path.join(root, 'absent project'), '--mode', 'setup', '--provider', 'kie'], { encoding: 'utf8' });
    assert.equal(attempt.status, 1);
    assert.match(JSON.parse(attempt.stdout).error, /audiovisual-review.*(?:install|Bundle)/i);
    assert.doesNotMatch(attempt.stdout + attempt.stderr, /ERR_MODULE_NOT_FOUND|Cannot find module/);
    // Instrument exported boundaries, so an early env/file read or transport attempt is a failure.
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import fs from 'node:fs/promises';
      import { pathToFileURL } from 'node:url';
      const calls=[];
      for(const key of ['readFile','lstat','realpath','mkdir','open','readdir'])fs[key]=async()=>{calls.push(key);throw new Error('unexpected project activity');};
      globalThis.fetch=async()=>{calls.push('fetch');throw new Error('unexpected provider activity');};
      const api=await import(pathToFileURL(process.argv[2]));
      for(const run of [()=>api.prepareMediaSetup(process.argv[3],'kie'),()=>api.loadProviderCredential(process.argv[3],'kie'),()=>api.runJob(process.argv[3],{id:'missing'},'create')]) {
        await assert.rejects(run,/audiovisual-review.*(?:install|Bundle)/i);
      }
      assert.deepEqual(calls,[]);
    `, 'standalone-api-probe', script, root], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stdout + probe.stderr);
  } finally { await rm(root, { recursive: true, force: true }); }
});
