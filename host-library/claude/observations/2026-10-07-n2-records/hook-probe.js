// Logging-only probe (Plan 035 N2 slice e). Never blocks. For each hook event of the lead it appends one JSON line to <project>/.claude/hook-probe.log:
// the event, the tool, the input keys, whether the transcript already holds the tool_use block of this very call (the race the host docs warn about),
// and the last records of the transcript. On UserPromptSubmit it returns a harmless additionalContext so that the record shows whether it reached the model.
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', chunk => { raw += chunk; }).on('end', () => {
  let input = {};
  try { input = JSON.parse(raw); } catch (e) { /* keep going with an empty input */ }
  const started = Date.now();
  const out = {
    at: new Date().toISOString(),
    event: input.hook_event_name,
    tool: input.tool_name || null,
    tool_use_id: input.tool_use_id || null,
    agent_id: input.agent_id || null,
    agent_type: input.agent_type || null,
    permission_mode: input.permission_mode || null,
    keys: Object.keys(input),
  };
  try {
    const text = fs.readFileSync(input.transcript_path, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    out.transcript_lines = lines.length;
    out.has_this_tool_use = input.tool_use_id ? text.includes(input.tool_use_id) : null;
    out.tail = lines.slice(-3).map(l => {
      try {
        const o = JSON.parse(l);
        const c = o.message && o.message.content;
        const blocks = Array.isArray(c)
          ? c.map(b => b.type + (b.type === 'text' ? ':' + b.text.slice(0, 40) : b.type === 'tool_use' ? ':' + b.name : ''))
          : (typeof c === 'string' ? 'str:' + c.slice(0, 40) : null);
        return { type: o.type, id: o.message && o.message.id, blocks };
      } catch (e) { return 'unparsed'; }
    });
  } catch (e) { out.transcript_error = String(e); }
  out.ms = Date.now() - started;
  try {
    const dir = path.join(input.cwd || process.cwd(), '.claude');
    fs.appendFileSync(path.join(dir, 'hook-probe.log'), JSON.stringify(out) + '\n');
  } catch (e) { /* the probe never fails the session */ }
  if (input.hook_event_name === 'UserPromptSubmit') {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'PROBE-CONTEXT: if you can read this sentence, the UserPromptSubmit hook in the agent frontmatter reached you.',
      },
    }));
  }
  process.exit(0);
});
