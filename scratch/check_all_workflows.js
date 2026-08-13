import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const dir = path.resolve('registry/workflows');
const files = fs.readdirSync(dir).filter(f => f.startsWith('workflow-') && f.endsWith('.md')).sort();

const inventory = files.map((file, idx) => {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const titleLine = lines.find(l => l.startsWith('# Workflow:'));
  const title = titleLine ? titleLine.replace('# Workflow:', '').trim() : file;

  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let metadata = null;
  if (fmMatch) {
    try {
      metadata = YAML.parse(fmMatch[1]);
    } catch (e) {
      metadata = { error: e.message };
    }
  }

  // Determine domain / category from filename prefix
  let domain = 'general';
  if (file.includes('--')) {
    domain = file.replace('workflow-', '').split('--')[0];
  } else if (file.startsWith('workflow-marketing-')) {
    domain = 'marketing';
  }

  return {
    id: idx + 1,
    filename: file,
    title,
    domain,
    metadata,
    hasYamlFrontmatter: !!fmMatch,
    hasMermaidFlowchart: content.includes('```mermaid'),
    hasVerificationGates: /verification gate|gate/i.test(content),
    hasToolInputs: /tool/i.test(content),
    hasRollbackProtocol: /rollback/i.test(content),
    linesCount: lines.length,
    bytes: content.length
  };
});

fs.writeFileSync('scratch/workflow_analysis.json', JSON.stringify(inventory, null, 2), 'utf8');
console.log(`Processed ${inventory.length} workflow files.`);
