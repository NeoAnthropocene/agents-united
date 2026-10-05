// Reads the output of `curl -sI -L <url>` (standard input or a file) and reports the redirect hops, a chain, a loop, a redirect
// that ends in an error, and a noindex on the final response.
// Usage: curl -sI -L https://example.com/page | node redirect-chain.mjs      (PowerShell: curl.exe -sI -L ... | node redirect-chain.mjs)
//        node redirect-chain.mjs headers.txt
// Exit code: 0 no finding, 1 a finding, 2 usage (a missing file, or no HTTP response in the input).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * One entry per response: { status, location, xRobotsTag }. A response starts at the first "HTTP/" line of a blank-line separated
 * block, so a pasted terminal session (the `$ curl ...` line above the first response) reads the same as raw curl output.
 */
export function parseResponses(text) {
  const responses = [];
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const start = lines.findIndex(l => /^HTTP\/[\d.]+\s+\d{3}/.test(l.trim()));
    if (start === -1) continue;
    const status = /^HTTP\/[\d.]+\s+(\d{3})/.exec(lines[start].trim());
    const header = name => {
      const line = lines.slice(start + 1).find(l => l.toLowerCase().startsWith(`${name}:`));
      return line === undefined ? undefined : line.slice(name.length + 1).trim();
    };
    responses.push({ status: Number(status[1]), location: header('location'), xRobotsTag: header('x-robots-tag') });
  }
  return responses;
}

export function analyse(responses) {
  const hops = responses.filter(r => r.status >= 300 && r.status < 400 && r.location !== undefined);
  const final = responses[responses.length - 1];
  const targets = hops.map(h => h.location);
  const loop = new Set(targets).size < targets.length;
  const findings = [];
  if (loop) findings.push('redirect loop: the same location is reached twice (check 4)');
  else if (hops.length > 1) findings.push(`redirect chain: ${hops.length} hops; redirect straight to the final URL in one hop (check 4)`);
  if (final.status >= 300 && final.status < 400 && !loop) findings.push('the chain did not end: the last response is still a redirect (curl stopped; check for a loop or raise --max-redirs)');
  if (final.status >= 400) findings.push(`final status ${final.status}: a redirect that ends in an error (check 3)`);
  if (/noindex/i.test(final.xRobotsTag ?? '')) findings.push('noindex: X-Robots-Tag on the final response (check 6; critical if the page should rank)');
  return { hops, final, findings };
}

function usage(reason) {
  if (reason) console.error(reason);
  console.error('usage: curl -sI -L <url> | node redirect-chain.mjs   |   node redirect-chain.mjs <headers file>');
  process.exit(2);
}

function main(argv) {
  const file = argv[0];
  if (file === undefined && process.stdin.isTTY) usage();
  if (file !== undefined && !fs.existsSync(file)) usage(`no such file: ${file}`);
  const responses = parseResponses(fs.readFileSync(file ?? 0, 'utf8'));
  if (responses.length === 0) usage('no HTTP response found in the input (it should be the output of curl -sI -L)');
  const { hops, final, findings } = analyse(responses);
  hops.forEach((h, i) => console.log(`hop ${i + 1}: ${h.status} -> ${h.location}`));
  console.log(`final: ${final.status}`);
  console.log(`${hops.length} redirect hop${hops.length === 1 ? '' : 's'}`);
  for (const f of findings) console.log(`FINDING ${f}`);
  process.exit(findings.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
