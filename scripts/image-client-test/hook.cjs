const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { decide, inside, sameFolder: equivalentFolder } = require('./guard.cjs');
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.probe/config.json'),'utf8'));
    const input = JSON.parse(data);
    const root = path.join(cfg.workspace,'.probe');
    fs.mkdirSync(path.join(root,'events'), {recursive:true});
    const sameFolder = equivalentFolder(input.cwd, cfg.workspace);
    const event = {at:new Date().toISOString(), kind:input.hook_event_name, sessionId:input.session_id, actor:input.agent_type ?? 'main', tool:input.tool_name, toolUseId:input.tool_use_id, folderMatches:sameFolder, verification:input.probe_verification===true};
    if (input.hook_event_name === 'SessionStart' && !event.verification && sameFolder && /^[a-f0-9-]{36}$/i.test(input.session_id ?? '') && typeof input.transcript_path === 'string' && inside(path.join(os.homedir(),'.claude/projects'),input.transcript_path) && path.basename(input.transcript_path) === input.session_id + '.jsonl') {
      fs.mkdirSync(path.join(root,'sessions'), {recursive:true});
      const runtime = {sessionId:input.session_id, transcriptPath:input.transcript_path, cwd:input.cwd, at:event.at};
      fs.writeFileSync(path.join(root,'sessions',input.session_id+'.json'), JSON.stringify(runtime));
      fs.writeFileSync(path.join(root,'latest.json'), JSON.stringify(runtime));
    }
    if (input.hook_event_name === 'SubagentStart' && !event.verification && sameFolder) {
      fs.mkdirSync(path.join(root,'peers'), {recursive:true});
      fs.writeFileSync(path.join(root,'peers',crypto.randomUUID()+'.json'),JSON.stringify({sessionId:input.session_id,agentId:input.agent_id,agentName:input.agent_name,agentType:input.agent_type}));
    }
    if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'ToolSearch') event.imageToolListed = JSON.stringify(input.tool_response ?? {}).includes('mcp__image-gen__generate_image');
    let decision;
    if (input.hook_event_name === 'PreToolUse') { decision = decide(cfg,input); event.allowed = decision.allow; if (!decision.allow) event.reason = decision.reason; }
    fs.writeFileSync(path.join(root,'events',crypto.randomUUID()+'.json'), JSON.stringify(event));
    if (decision && !decision.allow) process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:decision.reason}}));
    else process.stdout.write('{}');
  } catch { process.stderr.write('Synthetic GUI probe could not validate its input or configuration.'); process.exitCode = 2; }
});
