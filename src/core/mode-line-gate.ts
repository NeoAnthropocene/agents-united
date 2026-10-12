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
 * What the hold says depends on the ROUND of holds of the session, which the hook counts (the calls of one message are one round), and never on what
 * the lead says it wrote. Sitting S (2026-10-12): two leads had written the line only in their reasoning and believed that they had written it, and a
 * message that let a lead that "has written it" repeat the call alone sent them into 11 and 13 holds. Round 1 asks for the line as a text block even if
 * the lead believes it wrote it; round 2 lets a lead whose last message opened a text block with the line repeat the call alone (the host's save
 * lagging); round 3 and later ask for it again and say how many text blocks the hook sees. The count changes the message and never the release
 * (ADR 0044, ADR 0051).
 * * The script is written out as a file under `registry/hosts/claude/hooks/` by the regeneration of the native agents
 * (`UPDATE_NATIVE=1`), and a test ties the file to this constant. It has no inline form: the file is the gate, and a GLOBAL
 * install, which cannot name a project script, carries the lead without it.
 */
import { guardFileHandler } from './guard.js';

export const MODE_LINE_GATE_SCRIPT = String.raw`const load = name => (typeof require === "function" ? require(name) : process.getBuiltinModule(name));
const fs = load("fs");
const os = load("os");
const path = load("path");

const LINE = /^Mode: (?:Fully|Limited) Operational\./;
const TEMPLATE = "Mode: <Fully Operational or Limited Operational>. Callable: <the required integrations you can call, or none>. Missing: <the required integrations you cannot call, or none>. Extras: <MarkItDown and Stitch, only those you can call, or none>.";
// The calls of one message reach the hook within milliseconds of each other, and a new message needs a model round trip: calls closer than this are one round of holds. The variable is for the tests.
const ROUND_MS = Number(process.env.AGENTS_UNITED_MODE_LINE_ROUND_MS || 800);

// What the hold says depends on the round of holds of the session and never on what the lead says it wrote (ADR 0051, Sitting S).
function message(round, texts) {
  if (round <= 1) {
    return [
      "Mode line first. This is an expected hold, not a failure. Before this call, write the mode line as the first line of your text, filled in:",
      TEMPLATE,
      "Your definition asks for it under \"The first message\", and the host cannot see the message you are writing. Calls stay held until the mode line is visible in the saved transcript. A retry can be held again while the transcript lags; elapsed time alone never releases it.",
      "A hold is not a reason to stop: do not end your turn, do not ask the user and do not wait for a reply. The line must be a text block of your reply: your reasoning is not text, and neither the hook nor the user sees it. Write the line as the first line of a text block in the same message as the call you repeat, even if you believe you wrote it already.",
    ].join("\n");
  }
  if (round === 2) {
    return [
      "Mode line first. This is an expected hold, not a failure (hold 2).",
      "If your last message opened a text block with the mode line, the host has not saved it yet: repeat the call alone, with no text. If it did not (your reasoning is not text), write the line as the first line of a text block in the same message as the call you repeat, filled in:",
      TEMPLATE,
      "Do not stop, do not ask the user and do not wait for a reply.",
    ].join("\n");
  }
  return [
    "Mode line first. This is an expected hold, not a failure (hold " + round + ").",
    "The saved transcript has " + texts + " text block(s) of yours and none opens with the mode line; your reasoning is not text. Write the line now as the first line of a text block in the same message as the call you repeat, even if you believe you wrote it already, filled in:",
    TEMPLATE,
    "Do not stop, do not ask the user, do not wait for a reply, and do not tell the user that the hook is broken: it reads text blocks only.",
  ].join("\n");
}

function block(round, texts) {
  process.stderr.write(message(round, texts) + "\n");
  process.exit(2);
}

// The saved transcript: is there a text block of the lead that opens with the line, and how many text blocks of the lead are there.
function scan(file) {
  let texts = 0;
  try {
    for (const row of fs.readFileSync(file, "utf8").split("\n")) {
      if (row.indexOf("\"assistant\"") < 0) continue;
      let record;
      try { record = JSON.parse(row); } catch (e) { continue; }
      const blocks = record && record.type === "assistant" && record.message && Array.isArray(record.message.content) ? record.message.content : [];
      for (const part of blocks) {
        if (!part || part.type !== "text" || typeof part.text !== "string") continue;
        texts += 1;
        if (LINE.test(part.text.replace(/^\s+/, ""))) return { seen: true, texts: texts };
      }
    }
  } catch (e) { return null; /* unreadable evidence fails open */ }
  return { seen: false, texts: texts };
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
  const found = scan(input.transcript_path);
  if (found === null) process.exit(0);
  if (found.seen) { save({ done: true, version: 2 }); process.exit(0); }
  // The count changes the message and never the release: only the line in the saved transcript releases a call (ADR 0044).
  const now = Date.now();
  const before = typeof state.round === "number" && state.round > 0 ? state.round : 0;
  const sameMessage = before > 0 && typeof state.at === "number" && now - state.at < ROUND_MS;
  const round = sameMessage ? before : before + 1;
  if (!save({ pending: true, version: 2, round: round, at: now })) process.exit(0);
  block(round, found.texts);
});`;

/** The gate as a PreToolUse group of the lead: every tool, the script file, no shell. The script sorts out ToolSearch and the teammates' calls. */
export function modeLineGateHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof guardFileHandler>[] }> } {
  return { PreToolUse: [{ matcher: '*', hooks: [guardFileHandler('mode-line')] }] };
}
