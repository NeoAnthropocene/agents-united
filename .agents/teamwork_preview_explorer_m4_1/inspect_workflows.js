const fs = require('fs');
const path = require('path');

const registryDir = 'c:\\github\\agents-united\\registry\\workflows';
const files = fs.readdirSync(registryDir).filter(f => f.endsWith('.md'));

console.log(`Found ${files.length} workflow files in registry/workflows:`);

const results = [];

for (const file of files) {
  const filePath = path.join(registryDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract YAML frontmatter
  let frontmatterRaw = '';
  let hasFrontmatter = false;
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    hasFrontmatter = true;
    frontmatterRaw = fmMatch[1];
  }

  const lines = content.split('\n');

  results.push({
    file,
    hasFrontmatter,
    frontmatterRaw,
    lineCount: lines.length,
    hasMermaid: content.includes('```mermaid'),
    hasTransitionCriteria: /phase transition|transition criteria/i.test(content),
    hasVerificationGates: /verification gate/i.test(content),
    hasToolInputs: /tool input|required tool/i.test(content),
    hasValidationCheckpoints: /validation checkpoint/i.test(content),
    hasRollbackProtocols: /rollback protocol|automated rollback/i.test(content),
  });
}

fs.writeFileSync('c:\\github\\agents-united\\.agents\\teamwork_preview_explorer_m4_1\\inspection_raw.json', JSON.stringify(results, null, 2));
console.log('Inspection completed.');
