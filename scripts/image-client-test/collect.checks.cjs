const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

// Black-box fixtures: no real host records, credentials, provider or model.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'au-gui-collector-test-'));
const kit = path.join(temp, 'scripts/image-client-test');
const repository = path.resolve(__dirname, '../..');
for (const relative of ['scripts/image-client-test/collect.mjs', 'scripts/image-client-test/guard.cjs', 'scripts/image-client-test/integrity.cjs', 'scripts/hostlib/session-report.ts', 'registry/skills/image-creation/scripts/image-check.mjs']) {
  const target = path.join(temp, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repository, relative), target);
}
const availableId = '11111111-1111-4111-8111-111111111111';
const missingId = '22222222-2222-4222-8222-222222222222';
function fixture(name, { available = true, missing = true, partial = false, unrelated = false, wrapped = false, caseMismatch = false, injectedSkill = false, imageInvocations = false } = {}) {
  const workspace = path.join(temp, name);
  fs.mkdirSync(path.join(workspace, '.probe/sessions'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'assets/generated'), { recursive: true });
  const fixtureProfile = path.join(workspace, 'private-home');
  const recordRoot = path.join(fixtureProfile, '.claude/projects/fixture');
  fs.mkdirSync(recordRoot, { recursive: true });
  if (available) {
    const transcriptPath = path.join(recordRoot, `${availableId}.jsonl`);
    const records = [
      { type: 'agent-setting', agentSetting: 'agency-creative-designer' },
      { type: 'user', cwd: unrelated ? temp : caseMismatch ? workspace.toLowerCase() : workspace, version: 'fixture', promptId: 'prompt-1', message: { content: wrapped ? '\n<pasted_content id="fixture">\n[GUI fixture] Check only.\n</pasted_content>' : '[GUI fixture] Check only.' } },
      { type: 'assistant', message: { model: 'fixture-sonnet', content: [{ type: 'text', text: 'Fixture complete.' }] } },
    ];
    if (imageInvocations) {
      for (const id of ['blocked-image','allowed-image']) {
        records.push({type:'assistant',message:{model:'fixture-sonnet',content:[{type:'tool_use',id,name:'mcp__image-gen__generate_image',input:{provider:'gemini',quality:'fast',imageSize:'2K',aspectRatio:'4:5',fileName:'fixture',prompt:'Synthetic fixture'}}]}});
        records.push({type:'user',message:{content:[{type:'tool_result',tool_use_id:id,is_error:true,content:id==='blocked-image'?'Synthetic hook denial':'Synthetic provider failure'}]}});
      }
      fs.mkdirSync(path.join(workspace,'.probe/events'),{recursive:true});
      for (const [id,allowed] of [['blocked-image',false],['allowed-image',true]]) fs.writeFileSync(path.join(workspace,'.probe/events',id+'.json'),JSON.stringify({kind:'PreToolUse',sessionId:availableId,toolUseId:id,allowed}));
    }
    if (injectedSkill) records.push({type:'user',promptId:'prompt-1',message:{content:[{type:'text',text:'Base directory for this skill: /project/.claude/skills/mcp-setup\n# MCP Server Setup & Auto-Provisioning'}]}});
    if (wrapped) records.push({ type: 'user', promptId: 'prompt-1', message: { content: '\n<pasted_content id="fixture">\n[GUI fixture] repeated data under the same prompt id.\n</pasted_content>' } });
    fs.writeFileSync(transcriptPath, records.map(JSON.stringify).join('\n') + '\n' + (partial ? '{"type":"assistant"' : ''));
    fs.writeFileSync(path.join(workspace, '.probe/sessions/available.json'), JSON.stringify({ sessionId: availableId, transcriptPath }));
  }
  if (missing) fs.writeFileSync(path.join(workspace, '.probe/sessions/missing.json'), JSON.stringify({ sessionId: missingId, transcriptPath: path.join(recordRoot, `${missingId}.jsonl`) }));
  fs.writeFileSync(path.join(kit, 'cases.json'), JSON.stringify({ cases: [{ surface: 'desktop', workspace, sourceRevision: 'fixture', protectedFiles: [] }] }));
  return { workspace, fixtureProfile };
}
function collect(fixtureProfile, ...ids) {
  const preload = path.join(kit, 'fixture-profile.mjs');
  fs.writeFileSync(preload, `import os from 'node:os';\nos.homedir = () => ${JSON.stringify(fixtureProfile)};\n`);
  return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, path.join(kit, 'collect.mjs'), path.join(kit,'cases.json'), 'desktop', ...ids], { encoding: 'utf8', windowsHide: true });
}
test('automatic collection reports a missing Desktop transcript and still collects available sessions', () => {
  const { fixtureProfile } = fixture('mixed');
  const run = collect(fixtureProfile);
  assert.equal(run.status, 0, run.stderr || String(run.error));
  const evidence = JSON.parse(fs.readFileSync(path.join(kit, 'results/desktop/evidence.json'), 'utf8'));
  assert.deepEqual(evidence.sessions.map(session => session.sessionId), [availableId]);
  assert.deepEqual(evidence.missingTranscripts.map(item => item.sessionId), [missingId]);
  assert.equal(evidence.collectionComplete, false);
  assert.equal(evidence.preparedFromRevision, 'fixture');
  assert.equal(evidence.candidateSourceRevision, null);
  assert.match(fs.readFileSync(path.join(kit, 'results/desktop/summary.md'), 'utf8'), new RegExp(missingId));
  assert.equal(evidence.additionalModelSessionsLaunched, 0);
  assert.equal(evidence.knownNotionalModelCostSubtotalUSD,null);
});
test('collection refuses when every bound transcript is missing', () => {
  const { fixtureProfile } = fixture('all-missing', { available: false });
  const run = collect(fixtureProfile);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /No readable session records/);
  assert.match(run.stderr, new RegExp(missingId));
});
test('explicit UUID selection remains strict about missing records', () => {
  const { fixtureProfile } = fixture('explicit');
  const run = collect(fixtureProfile, missingId);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, new RegExp(missingId));
});
test('an unfinished final JSONL record is disclosed while complete records remain usable', () => {
  const { fixtureProfile } = fixture('partial', { missing: false, partial: true });
  const run = collect(fixtureProfile);
  assert.equal(run.status, 0, run.stderr || String(run.error));
  const evidence = JSON.parse(fs.readFileSync(path.join(kit, 'results/desktop/evidence.json'), 'utf8'));
  assert.equal(evidence.sessions[0].unparsedRecordLines, 1);
  assert.equal(evidence.sessions[0].humanPrompts, 1);
  assert.equal(evidence.collectionComplete, false);
});
test('a readable record from another project is rejected', () => {
  const { fixtureProfile } = fixture('unrelated', { missing: false, unrelated: true });
  const run = collect(fixtureProfile);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Unrelated test folder/);
});
test('GUI pasted-content wrappers are counted once per scripted prompt id', () => {
  const { fixtureProfile } = fixture('wrapped', { missing: false, wrapped: true });
  const run = collect(fixtureProfile);
  assert.equal(run.status, 0, run.stderr || String(run.error));
  const evidence = JSON.parse(fs.readFileSync(path.join(kit, 'results/desktop/evidence.json'), 'utf8'));
  assert.equal(evidence.sessions[0].scriptedHumanPrompts, 1);
  assert.equal(evidence.sessions[0].humanPrompts, 1);
});
test('human slash skill injection is recorded separately from Skill tool calls', () => {
  const {fixtureProfile}=fixture('injected-skill',{missing:false,injectedSkill:true});
  const run=collect(fixtureProfile);assert.equal(run.status,0,run.stderr);
  const evidence=JSON.parse(fs.readFileSync(path.join(kit,'results/desktop/evidence.json'),'utf8'));
  assert.deepEqual(evidence.sessions[0].injectedSkills,['mcp-setup']);
  assert.deepEqual(evidence.sessions[0].skillCalls,[]);
});

test('automatic bindings cannot redirect collection to configuration files', () => {
  const {workspace,fixtureProfile}=fixture('binding-escape',{missing:false});
  const target=path.join(workspace,'.mcp.json');fs.writeFileSync(target,'not a session record');
  fs.writeFileSync(path.join(workspace,'.probe/sessions/available.json'),JSON.stringify({sessionId:availableId,transcriptPath:target}));
  const run=collect(fixtureProfile);assert.notEqual(run.status,0);assert.match(run.stderr,/Session path escapes/);
});

test('UUID fallback works without SessionStart bindings and discloses uncollected event sessions', () => {
  const {workspace,fixtureProfile}=fixture('fallback',{missing:false});
  fs.rmSync(path.join(workspace,'.probe/sessions'),{recursive:true});
  fs.mkdirSync(path.join(workspace,'.probe/events'));
  fs.writeFileSync(path.join(workspace,'.probe/events/orphan.json'),JSON.stringify({sessionId:missingId,kind:'SessionStart'}));
  const run=collect(fixtureProfile,availableId);
  assert.equal(run.status,0,run.stderr);
  const evidence=JSON.parse(fs.readFileSync(path.join(kit,'results/desktop/evidence.json'),'utf8'));
  assert.equal(evidence.collectionComplete,false);
  assert.deepEqual(evidence.uncollectedEventSessionIds,[missingId]);
  assert.equal(evidence.totalNotionalModelCostUSD,null);
});
test('image-tool invocation counts distinguish a hook denial from an allowed failed call', () => {
  const {fixtureProfile}=fixture('image-decisions',{missing:false,imageInvocations:true});
  const run=collect(fixtureProfile);assert.equal(run.status,0,run.stderr);
  const evidence=JSON.parse(fs.readFileSync(path.join(kit,'results/desktop/evidence.json'),'utf8'));
  assert.equal(evidence.imageToolInvocations,2);
  assert.equal(evidence.imageInvocationsDeniedByHarness,1);
  assert.equal(evidence.imageInvocationsAllowedByHarness,1);
  assert.equal(evidence.imageInvocationsWithoutClearHarnessDecision,0);
  assert.deepEqual(evidence.sessions[0].imageCalls.map(c=>c.harnessDecision),['denied','allowed']);
  const summary=fs.readFileSync(path.join(kit,'results/desktop/summary.md'),'utf8');
  assert.match(summary,/Image-tool invocations: 2/);
  assert.match(summary,/harness-denied: 1/);
  assert.match(summary,/harness-allowed: 1/);
  assert.doesNotMatch(summary,/Image attempts recorded: 2/);
});

test('a failed image invocation without a hook decision stays unclassified', () => {
  const {workspace,fixtureProfile}=fixture('missing-image-decision',{missing:false,imageInvocations:true});
  fs.unlinkSync(path.join(workspace,'.probe/events/allowed-image.json'));
  const run=collect(fixtureProfile);assert.equal(run.status,0,run.stderr);
  const evidence=JSON.parse(fs.readFileSync(path.join(kit,'results/desktop/evidence.json'),'utf8'));
  assert.equal(evidence.imageInvocationsAllowedByHarness,0);
  assert.equal(evidence.imageInvocationsDeniedByHarness,1);
  assert.equal(evidence.imageInvocationsWithoutClearHarnessDecision,1);
  assert.equal(evidence.sessions[0].imageCalls[1].harnessDecision,'not-observed');
  assert.equal(evidence.totalNotionalModelCostUSD,null);
});

test('collector respects platform case sensitivity', {skip:process.platform==='win32'}, () => {
  const {fixtureProfile}=fixture('CaseSensitive',{missing:false,caseMismatch:true});
  const run=collect(fixtureProfile);
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/Unrelated test folder/);
});

after(() => {
  const absolute = path.resolve(temp), parent = path.resolve(os.tmpdir());
  assert.ok(absolute.toLowerCase().startsWith(parent.toLowerCase() + path.sep));
  assert.ok(path.basename(absolute).startsWith('au-gui-collector-test-'));
  fs.rmSync(absolute, { recursive: true, force: true });
});
