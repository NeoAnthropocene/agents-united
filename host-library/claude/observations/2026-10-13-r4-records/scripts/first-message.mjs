// Reads ONE session record of the lead and says what the first-message experiment needs: per assistant message the text it opens with and its calls (ToolSearch left out) with HOLD / PASS,
// and a summary line: the holds (each is a red hook error for the user), where the mode line stands against the first gated call, and any welcome words in the lead's own text.
// usage: node first-message.mjs <session.jsonl>      It prints no tool result except whether a gated call was held by the mode-line gate, and no key can be in a record this reads.
import fs from 'node:fs';

const LINE = /^\s*Mode: (?:Fully|Limited) Operational\./;
const WELCOME = /welcome|👋|\bI'?m Chris\b|\bI am Chris\b|your (?:specialist )?team|delegation-first|AstrolabsAI|\bAs Chris\b/i;
const file = process.argv[2];
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
const stamps = rows.map(r => r.timestamp).filter(Boolean).map(t => Date.parse(t));
const t0 = Math.min(...stamps);
const rel = ts => ((Date.parse(ts) - t0) / 1000);

const msgs = []; const byId = new Map(); const calls = new Map(); const searchIds = new Set(); const found = []; const queries = [];
for (const r of rows) {
  if (r.isSidechain || r.agentId || !r.message || !Array.isArray(r.message.content)) continue;
  if (r.type === 'assistant') {
    const id = r.message.id || r.uuid;
    let m = byId.get(id);
    if (!m) { m = { id, t: rel(r.timestamp), blocks: [] }; byId.set(id, m); msgs.push(m); }
    for (const p of r.message.content) {
      if (p.type === 'text') m.blocks.push({ kind: 'text', text: p.text || '', line: LINE.test(p.text || '') });
      else if (p.type === 'tool_use') { const b = { kind: 'call', name: p.name, out: p.name === 'ToolSearch' ? '' : '?', id: p.id }; m.blocks.push(b); calls.set(p.id, b); if (p.name === 'ToolSearch') { searchIds.add(p.id); queries.push(String((p.input && p.input.query) || '')); } }
    }
  } else if (r.type === 'user') {
    for (const p of r.message.content) if (p.type === 'tool_result' && calls.has(p.tool_use_id)) {
      const b = calls.get(p.tool_use_id);
      if (b.name === 'ToolSearch') { if (Array.isArray(p.content)) for (const x of p.content) if (x && x.type === 'tool_reference') found.push(String(x.tool_name)); continue; }
      const txt = typeof p.content === 'string' ? p.content : JSON.stringify(p.content);
      b.out = p.is_error && /mode-line-gate/.test(txt) ? 'HOLD' : 'PASS';
    }
  }
}

let n = 0; let holds = 0; let holdMsgs = 0; let lineMsg = 0; let lineAt = 0; let firstGatedMsg = 0; let firstGatedAt = 0; let textBlocksBeforeGated = 0; const welcome = [];
for (const m of msgs) {
  n += 1;
  const gated = m.blocks.filter(b => b.kind === 'call' && b.name !== 'ToolSearch');
  const searches = m.blocks.filter(b => b.kind === 'call' && b.name === 'ToolSearch').length;
  const texts = m.blocks.filter(b => b.kind === 'text');
  if (texts.some(b => b.line) && !lineMsg) { lineMsg = n; lineAt = m.t; }
  if (gated.length && !firstGatedMsg) { firstGatedMsg = n; firstGatedAt = m.t; }
  if (!firstGatedMsg) textBlocksBeforeGated += texts.length;
  const h = gated.filter(b => b.out === 'HOLD').length;
  if (h) { holds += h; holdMsgs += 1; }
  for (const b of texts) { const w = b.text.match(WELCOME); if (w) welcome.push(`msg ${n}: "${w[0]}"`); }
  const first = texts[0] ? texts[0].text.replace(/\s+/g, ' ').slice(0, 78) : '';
  if (process.env.FULL) for (const b of texts) console.log('      | ' + b.text.replace(/\s+/g, ' ').slice(0, 900));
  console.log(`msg ${String(n).padStart(2)} +${m.t.toFixed(1).padStart(5)}s  ${first ? (texts[0].line ? 'LINE ' : 'text ') + JSON.stringify(first) : '(no text)'}  ${searches ? 'ToolSearch x' + searches + ' ' : ''}${gated.map(b => b.name + ':' + b.out).join(' ')}`);
}
const before = !lineMsg ? 'NO' : (!firstGatedMsg ? 'n/a' : (lineMsg < firstGatedMsg ? 'yes' : (lineMsg === firstGatedMsg && msgs[lineMsg - 1].blocks.findIndex(b => b.kind === 'text' && b.line) < msgs[lineMsg - 1].blocks.findIndex(b => b.kind === 'call' && b.name !== 'ToolSearch') ? 'same message' : 'NO')));
const firstLine = msgs.flatMap(m => m.blocks).find(b => b.kind === 'text' && b.line);
const field = (name, next) => ((firstLine && firstLine.text.split(name + ': ')[1]) || '').split('. ' + next + ':')[0].split(',').map(x => x.trim()).filter(Boolean).sort().join('|');
// What the lead's own searches say about each required integration: callable when a search returned a tool of its server, missing when a search was made for it and returned none, unchecked when it was never searched for.
const INTEGRATIONS = { GitHub: /github/i, Firecrawl: /firecrawl/i, Context7: /context7/i, Playwright: /playwright/i, 'Chrome DevTools': /chrome[- ]?dev ?tools?/i, Figma: /figma/i };
const evidence = Object.fromEntries(Object.keys(INTEGRATIONS).map(k => [k, found.some(name => INTEGRATIONS[k].test(name)) ? 'callable' : (queries.some(q => INTEGRATIONS[k].test(q)) ? 'missing' : 'unchecked')]));
const truth = Object.keys(evidence).filter(k => evidence[k] === 'callable').sort().join('|');
const unchecked = Object.keys(evidence).filter(k => evidence[k] === 'unchecked').sort().join('|');
const claimedCallable = field('Callable', 'Missing').split('|').filter(Boolean);
const claimedMissing = field('Missing', 'Extras').split('|').filter(Boolean);
const lineAccurate = firstLine ? (Object.keys(evidence).every(k => evidence[k] === 'unchecked' || (evidence[k] === 'callable' ? claimedCallable.includes(k) : claimedMissing.includes(k))) ? 'yes' : 'NO') : 'n/a';
console.log(`SUMMARY holds=${holds} in ${holdMsgs} message(s) | line: ${lineMsg ? `message ${lineMsg} at +${lineAt.toFixed(1)}s` : 'NEVER'} | first gated call: ${firstGatedMsg ? `message ${firstGatedMsg} at +${firstGatedAt.toFixed(1)}s` : 'none'} | line written before the first gated call: ${before} | line accurate: ${lineAccurate} (its searches returned: ${truth || 'none'}; never searched for: ${unchecked || 'none'}) | welcome words: ${welcome.length ? welcome.join('; ') : 'none'}`);
