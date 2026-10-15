const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
// These are prepared, credential-free Claude settings, never MCP credential files.
// Preserve their hooks and every field except the native role switch and the
// human's approval of the single image-gen project definition.
function protectedState(cfg){
 try {
  if(!cfg.protectedFiles.every(item=>sha(fs.readFileSync(path.join(cfg.workspace,item.file)))===item.sha256))return false;
  for(const [file,baseline] of Object.entries(cfg.settingsBaselines??{})){
   const current=JSON.parse(fs.readFileSync(path.join(cfg.workspace,file),'utf8'));
   if(file==='.claude/settings.json'&&['orchestrator-digital-agency','agency-creative-designer'].includes(current.agent)) current.agent=baseline.agent;
   if(file==='.claude/settings.local.json'&&isDeepStrictEqual(current.enabledMcpjsonServers,['image-gen']))delete current.enabledMcpjsonServers;
   if(!isDeepStrictEqual(current,baseline))return false;
  }
  return true;
 }catch{return false;}
}
module.exports={protectedState};
