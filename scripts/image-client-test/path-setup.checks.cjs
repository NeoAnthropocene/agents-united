const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {decide, inside} = require('./guard.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'au-path-setup-'));
const workspace = path.join(root, 'Project');
fs.mkdirSync(path.join(workspace, '.claude/hooks'), {recursive:true});
fs.mkdirSync(path.join(workspace, '.probe'), {recursive:true});
const cfg = {workspace, imageBase:'one', desktopSetup:{providers:['gemini'],defaultProvider:'gemini',projectConfig:'absent'}};
for (const file of ['guard.cjs','hook.cjs']) fs.copyFileSync(path.join(__dirname,file),path.join(workspace,'.claude/hooks',file));
fs.writeFileSync(path.join(workspace,'.probe/config.json'),JSON.stringify(cfg));
const definition = {mcpServers:{'image-gen':{type:'stdio',command:'npx',args:['-y','mcp-image@0.18.0'],env:{GEMINI_API_KEY:'${AGENTS_UNITED_GEMINI_API_KEY}',IMAGE_PROVIDER:'gemini',SKIP_PROMPT_ENHANCEMENT:'true',IMAGE_OUTPUT_DIR:path.join(workspace,'assets/generated')}}}};
const invoke = (tool, args, cwd=workspace) => decide(cfg,{cwd,tool_name:tool,tool_input:args});
test('Windows folder spelling binds SessionStart and permits tools', {skip:process.platform!=='win32'}, () => {
  const cwd=workspace[0].toLowerCase()+workspace.slice(1);
  assert.equal(invoke('ToolSearch',{},cwd).allow,true);
  const id='11111111-1111-4111-8111-111111111111';
  const result=spawnSync(process.execPath,[path.join(workspace,'.claude/hooks/hook.cjs')],{input:JSON.stringify({hook_event_name:'SessionStart',session_id:id,cwd,transcript_path:path.join(os.homedir(),'.claude/projects/fixture',id+'.jsonl')}),encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  assert.equal(fs.existsSync(path.join(workspace,'.probe/sessions',id+'.json')),true);
});
test('POSIX case remains significant', {skip:process.platform==='win32'}, () => {
  assert.equal(invoke('ToolSearch',{},workspace.toLowerCase()).allow,false);
});
test('exact credential-free project Write is allowed but credentials and configuration drift are rejected', () => {
  const file_path=path.join(workspace,'.mcp.json');
  assert.equal(invoke('Write',{file_path,content:JSON.stringify(definition)}).allow,true);
  for(const change of [d=>d.mcpServers['image-gen'].env.GEMINI_API_KEY='literal-private-value',d=>d.mcpServers['image-gen'].args=['-y','mcp-image@latest'],d=>d.mcpServers.other={},d=>d.mcpServers['image-gen'].env.OPENAI_API_KEY='${AGENTS_UNITED_OPENAI_API_KEY}',d=>d.mcpServers['image-gen'].env.IMAGE_OUTPUT_DIR=path.join(root,'escape')]) {
    const d=structuredClone(definition); change(d);
    assert.equal(invoke('Write',{file_path,content:JSON.stringify(d)}).allow,false);
  }
  const duplicate=JSON.stringify(definition).replace('"GEMINI_API_KEY":', '"GEMINI_API_KEY":"literal-private-value","GEMINI_API_KEY":');
  assert.equal(invoke('Write',{file_path,content:duplicate}).allow,false);
  const alias=path.join(workspace,'alias');
  fs.writeFileSync(file_path,'unknown existing configuration');
  fs.symlinkSync(workspace,alias,process.platform==='win32'?'junction':'dir');
  assert.equal(invoke('Read',{file_path:path.join(alias,'.mcp.json')}).allow,false);
  fs.unlinkSync(alias);fs.unlinkSync(file_path);
  assert.equal(invoke('Read',{file_path}).allow,false);
  assert.equal(invoke('Edit',{file_path,old_string:'',new_string:JSON.stringify(definition)}).allow,false);
});
test('each selected provider subset has only its holders, with a selected default', () => {
  for(const providers of [['gemini'],['openai'],['seedream'],['gemini','openai'],['gemini','seedream'],['openai','seedream'],['gemini','openai','seedream']]) {
    const selected={...cfg,desktopSetup:{providers,defaultProvider:providers.at(-1),projectConfig:'absent'}};
    const expectedHolders={gemini:{GEMINI_API_KEY:'${AGENTS_UNITED_GEMINI_API_KEY}'},openai:{OPENAI_API_KEY:'${AGENTS_UNITED_OPENAI_API_KEY}'},seedream:{ARK_API_KEY:'${AGENTS_UNITED_ARK_API_KEY}'}};
    const env={...Object.assign({},...providers.map(p=>expectedHolders[p])),IMAGE_PROVIDER:providers.at(-1),SKIP_PROMPT_ENHANCEMENT:'true',IMAGE_OUTPUT_DIR:path.join(workspace,'assets/generated')};
    const d={mcpServers:{'image-gen':{type:'stdio',command:'npx',args:['-y','mcp-image@0.18.0'],env}}};
    assert.equal(decide(selected,{cwd:workspace,tool_name:'Write',tool_input:{file_path:path.join(workspace,'.mcp.json'),content:JSON.stringify(d)}}).allow,true);
  }
});
test('Windows slash spelling is valid for the actual absolute output folder', {skip:process.platform!=='win32'}, () => {
  const d=structuredClone(definition);d.mcpServers['image-gen'].env.IMAGE_OUTPUT_DIR=d.mcpServers['image-gen'].env.IMAGE_OUTPUT_DIR.replaceAll('\\','/');
  assert.equal(invoke('Write',{file_path:path.join(workspace,'.mcp.json'),content:JSON.stringify(d)}).allow,true);
});
test('unknown existing project file is left unread and receives only the exact private merge template', () => {
  fs.writeFileSync(path.join(workspace,'.mcp.json'),'unknown existing configuration');
  assert.equal(invoke('Write',{file_path:path.join(workspace,'.mcp.json'),content:JSON.stringify(definition)}).allow,false);
  assert.equal(invoke('Write',{file_path:path.join(workspace,'deliverables/image-gen.private-merge.json'),content:JSON.stringify(definition)}).allow,true);
  assert.equal(fs.readFileSync(path.join(workspace,'.mcp.json'),'utf8'),'unknown existing configuration');
});
test('credentials, unrelated folders, traversal and linked destinations stay excluded', () => {
  assert.equal(invoke('Read',{file_path:path.join(workspace,'.env')}).allow,false);
  assert.equal(invoke('Grep',{path:workspace,pattern:'.'}).allow,false);
  assert.equal(invoke('ToolSearch',{},workspace+'-other').allow,false);
  assert.equal(inside(workspace,path.join(workspace,'../outside')),false);
  assert.equal(inside(workspace,workspace+'-other'),false);
  const link=path.join(workspace,'deliverables');
  fs.symlinkSync(root,link,process.platform==='win32'?'junction':'dir');
  assert.equal(invoke('Write',{file_path:path.join(link,'image-gen.private-merge.json'),content:JSON.stringify(definition)}).allow,false);
});
after(()=>fs.rmSync(root,{recursive:true,force:true}));
