import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const dir = path.resolve('registry/workflows');
const files = fs.readdirSync(dir).filter(f => f.startsWith('workflow-') && f.endsWith('.md')).sort();

console.log(`Total workflow files found: ${files.length}\n`);

const results = files.map((f, i) => {
  const filePath = path.join(dir, f);
  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let meta = {};
  if (fmMatch) {
    try {
      meta = YAML.parse(fmMatch[1]);
    } catch (e) {
      meta = { parseError: e.message };
    }
  }
  
  // Extract phase headers
  const phaseHeaders = Array.from(content.matchAll(/###?\s+Phase\s+\d+[:\s]+([^\r\n]+)/gi)).map(m => m[0]);
  const hasMermaid = content.includes('```mermaid');
  const hasGates = /verification gate|gate|validation checkpoint/i.test(content);
  const hasRollback = /rollback/i.test(content);
  const hasTools = /required tool|tools/i.test(content);

  return {
    index: i + 1,
    filename: f,
    name: meta.name || 'N/A',
    description: meta.description || 'N/A',
    bundle: meta.bundle || 'N/A',
    estimatedDuration: meta.estimatedDuration || 'N/A',
    phaseHeadersCount: phaseHeaders.length,
    phaseHeaders,
    hasMermaid,
    hasGates,
    hasRollback,
    hasTools,
    contentLength: content.length,
    linesCount: content.split('\n').length
  };
});

console.log(JSON.stringify(results, null, 2));
