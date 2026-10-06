import fs from 'fs';import path from 'path';import os from 'os';
const dir=path.join(os.homedir(),'.claude/projects/C--github-scratch-pilot-h8-skills');
const prompts=JSON.parse(fs.readFileSync('C:/github/scratch-pilot/h8-workspace/evals-first-two.json','utf8'));
const cfg=process.argv[2]||'with';const out=`C:/github/scratch-pilot/h8-workspace/runs-${cfg}`;fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).map(f=>({f,t:fs.statSync(path.join(dir,f)).mtimeMs})).sort((a,b)=>a.t-b.t);
const sel=cfg==='with'?files.slice(0,12):files.slice(12);
for(const {f} of sel){
 const L=fs.readFileSync(path.join(dir,f),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
 const seen=new Set();const skillIds={};const refused=[];let first='',tools={},skills=[],final='',tin=0,tout=0,tcr=0,tcc=0,t0,t1;
 for(const e of L){ if(e.timestamp){t0??=e.timestamp;t1=e.timestamp;}
  const m=e.message; if(!m)continue;
  if(e.type==='user'&&Array.isArray(m.content)){for(const x of m.content){if(x.type==='tool_result'&&skillIds[x.tool_use_id]&&x.is_error)refused.push(skillIds[x.tool_use_id]);}}
  if(e.type==='user'&&!first){const c=m.content;first=typeof c==='string'?c:(c.find?.(x=>x.type==='text')?.text||'');}
  if(e.type==='assistant'&&Array.isArray(m.content)){
   for(const c of m.content){if(c.type==='tool_use'){tools[c.name]=(tools[c.name]||0)+1;if(c.name==='Skill'){skills.push(c.input.skill);skillIds[c.id]=c.input.skill;}}
    if(c.type==='text')final=c.text;}
   const u=(seen.has(m.id)?{}:(seen.add(m.id),m.usage))||{};tin+=u.input_tokens||0;tout+=u.output_tokens||0;tcr+=u.cache_read_input_tokens||0;tcc+=u.cache_creation_input_tokens||0;}}
 const p=prompts.find(x=>first.trim()===x.prompt.trim());
 if(!p){console.log(f,'no prompt match:',first.slice(0,60));continue;}
 const rec={n:p.n,skill:p.skill,config:cfg,session:f.replace('.jsonl',''),wall_s:(Date.parse(t1)-Date.parse(t0))/1000,in:tin,out:tout,cache_read:tcr,cache_create:tcc,tools,skillCalls:skills.filter(k=>!refused.includes(k)),skillRefused:refused};
 fs.writeFileSync(`${out}/${String(p.n).padStart(2,'0')}-${p.skill}.answer.md`,final);
 fs.writeFileSync(`${out}/${String(p.n).padStart(2,'0')}-${p.skill}.meta.json`,JSON.stringify(rec,null,1));
 console.log(p.n,p.skill,JSON.stringify({wall:rec.wall_s,out:tout,cr:tcr,tools,loaded:rec.skillCalls,refused}));
}
