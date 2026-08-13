import { execSync } from 'node:child_process';
import fs from 'fs-extra';

const envContent = await fs.readFile('.env.local', 'utf8');
const tokenMatch = envContent.match(/GITHUB_TOKEN=(.+)/);
if (!tokenMatch) {
  console.error('No GITHUB_TOKEN found in .env.local');
  process.exit(1);
}

const token = tokenMatch[1].trim();
const repoUrl = `https://${token}@github.com/NeoAnthropocene/agents-united.git`;

console.log('Committing test additions...');
execSync(`git add . && git commit -m "test(cli): add comprehensive CLI end-to-end integration test suite"`, { stdio: 'inherit' });

console.log('Pushing dev branch...');
execSync(`git push "${repoUrl}" dev:dev`, { stdio: 'inherit' });

console.log('Pushing main branch...');
execSync(`git push "${repoUrl}" dev:main`, { stdio: 'inherit' });

console.log('Push complete!');
