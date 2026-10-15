const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {protectedState}=require('./integrity.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'au-integrity-checks-'));
const original={hooks:{PreToolUse:[{matcher:'*',hooks:[{type:'command',command:'node',args:['protected-hook']}]}]}};
fs.mkdirSync(path.join(root,'.claude'));
const cfg={workspace:root,protectedFiles:[],settingsBaselines:{'.claude/settings.local.json':original}};
const put=x=>fs.writeFileSync(path.join(root,'.claude/settings.local.json'),JSON.stringify(x));
test('human approval of exactly image-gen preserves protected controls',()=>{
 put({...original,enabledMcpjsonServers:['image-gen']});assert.equal(protectedState(cfg),true);
 put({...original,enabledMcpjsonServers:['another-server']});assert.equal(protectedState(cfg),false);
 put({...original,enableAllProjectMcpServers:true});assert.equal(protectedState(cfg),false);
 put({...original,hooks:{}});assert.equal(protectedState(cfg),false);
});
after(()=>fs.rmSync(root,{recursive:true,force:true}));
