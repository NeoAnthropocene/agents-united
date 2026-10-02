// agents-united guard hook for Antigravity (ADR 0030). One reviewed, dependency-free file, installed beside hooks.json in `.agents/hooks/`.
// It denies what no agent should do without a human: a forced push, a production deploy, a .env write. The patterns are the ones of the
// Claude guard (src/core/guard.ts); a test keeps the two identical. It runs as a PreToolUse command hook for the main agent and for
// subagents alike. Observed on agy 1.2.15: an answer with no decision, non-JSON output or a non-zero exit blocks the call, so this file
// always answers: `deny` with a reason for a match, otherwise `ask`, which falls back to the user's own permission settings. It never answers `allow`.

const FORCE_PUSH = /\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/;
const VERCEL_PROD = /\bvercel\b[^;&|]*--prod\b/;
const ENV_PATH = /(^|\/)\.env(\.(?!example$)[^\/]+)?$/;
const ENV_REDIRECT = />\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/;

const WRITE_TOOLS = new Set(['write_to_file', 'replace_file_content', 'multi_replace_file_content']);

const reasonFor = (name, args) => {
  const given = args && typeof args === 'object' ? args : {};
  if (name === 'run_command') {
    const command = typeof given.CommandLine === 'string' ? given.CommandLine : '';
    if (FORCE_PUSH.test(command)) return 'git push --force';
    if (VERCEL_PROD.test(command)) return 'vercel --prod';
    if (ENV_REDIRECT.test(command)) return 'a .env write';
  } else if (WRITE_TOOLS.has(name)) {
    const target = typeof given.TargetFile === 'string' ? given.TargetFile : '';
    if (ENV_PATH.test(target.replace(/\\/g, '/'))) return 'a .env write';
  }
  return '';
};

let raw = '';
process.stdin.on('data', chunk => (raw += chunk)).on('end', () => {
  let reason = '';
  try {
    const call = JSON.parse(raw)?.toolCall;
    reason = reasonFor(call?.name, call?.args);
  } catch {
    reason = ''; // a shape this file does not know is not a match: hand it back to the user's settings
  }
  const answer = reason ? { decision: 'deny', reason: `Blocked by agents-united guard: ${reason} requires explicit human approval outside the agent session.` } : { decision: 'ask' };
  process.stdout.write(`${JSON.stringify(answer)}\n`);
});
