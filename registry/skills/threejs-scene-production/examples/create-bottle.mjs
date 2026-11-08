import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, parseFlags, resultReport } from '../../audiovisual-review/scripts/review.mjs';
import { writeExclusive } from '../../3d-design-direction/scripts/project-3d.mjs';

/** Original MIT procedural geometry; no external asset or provider is used. */
export function createBottle() {
  const profile = [[.46,0],[.52,.05],[.55,.15],[.55,1.3],[.5,1.45],[.28,1.62],[.24,1.75],[.24,2.05],[.27,2.08],[.27,2.2]];
  const segments=48, positions=[], normals=[], body=[], cap=[];
  for(let ring=0;ring<profile.length;ring++) {
    const [radius,y]=profile[ring],before=profile[Math.max(0,ring-1)],after=profile[Math.min(profile.length-1,ring+1)];
    const dy=after[1]-before[1],dr=after[0]-before[0],length=Math.hypot(dy,dr);
    for(let segment=0;segment<segments;segment++) {const angle=segment*2*Math.PI/segments;positions.push(radius*Math.cos(angle),y,radius*Math.sin(angle));normals.push(dy*Math.cos(angle)/length,-dr/length,dy*Math.sin(angle)/length);}
  }
  // The two strips above the neck form the cap's flare and side wall.
  for(let ring=0;ring<profile.length-1;ring++)for(let segment=0;segment<segments;segment++){const a=ring*segments+segment,b=ring*segments+(segment+1)%segments,c=a+segments,d=b+segments;(profile[ring][1]>=2.05?cap:body).push(a,c,b,b,c,d);}
  for(const top of [false,true]) {const [radius,y]=profile[top?profile.length-1:0],center=positions.length/3;positions.push(0,y,0);normals.push(0,top?1:-1,0);for(let i=0;i<segments;i++){const angle=i*2*Math.PI/segments;positions.push(radius*Math.cos(angle),y,radius*Math.sin(angle));normals.push(0,top?1:-1,0);}for(let i=0;i<segments;i++){const current=center+1+i,next=center+1+(i+1)%segments;(top?cap:body).push(...(top?[center,next,current]:[center,current,next]));}}
  const positionBytes=Buffer.alloc(positions.length*4),normalBytes=Buffer.alloc(normals.length*4),bodyBytes=Buffer.alloc(body.length*2),capBytes=Buffer.alloc(cap.length*2);
  positions.forEach((v,i)=>positionBytes.writeFloatLE(v,i*4));normals.forEach((v,i)=>normalBytes.writeFloatLE(v,i*4));body.forEach((v,i)=>bodyBytes.writeUInt16LE(v,i*2));cap.forEach((v,i)=>capBytes.writeUInt16LE(v,i*2));
  const binary=Buffer.concat([positionBytes,normalBytes,bodyBytes,capBytes]);
  const json={asset:{version:'2.0',generator:'agents-united original bottle fixture 1.0.1',copyright:'NeoAnthropocene / agents-united (MIT)'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Original procedural bottle',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,material:0},{attributes:{POSITION:0,NORMAL:1},indices:3,material:1}]}],materials:[{name:'Original jade ceramic',pbrMetallicRoughness:{baseColorFactor:[.035,.25,.17,1],metallicFactor:.15,roughnessFactor:.28}},{name:'Original brushed brass cap',pbrMetallicRoughness:{baseColorFactor:[.64,.43,.16,1],metallicFactor:.75,roughnessFactor:.32}}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positionBytes.length,target:34962},{buffer:0,byteOffset:positionBytes.length,byteLength:normalBytes.length,target:34962},{buffer:0,byteOffset:positionBytes.length+normalBytes.length,byteLength:bodyBytes.length,target:34963},{buffer:0,byteOffset:positionBytes.length+normalBytes.length+bodyBytes.length,byteLength:capBytes.length,target:34963}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:'VEC3',min:[-.55,0,-.55],max:[.55,2.2,.55]},{bufferView:1,componentType:5126,count:normals.length/3,type:'VEC3'},{bufferView:2,componentType:5123,count:body.length,type:'SCALAR'},{bufferView:3,componentType:5123,count:cap.length,type:'SCALAR'}]};
  const raw=Buffer.from(JSON.stringify(json)),padding=(4-raw.length%4)%4,jsonBytes=Buffer.concat([raw,Buffer.alloc(padding,32)]);
  const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binaryHeader=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonBytes.length+binary.length,8);jsonHeader.writeUInt32LE(jsonBytes.length);jsonHeader.writeUInt32LE(0x4e4f534a,4);binaryHeader.writeUInt32LE(binary.length);binaryHeader.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,jsonHeader,jsonBytes,binaryHeader,binary]);
}
async function main(args) {if(args.length===1&&args[0]==='--help')return resultReport([],{help:'--project ABS --out new-relative.glb (original MIT procedural bottle; preserves existing files)'});const errors=[],opts=parseFlags(args,['--project','--out'],errors);if(!opts['--project']||!opts['--out']?.endsWith('.glb'))errors.push({code:'cli.arguments',path:'arguments',message:'Supply absolute project and new relative GLB output.'});const root=errors.length?null:await projectRoot(opts['--project'],errors);if(root)await writeExclusive(root,opts['--out'],createBottle(),errors);return resultReport(errors);}
const invoked=process.argv[1]?await realpath(path.resolve(process.argv[1])).catch(()=>null):null;
if(invoked&&import.meta.url===pathToFileURL(invoked).href){try{const report=await main(process.argv.slice(2));console.log(JSON.stringify(report));process.exitCode=report.ok?0:2;}catch{console.log(JSON.stringify(resultReport([{code:'demo.failed',path:'$',message:'Unable to create the bounded procedural example.'}])));process.exitCode=2;}}
