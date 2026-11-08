import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contained, safeRelativePath, readInput, projectRoot, resultReport, parseFlags } from '../../audiovisual-review/scripts/review.mjs';
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HASH=/^sha256:[a-f0-9]{64}$/;
const VERSION=/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const COMMERCIAL_TERMS=new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','CC0-1.0','CC-BY-4.0','LicenseRef-Project-Permission']);
const NONCOMMERCIAL_TERMS=new Set([...COMMERCIAL_TERMS,'CC-BY-NC-4.0','CC-BY-NC-SA-4.0','CC-BY-NC-ND-4.0']);
const issue=(errors,code,field,message)=>errors.push({code,path:field,message});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=10000;
const positive=(x,max)=>Number.isSafeInteger(x)&&x>0&&x<=max;
function fields(value,allowed,field,errors,required=allowed){if(!object(value)){issue(errors,'schema.object',field,'Expected an object.');return false;}if(Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))issue(errors,'schema.fields',field,'Unexpected or missing fields.');return true;}
function relative(value,field,errors){if(!safeRelativePath(value))issue(errors,'path.unsafe',field,'Use a nonprivate project-relative path.');}
function fingerprint(value,field,errors){if(!fields(value,['path','sha256'],field,errors))return;relative(value.path,field,errors);if(!HASH.test(value.sha256))issue(errors,'file.hash',field,'Expected a SHA-256 fingerprint.');}
function noSecrets(value){if(typeof value==='string')return /https?:\/\/[^\s]*[?@]/i.test(value);if(Array.isArray(value))return value.some(noSecrets);return object(value)&&Object.entries(value).some(([key,v])=>/^(?:token|apiKey|password|secret|authorization|credentials)$/i.test(key)||noSecrets(v));}
export function validateProject3d(value){
 const errors=[];if(!fields(value,['schemaVersion','requestId','status','route','usage','renderer','dimensions','budgets','asset','sources','outputs'],'project',errors))return errors;
 if(value.schemaVersion!==1||typeof value.requestId!=='string'||!ID.test(value.requestId)||!['planned','approved','produced','reviewed'].includes(value.status)||value.route!=='threejs-browser'||!['personal-private','public-noncommercial','commercial'].includes(value.usage))issue(errors,'project.identity','project','Use version 1, a stable string ID, supported status, selected route and usage.');
 if(fields(value.renderer,['three','playwright','gltfValidator'],'renderer',errors))for(const [key,v]of Object.entries(value.renderer))if(typeof v!=='string'||!VERSION.test(v))issue(errors,'renderer.version',`renderer.${key}`,'Use an exact version.');
 if(fields(value.dimensions,['width','height'],'dimensions',errors))for(const key of ['width','height'])if(!positive(value.dimensions[key],8192))issue(errors,'dimensions.bounds',`dimensions.${key}`,'Use an integer dimension from 1 to 8192.');
 const caps={maxBytes:268435456,maxTriangles:10000000,maxTextureDimension:16384,maxTextureBytes:1073741824};
 if(fields(value.budgets,Object.keys(caps),'budgets',errors))for(const [key,max]of Object.entries(caps))if(!positive(value.budgets[key],max))issue(errors,'budget.bounds',`budgets.${key}`,'Use a positive bounded integer budget.');
 relative(value.asset,'asset',errors);if(typeof value.asset!=='string'||!value.asset.toLowerCase().endsWith('.glb'))issue(errors,'asset.format','asset','The initial route requires a GLB.');
 if(!Array.isArray(value.sources)||!value.sources.length||value.sources.length>1000)issue(errors,'sources.array','sources','Supply 1 to 1000 source paths.');
 else {value.sources.forEach((x,i)=>relative(x,`sources[${i}]`,errors));const normalized=value.sources.map(x=>typeof x==='string'?x.replaceAll('\\','/').toLowerCase():'');if(new Set(normalized).size!==normalized.length||!normalized.includes(String(value.asset).replaceAll('\\','/').toLowerCase()))issue(errors,'sources.identity','sources','Sources must be unique and include the GLB.');}
 if(fields(value.outputs,['viewer','proof','formatReport','provenance','assetLedger','motionHandoff'],'outputs',errors,['viewer','proof','formatReport','provenance','assetLedger'])){
  for(const [key,v]of Object.entries(value.outputs))relative(v,`outputs.${key}`,errors);
  const extensions={viewer:'.html',proof:'.png',formatReport:'.json',provenance:'.json',assetLedger:'.md',motionHandoff:'.json'};
  for(const [key,v]of Object.entries(value.outputs))if(typeof v==='string'&&!v.toLowerCase().endsWith(extensions[key]))issue(errors,'output.format',`outputs.${key}`,'Unexpected output extension.');
  const values=Object.values(value.outputs).map(x=>String(x).replaceAll('\\','/').toLowerCase());const sources=Array.isArray(value.sources)?value.sources.map(v=>String(v).replaceAll('\\','/').toLowerCase()):[];if(new Set(values).size!==values.length||values.some(x=>sources.includes(x)))issue(errors,'output.alias','outputs','Output paths must be distinct from each other and sources.');
 }return errors;
}
export function validateProvenance(value,config,{delivery=false}={}){
 const errors=[];if(!fields(value,['schemaVersion','requestId','assets'],'provenance',errors))return errors;
 if(!object(config)||validateProject3d(config).length){issue(errors,'provenance.project','project','Validate a selected 3D project before its provenance.');return errors;}
 if(value.schemaVersion!==1||value.requestId!==config.requestId)issue(errors,'provenance.identity','provenance','Version and request ID must match.');
 if(!Array.isArray(value.assets)||!value.assets.length||value.assets.length>1000){issue(errors,'provenance.assets','assets','Supply 1 to 1000 asset records.');return errors;}
 const ids=new Set();const paths=new Set();
 for(const [i,a]of value.assets.entries()){
  const field=`assets[${i}]`;if(!fields(a,['id','creator','source','license','rightsStatus','reviewOwner','approvedUses','attribution','modifications','file','evidence','dependencies','transformations'],field,errors))continue;
  if(typeof a.id!=='string'||!ID.test(a.id)||ids.has(a.id))issue(errors,'provenance.id',field,'Asset IDs must be stable and unique.');ids.add(a.id);
  for(const key of ['creator','license','reviewOwner','attribution'])if(!text(a[key]))issue(errors,'provenance.text',`${field}.${key}`,'Supply the actual author, terms, attribution and review owner.');
  if(!['cleared','unverified','restricted'].includes(a.rightsStatus))issue(errors,'rights.status',field,'Use an explicit rights status.');
  if(fields(a.source,['kind','url','assetId','revision','retrievedAt'],`${field}.source`,errors,['kind','revision','retrievedAt'])){
   const date=new Date(a.source.retrievedAt);if(!['procedural','supplied','library'].includes(a.source.kind)||!text(a.source.revision)||typeof a.source.retrievedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.source.retrievedAt)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==a.source.retrievedAt)issue(errors,'source.identity',field,'Record source kind, exact revision and valid retrieval date.');
   if(a.source.url!==undefined){try{const u=new URL(a.source.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new Error();}catch{issue(errors,'source.url',field,'Use a public HTTPS source page without credentials or query tokens.');}}
   if(a.source.kind==='library'&&(!text(a.source.assetId)||!a.source.url))issue(errors,'source.library',field,'Library records require an asset ID and source page.');
  }
  fingerprint(a.file,`${field}.file`,errors);if(typeof a.file?.path==='string'){const p=a.file.path.replaceAll('\\','/').toLowerCase();if(paths.has(p))issue(errors,'provenance.path',field,'Each asset file has one ledger record.');paths.add(p);}
  if(a.evidence!==null)fingerprint(a.evidence,`${field}.evidence`,errors);
  if(a.rightsStatus==='cleared'&&(a.license==='non-license'||a.evidence===null))issue(errors,'rights.evidence',field,'Cleared assets require actual local evidence.');
  if(!Array.isArray(a.approvedUses)||!a.approvedUses.every(x=>['personal-private','public-noncommercial','commercial'].includes(x))||new Set(a.approvedUses).size!==a.approvedUses.length)issue(errors,'rights.scope',field,'Record the explicit uses approved by the named reviewer; this is an attestation, not legal verification.');
  if(delivery&&a.rightsStatus==='restricted')issue(errors,'rights.restricted',field,'A known prohibited use must be resolved before delivery.');
  if(delivery&&config.usage!=='personal-private'&&!(config.usage==='commercial'?COMMERCIAL_TERMS:NONCOMMERCIAL_TERMS).has(a.license))issue(errors,'rights.terms',field,'Unknown or unsupported terms need explicit project permission and reviewer evidence before public release.');
  if(delivery&&config.usage!=='personal-private'&&(a.rightsStatus!=='cleared'||a.license==='non-license'||!Array.isArray(a.approvedUses)||!a.approvedUses.includes(config.usage)||(config.usage==='commercial'&&/\bNC\b/i.test(a.license))||(/\bND\b/i.test(a.license)&&a.modifications?.length)))issue(errors,'rights.release',field,'Public or commercial delivery requires usage-scoped reviewer approval and compatible recorded terms.');
  if(!Array.isArray(a.modifications)||!a.modifications.every(text))issue(errors,'provenance.modifications',field,'Record a list of modifications.');
  if(!Array.isArray(a.dependencies)||a.dependencies.length>1000||!a.dependencies.every(x=>typeof x==='string'&&ID.test(x))||new Set(a.dependencies).size!==a.dependencies.length)issue(errors,'provenance.dependencies',field,'Record unique dependency asset IDs.');
  if(!Array.isArray(a.transformations)||a.transformations.length>1000)issue(errors,'provenance.transformations',field,'Record transformations as an array.');
  else for(const [j,t]of a.transformations.entries()){if(!fields(t,['tool','version','options','outputs'],`${field}.transformations[${j}]`,errors))continue;if(!text(t.tool)||!text(t.version)||!object(t.options)||noSecrets(t.options)||JSON.stringify(t.options).length>65536||!Array.isArray(t.outputs)||!t.outputs.length)issue(errors,'transformation.fields',field,'Record actual tool/version, nonsecret options and output fingerprints.');else t.outputs.forEach(x=>fingerprint(x,field,errors));}
 }
 if(!paths.has(String(config.asset).replaceAll('\\','/').toLowerCase()))issue(errors,'provenance.asset','assets','The selected GLB must have a ledger record.');
 for(const source of Array.isArray(config.sources)?config.sources:[])if(!paths.has(String(source).replaceAll('\\','/').toLowerCase()))issue(errors,'provenance.source','sources','Every used source asset or authored scene/code source needs a ledger record.');
 const byId=new Map(value.assets.filter(object).map(a=>[a.id,a]));
 const visited=new Set(),active=new Set();function visit(id){if(active.has(id)){issue(errors,'provenance.cycle','assets','Asset dependencies must be acyclic.');return;}if(visited.has(id))return;active.add(id);const a=byId.get(id);for(const dependency of Array.isArray(a?.dependencies)?a.dependencies:[]){if(!byId.has(dependency))issue(errors,'provenance.missing','assets','Every dependency needs its own ledger record.');else visit(dependency);}active.delete(id);visited.add(id);}
 for(const id of ids)visit(id);return errors;
}
export async function localFile(root,file,errors,field='file'){
 if(!safeRelativePath(file)){issue(errors,'path.unsafe',field,'Use a nonprivate project-relative file.');return null;}
 try{const absolute=path.resolve(root,file.replaceAll('\\','/')),resolved=await realpath(absolute);if(!contained(root,absolute)||!contained(root,resolved)||!safeRelativePath(path.relative(root,resolved))||!(await stat(resolved)).isFile())throw new Error();return resolved;}catch{issue(errors,'file.read',field,'File is missing, private or outside the project.');return null;}
}
export async function hashFile(root,file,errors,field='file'){
 const absolute=await localFile(root,file,errors,field);if(!absolute)return null;try{if((await stat(absolute)).size>268435456)throw new Error();const hash=createHash('sha256');for await(const chunk of createReadStream(absolute))hash.update(chunk);return {path:file.replaceAll('\\','/'),sha256:`sha256:${hash.digest('hex')}`};}catch{issue(errors,'file.hash',field,'Unable to hash a bounded local file.');return null;}
}
export async function writeExclusive(root,file,content,errors){
 if(!safeRelativePath(file)){issue(errors,'output.path','out','Use a nonprivate project-relative output.');return false;}
 try{const target=path.resolve(root,file.replaceAll('\\','/'));let ancestor=path.dirname(target);const absent=[];while(true){try{await stat(ancestor);break;}catch{absent.push(ancestor);const parent=path.dirname(ancestor);if(parent===ancestor)throw new Error();ancestor=parent;}}const resolved=await realpath(ancestor);if(!contained(root,resolved)||!safeRelativePath(path.relative(root,resolved)||'root')||!contained(root,target))throw new Error();for(const directory of absent.reverse())await mkdir(directory);const parent=await realpath(path.dirname(target));if(!contained(root,parent)||!safeRelativePath(path.relative(root,parent)||'root'))throw new Error();await writeFile(path.join(parent,path.basename(target)),content,{flag:'wx'});return true;}catch{issue(errors,'output.write','out','Output exists or its parent is unsafe or unwritable.');return false;}
}
export async function inspectProject(options){
 const {project,file='media/3d.json',delivery=false}=options??{};
 const errors=[],warnings=[];const root=await projectRoot(project,errors);if(!root)return resultReport(errors,{warnings});relative(file,'file',errors);const record=errors.length?null:await readInput(file,'json',errors,'file',root);if(errors.length)return resultReport(errors,{warnings});errors.push(...validateProject3d(record));if(errors.length)return resultReport(errors,{warnings});
 const provenance=await readInput(record.outputs.provenance,'json',errors,'provenance',root);if(!errors.length)errors.push(...validateProvenance(provenance,record,{delivery}));if(errors.length)return resultReport(errors,{warnings});
 const sources=[];for(const source of record.sources){const entry=await hashFile(root,source,errors,'sources');if(entry)sources.push(entry);}
 for(const asset of provenance.assets){if(asset.rightsStatus!=='cleared'||!NONCOMMERCIAL_TERMS.has(asset.license))warnings.push({code:'rights.check',assetId:asset.id,message:'Non-license or unresolved asset: maintainer must check before public or commercial use.'});for(const expected of [asset.file,asset.evidence,...asset.transformations.flatMap(x=>x.outputs)].filter(Boolean)){const actual=await hashFile(root,expected.path,errors,'provenance');if(actual&&actual.sha256!==expected.sha256)issue(errors,'file.stale','provenance','Asset, evidence or transformation output changed.');}}
 return resultReport(errors,{warnings,root,record,provenance,sources});
}
export async function initialize(options){const {project,input,file='media/3d.json'}=options??{};const errors=[];if(typeof file!=='string'||!file.toLowerCase().endsWith('.json')){issue(errors,'output.format','file','Initialize an explicit JSON project record.');return resultReport(errors);}const root=await projectRoot(project,errors);if(!root)return resultReport(errors);relative(input,'input',errors);const value=errors.length?null:await readInput(input,'json',errors,'input',root);if(!errors.length)errors.push(...validateProject3d(value));if(!errors.length)await writeExclusive(root,file,`${JSON.stringify(value,null,2)}\n`,errors);return resultReport(errors);}
export async function writeLedger(options){const inspected=await inspectProject(options);if(!inspected.ok)return inspected;const escape=x=>String(x).replaceAll('|','\\|').replace(/[\r\n]/g,' ');const lines=['# Used 3D assets','',`Request: ${escape(inspected.record.requestId)}`,`Usage: ${escape(inspected.record.usage)}`,'','Unresolved entries are **non-license**. Check their terms before public or commercial use; private prototype inclusion is not clearance.','','| ID | File and hash | Creator / source | License / status | Attribution / modifications | Review owner |','| --- | --- | --- | --- | --- | --- |'];for(const a of inspected.provenance.assets)lines.push(`| ${escape(a.id)} | ${escape(a.file.path)} (${a.file.sha256}) | ${escape(a.creator)} / ${escape(a.source.url??a.source.kind)} @ ${escape(a.source.revision)} | ${escape(a.rightsStatus==='cleared'&&NONCOMMERCIAL_TERMS.has(a.license)?a.license:'non-license')} / ${escape(a.rightsStatus)} | ${escape(a.attribution)} / ${escape(a.modifications.join('; '))} | ${escape(a.reviewOwner)} |`);const errors=[];await writeExclusive(inspected.root,inspected.record.outputs.assetLedger,lines.join('\n')+'\n',errors);return resultReport(errors,{warnings:inspected.warnings});}
async function main(args){const [command,...rest]=args;if(command==='--help')return resultReport([],{help:'init --project ABS --input relative.json [--file media/3d.json] | validate/ledger --project ABS [--file media/3d.json] [--delivery true]'});const errors=[];const opts=parseFlags(rest,['--project','--input','--file','--delivery'],errors);if(!['init','validate','ledger'].includes(command)||!opts['--project']||(command==='init'&&!opts['--input'])||(opts['--delivery']!==undefined&&opts['--delivery']!=='true'))issue(errors,'cli.arguments','arguments','Choose a documented command and explicit project.');if(errors.length)return resultReport(errors);const options={project:opts['--project'],input:opts['--input'],file:opts['--file']??'media/3d.json',delivery:opts['--delivery']==='true'};const r=command==='init'?await initialize(options):command==='ledger'?await writeLedger(options):await inspectProject(options);return resultReport(r.errors,{warnings:r.warnings??[]});}
const invoked=process.argv[1]?await realpath(path.resolve(process.argv[1])).catch(()=>null):null;
if(invoked&&import.meta.url===pathToFileURL(invoked).href){try{const r=await main(process.argv.slice(2));console.log(JSON.stringify(r));process.exitCode=r.ok?0:2;}catch{console.log(JSON.stringify(resultReport([{code:'validation.internal',path:'$',message:'Unable to validate; input contents were not echoed.'}])));process.exitCode=2;}}
