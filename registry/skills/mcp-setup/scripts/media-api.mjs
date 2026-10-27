import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Help and plugin discovery also ship in Bundles without media production.
// Actual media operations must still use the single strict shared contract.
let contained, parseFlags, projectRoot, readInput, safeRelativePath, validatePreferences;
async function loadSharedContract(){
  if(projectRoot)return;
  try{({contained,parseFlags,projectRoot,readInput,safeRelativePath,validatePreferences}=await import('../../audiovisual-review/scripts/review.mjs'));}
  catch(error){if(error.code==='ERR_MODULE_NOT_FOUND')fail('Media operations require audiovisual-review/scripts/review.mjs as a sibling in the same installed Skills layout; digital-agency and full already provide it. Ask the calling lead to arrange approved setup. Help and plugin discovery work independently.');throw error;}
}

const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const KEY=Object.freeze(Object.assign(Object.create(null),{kie:'KIE_API_KEY',byteplus:'ARK_API_KEY','fish-audio':'FISH_API_KEY'}));
const BASE=Object.freeze(Object.assign(Object.create(null),{kie:'https://api.kie.ai',byteplus:'https://ark.ap-southeast.bytepluses.com/api/v3'}));
const TERMINAL=['failed','cancelled','expired','rejected','completed'];
const MAX_MEDIA=100*1024*1024;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{const error=new Error(message);error.safe=true;throw error;};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';

async function rootFor(directory){await loadSharedContract();const errors=[];const root=await projectRoot(directory,errors);if(errors.length)fail('Select an existing absolute project directory.');return root;}
async function info(file){try{return await lstat(file);}catch(error){if(error.code==='ENOENT')return null;fail('Project file is unreadable.');}}

// Reject every child link, including links whose current target is inside the root.
// The selected root itself has already been explicitly resolved by projectRoot.
async function local(root,relative,{parents=false,privateFile=false}={}){
  if(!privateFile&&!safeRelativePath(relative))fail('Unsafe project-relative output path.');
  const parts=relative.replaceAll('\\','/').split('/');let cursor=root;
  for(let index=0;index<parts.length;index++){
    cursor=path.join(cursor,parts[index]);
    if(!contained(root,cursor))fail('Path is outside selected project.');
    let entry=await info(cursor);
    if(!entry&&index<parts.length-1&&parents){try{await mkdir(cursor);}catch(error){if(error.code!=='EEXIST')fail('Cannot prepare project directory.');}entry=await info(cursor);}
    if(entry&&(entry.isSymbolicLink()||!contained(root,await realpath(cursor))))fail('Linked path is outside the allowed project file boundary.');
    if(entry&&index<parts.length-1&&!entry.isDirectory())fail('Project path parent must be a directory.');
  }
  return cursor;
}
async function writeExclusive(file,bytes){
  let handle;
  try{handle=await open(file,'wx',0o600);await handle.writeFile(bytes);await handle.sync();}
  catch(error){if(error.code==='EEXIST')fail('Output path already exists; choose a new output.');fail('Cannot write exclusive project file.');}
  finally{await handle?.close();}
}

/** Writes placeholders and ignore rules only. Never reads or changes private .env. */
export async function prepareMediaSetup(directory,provider){
  const name=KEY[provider];if(!name)fail('Select a documented provider.');
  const root=await rootFor(directory);
  for(const [relative,lines] of [['.env.example',[`${name}=`]],['.gitignore',['.env','.env.*','!.env.example']]]){
    const file=await local(root,relative,{privateFile:true});const entry=await info(file);
    if(entry&&(!entry.isFile()||entry.size>65536))fail('Setup file must be a small regular file.');
    const old=entry?await readFile(file,'utf8'):'';
    const missing=relative==='.gitignore'?(old.replaceAll('\r\n','\n').trimEnd().endsWith(lines.join('\n'))?[]:lines)
      :lines.filter(()=>!new RegExp(`^${name}=`, 'm').test(old));
    if(!missing.length)continue;
    const text=(old&&!old.endsWith('\n')?'\n':'')+missing.join('\n')+'\n';
    if(entry){const handle=await open(file,'a');try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}}
    else await writeExclusive(file,text);
  }
  return {ok:true,provider,credentialName:name,action:'Enter the selected key privately in the selected project .env; setup makes no provider call.'};
}

/** Internal adapter boundary; deliberately absent from the CLI. No inherited env. */
export async function loadProviderCredential(directory,provider){
  const name=KEY[provider];if(!name)fail('Unsupported credential provider.');
  const root=await rootFor(directory);const file=await local(root,'.env',{privateFile:true});const entry=await info(file);
  if(!entry)fail(`missing ${name} in selected project .env`);
  if(!entry.isFile()||entry.size>65536)fail('Private env must be a small regular file.');
  let content;try{content=await readFile(file,'utf8');}catch{fail('Private selected-project env is unreadable.');}
  const matches=content.split(/\r?\n/).filter(line=>new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line));
  if(matches.length!==1)fail(`missing ${name} or ambiguous selected project entry`);
  let value=matches[0].slice(matches[0].indexOf('=')+1).trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  if(!value||value.length>8192||/[\s\x00-\x1f]/.test(value)||/^(?:your[-_]|replace|placeholder|\$\{|<)/i.test(value))fail(`missing ${name} usable private value`);
  return {name,value};
}

function taskId(value){if(typeof value!=='string'||!ID.test(value))fail('Invalid provider task identity.');return value;}
function outputUrls(values){
  if(!Array.isArray(values)||values.length!==1)fail('Provider output must contain exactly one supported media asset.');
  return values.map(value=>{
    let url;try{url=new URL(value);}catch{fail('Provider output URL is invalid.');}
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port||url.href.length>16384||/^(?:localhost|127\.|0\.|\[|10\.|192\.168\.|169\.254\.)/i.test(url.hostname))fail('Provider output requires a public credential-free HTTPS URL.');
    return url.href;
  });
}

/** Transient result URLs must never be serialized into the job ledger or CLI. */
export function parseProviderResponse(provider,body,mode){
  if(!object(body)||!['create','status'].includes(mode))fail('Invalid provider response.');
  let status,id,outputs;
  if(provider==='kie'){
    if(body.code!==200)fail('provider rejected request; inspect provider account privately.');
    if(!object(body.data))fail('Provider response is missing task data.');
    id=body.data.taskId===undefined?undefined:taskId(body.data.taskId);
    if(mode==='create')return {status:'submitted',taskId:taskId(id)};
    const states={waiting:'queued',queuing:'queued',generating:'running',success:'completed',fail:'failed'};
    status=Object.hasOwn(states,body.data.state)?states[body.data.state]:undefined;
    if(!status)fail('unknown status from provider.');
    if(status==='completed'){
      let result=body.data.resultJson;
      if(typeof result==='string'){try{result=JSON.parse(result);}catch{fail('Provider output is malformed.');}}
      outputs=outputUrls(result?.resultUrls);
    }
  }else if(provider==='byteplus'){
    if(body.error&&!(mode==='status'&&['failed','cancelled','expired'].includes(body.status)))fail('provider rejected request; inspect provider account privately.');
    id=body.id===undefined?undefined:taskId(body.id);
    if(mode==='create')return {status:'submitted',taskId:taskId(id)};
    const states={queued:'queued',running:'running',succeeded:'completed',failed:'failed',cancelled:'cancelled',expired:'expired'};
    status=Object.hasOwn(states,body.status)?states[body.status]:undefined;
    if(!status)fail('unknown status from provider.');
    if(status==='completed')outputs=outputUrls([body.content?.video_url]);
  }else fail('Unsupported async API provider.');
  return {status,...(id?{taskId:id}:{}),...(outputs?{outputs}:{})};
}

function credentialPayload(value,depth=0){
  if(depth>30)return true;
  if(typeof value==='string')return /\bBearer\s|\bsk[-_][A-Za-z0-9]|(?:KIE|ARK|FISH)_API_KEY|-----BEGIN .*PRIVATE KEY/i.test(value);
  if(Array.isArray(value))return value.some(item=>credentialPayload(item,depth+1));
  if(object(value))return Object.entries(value).some(([key,item])=>/authorization|api.?key|access.?key|token|secret|password|credential|callback|webhook/i.test(key)||credentialPayload(item,depth+1));
  return false;
}
function validateCreate(job,preferences){
  if(!object(job)||typeof job.id!=='string'||!ID.test(job.id))fail('Use a stable nonsecret job id.');
  if(!BASE[job.provider])fail('Provider is not selected or has no supported async API adapter.');
  if(job.regionBaseUrl!==undefined&&job.regionBaseUrl!==BASE[job.provider])fail('Unsupported provider region base URL.');
  const selection=preferences.providers.find(row=>row.provider===job.provider&&row.modality===job.modality&&row.route===job.route&&row.model===job.payload?.model);
  if(!selection||job.route!=='api')fail('Job provider, model, modality and API route must match the selected saved choice.');
  if(job.approved!==true)fail('Explicit per-job approval is required.');
  if(typeof job.ceilingUsd!=='number'||!Number.isFinite(job.ceilingUsd)||job.ceilingUsd<=0||job.ceilingUsd>1000000)fail('A finite positive job ceiling is required.');
  if(!object(job.payload)||credentialPayload(job.payload)||JSON.stringify(job.payload).length>1048576)fail('Payload contains credential-like data or exceeds the safe request bound.');
  if(job.provider==='kie'&&(!object(job.payload.input)||Object.keys(job.payload).some(key=>!['model','input'].includes(key))))fail('KIE payload needs model and input only.');
  if(job.provider==='byteplus'&&(job.modality!=='video'||!Array.isArray(job.payload.content)||!job.payload.content.length))fail('BytePlus video payload needs selected model and content.');
  if(!safeRelativePath(job.output)||!/^media\/assets\//.test(job.output.replaceAll('\\','/'))||!(/\.(?:wav|mp3|ogg|flac|mp4|webm)$/i.test(job.output)))fail('Use a new supported media/assets output path.');
}

async function preferencesFor(root){
  await local(root,'media/project.json');const errors=[];const value=await readInput('media/project.json','json',errors,'preferences',root);
  if(errors.length||validatePreferences(value).length)fail('Saved project preferences must satisfy the complete shared contract.');return value;
}
async function readLedger(root,relative){
  await local(root,relative);const errors=[];const value=await readInput(relative,'json',errors,'job',root);
  const fields=['schemaVersion','id','provider','modality','route','model','regionBaseUrl','ceilingUsd','output','status','taskId','artifacts'];
  if(errors.length||!object(value)||Object.keys(value).some(key=>!fields.includes(key))||value.schemaVersion!==1||!ID.test(value.id)||!BASE[value.provider]||!ID.test(value.taskId??'none')
    ||typeof value.model!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(value.model)||credentialPayload(value.model)||credentialPayload(value.id)||credentialPayload(value.taskId)
    ||!['audio','video'].includes(value.modality)||value.route!=='api'||value.regionBaseUrl!==BASE[value.provider]
    ||!['submission-unknown','submitted','queued','running','status-unavailable','download-failed',...TERMINAL].includes(value.status)
    ||!safeRelativePath(value.output)||!value.output.replaceAll('\\','/').startsWith('media/assets/')
    ||typeof value.ceilingUsd!=='number'||!Number.isFinite(value.ceilingUsd)||value.ceilingUsd<=0||value.ceilingUsd>1000000
    ||(value.artifacts!==undefined&&(!Array.isArray(value.artifacts)||value.artifacts.length!==1||value.artifacts.some(row=>!object(row)
      ||Object.keys(row).some(key=>!['path','sha256','bytes','mime'].includes(key))||row.path!==value.output||!/^[a-f0-9]{64}$/.test(row.sha256)
      ||!Number.isSafeInteger(row.bytes)||row.bytes<1||row.bytes>MAX_MEDIA||!['audio/wav','audio/mpeg','audio/flac','audio/ogg','video/mp4','video/webm'].includes(row.mime)))))fail('Saved job reservation is invalid; manual provider reconciliation is required.');
  if(value.id!==path.basename(relative,'.json'))fail('Saved job reservation is invalid; identity differs from file.');
  return value;
}
async function save(root,relative,value){
  const file=await local(root,relative);const temp=await local(root,`${relative}.tmp`);await writeExclusive(temp,json(value));
  try{await local(root,relative);await rename(temp,file);}catch{fail('Cannot persist job status; keep reservation and reconcile manually.');}
}
function summary(record){
  return {id:record.id,provider:record.provider,modality:record.modality,route:record.route,model:record.model,ceilingUsd:record.ceilingUsd,status:record.status,
    ...(record.taskId?{taskId:record.taskId}:{}),...(record.artifacts?{artifacts:record.artifacts}:{}),
    action:record.status==='submission-unknown'?'Do manual provider reconciliation before any replacement paid submission.':record.status==='completed'?'Use the local asset for finishing; codec, duration and listening quality remain unverified.':record.status==='rejected'?'Review provider authentication/request privately; reservation remains held.':TERMINAL.includes(record.status)?'Review provider task privately; reservation remains held.':'Resume status using the same job id; never submit a replacement blindly.'};
}
async function bytesOf(response,maximum){
  const length=response.headers?.get('content-length');if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>maximum))fail('Response exceeds byte bound.');
  if(!response.body?.getReader)fail('Response needs a bounded readable body.');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum)fail('Response exceeds byte bound.');chunks.push(Buffer.from(value));}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks,size);
}
async function providerRequest(fetch,url,options,timeoutMs){
  let response;
  try{response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});}catch{fail('Provider transport unavailable.');}
  if(response.status<200||response.status>=300){const error=new Error('Provider HTTP rejection.');error.rejected=response.status>=400&&response.status<500;throw error;}
  let body;try{body=JSON.parse((await bytesOf(response,1048576)).toString('utf8'));}catch{fail('Provider JSON response is invalid.');}return body;
}
function mediaMime(bytes,type,modality){
  const mime=type?.split(';')[0].trim().toLowerCase();const head=bytes.subarray(0,16);
  if(modality==='video'&&mime==='video/mp4'&&bytes.length>=12&&head.toString('ascii',4,8)==='ftyp')return mime;
  if(modality==='video'&&mime==='video/webm'&&head.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return mime;
  if(modality==='audio'&&['audio/wav','audio/wave','audio/x-wav'].includes(mime)&&bytes.length>=44&&head.toString('ascii',0,4)==='RIFF'&&head.toString('ascii',8,12)==='WAVE')return 'audio/wav';
  if(modality==='audio'&&['audio/mpeg','audio/mp3'].includes(mime)&&(head.toString('ascii',0,3)==='ID3'||(head[0]===0xff&&(head[1]&0xe0)===0xe0)))return 'audio/mpeg';
  if(modality==='audio'&&mime==='audio/flac'&&head.toString('ascii',0,4)==='fLaC')return mime;
  if(modality==='audio'&&['audio/ogg','application/ogg'].includes(mime)&&head.toString('ascii',0,4)==='OggS')return 'audio/ogg';
  fail('Downloaded response is not recognized media for this modality.');
}
async function download(root,record,url,fetch,timeoutMs,maxBytes){
  const file=await local(root,record.output,{parents:true});if(await info(file))fail('Output path already exists.');
  // A fresh request with an empty header object: no provider credential reaches the CDN.
  const response=await fetch(url,{method:'GET',headers:{},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  if(response.status!==200)fail('Media download failed or redirected.');
  const bytes=await bytesOf(response,maxBytes);const mime=mediaMime(bytes,response.headers?.get('content-type'),record.modality);
  const extension=path.extname(record.output).toLowerCase();
  if(!({'audio/wav':['.wav'],'audio/mpeg':['.mp3'],'audio/flac':['.flac'],'audio/ogg':['.ogg'],'video/mp4':['.mp4'],'video/webm':['.webm']}[mime]?.includes(extension)))fail('Output extension does not match downloaded media.');
  await local(root,record.output);await writeExclusive(file,bytes);
  return {path:record.output.replaceAll('\\','/'),sha256:digest(bytes),bytes:bytes.length,mime};
}

/** One create and one status observation per invocation; status/resume never creates. */
export async function runJob(directory,job,mode,options={}){
  if(!['create','status'].includes(mode))fail('Use create or status mode.');
  const root=await rootFor(directory);const preferences=await preferencesFor(root);
  if(!object(job)||typeof job.id!=='string'||!ID.test(job.id))fail('Use a stable nonsecret job id.');
  if(mode==='create')validateCreate(job,preferences);
  const timeoutMs=options.timeoutMs??30000,maxBytes=options.maxBytes??MAX_MEDIA;
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_MEDIA)fail('Use bounded timeout and byte limits.');
  const relative=`media/jobs/${job.id}.json`;await local(root,relative,{parents:true});
  const lock=await local(root,'media/jobs/.project-lock');let handle;
  try{handle=await open(lock,'wx',0o600);}catch{fail('Project media jobs are busy; inspect stale lock after a stopped process and reconcile before retrying.');}
  try{
    let record;
    if(mode==='create'){
      if(await info(await local(root,relative)))fail('Job is already reserved; use status instead of another paid create.');
      const output=await local(root,job.output);if(await info(output))fail('Output path already exists; choose a new output.');
      const credential=await loadProviderCredential(root,job.provider);
      if(JSON.stringify(job).includes(credential.value))fail('Job contains the selected credential.');
      let reserved=0;
      for(const file of await readdir(path.join(root,'media/jobs'))){
        if(file.endsWith('.tmp'))fail('Unfinished job state requires manual reconciliation.');
        if(file.endsWith('.json')){
          const previous=await readLedger(root,`media/jobs/${file}`);reserved+=previous.ceilingUsd;
          if(previous.output.toLowerCase()===job.output.replaceAll('\\','/').toLowerCase())fail('Output path is already reserved by another job.');
        }
      }
      if(reserved+job.ceilingUsd>preferences.spend.ceilingUsd)fail('Project budget would be exceeded by conservative existing reservations.');
      record={schemaVersion:1,id:job.id,provider:job.provider,modality:job.modality,route:'api',model:job.payload.model,regionBaseUrl:BASE[job.provider],ceilingUsd:job.ceilingUsd,output:job.output.replaceAll('\\','/'),status:'submission-unknown'};
      // Durable, exclusive reservation precedes the first paid request. It survives ambiguity.
      await writeExclusive(await local(root,relative),json(record));
      let submitted;
      try{
        const body=await providerRequest(options.fetch??globalThis.fetch,BASE[record.provider]+(record.provider==='kie'?'/api/v1/jobs/createTask':'/contents/generations/tasks'),{method:'POST',headers:{Authorization:`Bearer ${credential.value}`,'Content-Type':'application/json'},body:JSON.stringify(job.payload)},timeoutMs);
        try{submitted=parseProviderResponse(record.provider,body,'create');if(submitted.taskId.includes(credential.value))fail('Provider task identity contains credential data.');}
        catch(error){if(error.safe&&error.message.startsWith('provider rejected'))error.rejected=true;throw error;}
      }catch(error){record.status=error.rejected?'rejected':'submission-unknown';await save(root,relative,record);return summary(record);}
      record.taskId=submitted.taskId;record.status='submitted';await save(root,relative,record);
    }else{
      record=await readLedger(root,relative);
      for(const field of ['id','provider','modality','route','regionBaseUrl'])if(job[field]!==undefined&&job[field]!==record[field])fail('Status routing must match the saved job identity and region.');
      if(!safeRelativePath(record.output)||!record.output.replaceAll('\\','/').startsWith('media/assets/'))fail('Saved output path is unsafe.');
      if(TERMINAL.includes(record.status)||!record.taskId)return summary(record);
    }
    const credential=await loadProviderCredential(root,record.provider);const fetch=options.fetch??globalThis.fetch;
    const url=BASE[record.provider]+(record.provider==='kie'?`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(record.taskId)}`:`/contents/generations/tasks/${encodeURIComponent(record.taskId)}`);
    let observed;
    try{
      observed=parseProviderResponse(record.provider,await providerRequest(fetch,url,{method:'GET',headers:{Authorization:`Bearer ${credential.value}`}},timeoutMs),'status');
      if(observed.taskId&&observed.taskId!==record.taskId)fail('Provider task identity mismatch.');
    }catch{record.status='status-unavailable';await save(root,relative,record);return summary(record);}
    record.status=observed.status;
    if(observed.status==='completed'){
      try{
        if(observed.outputs.some(url=>url.includes(credential.value)||decodeURIComponent(url).includes(credential.value)))fail('Provider output contains credential data.');
        record.artifacts=[await download(root,record,observed.outputs[0],fetch,timeoutMs,maxBytes)];
      }
      catch{record.status='download-failed';}
    }
    await save(root,relative,record);return summary(record);
  }finally{await handle.close();await unlink(lock).catch(()=>{});}
}

async function main(args){
  if(args.length===1&&args[0]==='--help')return {usage:[
    'node <installed-mcp-setup>/scripts/media-api.mjs --project <absolute-project> --mode setup --provider kie|byteplus|fish-audio',
    'node <installed-mcp-setup>/scripts/media-api.mjs --project <absolute-project> --mode create --job <relative-job.json>',
    'node <installed-mcp-setup>/scripts/media-api.mjs --project <absolute-project> --mode status --job <relative-status.json>'
  ],statusInput:{id:'saved-job-id'},behavior:'Create reserves the ceiling then submits once and checks status once. Status resumes the saved task and downloads completed media locally; it never submits. No implicit polling or retry.',limits:'Local ceiling reservations estimate spend and are not vendor-enforced billing caps. Actual codec, duration and listening quality remain unverified until finishing. Enter keys privately in the selected project .env.'};
  await loadSharedContract();
  const errors=[];const flags=parseFlags(args,['--project','--job','--mode','--provider'],errors);
  if(errors.length)fail('Use documented --project, --job, --mode and --provider flags.');
  const root=await rootFor(flags['--project']);
  if(flags['--mode']==='setup')return prepareMediaSetup(root,flags['--provider']);
  if(!safeRelativePath(flags['--job']))fail('Select a nonprivate project-relative job JSON file.');
  await local(root,flags['--job']);const input=await readInput(flags['--job'],'json',errors,'job',root);
  if(errors.length)fail('Job input must be a small nonprivate project JSON file.');
  return runJob(root,input,flags['--mode']);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main(process.argv.slice(2)).then(result=>process.stdout.write(json(result))).catch(error=>{process.stdout.write(json({ok:false,error:error.safe?error.message:'Media operation failed without exposing private details.'}));process.exitCode=1;});
}
