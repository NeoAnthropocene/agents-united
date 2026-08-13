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

console.log('Committing scoped package fix...');
execSync(`git add . && git commit -m "fix(release): update package name to @neoanthropocene/agents-united and configure semantic-release npm plugin"`, { stdio: 'inherit' });

console.log('Pushing dev branch...');
execSync(`git push "${repoUrl}" dev:dev`, { stdio: 'inherit' });

console.log('Pushing main branch to trigger GitHub Actions release...');
execSync(`git push "${repoUrl}" dev:main --force`, { stdio: 'inherit' });

console.log('Push successful!');
