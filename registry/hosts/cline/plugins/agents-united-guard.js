// agents-united guard plugin for the Cline CLI (ADR 0028). One reviewed, dependency-free file, installed by copying to .cline/plugins/.
// It blocks what no agent should do without a human: a forced push, a production deploy, a .env write. The patterns are the ones of the
// Claude guard (src/core/guard.ts); a test keeps the two identical. Read-only roles do not need it: their `tools:` list is enforced by the host.
// A throwing beforeTool hook blocks the call and ends the run of the agent that made it (the whole run for the main agent, only that
// subagent's run for a subagent). Plugins apply to the CLI, the SDK and Kanban, not to the IDE extensions.

const FORCE_PUSH = /\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/;
const VERCEL_PROD = /\bvercel\b[^;&|]*--prod\b/;
const ENV_PATH = /(^|\/)\.env(\.(?!example$)[^\/]+)?$/;
const ENV_REDIRECT = />\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/;

const SHELL_TOOLS = new Set(['run_commands', 'bash', 'execute_command']);
const WRITE_TOOLS = new Set(['editor', 'apply_patch', 'write_to_file', 'replace_in_file', 'apply_diff']);
const PATCH_TOOLS = new Set(['apply_patch', 'apply_diff']);
const PATH_KEYS = ['path', 'file_path', 'filePath', 'filename', 'file', 'target'];
const PATCH_HEADER = /^(?:\*\*\* (?:Add|Update|Delete) File:|\+\+\+|---|diff --git)\s*(.+)$/;

// The hook context seen on CLI 3.0.68: toolCall.toolName, tool.name and input; the docs example uses toolCall.name.
const toolNameOf = context => {
  const name = context?.toolCall?.toolName ?? context?.tool?.name ?? context?.toolCall?.name;
  return typeof name === 'string' ? name : '';
};
const inputOf = context => context?.input ?? context?.toolCall?.input;

const commandsOf = input => (input && typeof input === 'object' ? [input.commands, input.command].flat().filter(item => typeof item === 'string') : []);

const leaves = (value, depth = 0) =>
  depth > 6 ? [] : typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(item => leaves(item, depth + 1)) : value && typeof value === 'object' ? Object.values(value).flatMap(item => leaves(item, depth + 1)) : [];

// The files a write touches: named path keys, and for a patch the file headers of its text (whatever key carries it).
const pathsOf = (toolName, input) => {
  if (!input || typeof input !== 'object') return [];
  const direct = PATH_KEYS.map(key => input[key]).filter(item => typeof item === 'string');
  if (!PATCH_TOOLS.has(toolName)) return direct;
  const headers = leaves(input)
    .flatMap(text => text.split('\n'))
    .flatMap(line => (PATCH_HEADER.exec(line.trim())?.[1] ?? '').split(/\s+/).filter(Boolean))
    .map(file => file.replace(/^[ab]\//, ''));
  return [...direct, ...headers];
};

const reasonFor = (toolName, input) => {
  if (SHELL_TOOLS.has(toolName)) {
    for (const command of commandsOf(input)) {
      if (FORCE_PUSH.test(command)) return 'git push --force';
      if (VERCEL_PROD.test(command)) return 'vercel --prod';
      if (ENV_REDIRECT.test(command)) return 'a .env write';
    }
  } else if (WRITE_TOOLS.has(toolName) && pathsOf(toolName, input).some(file => ENV_PATH.test(file.replace(/\\/g, '/')))) {
    return 'a .env write';
  }
  return '';
};

export default {
  name: 'agents-united-guard',
  manifest: { capabilities: ['hooks'] },
  hooks: {
    beforeTool(context) {
      let reason = '';
      try {
        reason = reasonFor(toolNameOf(context), inputOf(context));
      } catch {
        reason = ''; // never fail on a shape this file does not know: only a block may throw
      }
      if (reason) throw new Error(`Blocked by agents-united guard: ${reason} requires explicit human approval outside the agent session.`);
    },
  },
};
