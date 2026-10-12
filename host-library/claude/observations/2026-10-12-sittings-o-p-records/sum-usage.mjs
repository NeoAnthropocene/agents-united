// Sums the token usage of Claude Code session records (.jsonl), once per API message (a message split over several records repeats its usage).
// usage: node sum-usage.mjs <file.jsonl> [more files...]
// With several files it prints each file and the total. Prices are fitted from headless runs (see the observation), not published prices.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PRICE = { out: 10.01, cw: 4.0, cr: 0.2 }; // USD per million tokens, fitted on four headless runs of Sitting O (exact to four decimals)

function sum(file) {
  const byId = new Map();
  let anonymous = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== 'assistant' || !entry.message?.usage) continue;
    const id = entry.message.id ?? `anon-${anonymous++}`;
    const u = entry.message.usage;
    const previous = byId.get(id);
    const current = { in: u.input_tokens ?? 0, out: u.output_tokens ?? 0, cw: u.cache_creation_input_tokens ?? 0, cr: u.cache_read_input_tokens ?? 0 };
    // later records of one message carry the final output count: keep the largest of each field
    byId.set(id, previous ? { in: Math.max(previous.in, current.in), out: Math.max(previous.out, current.out), cw: Math.max(previous.cw, current.cw), cr: Math.max(previous.cr, current.cr) } : current);
  }
  const total = { messages: byId.size, in: 0, out: 0, cw: 0, cr: 0 };
  for (const v of byId.values()) {
    total.in += v.in;
    total.out += v.out;
    total.cw += v.cw;
    total.cr += v.cr;
  }
  return total;
}
const usd = t => (t.out * PRICE.out + t.cw * PRICE.cw + t.cr * PRICE.cr) / 1e6;

const files = process.argv.slice(2);
const all = { messages: 0, in: 0, out: 0, cw: 0, cr: 0 };
for (const file of files) {
  const t = sum(file);
  console.log(`${path.basename(file).slice(0, 44).padEnd(44)} messages ${String(t.messages).padStart(4)}  in ${String(t.in).padStart(6)}  out ${String(t.out).padStart(6)}  cache-write ${String(t.cw).padStart(7)}  cache-read ${String(t.cr).padStart(8)}  ~${usd(t).toFixed(4)} USD`);
  for (const k of Object.keys(all)) all[k] += t[k];
}
if (files.length > 1) console.log(`${'TOTAL'.padEnd(44)} messages ${String(all.messages).padStart(4)}  in ${String(all.in).padStart(6)}  out ${String(all.out).padStart(6)}  cache-write ${String(all.cw).padStart(7)}  cache-read ${String(all.cr).padStart(8)}  ~${usd(all).toFixed(4)} USD`);
