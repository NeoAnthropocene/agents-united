// Plan 036 probe P3 (H10i): holds the designer's published tokens.json to the rules of the Claude Design token form
// (references/claude-design-format.md of design-system-tokens, PR 181) with the tested converter of that pull request
// (tests/helpers/claude-design-tokens.ts: toDesignSystemTokens and validateDesignSystemTokens), and compares it
// token by token with the converter's own output for the same source file. Needs the helper of PR 181 (Node 24 strips the types).
// Usage: node compare-tokens.mjs <claude-design-tokens.ts> <source design-tokens.json> <her published tokens.json>
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [helper, sourceFile, hersFile] = process.argv.slice(2);
const { toDesignSystemTokens, validateDesignSystemTokens } = await import(pathToFileURL(helper).href);
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const hers = JSON.parse(fs.readFileSync(hersFile, 'utf8'));
const conv = toDesignSystemTokens(source, 'PetPal');

const problems = validateDesignSystemTokens(hers);
console.log('validator on her file:', problems.length === 0 ? 'no problems' : JSON.stringify(problems));
console.log('a nested $value anywhere in her file:', JSON.stringify(hers).includes('$value'));
let differences = 0;
for (const family of ['color', 'spacing', 'radius']) {
  const A = Object.fromEntries((hers[family]?.tokens ?? []).map((t) => [t.name, t]));
  const B = Object.fromEntries((conv[family]?.tokens ?? []).map((t) => [t.name, t]));
  const names = [...new Set([...Object.keys(A), ...Object.keys(B)])];
  const diffs = [];
  for (const n of names) {
    if (!A[n]) diffs.push(`${n}: only in the converter's output`);
    else if (!B[n]) diffs.push(`${n}: only in her file`);
    else {
      if (A[n].value !== B[n].value) diffs.push(`${n}: value ${A[n].value} (hers) against ${B[n].value}`);
      if ((A[n].usage ?? '') !== (B[n].usage ?? '')) diffs.push(`${n}: usage "${A[n].usage}" (hers) against "${B[n].usage}"`);
    }
  }
  differences += diffs.length;
  const emptyUsage = (hers[family]?.tokens ?? []).filter((t) => !t.usage).length;
  console.log(`${family}: her file ${Object.keys(A).length} tokens, the converter ${Object.keys(B).length}, differences in name, value or usage: ${diffs.length}${diffs.length ? ' ' + JSON.stringify(diffs) : ''}; empty usage in her file: ${emptyUsage}`);
}
const j = (v) => JSON.stringify(v);
console.log('themes the same:', j(hers.color.themes) === j(conv.color.themes));
console.log('type the same:', j(hers.type) === j(conv.type));
const order = (o) => (o.color.tokens ?? []).map((t) => t.name).join(',');
console.log('colour order the same:', order(hers) === order(conv), order(hers) === order(conv) ? '' : `(hers: ${order(hers)}) (converter: ${order(conv)})`);
console.log(`token differences, order aside: ${differences}`);
