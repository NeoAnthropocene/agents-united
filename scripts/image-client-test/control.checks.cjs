const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'au-control-checks-'));
const id='11111111-1111-4111-8111-111111111111';
function fixture(agent='agency-creative-designer',visible=true){
 const workspace=fs.mkdtempSync(path.join(temp,'case-'));
 const records=path.join(workspace,'home/.claude/projects/fixture');
 fs.mkdirSync(records,{recursive:true});fs.mkdirSync(path.join(workspace,'.probe/events'),{recursive:true});fs.mkdirSync(path.join(workspace,'.claude'));
 const manifest=path.join(workspace,'cases.json');
 const settings={agent:'orchestrator-digital-agency',hooks:{}};
 fs.writeFileSync(path.join(workspace,'.claude/settings.json'),JSON.stringify(settings));
 fs.writeFileSync(manifest,JSON.stringify({cases:[{surface:'desktop',workspace,protectedFiles:[],settingsHooksSHA:crypto.createHash('sha256').update('{}').digest('hex')}]}));
 const rows=[{type:'agent-setting',agentSetting:agent},{type:'user',cwd:process.platform==='win32'?workspace[0].toLowerCase()+workspace.slice(1):workspace,promptId:'one',message:{content:'Fixture'}},{type:'assistant',message:{model:'fixture-sonnet',content:[{type:'tool_use',id:'lookup',name:'ToolSearch',input:{query:'image-gen'}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'lookup',is_error:!visible,content:visible?[{type:'tool_reference',tool_name:'mcp__image-gen__generate_image'}]:'not found'}]}}];
 fs.writeFileSync(path.join(records,id+'.jsonl'),rows.map(JSON.stringify).join('\n'));
 for(const event of [{kind:'PreToolUse',allowed:true},{kind:'PostToolUse',tool:'ToolSearch',imageToolListed:true}]) fs.writeFileSync(path.join(workspace,'.probe/events',event.kind+'.json'),JSON.stringify({...event,sessionId:id}));
 const preload=path.join(workspace,'home.mjs');fs.writeFileSync(preload,`import os from 'node:os';os.homedir=()=>${JSON.stringify(path.join(workspace,'home'))};`);
 const run=(action,...flags)=>spawnSync(process.execPath,['--import',pathToFileURL(preload).href,path.join(__dirname,'control.mjs'),manifest,'desktop',action,'--session',id,...flags],{encoding:'utf8',windowsHide:true});
 return {workspace,run};
}
test('designer role switch requires native Chris setup, including explicit UUID fallback',()=>{
 const wrong=fixture();assert.notEqual(wrong.run('designer').status,0);
 const setup=fixture('orchestrator-digital-agency');const result=setup.run('designer');assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(fs.readFileSync(path.join(setup.workspace,'.claude/settings.json'),'utf8')).agent,'agency-creative-designer');
});
test('arming requires separate human flags, native designer and successful host tool reference',()=>{
 const good=fixture();assert.notEqual(good.run('arm','--confirmed-server').status,0);
 const invisible=fixture('agency-creative-designer',false);assert.notEqual(invisible.run('arm','--confirmed-server','--authorize-one-image').status,0);
 const wrong=fixture('orchestrator-digital-agency');assert.notEqual(wrong.run('arm','--confirmed-server','--authorize-one-image').status,0);
 const result=good.run('arm','--confirmed-server','--authorize-one-image');assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(fs.readFileSync(path.join(good.workspace,'.probe/armed.json'),'utf8')).sessionId,id);
 assert.equal(fs.existsSync(path.join(good.workspace,'.probe/image-attempt.json')),false);
});
after(()=>fs.rmSync(temp,{recursive:true,force:true}));
