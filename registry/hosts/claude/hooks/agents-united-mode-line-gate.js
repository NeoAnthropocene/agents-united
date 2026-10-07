const load = name => (typeof require === "function" ? require(name) : process.getBuiltinModule(name));
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
});
