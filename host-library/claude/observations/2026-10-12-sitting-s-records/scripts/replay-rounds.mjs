// Replays the AMENDED mode-line hook (ADR 0051 as amended after Sitting S) on the FINAL saved transcript of a session, three holds in a row, each a round of its own
// (AGENTS_UNITED_MODE_LINE_ROUND_MS=0), as the host would call it for an Agent call. For each hold it prints the exit code and the whole message; the third message says
// how many text blocks of the lead the hook sees in the transcript. Reads the transcript, runs the hook in a temporary directory (its marker goes there) and changes
// nothing in the session.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [transcript, hookFile] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-rounds-'));
const session = 'replay-' + Date.now();
for (let call = 1; call <= 3; call += 1) {
  const payload = JSON.stringify({ session_id: session, transcript_path: transcript, cwd: tmp, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: {}, tool_use_id: 'toolu_replay' + call });
  const out = spawnSync('node', [hookFile], { input: payload, encoding: 'utf8', env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp, AGENTS_UNITED_MODE_LINE_ROUND_MS: '0' } });
  const lines = out.stderr.split('\n').filter(Boolean);
  console.log(`hold ${call}: exit ${out.status}; ${lines[0]}`);
  for (const line of lines.slice(1)) console.log(`    ${line}`);
}
fs.rmSync(tmp, { recursive: true, force: true });