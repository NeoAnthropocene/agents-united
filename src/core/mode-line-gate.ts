/**
 * Plan 035 N2 slice (e) — the mode-line gate of the digital-agency lead: a PreToolUse hook that holds the lead's first call
 * other than `ToolSearch` until the lead has written its mode line (the section "The first message" of its definition).
 *
 * Why a hook: text did not do it. The host writes its transcript asynchronously, so a line written in the current response may
 * need another retry before the gate sees it. R2 (`75b89b2c`, 2026-10-07) disproved the original two-second release window: a
 * held Bash call and an allowed Agent call shared a response 3.433 seconds apart, and no mode line was ever written. Elapsed time
 * is not evidence. Lead calls stay held until the saved transcript shows the line (ADR 0044); an unreadable transcript fails open.
 *
 * The lead's frontmatter hooks also fire for its teammates' calls (probe: Ava's calls arrived with an `agent_id`), so a call with
 * an `agent_id` is never the gate's business. Everything that can go wrong inside the gate lets the call through: a hook that
 * cannot start does not block either, and a gate that wedges a session is worse than a lead that forgets a line.
 *
 * The script is written out as a file under `registry/hosts/claude/hooks/` by the regeneration of the native agents
 * (`UPDATE_NATIVE=1`), and a test ties the file to this constant. It has no inline form: the file is the gate, and a GLOBAL
 * install, which cannot name a project script, carries the lead without it.
 */
import { guardFileHandler } from './guard.js';

export const MODE_LINE_GATE_SCRIPT = String.raw`const load = name => (typeof require === "function" ? require(name) : process.getBuiltinModule(name));
const fs = load("fs");
const os = load("os");
const path = load("path");

const LINE = /^Mode: (?:Fully|Limited) Operational\./;
const MESSAGE = [
  "Mode line first. This is an expected hold, not a failure. Before this call, write the mode line as the first line of your text, filled in:",
  "Mode: <Fully Operational or Limited Operational>. Callable: <the required integrations you can call, or none>. Missing: <the required integrations you cannot call, or none>. Extras: <MarkItDown and Stitch, only those you can call, or none>.",
  "Your definition asks for it under \"The first message\". Do this even if you believe you wrote it already: the host cannot see the message you are writing. Calls stay held until the mode line is visible in the saved transcript. Then make the call again, and write the line in the same message as the call you repeat. A retry can be held again while the transcript lags; elapsed time alone never releases it.",
].join("\n");

function block() {
  process.stderr.write(MESSAGE + "\n");
  process.exit(2);
}

function hasLine(file) {
  try {
    for (const row of fs.readFileSync(file, "utf8").split("\n")) {
      if (row.indexOf("\"assistant\"") < 0) continue;
      let record;
      try { record = JSON.parse(row); } catch (e) { continue; }
      const blocks = record && record.type === "assistant" && record.message && Array.isArray(record.message.content) ? record.message.content : [];
      for (const part of blocks) {
        if (part && part.type === "text" && typeof part.text === "string" && LINE.test(part.text.replace(/^\s+/, ""))) return true;
      }
    }
  } catch (e) { return null; /* unreadable evidence fails open */ }
  return false;
}

let raw = "";
process.stdin.on("data", chunk => { raw += chunk; }).on("end", () => {
  let input;
  try { input = JSON.parse(raw); } catch (e) { process.exit(0); }
  if (!input || input.hook_event_name !== "PreToolUse" || input.agent_id || input.tool_name === "ToolSearch") process.exit(0);
  const session = String(input.session_id || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!session) process.exit(0);

  const marker = path.join(os.tmpdir(), "agents-united", "mode-line-" + session);
  const save = state => {
    try {
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      fs.writeFileSync(marker, JSON.stringify(state));
      return true;
    } catch (e) { return false; }
  };

  let state = {};
  try { state = JSON.parse(fs.readFileSync(marker, "utf8")); } catch (e) { /* the first call of the session */ }
  // A version-1 done marker can come from elapsed time alone, so it is not proof that the line was seen.
  if (state.done && state.version === 2) process.exit(0);
  const seen = hasLine(input.transcript_path);
  if (seen === null) process.exit(0);
  if (seen) { save({ done: true, version: 2 }); process.exit(0); }
  if (!save({ pending: true, version: 2 })) process.exit(0);
  block();
});`;

/** The gate as a PreToolUse group of the lead: every tool, the script file, no shell. The script sorts out ToolSearch and the teammates' calls. */
export function modeLineGateHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof guardFileHandler>[] }> } {
  return { PreToolUse: [{ matcher: '*', hooks: [guardFileHandler('mode-line')] }] };
}
