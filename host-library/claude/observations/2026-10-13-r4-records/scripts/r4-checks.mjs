// Checks of the R4 session that the helper does not make: the fixed contract in every brief, hook errors in any record, the order of acceptance / owner / first write for Ava,
// the shutdown responses of each teammate (time sent, and whether the lead received one), and the contract tokens in the nine files.
// usage: node r4-checks.mjs <project-folder> <session-id> <pilot-folder>      Prints names, times and counts; no secrets are in these records.
import fs from 'node:fs';
import path from 'node:path';

const [project, id, pilot] = process.argv.slice(2);
const leadFile = path.join(project, `${id}.jsonl`);
const subDir = path.join(project, id, 'subagents');
const read = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
const blocks = entry => (Array.isArray(entry?.message?.content) ? entry.message.content : []);
const time = entry => entry?.timestamp ?? '';
const short = iso => (iso ? iso.slice(11, 23) : '');

const lead = read(leadFile);
console.log('=== lead: Agent briefs (the fixed contract in every brief)');
const briefs = [];
for (const entry of lead) {
  for (const block of blocks(entry)) {
    if (block.type === 'tool_use' && block.name === 'Agent') {
      const prompt = String(block.input?.prompt ?? '');
      briefs.push({ at: time(entry), name: block.input?.name, type: block.input?.subagent_type, prompt });
    }
  }
}
for (const brief of briefs) {
  const colour = brief.prompt.includes('color.cta.primary');
  const testId = brief.prompt.includes('hero-primary-cta');
  const peers = /peer/i.test(brief.prompt);
  const readOnly = /CONSULTATION ONLY/i.test(brief.prompt);
  console.log(`${short(brief.at)} ${String(brief.name).padEnd(8)} ${String(brief.type).padEnd(34)} colour-token:${colour ? 'yes' : 'NO '} testId:${testId ? 'yes' : 'NO '} peers-listed:${peers ? 'yes' : 'no '} consultation-only:${readOnly ? 'yes' : 'no'} chars:${brief.prompt.length}`);
}
const both = briefs.filter(b => b.prompt.includes('color.cta.primary') && b.prompt.includes('hero-primary-cta')).length;
console.log(`briefs with both values: ${both} of ${briefs.length}`);

console.log('\n=== lead: AskUserQuestion, its answer, and the owner of task 1');
let askAt = '';
let answerAt = '';
let ownerAt = '';
const askIds = new Set();
for (const entry of lead) {
  for (const block of blocks(entry)) {
    if (block.type === 'tool_use' && block.name === 'AskUserQuestion') { askAt = time(entry); askIds.add(block.id); }
    if (block.type === 'tool_result' && askIds.has(block.tool_use_id)) answerAt = time(entry);
    if (block.type === 'tool_use' && block.name === 'TaskUpdate' && block.input?.taskId === '1' && block.input?.owner) ownerAt = ownerAt || time(entry);
  }
}
console.log(`ask ${short(askAt)}  answered ${short(answerAt)}  task 1 owner set ${short(ownerAt)}`);

console.log('\n=== lead: Bash commands (first 160 chars)');
for (const entry of lead) for (const block of blocks(entry)) if (block.type === 'tool_use' && block.name === 'Bash') console.log(`${short(time(entry))} ${String(block.input?.command).replace(/\s+/g, ' ').slice(0, 160)}`);

console.log('\n=== hook errors in any record (strings: "hook error", "Mode line first", "PreToolUse")');
const files = [leadFile, ...(fs.existsSync(subDir) ? fs.readdirSync(subDir).filter(f => f.endsWith('.jsonl')).map(f => path.join(subDir, f)) : [])];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const count = needle => text.split(needle).length - 1;
  console.log(`${path.basename(file).slice(0, 44).padEnd(46)} hook error:${count('hook error')} Mode line first:${count('Mode line first')} PreToolUse:${count('PreToolUse')}`);
}

console.log('\n=== teammates: first and last record, first Write/Edit, shutdown responses sent (tool_use SendMessage with a shutdown_response)');
for (const file of files.slice(1)) {
  const records = read(file);
  const meta = (() => { const m = file.replace(/\.jsonl$/, '.meta.json'); return fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, 'utf8')) : {}; })();
  let firstWrite = '';
  const responses = [];
  for (const entry of records) {
    for (const block of blocks(entry)) {
      if (block.type === 'tool_use' && (block.name === 'Write' || block.name === 'Edit') && !firstWrite) firstWrite = time(entry);
      if (block.type === 'tool_use' && block.name === 'SendMessage') {
        const message = block.input?.message;
        const asText = typeof message === 'string' ? message : JSON.stringify(message ?? {});
        if (/shutdown_response/.test(asText)) responses.push({ at: time(entry), approve: /"approve":\s*true/.test(asText), asObject: typeof message === 'object' });
      }
    }
  }
  console.log(`${path.basename(file).slice(0, 34).padEnd(36)} ${String(meta.agentType ?? meta.name ?? '').padEnd(34)} first ${short(time(records[0]))} last ${short(time(records.at(-1)))} firstWrite ${short(firstWrite)} responses: ${responses.map(r => `${short(r.at)} approve:${r.approve} object:${r.asObject}`).join(' | ') || 'none'}`);
}

console.log('\n=== lead: shutdown_approved / teammate_terminated received (by name)');
const approved = [];
const terminated = [];
for (const entry of lead) {
  const text = JSON.stringify(entry.message?.content ?? '');
  for (const match of text.matchAll(/shutdown_approved[^}]*?\\"from\\":\\"([a-z]+)\\"[^}]*?\\"timestamp\\":\\"([^\\]+)\\"/g)) approved.push(`${match[1]}@${match[2].slice(11, 23)}`);
  for (const match of text.matchAll(/teammate_terminated\\",\\"message\\":\\"([a-z]+) has shut down/g)) terminated.push(match[1]);
}
console.log('approved:', approved.join(', '));
console.log('terminated:', terminated.join(', '));

console.log('\n=== files: contract tokens and lines');
if (pilot && fs.existsSync(pilot)) {
  for (const name of fs.readdirSync(pilot).sort()) {
    const text = fs.readFileSync(path.join(pilot, name), 'utf8');
    console.log(`${name.padEnd(22)} lines:${String(text.split('\n').length - (text.endsWith('\n') ? 1 : 0)).padStart(3)} color.cta.primary:${text.includes('color.cta.primary') ? 'yes' : 'no '} hero-primary-cta:${text.includes('hero-primary-cta') ? 'yes' : 'no '}`);
  }
}
