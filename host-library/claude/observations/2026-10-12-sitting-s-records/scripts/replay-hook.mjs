// Replays the mode-line hook on the FINAL saved transcript of a session, as the host would call it for an Agent call, and reports what it answers.
// Also reports every assistant text block that contains "Mode:" anywhere, and every thinking block that mentions the mode, so that "the line was never a text block" can be read off the file.
// Reads files, runs the installed hook in a temporary directory (its marker goes there), prints; changes nothing in the session.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [transcript, hookFile] = process.argv.slice(2);
const rows = fs.readFileSync(transcript, 'utf8').split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const textBlocks = [];
const thinking = [];
for (const r of rows) {
  if (r.type !== 'assistant') continue;
  for (const b of r.message?.content ?? []) {
    if (b.type === 'text') textBlocks.push({ at: r.timestamp, text: String(b.text ?? '') });
    if (b.type === 'thinking') thinking.push({ at: r.timestamp, text: String(b.thinking ?? '') });
  }
}
const lineAt = t => /^Mode: (?:Fully|Limited) Operational\./.test(t.replace(/^\s+/, ''));
console.log(`assistant text blocks: ${textBlocks.length}; of them opening with the mode line: ${textBlocks.filter(b => lineAt(b.text)).length}; containing "Mode:" anywhere: ${textBlocks.filter(b => b.text.includes('Mode:')).length}`);
for (const b of textBlocks) console.log(`  text @${b.at?.slice(11, 19)}: ${b.text.replace(/\s+/g, ' ').slice(0, 130)}`);
console.log(`thinking blocks: ${thinking.length}; mentioning the mode or "Limited Operational": ${thinking.filter(b => /Limited Operational|Fully Operational|Mode:/.test(b.text)).length}`);
for (const b of thinking.filter(x => x.text.trim())) console.log(`  thinking @${b.at?.slice(11, 19)}: ${b.text.replace(/\s+/g, ' ').slice(0, 260)}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-hook-'));
const payload = JSON.stringify({ session_id: 'replay-' + Date.now(), transcript_path: transcript, cwd: tmp, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: {}, tool_use_id: 'toolu_replay' });
const out = spawnSync('node', [hookFile], { input: payload, encoding: 'utf8', env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp } });
console.log(`the installed hook on the final transcript: exit ${out.status} (0 = the line is found and the call would pass, 2 = held)`);
fs.rmSync(tmp, { recursive: true, force: true });
