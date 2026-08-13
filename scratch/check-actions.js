import fs from 'fs-extra';

const envContent = await fs.readFile('.env.local', 'utf8');
const tokenMatch = envContent.match(/GITHUB_TOKEN=(.+)/);
if (!tokenMatch) {
  console.error('No GITHUB_TOKEN found in .env.local');
  process.exit(1);
}

const token = tokenMatch[1].trim();

const res = await fetch('https://api.github.com/repos/NeoAnthropocene/agents-united/actions/runs', {
  headers: {
    'Authorization': `token ${token}`,
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github.v3+json'
  }
});

const data = await res.json();
if (!data.workflow_runs) {
  console.log('API Response:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`Found ${data.workflow_runs.length} workflow runs:`);
for (const run of data.workflow_runs.slice(0, 5)) {
  console.log(`\nRun ID: ${run.id} | Workflow: ${run.name} | Event: ${run.event} | Status: ${run.status} | Conclusion: ${run.conclusion}`);
  console.log(`URL: ${run.html_url}`);

  // Fetch jobs for this run
  const jobsRes = await fetch(run.jobs_url, {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'Node.js',
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  const jobsData = await jobsRes.json();
  if (jobsData.jobs) {
    for (const job of jobsData.jobs) {
      console.log(`  Job: ${job.name} | Conclusion: ${job.conclusion}`);
      if (job.steps) {
        for (const step of job.steps) {
          if (step.conclusion === 'failure') {
            console.log(`    ❌ Failed Step: ${step.name}`);
          }
        }
      }
    }
  }
}
