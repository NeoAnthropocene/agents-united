const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('./guard.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'au-gui-guard-test-'));
const config = { workspace: temp, imageBase: 'gui-test-once' };
fs.mkdirSync(path.join(temp, '.probe'), {recursive:true});
const call = (name, input, extra={}) => decide(config, {cwd:temp, session_id:'unit-session', tool_name:name, tool_input:input, ...extra});
test('rejects credential configuration reads and arbitrary shell commands', () => {
  assert.equal(call('Read', {file_path:path.join(os.homedir(), '.claude.json')}).allow, false);
  assert.equal(call('Bash', {command:'claude mcp get image-gen'}).allow, false);
  assert.equal(call('Bash', {command:'node -e "process.env"'}).allow, false);
});
test('permits local skill reads but not test control writes', () => {
  assert.equal(call('Read', {file_path:path.join(temp, '.claude/skills/image-generation/SKILL.md')}).allow, true);
  assert.equal(call('Write', {file_path:path.join(temp, '.probe/armed.json')}).allow, false);
  assert.equal(call('Write', {file_path:path.join(temp, 'assets/generated/hero.provenance.json')}).allow, true);
});
test('rejects generation before human arming and by the lead', () => {
  const image = {provider:'gemini', quality:'fast', imageSize:'2K', aspectRatio:'4:5', fileName:config.imageBase, prompt:'A synthetic dog on a sofa.'};
  assert.equal(call('mcp__image-gen__generate_image', image, {agent_type:'agency-creative-designer'}).allow, false);
  fs.writeFileSync(path.join(temp, '.probe/armed.json'), '{"sessionId":"unit-session"}');
  assert.equal(call('mcp__image-gen__generate_image', image).allow, false);
});
test('allows only the selected provider and no input images', () => {
  const image = {provider:'seedream', quality:'fast', imageSize:'2K', aspectRatio:'4:5', fileName:config.imageBase, prompt:'Synthetic.'};
  assert.equal(call('mcp__image-gen__generate_image', image, {agent_type:'agency-creative-designer'}).allow, false);
  assert.equal(call('mcp__image-gen__generate_image', {...image,provider:'gemini',inputImagePaths:['outside.jpg']}, {agent_type:'agency-creative-designer'}).allow, false);
});
test('atomically allows one attempt, including failed provider attempts', () => {
  const image = {provider:'gemini', quality:'fast', imageSize:'2K', aspectRatio:'4:5', fileName:config.imageBase, prompt:'A synthetic dog on a sofa.'};
  assert.equal(call('mcp__image-gen__generate_image', image, {agent_type:'agency-creative-designer'}).allow, true);
  assert.equal(call('mcp__image-gen__generate_image', image, {agent_type:'agency-creative-designer'}).allow, false);
});
test('scope mismatch and unrelated services cannot run', () => {
  assert.equal(call('Read', {file_path:path.join(temp,'brief.md')}, {cwd:os.tmpdir()}).allow, false);
  assert.equal(call('mcp__github__create_issue', {}).allow, false);
  assert.equal(call('Agent', {subagent_type:'agency-growth-strategist'}).allow, false);
});
test('allows image-check only as the exact local script command', () => {
  assert.equal(call('Bash', {command:'node .claude/skills/image-creation/scripts/image-check.mjs assets/generated --stamp --json'}).allow, true);
  assert.equal(call('Bash', {command:'node .claude/skills/image-creation/scripts/image-check.mjs assets/generated --stamp --json; claude mcp get image-gen'}).allow, false);
});
test('a verified native main designer can use only its own armed session', () => {
  fs.unlinkSync(path.join(temp,'.probe/image-attempt.json'));
  fs.writeFileSync(path.join(temp,'.probe/armed.json'),JSON.stringify({sessionId:'native-designer-session',verifiedMainAgent:'agency-creative-designer'}));
  const image={provider:'gemini',quality:'fast',imageSize:'2K',aspectRatio:'4:5',fileName:config.imageBase,prompt:'Synthetic dog.'};
  assert.equal(call('mcp__image-gen__generate_image',image).allow,false);
  assert.equal(call('mcp__image-gen__generate_image',image,{session_id:'native-designer-session',agent_type:'orchestrator-digital-agency'}).allow,false);
  assert.equal(call('mcp__image-gen__generate_image',image,{session_id:'native-designer-session'}).allow,true);
});
process.on('exit', () => {
  const absolute = path.resolve(temp), parent = path.resolve(os.tmpdir());
  assert.ok(absolute.toLowerCase().startsWith(parent.toLowerCase() + path.sep));
  assert.ok(path.basename(absolute).startsWith('au-gui-guard-test-'));
  fs.rmSync(absolute, {recursive:true,force:true});
});
