#!/usr/bin/env node
// Sample size and run length for a two-arm test on a conversion rate.
// n per arm = 16 * p * (1 - p) / d^2  (5% significance, 80% power, d = absolute difference).
// Usage: node sample-size.mjs --baseline 0.04 (--lift 0.20 | --abs 0.008) [--daily 1500]
// Prints estimates only: a rule-of-thumb formula, not a power calculator.
import { pathToFileURL } from 'node:url';

export function sampleSizePerArm(baseline, absDiff) {
  if (!(baseline > 0 && baseline < 1)) throw new Error('baseline must be between 0 and 1 (for example 0.04)');
  if (!(absDiff > 0)) throw new Error('the absolute difference must be above 0');
  return Math.ceil((16 * baseline * (1 - baseline)) / (absDiff * absDiff) - 1e-9);
}

/** Days for the two arms together, and the run length in whole weeks (at least one). */
export function runWeeks(perArm, dailyVisitors) {
  if (!(dailyVisitors > 0)) throw new Error('daily visitors must be above 0');
  const days = (2 * perArm) / dailyVisitors;
  return { days, weeks: Math.max(1, Math.ceil(days / 7)) };
}

function main(argv) {
  const get = name => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : Number(argv[i + 1]);
  };
  const baseline = get('baseline');
  const lift = get('lift');
  const abs = get('abs') ?? (lift !== undefined && baseline !== undefined ? baseline * lift : undefined);
  if (baseline === undefined || abs === undefined) {
    console.error('usage: node sample-size.mjs --baseline 0.04 (--lift 0.20 | --abs 0.008) [--daily 1500]');
    process.exit(2);
  }
  const n = sampleSizePerArm(baseline, abs);
  console.log(`baseline ${baseline}, absolute difference ${abs}`);
  console.log(`sample per arm: ${n} (total ${2 * n})  [estimate]`);
  const daily = get('daily');
  if (daily !== undefined) {
    const { days, weeks } = runWeeks(n, daily);
    console.log(`days at ${daily} eligible visitors a day: ${days.toFixed(1)}; run ${weeks * 7} days (${weeks} whole week${weeks === 1 ? '' : 's'})`);
    if (weeks * 7 > 28) console.log('over 28 days: not worth running at this volume; make the change bolder or test a higher step of the funnel');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
