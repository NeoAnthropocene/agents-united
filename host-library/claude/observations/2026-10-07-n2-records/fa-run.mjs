// One headless first-answer check with an early stop (Plan 035 N2 slice b).
// Usage: node fa-run.mjs <scratch dir> <out file> <prompt file> [budget usd]
// Runs `claude -p` as the digital-agency lead with both team variables set and stops the process at the first assistant message that holds a text block
// or a call other than ToolSearch (or at the budget, or after 90 s). The record up to that point is written to <out file> as stream-json lines.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [dir, out, promptFile, budget = '0.15'] = process.argv.slice(2);
const prompt = fs.readFileSync(promptFile, 'utf8').trim();
const args = ['-p', prompt, '--agent', 'orchestrator-digital-agency', '--model', 'sonnet', '--effort', 'low', '--permission-mode', 'auto',
  '--output-format', 'stream-json', '--verbose', '--max-budget-usd', budget];
const child = spawn('claude', args, {
  cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
  env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1', CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' },
});

const sink = fs.createWriteStream(out);
let buffer = '';
let stopped = '';
const stop = (why) => { if (!stopped) { stopped = why; child.kill(); } };
const timer = setTimeout(() => stop('timeout 90 s'), 90_000);

child.stdout.on('data', chunk => {
  sink.write(chunk);
  buffer += chunk.toString('utf8');
  const parts = buffer.split('\n');
  buffer = parts.pop() ?? '';
  for (const line of parts) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type !== 'assistant') continue;
    const blocks = event.message?.content ?? [];
    const text = blocks.some(b => b.type === 'text' && b.text.trim() !== '');
    const other = blocks.some(b => b.type === 'tool_use' && b.name !== 'ToolSearch');
    if (text || other) stop(text ? 'first text block' : 'first call other than ToolSearch');
  }
});
child.on('close', code => {
  clearTimeout(timer);
  sink.end();
  console.log(`stopped: ${stopped || 'ended by itself'} | exit ${code}`);
});
