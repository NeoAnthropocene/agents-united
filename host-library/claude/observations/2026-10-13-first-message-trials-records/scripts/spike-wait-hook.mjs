// SPIKE (2026-10-13): writes into a scratch folder a copy of the mode-line gate that WAITS for the saved transcript before it holds, and logs every decision. Not the repository's script.
// usage: node spike-wait-hook.mjs <folder>
import fs from 'node:fs';
import path from 'node:path';
const folder = process.argv[2];
const repo = 'C:/github/scratch-pilot/wt-s19c/registry/hosts/claude/hooks/agents-united-mode-line-gate.js';
const current = fs.readFileSync(repo, 'utf8');
const cut = current.indexOf('// The saved transcript: is there a text block');
if (cut < 0) throw new Error('marker comment not found');
let head = current.slice(0, cut);
head = head.replace('const ROUND_MS =', 'const WAIT_MS = Number(process.env.AGENTS_UNITED_MODE_LINE_WAIT_MS || 12000);\nconst POLL_MS = 150;\nconst ROUND_MS =');
const tail = String.raw`// The saved transcript: is there a text block of the lead that opens with the line, how many text blocks of the lead are there, and is the tool_use block of the call being judged saved.
function scan(file, id) {
  let texts = 0;
  let own = false;
  try {
    for (const row of fs.readFileSync(file, "utf8").split("\n")) {
      if (row.indexOf("\"assistant\"") < 0) continue;
      let record;
      try { record = JSON.parse(row); } catch (e) { continue; }
      const blocks = record && record.type === "assistant" && record.message && Array.isArray(record.message.content) ? record.message.content : [];
      for (const part of blocks) {
        if (!part) continue;
        if (part.type === "tool_use" && id && part.id === id) own = true;
        if (part.type !== "text" || typeof part.text !== "string") continue;
        texts += 1;
        if (LINE.test(part.text.replace(/^\s+/, ""))) return { seen: true, texts: texts, own: own };
      }
    }
  } catch (e) { return null; /* unreadable evidence fails open */ }
  return { seen: false, texts: texts, own: own };
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
  const log = entry => { try { fs.appendFileSync(marker + ".log", JSON.stringify(Object.assign({ at: new Date().toISOString(), tool: input.tool_name }, entry)) + "\n"); } catch (e) { /* the log never decides anything */ } };
  const read = () => { try { return JSON.parse(fs.readFileSync(marker, "utf8")); } catch (e) { return {}; } };

  let state = read();
  if (state.done && state.version === 2) process.exit(0);
  const began = Date.now();
  let found = scan(input.transcript_path, input.tool_use_id);
  if (found === null) process.exit(0);
  const first = found;
  while (!found.seen && !found.own && WAIT_MS > 0 && Date.now() - began < WAIT_MS) {
    await sleep(POLL_MS);
    found = scan(input.transcript_path, input.tool_use_id);
    if (found === null) process.exit(0);
  }
  const waited = Date.now() - began;
  if (found.seen) { save({ done: true, version: 2 }); log({ event: "released", by: waited > POLL_MS ? "line-after-wait" : "line", waitedMs: waited, firstOwn: first.own, firstTexts: first.texts }); process.exit(0); }
  state = read();
  if (state.done && state.version === 2) process.exit(0);
  const now = Date.now();
  const before = typeof state.round === "number" && state.round > 0 ? state.round : 0;
  const sameMessage = before > 0 && typeof state.at === "number" && now - state.at < ROUND_MS;
  const round = sameMessage ? before : before + 1;
  if (!save({ pending: true, version: 2, round: round, at: now })) process.exit(0);
  log({ event: "held", round: round, texts: found.texts, own: found.own, firstOwn: first.own, waitedMs: waited, by: found.own ? "caught-up" : (WAIT_MS > 0 ? "cap" : "no-wait") });
  block(round, found.texts);
}

let raw = "";
process.stdin.on("data", chunk => { raw += chunk; }).on("end", () => { gate(raw).catch(() => process.exit(0)); });
`;
const out = path.join(folder, '.claude', 'hooks', 'agents-united-mode-line-gate.js');
fs.writeFileSync(out, head + tail);
console.log('spike gate written to ' + out);
