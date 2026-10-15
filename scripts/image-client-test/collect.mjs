import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import guard from './guard.cjs';
import integrity from './integrity.cjs';
import {loadSession,resolveSessionFile} from '../hostlib/session-report.ts';
const root=path.dirname(fileURLToPath(import.meta.url));
const [manifest,surface,...ids]=process.argv.slice(2);
assert.ok(manifest, 'Usage: collect.mjs <cases.json> <surface> [session UUIDs...]');
const cfg=JSON.parse(fs.readFileSync(path.resolve(manifest),'utf8')).cases.find(item=>item.surface===surface);
assert.ok(cfg,'Choose desktop or vscode.');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const messageText=row=>typeof row.message?.content==='string'?row.message.content:Array.isArray(row.message?.content)?row.message.content.filter(block=>block?.type==='text').map(block=>block.text).join('\n'):'';
const boundDir=path.join(cfg.workspace,'.probe/sessions');
const bound=fs.existsSync(boundDir)?fs.readdirSync(boundDir).filter(file=>file.endsWith('.json')).map(file=>read(path.join(boundDir,file))):[];
const available=bound.filter(item=>typeof item.transcriptPath==='string'&&fs.existsSync(item.transcriptPath)&&fs.statSync(item.transcriptPath).isFile());
const missingTranscripts=bound.filter(item=>!available.includes(item)).map(item=>({sessionId:item.sessionId,transcriptPath:item.transcriptPath,reason:'No transcript file at the recorded SessionStart path.'}));
const files=ids.length?ids.map(id=>{assert.match(id,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);return resolveSessionFile(id);}):available.map(item=>item.transcriptPath);
assert.ok(files.length,`No readable session records. Missing bindings: ${missingTranscripts.map(item=>item.sessionId).join(', ')||'none'}. Supply the actual setup/designer UUIDs if their records exist; never launch another session to collect.`);
const eventsDir=path.join(cfg.workspace,'.probe/events');
const events=fs.existsSync(eventsDir)?fs.readdirSync(eventsDir).map(file=>read(path.join(eventsDir,file))).filter(event=>!event.verification):[];
// An isError result does not say whether a call reached the server. Correlate
// the controlling PreToolUse decision; an allowed call still does not prove
// provider receipt or billing.
const imageDecision=(sessionId,toolUseId)=>{
  const decisions=new Set(events.filter(event=>event.kind==='PreToolUse'&&event.sessionId===sessionId&&event.toolUseId===toolUseId&&typeof event.allowed==='boolean').map(event=>event.allowed));
  return decisions.size===1?(decisions.has(true)?'allowed':'denied'):decisions.size?'conflicting':'not-observed';
};
const sessions=[...new Set(files)].map(file=>{
  assert.ok(guard.inside(path.join(os.homedir(),'.claude/projects'),file)&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.jsonl$/i.test(path.basename(file)),'Session path escapes the host project records.');
  const session=loadSession(file); assert.ok(guard.sameFolder(session.cwd,cfg.workspace),'Unrelated test folder.');
  const lead=session.agents.find(agent=>agent.isLead);
  const calls=lead.calls.filter(call=>call.name==='mcp__image-gen__generate_image');
  const typed=fs.readFileSync(file,'utf8');
  const rows=[];
  let unparsedRecordLines=0;
  for(const line of typed.split(/\r?\n/).filter(line=>line.trim())) {
    try { const row=JSON.parse(line); if(row&&typeof row==='object'&&!Array.isArray(row)) rows.push(row); else unparsedRecordLines++; }
    catch { unparsedRecordLines++; }
  }
  const human=new Set(rows.filter(row=>row.type==='user'&&row.isSidechain!==true&&typeof row.promptId==='string'&&/\[GUI [^\]\r\n]+\]/.test(messageText(row))).map(row=>row.promptId)).size;
  const leadText=rows.filter(row=>row.type==='assistant').map(row=>messageText(row)).join('\n');
  const injectedSkills=[...new Set(rows.filter(row=>row.type==='user').flatMap(row=>[...messageText(row).matchAll(/Base directory for this skill:[^\r\n]*[/\\]skills[/\\](mcp-setup|image-generation)(?=[/\\\r\n]|$)/g)].map(match=>match[1])))];
  const setupPrinted=leadText.includes('mcp-image@0.18.0')&&leadText.includes('GEMINI_API_KEY');
  return {sessionId:session.sessionId,version:session.version,agentSetting:session.agentSetting,models:lead.models,humanPrompts:session.prompts,scriptedHumanPrompts:human,unparsedRecordLines,notionalModelCostUSD:session.cost?.totalCostUSD??null,setupCommandPrinted:setupPrinted,injectedSkills,nativeAgentSettings:[...new Set(rows.filter(row=>row.type==='agent-setting').map(row=>row.agentSetting).filter(value=>typeof value==='string'))],skillCalls:lead.calls.filter(call=>call.name==='Skill').map(call=>({name:call.input.skill,resultObserved:call.result!==undefined,isError:call.isError??false})),toolLookups:lead.calls.filter(call=>call.name==='ToolSearch').map(call=>({toolUseId:call.id,imageToolReferenced:call.result?.includes('tool_reference mcp__image-gen__generate_image')??false,isError:call.isError??false})),toolCalls:lead.calls.map(call=>({name:call.name,toolUseId:call.id,resultObserved:call.result!==undefined,isError:call.isError??false})),imageCalls:calls.map(call=>({harnessDecision:imageDecision(session.sessionId,call.id),at:call.at,toolUseId:call.id,provider:call.input.provider,quality:call.input.quality,imageSize:call.input.imageSize,aspectRatio:call.input.aspectRatio,fileName:call.input.fileName,resultObserved:call.result!==undefined,isError:call.isError??false})),keyShapeFound:/AIza[0-9A-Za-z_-]{20,}/.test(typed),errors:lead.calls.filter(call=>call.isError).map(call=>({at:call.at,tool:call.name}))};
});
const imageDir=path.join(cfg.workspace,'assets/generated');
const checked=spawnSync(process.execPath,[path.resolve(root,'../../registry/skills/image-creation/scripts/image-check.mjs'),imageDir,'--json'],{encoding:'utf8',windowsHide:true});
assert.ok(checked.status===0||checked.status===1,checked.stderr||String(checked.error));
const imageCheck=JSON.parse(checked.stdout);
const sourceUnchanged=integrity.protectedState(cfg);
const uncollectedEventSessionIds=[...new Set(events.map(event=>event.sessionId).filter(id=>typeof id==='string'&&!sessions.some(session=>session.sessionId===id)))].sort();
const collectionComplete=uncollectedEventSessionIds.length===0&&missingTranscripts.length===0&&sessions.every(item=>item.unparsedRecordLines===0);
const imageInvocations=sessions.flatMap(session=>session.imageCalls);
const imageInvocationCounts={imageToolInvocations:imageInvocations.length,imageInvocationsDeniedByHarness:imageInvocations.filter(call=>call.harnessDecision==='denied').length,imageInvocationsAllowedByHarness:imageInvocations.filter(call=>call.harnessDecision==='allowed').length,imageInvocationsWithoutClearHarnessDecision:imageInvocations.filter(call=>!['allowed','denied'].includes(call.harnessDecision)).length};
const result={...imageInvocationCounts,surface,workspace:cfg.workspace,preparedFromRevision:cfg.sourceRevision,candidateBranch:cfg.candidateBranch??null,candidateSourceRevision:cfg.candidateSourceRevision??null,protectedFilesUnchanged:sourceUnchanged,collectionComplete,uncollectedEventSessionIds,missingTranscripts,sessions,events,attemptUsed:fs.existsSync(path.join(cfg.workspace,'.probe/image-attempt.json')),imageCheck,imageCheckModifiesFiles:false,totalNotionalModelCostUSD:collectionComplete&&sessions.every(item=>typeof item.notionalModelCostUSD==='number')?sessions.reduce((sum,item)=>sum+item.notionalModelCostUSD,0):null,knownNotionalModelCostSubtotalUSD:sessions.some(item=>typeof item.notionalModelCostUSD==='number')?sessions.reduce((sum,item)=>sum+(item.notionalModelCostUSD??0),0):null,providerBillUSD:'unverified',additionalModelSessionsLaunched:0,limitations:[cfg.candidateSourceRevision?'The candidate revision and protected hashes identify the prepared bytes; a later branch head does not replace this tested revision.':'The legacy preparation manifest records the dev base and candidate branch, not necessarily the eventual candidate commit; use the runbook and protected hashes to identify tested bytes.','Missing transcripts and unparsed record lines are disclosed; absent evidence cannot establish no activity or spending in those sessions.','GUI behavior is established only by this client record, not by CLI or another GUI.','Standalone native setup/designer sessions do not establish coordinated team support or a lead-to-teammate handoff.','Sessions seen only in hook events remain uncollected; missing host records cannot establish activity or cost.','A Google-key-shape scan is heuristic, not proof that every secret format is absent.']};
const out=path.join(path.dirname(path.resolve(manifest)),'results',surface);fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(out,'summary.md'),`# ${surface} image test\n\nSessions: ${sessions.map(item=>item.sessionId+' ('+(item.agentSetting??'no native setting recorded')+')').join(', ')}. Image-tool invocations: ${result.imageToolInvocations} (harness-denied: ${result.imageInvocationsDeniedByHarness}; harness-allowed: ${result.imageInvocationsAllowedByHarness}; without a clear harness decision: ${result.imageInvocationsWithoutClearHarnessDecision}). An allowed invocation alone does not establish provider receipt or billing. Files checked: ${imageCheck.checked}; findings: ${imageCheck.findings.length}. Protected files unchanged: ${sourceUnchanged}. Notional model cost: ${result.totalNotionalModelCostUSD??'unverified'} USD. Provider bill: unverified.\n\nCollection complete: ${collectionComplete}. Uncollected event sessions: ${uncollectedEventSessionIds.join(', ')||'none'}. Missing transcripts: ${missingTranscripts.map(item=>item.sessionId).join(', ')||'none'}. Unparsed record lines: ${sessions.reduce((sum,item)=>sum+item.unparsedRecordLines,0)}. Missing records remain unverified; their hooks alone cannot establish model activity or cost.\n\nNo model was started by this collector. Native activation, tool availability, output directory, sidecar and containment errors need review in evidence.json. Preserve originals and share your UI observations separately; do not share keys or raw MCP configuration.\n`);
console.log(JSON.stringify({output:out,sessions:sessions.map(item=>item.sessionId),images:imageCheck.checked,findings:imageCheck.findings.length,collectionComplete,missingTranscripts:missingTranscripts.map(item=>item.sessionId)},null,2));
