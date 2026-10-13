// Prints the session's own cost record (the last entry of type "cost-state" in a session record: Claude Code 2.1.296 and later write one), for the protocol's ledger.
// usage: node cost-state.mjs <session.jsonl>      It prints numbers and model names only.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node cost-state.mjs <session.jsonl>');
  process.exit(2);
}
let last;
let versions = new Set();
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  if (entry.version) versions.add(entry.version);
  if (entry.type === 'cost-state' && typeof entry.totalCostUSD === 'number') last = entry;
}
if (!last) {
  console.log('no cost-state entry in this record');
  process.exit(0);
}
const models = Object.entries(last.modelUsage ?? {}).map(([name, usage]) => ({
  model: name,
  costUSD: Number(usage.costUSD ?? 0),
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadInputTokens: usage.cacheReadInputTokens,
  cacheCreationInputTokens: usage.cacheCreationInputTokens,
}));
console.log(JSON.stringify({
  claudeCodeVersions: [...versions],
  totalCostUSD: last.totalCostUSD,
  totalAPIDurationSeconds: Math.round((last.totalAPIDuration ?? 0) / 100) / 10,
  totalDurationSeconds: Math.round((last.totalDuration ?? 0) / 100) / 10,
  hasUnknownModelCost: last.hasUnknownModelCost,
  models,
}, null, 2));
