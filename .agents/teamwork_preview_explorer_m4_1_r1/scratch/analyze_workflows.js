const fs = require('fs');
const path = require('path');

const dir = 'c:/github/agents-united/registry/workflows';
const files = fs.readdirSync(dir).filter(f => f.startsWith('workflow-') && f.endsWith('.md'));

console.log(`Found ${files.length} workflow files.`);

const results = [];

for (const file of files) {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check YAML frontmatter
  const hasFrontmatter = content.startsWith('---');
  let frontmatterFields = [];
  let yamlObj = {};
  if (hasFrontmatter) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      const yamlStr = parts[1];
      yamlStr.split('\n').forEach(line => {
        const match = line.match(/^([a-zA-Z0-9_]+):/);
        if (match) frontmatterFields.push(match[1]);
      });
    }
  }

  const hasName = frontmatterFields.includes('name');
  const hasDescription = frontmatterFields.includes('description');
  const hasBundle = frontmatterFields.includes('bundle');
  const hasEstimatedDuration = frontmatterFields.includes('estimatedDuration');

  // Check Mermaid flowchart
  const hasMermaid = content.includes('```mermaid') || content.includes('flowchart') || content.includes('graph TD') || content.includes('graph LR');

  // Check Phase transition criteria
  const hasPhaseTransition = /phase transition|transition criteria/i.test(content);

  // Check Deterministic verification gates
  const hasVerificationGates = /verification gate|verification/i.test(content);

  // Check Required tool inputs
  const hasToolInputs = /tool input|required tool/i.test(content);

  // Check Validation checkpoints
  const hasValidationCheckpoints = /validation checkpoint|checkpoint/i.test(content);

  // Check Automated rollback protocols
  const hasRollbackProtocols = /rollback protocol|rollback/i.test(content);

  results.push({
    file,
    contentLength: content.length,
    lineCount: content.split('\n').length,
    hasFrontmatter,
    frontmatterFields,
    hasName,
    hasDescription,
    hasBundle,
    hasEstimatedDuration,
    hasMermaid,
    hasPhaseTransition,
    hasVerificationGates,
    hasToolInputs,
    hasValidationCheckpoints,
    hasRollbackProtocols,
  });
}

console.log(JSON.stringify(results, null, 2));
