const load = name => (typeof require === "function" ? require(name) : process.getBuiltinModule(name));
const fs = load("fs");
const os = load("os");
const path = load("path");

const LINE = /^Mode: (?:Fully|Limited) Operational\./;
const TEMPLATE = "Mode: <Fully Operational or Limited Operational>. Callable: <the required integrations you can call, or none>. Missing: <the required integrations you cannot call, or none>. Extras: <MarkItDown and Stitch, only those you can call, or none>.";
// The calls of one message reach the hook within milliseconds of each other, and a new message needs a model round trip: calls closer than this are one round of holds. The variable is for the tests.
const ROUND_MS = Number(process.env.AGENTS_UNITED_MODE_LINE_ROUND_MS || 800);
// The host writes its transcript late (the line was missing from the file 2.7 to 6.0 s after it was written, and present by 9 to 10 s, in Sittings P, T and U), so a line the lead has just written may not be in the file yet.
// Before it holds a call the hook looks at the file for up to this long, every POLL_MS. 0 turns the wait off. The variable is for the tests and for a maintainer who finds the wait in the way.
// The default, 8 s, is the maintainer's choice (ADR 0053): above the slowest save seen missing (6.0 s) and below the latest seen present (9 to 10 s).
const WAIT_MS = Number(process.env.AGENTS_UNITED_MODE_LINE_WAIT_MS || 8000);
const POLL_MS = 150;
// The rounds of holds in which the hook waits (the first two); from the third round the message says what the file holds, and that count is then accurate.
const WAIT_ROUNDS = 2;

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function gate(raw) {
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
  const read = () => {
    try { return JSON.parse(fs.readFileSync(marker, "utf8")); } catch (e) { return {}; /* the first call of the session */ }
  };
  // One line per decision beside the marker, with names and counts and no text, so that whoever reads a sitting can tell what the gate did and how long the host's save took. The log never decides anything.
  const log = entry => {
    try {
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      fs.appendFileSync(marker + ".log", JSON.stringify(Object.assign({ at: new Date().toISOString(), tool: input.tool_name }, entry)) + "\n");
    } catch (e) { /* the log is not the gate */ }
  };

  let state = read();
  // A version-1 done marker can come from elapsed time alone, so it is not proof that the line was seen.
  if (state.done && state.version === 2) process.exit(0);
  const began = Date.now();
  let found = scan(input.transcript_path);
  if (found === null) process.exit(0);
  // The round of this call, from the state as the call found it (the calls of one message find the same state, so they are one round, also when each of them waits).
  const before = typeof state.round === "number" && state.round > 0 ? state.round : 0;
  const sameMessage = before > 0 && typeof state.at === "number" && began - state.at < ROUND_MS;
  const round = sameMessage ? before : before + 1;
  // The host saves its transcript late, and the hook has no other source for the text of the message being written: look at the file for a while before holding (ADR 0053).
  // The wait ends on the line, which releases the call, or at the cap, which holds it: elapsed time alone never releases a call (ADR 0044). It is for the first two rounds only: by the third the
  // lead has been told twice and the file has had two rounds to catch up, and a lead that never writes the line must not pay the cap at each of its holds.
  const waits = !found.seen && WAIT_MS > 0 && round <= WAIT_ROUNDS;
  if (waits) {
    log({ event: "waiting" });
    while (!found.seen && Date.now() - began < WAIT_MS) {
      await sleep(POLL_MS);
      found = scan(input.transcript_path);
      if (found === null) process.exit(0);
    }
  }
  const waited = Date.now() - began;
  if (found.seen) {
    save({ done: true, version: 2 });
    log({ event: "released", by: waits ? "line-after-wait" : "line", waitedMs: waited });
    process.exit(0);
  }
  // The state is read again: a call of the same message may have been released or held while this one waited.
  state = read();
  if (state.done && state.version === 2) process.exit(0);
  // The count changes the message and never the release: only the line in the saved transcript releases a call (ADR 0044).
  if (!save({ pending: true, version: 2, round: round, at: Date.now() })) process.exit(0);
  log({ event: "held", round: round, texts: found.texts, waitedMs: waited, by: waits ? "cap" : "no-wait" });
  block(round, found.texts);
}

let raw = "";
process.stdin.on("data", chunk => { raw += chunk; }).on("end", () => {
  // Anything that goes wrong inside the gate lets the call through: a gate that wedges a session is worse than a lead that forgets a line.
  gate(raw).catch(() => process.exit(0));
});
