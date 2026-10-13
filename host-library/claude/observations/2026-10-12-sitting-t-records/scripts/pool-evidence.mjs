// Why the lead never "recognized" the image server (Sitting T, H10k2): what its tool allowlist holds, what tool pool the session gave it, what the designer's pool was, and
// every search for the image tool. It prints names and counts only (no command output, no environment, no key). Reads the installed role files and the session records.
// usage: node pool-evidence.mjs <scenario folder> <lead session .jsonl> <teammate .jsonl of the tool check>
import fs from 'node:fs';
import path from 'node:path';

const [folder, leadFile, mateFile] = process.argv.slice(2);
const rowsOf = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const toolsOf = role => {
  const text = fs.readFileSync(path.join(folder, '.claude', 'agents', `${role}.md`), 'utf8');
  const line = text.split(/\r?\n/).slice(0, 30).find(l => l.startsWith('tools:')) ?? '';
  return line.slice(6).trim().split(/,\s*(?![^()]*\))/).map(t => t.trim()).filter(Boolean);
};
const serverOf = name => (String(name).startsWith('mcp__') ? String(name).split('__').slice(0, 2).join('__') : '(built-in)');
const bySrv = names => { const m = new Map(); for (const n of names) m.set(serverOf(n), (m.get(serverOf(n)) ?? 0) + 1); return [...m].map(([k, v]) => `${k} ${v}`).join(', '); };
const t = r => String(r.timestamp ?? '').slice(11, 19);

for (const role of ['orchestrator-digital-agency', 'agency-creative-designer']) {
  const tools = toolsOf(role);
  const mcp = tools.filter(x => x.startsWith('mcp__'));
  console.log(`${role}: ${tools.length} entries in its tools allowlist; MCP entries: ${mcp.join(', ')}`);
  console.log(`  names the image server or its tool: ${tools.some(x => x.includes('image-gen')) ? 'yes (' + tools.filter(x => x.includes('image-gen')).join(', ') + ')' : 'NO'}`);
}

const lead = rowsOf(leadFile);
const mate = rowsOf(mateFile);
const deltas = rows => rows.map((r, i) => ({ r, i })).filter(({ r }) => r.attachment?.type === 'deferred_tools_delta');
const first = deltas(lead)[0];
const startPool = first?.r.attachment.addedNames ?? [];
console.log(`\nThe lead's deferred-tool pool when the session started (${t(first.r)} UTC): ${startPool.length} tools: ${bySrv(startPool)}`);
const connected = lead.find(r => r.attachment?.type === 'mcp_instructions_delta')?.attachment.addedNames ?? [];
console.log(`Servers with instructions that the session reported as connected: ${connected.join(', ')}`);
console.log(`  of them, tools in the lead's pool: ${connected.map(c => `${c}: ${startPool.filter(n => serverOf(n).toLowerCase().includes(c.replace(/^claude\.ai /, 'claude_ai_').toLowerCase().replace(/ /g, '_'))).length}`).join('; ')}`);
for (const { r } of deltas(lead).slice(1)) console.log(`A later change of the pool at ${t(r)} UTC: removed ${JSON.stringify(r.attachment.removedNames)}, added ${JSON.stringify(r.attachment.addedNames)}`);

const results = new Map();
for (const r of lead) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) if (b.type === 'tool_result') results.set(b.tool_use_id, r);
console.log("\nThe lead's searches for the image tool (ToolSearch):");
for (const r of lead) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) {
  if (b.type === 'tool_use' && b.name === 'ToolSearch' && /image/.test(JSON.stringify(b.input))) {
    const res = results.get(b.id);
    const matches = res?.toolUseResult?.matches;
    const names = Array.isArray(matches) ? matches : [];
    console.log(`  ${t(r)} ${JSON.stringify(b.input)}  pool ${res?.toolUseResult?.total_deferred_tools ?? '?'}  matches: ${names.length ? names.join(', ') : 'none'}`);
  }
}

const mfirst = deltas(mate)[0];
const matePool = mfirst?.r.attachment.addedNames ?? [];
console.log(`\nJamileh's pool in the tool check (${t(mfirst.r)} UTC): ${matePool.length} deferred tools: ${bySrv(matePool)}`);
const mresults = new Map();
for (const r of mate) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) if (b.type === 'tool_result') mresults.set(b.tool_use_id, r);
for (const r of mate) for (const b of Array.isArray(r.message?.content) ? r.message.content : []) {
  if (b.type === 'tool_use' && b.name === 'ToolSearch' && /image/.test(JSON.stringify(b.input))) {
    const res = mresults.get(b.id);
    console.log(`  ${t(r)} ${JSON.stringify(b.input)}  pool ${res?.toolUseResult?.total_deferred_tools ?? '?'}  matches: ${(res?.toolUseResult?.matches ?? []).length || 'none'}`);
  }
}
