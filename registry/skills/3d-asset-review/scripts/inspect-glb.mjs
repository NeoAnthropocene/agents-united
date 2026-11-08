import { open, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeRelativePath } from '../../audiovisual-review/scripts/review.mjs';

const PIN = '2.0.0-dev.3.10';
const fail = (code, field, message) => ({ code, path: field, message });
const inside = (root, target) => { const r = path.relative(root, target); return r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r); };
const identity = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b) { return Array.from({length:16}, (_,i) => { let n=0; for(let k=0;k<4;k++) n+=a[k*4+i%4]*b[Math.floor(i/4)*4+k]; return n; }); }
function matrix(n) {
  if (n.matrix) return n.matrix;
  const [x,y,z,w]=n.rotation ?? [0,0,0,1], [sx,sy,sz]=n.scale ?? [1,1,1], [tx,ty,tz]=n.translation ?? [0,0,0];
  return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,tx,ty,tz,1];
}
function metricsFor(json, bin, bytes) {
  if (!Number.isInteger(json.scene) || !json.scenes?.[json.scene]) throw fail('unsupported.scene','asset','An explicit default scene is required for scene metrics.');
  if ((json.extensionsUsed ?? []).length || (json.extensionsRequired ?? []).length) throw fail('unsupported.extension','asset','Extensions are not supported by these metrics.');
  if ((json.buffers ?? []).some(b => b.uri !== undefined) || (json.images ?? []).some(i => i.uri !== undefined)) throw fail('unsupported.resource','asset','External and data URI resources are unsupported.');
  const images = (json.images ?? []).map((image) => {
    const view = json.bufferViews?.[image?.bufferView];
    if (!image || !view || view.buffer !== 0) throw fail('asset.image','asset','Texture image is missing or not embedded in the GLB buffer.');
    const start=view.byteOffset ?? 0, data=bin.subarray(start,start+view.byteLength);
    if (data.length !== view.byteLength) throw fail('asset.image','asset','Image buffer view is truncated.');
    let width, height;
    if (image.mimeType === 'image/png' && data.length >= 24 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {width=data.readUInt32BE(16);height=data.readUInt32BE(20);}
    else if (image.mimeType === 'image/jpeg' && data.length >= 4 && data[0]===255 && data[1]===216) {
      let offset=2; while(offset+4<=data.length) {if(data[offset]!==255) break; const marker=data[offset+1]; offset+=2; if(marker===216 || marker===1 || (marker>=208 && marker<=215)) continue; if(offset+2>data.length) break; const length=data.readUInt16BE(offset); if(length<2 || offset+length>data.length) break; if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length>=7){height=data.readUInt16BE(offset+3);width=data.readUInt16BE(offset+5);break;} offset+=length;}
    }
    if (!width || !height || !Number.isSafeInteger(width*height*4)) throw fail('unsupported.image','asset','Only valid embedded PNG and JPEG dimensions are supported.');
    return {width,height,decodedBytes:width*height*4};
  });
  const textures=(json.textures ?? []).map(texture=>{const image=images[texture.source];if(!image) throw fail('asset.image','asset','Texture references a missing image.');return image;});
  if ((json.accessors ?? []).some(a => a.sparse) || (json.bufferViews ?? []).some(v => v.byteStride)) throw fail('unsupported.accessor','asset','Sparse and interleaved accessors are unsupported.');
  if ((json.animations ?? []).length || (json.skins ?? []).length || (json.meshes ?? []).some(m => (m.primitives ?? []).some(p => p.targets))) throw fail('unsupported.deformation','asset','Animated, skinned and morph geometry is unsupported.');
  let storedTriangles=0; const meshTriangles=[];
  for (const m of json.meshes ?? []) { let count=0; for (const p of m.primitives) { if ((p.mode ?? 4)!==4) throw fail('unsupported.mode','asset','Only triangle-list primitives are supported.'); const a=json.accessors[p.indices ?? p.attributes.POSITION]; count+=a.count/3; } meshTriangles.push(count); storedTriangles+=count; }
  let renderedTriangles=0, instances=0; const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  const visit=(index,parent)=>{ const n=json.nodes[index]; const world=multiply(parent,matrix(n)); if(n.mesh!==undefined) { instances++; renderedTriangles+=meshTriangles[n.mesh]; for(const p of json.meshes[n.mesh].primitives) { const a=json.accessors[p.attributes.POSITION], v=json.bufferViews[a.bufferView]; if (a.componentType!==5126 || a.type!=='VEC3' || v.buffer!==0) throw fail('unsupported.position','asset','Positions require tightly packed float VEC3 in the GLB buffer.'); const start=(v.byteOffset??0)+(a.byteOffset??0); let indexAt, indexCount; if(p.indices!==undefined){const ia=json.accessors[p.indices], iv=json.bufferViews[ia.bufferView], size=({5121:1,5123:2,5125:4})[ia.componentType]; if(!size || iv.buffer!==0) throw fail('unsupported.indices','asset','Unsupported index accessor.'); const begin=(iv.byteOffset??0)+(ia.byteOffset??0); indexCount=ia.count; indexAt=(i)=>{const off=begin+i*size;if(off+size>bin.length || off+size>(iv.byteOffset??0)+iv.byteLength) throw fail('asset.accessor','asset','Index accessor exceeds its buffer.');return size===1?bin.readUInt8(off):size===2?bin.readUInt16LE(off):bin.readUInt32LE(off);};} else {indexCount=a.count;indexAt=i=>i;} for(let vertex=0;vertex<indexCount;vertex++){const i=indexAt(vertex);if(i>=a.count) throw fail('asset.accessor','asset','Index exceeds position accessor.');const off=start+i*12; if(off+12>bin.length || off+12>(v.byteOffset??0)+v.byteLength) throw fail('asset.accessor','asset','Position accessor exceeds its buffer.'); const x=bin.readFloatLE(off),y=bin.readFloatLE(off+4),z=bin.readFloatLE(off+8); const q=[world[0]*x+world[4]*y+world[8]*z+world[12],world[1]*x+world[5]*y+world[9]*z+world[13],world[2]*x+world[6]*y+world[10]*z+world[14]]; for(let j=0;j<3;j++){min[j]=Math.min(min[j],q[j]);max[j]=Math.max(max[j],q[j]);} } } } for(const c of n.children ?? []) visit(c,world); };
  for(const n of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(n,identity());
  return { bytes, storedTriangles, renderedTriangles, instances, bounds: instances ? {min,max} : null, materials:(json.materials??[]).length, textures, extensionsUsed:json.extensionsUsed??[], extensionsRequired:json.extensionsRequired??[] };
}
// Preserve validator classifications without copying untrusted model text or resource metadata.
function safeValidatorReport(report) {
  const issues=report?.issues, counts=['numErrors','numWarnings','numInfos','numHints'];
  if(!issues || counts.some(k=>!Number.isSafeInteger(issues[k])||issues[k]<0) || !Array.isArray(issues.messages) || typeof issues.truncated!=='boolean') throw Error('invalid validator output');
  const messages=issues.messages.map(({code,severity})=>{if(typeof code!=='string'||!/^[A-Z0-9_]{1,100}$/.test(code)||!Number.isInteger(severity)||severity<0||severity>3)throw Error('invalid validator issue');return {code,severity};});
  return {textOmitted:true,issues:{numErrors:issues.numErrors,numWarnings:issues.numWarnings,numInfos:issues.numInfos,numHints:issues.numHints,messages,truncated:issues.truncated}};
}
export async function inspectGlb(input) {
  const {project,asset,budgets}=input && typeof input === 'object' ? input : {};
  const errors=[]; const result={ok:false,errors,source:null,budgets,metrics:null,validator:null};
  if(!safeRelativePath(asset)) {errors.push(fail('path.unsafe','asset','Use a project-relative file path.'));return result;}
  if(typeof project!=='string' || !path.isAbsolute(project)) {errors.push(fail('project.invalid','project','Project must be an absolute directory path.'));return result;}
  const keys=['maxBytes','maxTriangles','maxTextureDimension','maxTextureBytes'];
  if (!budgets || typeof budgets!=='object' || Array.isArray(budgets) || Object.keys(budgets).some(k=>!keys.includes(k)) || keys.some(k=>!Number.isSafeInteger(budgets[k]) || budgets[k]<1)) {errors.push(fail('budget.invalid','budgets','Exactly four positive integer budgets are required.'));return result;}
  let root,bytes; try {root=await realpath(project); const target=await realpath(path.resolve(root,asset.replaceAll('\\','/'))); if(!inside(root,target) || !safeRelativePath(path.relative(root,target))) throw Error('outside');const handle=await open(target,'r');try {const info=await handle.stat();if(!info.isFile())throw Error('not file');if(info.size>budgets.maxBytes || info.size>268435456){errors.push(fail('budget.bytes','budgets.maxBytes','Asset exceeds the byte budget or 256 MiB safety limit.'));return result;}const buffer=Buffer.alloc(info.size+1);let read=0;while(read<buffer.length){const part=await handle.read(buffer,read,buffer.length-read,null);if(!part.bytesRead)break;read+=part.bytesRead;}if(read!==info.size)throw Error('file changed');bytes=buffer.subarray(0,read);}finally{await handle.close();}} catch {errors.push(fail('path.unavailable','asset','Asset is missing, private, changed, or resolves outside project.'));return result;}
  result.source={path:asset.replaceAll('\\','/'),sha256:`sha256:${createHash('sha256').update(bytes).digest('hex')}`};
  // Reject unsupported URI resources before producing an upstream report that can echo signed URLs.
  // This only screens the declared GLB JSON; Khronos remains authoritative for supported assets.
  try {
    if(bytes.length>=20 && bytes.readUInt32LE(0)===0x46546c67 && bytes.readUInt32LE(16)===0x4e4f534a) {
      const len=bytes.readUInt32LE(12);
      if(20+len<=bytes.length){const declared=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
        if(['buffers','images'].some(key=>Array.isArray(declared?.[key]) && declared[key].some(entry=>entry && Object.hasOwn(entry,'uri')))) {
          errors.push(fail('unsupported.resource','asset','External and data URI resources are unsupported.'));return result;
        }
      }
    }
  } catch { /* Let the validator diagnose malformed JSON without inventing a validity result. */ }
  let validator; try { const dir=await realpath(path.join(root,'media','3d-runtime','node_modules','gltf-validator')); if(!inside(root,dir)) throw Error(); const hashes={'index.js':'78deff9ea85743e86461c2d14fae76e7fc3ca0432e652f62948066b55fa16f0d','gltf_validator.dart.js':'b73a7b2d455ac217567725138b46d826a13d7d1bb0c88c15f7c571bfb349298c'}; for(const [name,hash] of Object.entries(hashes)){const file=await realpath(path.join(dir,name));if(!inside(dir,file) || createHash('sha256').update(await readFile(file)).digest('hex')!==hash) throw Error();} const manifest=await realpath(path.join(dir,'package.json'));if(!inside(dir,manifest)) throw Error();const pkg=JSON.parse(await readFile(manifest,'utf8')); if(pkg.version!==PIN || pkg.name!=='gltf-validator' || pkg.main!=='index.js') throw Error(); validator=createRequire(manifest)(path.join(dir,'index.js')); } catch {errors.push(fail('validator.missing','validator',`Install intact project-local gltf-validator ${PIN}.`));return result;}
  try {const report=await validator.validateBytes(new Uint8Array(bytes),{format:'glb',writeTimestamp:false,maxIssues:0});result.validator={version:validator.version(),report:safeValidatorReport(report)};let declared;try{if(bytes.length>=20){const len=bytes.readUInt32LE(12);if(20+len<=bytes.length) declared=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));}}catch{} if((declared?.extensionsUsed??[]).length || (declared?.extensionsRequired??[]).length) errors.push(fail('unsupported.extension','asset','Extensions and compression are unsupported by these metrics.'));if(report.issues.numErrors>0) errors.push(fail('validator.invalid','asset','Khronos validation reported errors.'));if(errors.length)return result;}
  catch {errors.push(fail('validator.invalid','asset','Khronos could not validate the GLB.'));return result;}
  try {if(bytes.length<20 || bytes.readUInt32LE(0)!==0x46546c67 || bytes.readUInt32LE(8)!==bytes.length) throw fail('asset.invalid','asset','Invalid or truncated GLB.'); const length=bytes.readUInt32LE(12); if(20+length>bytes.length) throw fail('asset.invalid','asset','Truncated JSON chunk.'); const json=JSON.parse(bytes.subarray(20,20+length).toString('utf8')); const binStart=20+length; const bin=binStart+8<=bytes.length?bytes.subarray(binStart+8):Buffer.alloc(0); result.metrics=metricsFor(json,bin,bytes.length); if(bytes.length>budgets.maxBytes) errors.push(fail('budget.bytes','budgets.maxBytes','Asset exceeds byte budget.')); if(result.metrics.renderedTriangles>budgets.maxTriangles) errors.push(fail('budget.triangles','budgets.maxTriangles','Asset exceeds rendered triangle budget.')); if(result.metrics.textures.some(t=>t.width>budgets.maxTextureDimension || t.height>budgets.maxTextureDimension)) errors.push(fail('budget.textureDimension','budgets.maxTextureDimension','Texture exceeds dimension budget.')); if(result.metrics.textures.reduce((n,t)=>n+t.decodedBytes,0)>budgets.maxTextureBytes) errors.push(fail('budget.textureBytes','budgets.maxTextureBytes','Textures exceed decoded RGBA byte budget.')); }
  catch(e){errors.push(e?.code ? e : fail('asset.invalid','asset','Unsupported or malformed GLB data.'));}
  result.ok=errors.length===0; return result;
}

async function cli(args) {
  if(args[0]!=='inspect' || args.length!==9) throw Error('usage');
  const options={}; for(let i=1;i<args.length;i+=2){if(!['--project','--asset','--budgets','--out'].includes(args[i]) || options[args[i]]!==undefined) throw Error('usage'); options[args[i]]=args[i+1];}
  if(!path.isAbsolute(options['--project'] ?? '') || !safeRelativePath(options['--budgets']) || !safeRelativePath(options['--out'])) throw Error('path');
  const root=await realpath(options['--project']); const budgetsPath=await realpath(path.resolve(root,options['--budgets'].replaceAll('\\','/')));
  if(!inside(root,budgetsPath)) throw Error('path');
  const out=path.resolve(root,options['--out'].replaceAll('\\','/'));const parent=await realpath(path.dirname(out));if(!inside(root,parent)) throw Error('path');
  const budgets=JSON.parse(await readFile(budgetsPath,'utf8'));const report=await inspectGlb({project:root,asset:options['--asset'],budgets});
  await writeFile(path.join(parent,path.basename(out)),JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
const invoked=process.argv[1]?await realpath(path.resolve(process.argv[1])).catch(()=>null):null;
if(invoked && import.meta.url===pathToFileURL(invoked).href) {
  try {const result=await cli(process.argv.slice(2));console.log(JSON.stringify(result));process.exitCode=result.ok?0:2;}
  catch {console.log(JSON.stringify({ok:false,errors:[fail('inspect.cli','$','Invalid arguments or inaccessible, unsafe, or existing report path.')]}));process.exitCode=2;}
}
