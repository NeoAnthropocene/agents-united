// Sample-ratio mismatch check for a two-arm test (chi-square, 1 degree of freedom).
// Usage: node srm-check.mjs <arm A count> <arm B count> [--ratio 0.5]
// chi-square >= 10.83 means p < 0.001: the assignment is broken and the result must not be read.
import { pathToFileURL } from 'node:url';

export function srm(a, b, ratioA = 0.5) {
  const total = a + b;
  const ea = total * ratioA;
  const eb = total * (1 - ratioA);
  const chi2 = (a - ea) ** 2 / ea + (b - eb) ** 2 / eb;
  const verdict = chi2 >= 10.83 ? 'invalid' : chi2 >= 6.63 ? 'warning' : 'ok';
  return { chi2, verdict };
}

function main(argv) {
  const [a, b] = argv.slice(0, 2).map(Number);
  const i = argv.indexOf('--ratio');
  const ratio = i === -1 ? 0.5 : Number(argv[i + 1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    console.error('usage: node srm-check.mjs <arm A count> <arm B count> [--ratio 0.5]');
    process.exit(2);
  }
  const { chi2, verdict } = srm(a, b, ratio);
  console.log(`chi-square ${chi2.toFixed(2)}: ${verdict}`);
  if (verdict === 'invalid') console.log('p < 0.001: stop and find the assignment bug before reading any result');
  if (verdict === 'warning') console.log('p < 0.01: check assignment before trusting the result');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
