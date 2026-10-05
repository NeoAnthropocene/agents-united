// Health score of an SEO audit by the agency rule: start at 100, subtract 15 per critical finding, 7 per major, 2 per minor, floor 0.
// Usage: node health-score.mjs --critical <n> --major <n> --minor <n>
//        node health-score.mjs <findings.md>   counts the table rows whose severity cell is exactly critical, major or minor
// The score summarises this audit's scope: it is not an industry metric and is not comparable across sites with a different scope.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const WEIGHTS = { critical: 15, major: 7, minor: 2 };

export function healthScore({ critical = 0, major = 0, minor = 0 }) {
  return Math.max(0, 100 - WEIGHTS.critical * critical - WEIGHTS.major * major - WEIGHTS.minor * minor);
}

/** Counts the markdown table rows that carry a severity as a whole cell. */
export function countSeverities(markdown) {
  const counts = { critical: 0, major: 0, minor: 0 };
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim().toLowerCase());
    for (const severity of Object.keys(counts)) if (cells.includes(severity)) counts[severity] += 1;
  }
  return counts;
}

function usage(reason) {
  if (reason) console.error(reason);
  console.error('usage: node health-score.mjs --critical <n> --major <n> --minor <n>   |   node health-score.mjs <findings.md>');
  process.exit(2);
}

function main(argv) {
  const counts = { critical: 0, major: 0, minor: 0 };
  let flagged = false;
  let file;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--') && arg.slice(2) in counts) {
      const value = argv[i + 1];
      if (!/^\d+$/.test(value ?? '')) usage(`${arg} needs a whole number of 0 or more`);
      counts[arg.slice(2)] = Number(value);
      flagged = true;
      i += 1;
    } else if (!arg.startsWith('--') && file === undefined) file = arg;
    else usage(`unexpected argument: ${arg}`);
  }
  if (flagged === (file !== undefined)) usage();
  if (file !== undefined) {
    if (!fs.existsSync(file)) usage(`no such file: ${file}`);
    Object.assign(counts, countSeverities(fs.readFileSync(file, 'utf8')));
  }
  const score = healthScore(counts);
  let lost = 0;
  for (const severity of Object.keys(WEIGHTS)) {
    const points = WEIGHTS[severity] * counts[severity];
    lost += points;
    console.log(`${severity} ${counts[severity]} x ${WEIGHTS[severity]} = ${points}`);
  }
  console.log(`health score: ${score} (100 - ${lost}${lost > 100 ? ', floor 0' : ''})`);
  console.log("This is a summary of this audit's scope, not an industry metric, and not comparable across sites with a different scope.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
