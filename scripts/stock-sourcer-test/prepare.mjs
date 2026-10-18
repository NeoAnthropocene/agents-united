#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DEFAULT_ROOT = path.join(os.tmpdir(), 'agents-united-stock-sourcer-test');
const HOSTS = ['claude', 'cline', 'antigravity', 'codex'];
const SKILLS_TO_COPY = ['commercial-stock-sourcer', 'image-creation', 'color-theory'];

const BRIEF_MD = `# Creative Brief — Hearth Roasters Stock & B-Roll Sourcing

You are **Jamileh** (\`agency-creative-designer\` / \`subagent-marketing-creative-designer\`).
Our specialty coffee brand **Hearth Roasters** needs commercial-safe stock assets for its new landing page.

## Brand Palette (\`design-tokens.json\`)
- \`--surface-paper\`: \`#FAF6F0\` (light cream headline & body text on dark hero overlays)
- \`--surface-espresso\`: \`#231F1D\` (deep roast background)
- \`--accent-copper\`: \`#C86D3B\` (primary CTA accent)

## Task Requirements
Load and follow the \`commercial-stock-sourcer\` skill:
1. **Step 1 (Fetch Candidates):** Run \`scripts/fetch-stock.mjs\` to download 3 landscape photo candidates for \`"pour over coffee"\` into \`./assets/stock-candidates\`.
2. **Step 2 (Vision-in-the-Loop Inspection):** Read \`./assets/stock-candidates/manifest.json\` and inspect each downloaded candidate image visually with your multimodal file-reading tool (\`Read\`). Evaluate warm lighting, absence of third-party trademarks, and a clean copy zone for \`#FAF6F0\` headline text.
3. **Step 3 (Select, Promote & Clean Up):** Promote the single best photo to \`assets/stock/hero-coffee.jpg\` and delete \`./assets/stock-candidates/\`.
4. **Step 4 (Provenance & Attribution):** Write \`assets/stock/hero-coffee.jpg.provenance.json\` (including \`provider\`, \`creator\`, \`license\`, \`sourceUrl\`, \`inspectedByVision: true\`, and \`visionNotes\`) and write \`attribution.md\` in the workspace root.
`;

const DESIGN_TOKENS = {
  color: {
    surface: {
      paper: { value: '#FAF6F0', type: 'color' },
      espresso: { value: '#231F1D', type: 'color' },
    },
    accent: {
      copper: { value: '#C86D3B', type: 'color' },
    },
  },
};

function copySkillDir(skillName, destSkillsRoot) {
  const src = path.join(REPO_ROOT, 'registry', 'skills', skillName);
  const dest = path.join(destSkillsRoot, skillName);
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function scaffoldHostWorkspace(rootDir, host, clean = false) {
  const ws = path.join(rootDir, host);
  const stockDir = path.join(ws, 'assets', 'stock');
  const hasCompletedRun =
    !clean &&
    fs.existsSync(path.join(ws, 'attribution.md')) &&
    fs.existsSync(stockDir) &&
    fs.readdirSync(stockDir).some(f => f.endsWith('.provenance.json'));

  if (!hasCompletedRun) {
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {
      fs.rmSync(path.join(ws, 'assets'), { recursive: true, force: true });
      fs.rmSync(path.join(ws, 'attribution.md'), { force: true });
    }
  } else {
    fs.rmSync(path.join(ws, 'assets', 'stock-candidates'), { recursive: true, force: true });
  }
  fs.mkdirSync(stockDir, { recursive: true });
  fs.writeFileSync(path.join(ws, 'BRIEF.md'), BRIEF_MD, 'utf8');
  fs.writeFileSync(path.join(ws, 'design-tokens.json'), `${JSON.stringify(DESIGN_TOKENS, null, 2)}\n`, 'utf8');

  const wsScriptsDir = path.join(ws, 'scripts');
  fs.mkdirSync(wsScriptsDir, { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, 'registry', 'skills', 'commercial-stock-sourcer', 'scripts', 'fetch-stock.mjs'),
    path.join(wsScriptsDir, 'fetch-stock.mjs'),
  );

  if (host === 'claude') {
    const skillsDir = path.join(ws, '.claude', 'skills');
    const agentsDir = path.join(ws, '.claude', 'agents');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });
    for (const s of SKILLS_TO_COPY) copySkillDir(s, skillsDir);
    fs.copyFileSync(
      path.join(REPO_ROOT, 'registry', 'hosts', 'claude', 'agents', 'agency-creative-designer.md'),
      path.join(agentsDir, 'agency-creative-designer.md'),
    );
  } else if (host === 'cline') {
    const skillsDir = path.join(ws, '.cline', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    for (const s of SKILLS_TO_COPY) copySkillDir(s, skillsDir);
    fs.copyFileSync(
      path.join(REPO_ROOT, 'registry', 'agents', 'subagent-marketing-creative-designer.md'),
      path.join(ws, '.clinerules'),
    );
  } else if (host === 'antigravity') {
    const skillsDir = path.join(ws, '.agents', 'skills');
    const agentsDir = path.join(ws, '.agents', 'agents');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });
    for (const s of SKILLS_TO_COPY) copySkillDir(s, skillsDir);
    fs.copyFileSync(
      path.join(REPO_ROOT, 'registry', 'agents', 'subagent-marketing-creative-designer.md'),
      path.join(agentsDir, 'subagent-marketing-creative-designer.md'),
    );
  } else if (host === 'codex') {
    const skillsDir = path.join(ws, '.agents', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    for (const s of SKILLS_TO_COPY) copySkillDir(s, skillsDir);
    fs.copyFileSync(
      path.join(REPO_ROOT, 'registry', 'agents', 'subagent-marketing-creative-designer.md'),
      path.join(ws, 'AGENTS.md'),
    );
  }

  return ws;
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', default: DEFAULT_ROOT },
      'skip-preflight-network': { type: 'boolean', default: false },
      clean: { type: 'boolean', default: false },
    },
    strict: false,
  });

  const rootDir = path.resolve(String(values.root ?? DEFAULT_ROOT));
  fs.mkdirSync(rootDir, { recursive: true });

  for (const host of HOSTS) {
    scaffoldHostWorkspace(rootDir, host, Boolean(values.clean));
  }

  if (!values['skip-preflight-network']) {
    const preflightDir = path.join(rootDir, '_preflight');
    const fetchScript = path.join(
      REPO_ROOT,
      'registry',
      'skills',
      'commercial-stock-sourcer',
      'scripts',
      'fetch-stock.mjs',
    );
    const res = spawnSync(
      process.execPath,
      [fetchScript, '--query', 'coffee', '--type', 'photo', '--limit', '1', '--output', preflightDir],
      { encoding: 'utf8' },
    );
    if (res.status !== 0) {
      process.stderr.write(`Pre-flight network check warning: ${res.stderr}\n`);
    } else {
      process.stdout.write(`Pre-flight script check PASSED: ${res.stdout.trim()}\n`);
    }
  }

  process.stdout.write(`\nPrepared 4 isolated host workspaces under: ${rootDir}\n\n`);
  process.stdout.write(`=== Maintainer Live-Host CLI Commands (docs/live-test-protocol.md) ===\n`);
  process.stdout.write(
    `1. Claude Code:\n   cd "${path.join(rootDir, 'claude')}" ; claude -p "Read BRIEF.md and execute the stock sourcing task using commercial-stock-sourcer." --model sonnet --effort low --max-budget-usd 0.80 --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Skill"\n`,
  );
  process.stdout.write(
    `2. Cline CLI:\n   cd "${path.join(rootDir, 'cline')}" ; cline -y "Read BRIEF.md and execute the stock sourcing task using commercial-stock-sourcer."\n`,
  );
  process.stdout.write(
    `3. Antigravity CLI:\n   cd "${path.join(rootDir, 'antigravity')}" ; agy chat -m "Read BRIEF.md and execute the stock sourcing task using commercial-stock-sourcer."\n`,
  );
  process.stdout.write(
    `4. Codex CLI:\n   cd "${path.join(rootDir, 'codex')}" ; codex exec -s danger-full-access --skip-git-repo-check "Read BRIEF.md and execute the stock sourcing task using commercial-stock-sourcer."\n`,
  );
}

main();
