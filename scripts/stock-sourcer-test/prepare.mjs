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

const SHARED_BRIEF_HEADER = `# Creative Brief — Hearth Roasters Stock Sourcing

You are **Jamileh** (\`agency-creative-designer\` / \`subagent-marketing-creative-designer\`).
Our brand **Hearth Roasters** needs commercial-safe stock assets for our upcoming marketing campaigns and landing page sections.

## Brand Palette (\`design-tokens.json\`)
- \`--surface-paper\`: \`#FAF6F0\` (light cream headline & body text on dark overlays)
- \`--surface-espresso\`: \`#231F1D\` (deep roast background)
- \`--accent-copper\`: \`#C86D3B\` (primary CTA accent)

### Task Requirements
Load and follow the \`commercial-stock-sourcer\` skill for each asset. If \`.env\` exists in the workspace root, \`scripts/fetch-stock.mjs\` will automatically load \`UNSPLASH_ACCESS_KEY\` (and any other configured keys) and blend available candidates with Openverse / Wikimedia Commons. Unconfigured providers without API keys are safely skipped.

### Sourcing Workflow:
1. **Step 1 (Fetch Candidates):**
   - For API Sourcing: Run \`node scripts/fetch-stock.mjs --query "<query>" --type <type> --orientation <orientation> --limit 5 --output ./assets/stock-candidates\`.
   - For Web Search Fallback: Use your native web search tool (e.g. searching Wikimedia Commons or public domain for the subject) to find 1 to 3 candidate image/file URLs. Then run:
     \`node scripts/fetch-stock.mjs --url "<found_url>" --output ./assets/stock-candidates\`.
     *(Fallback: If your host environment does not have a web_search tool, or if discovered URLs 404/fail to download, fall back to: \`node scripts/fetch-stock.mjs --query "<query>" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`.)*
2. **Step 2 (Vision-in-the-Loop Inspection & Hard Pass/Fail Gate):**
   - Read \`./assets/stock-candidates/manifest.json\`.
   - Inspect each candidate image with \`Read\` (or view tool) against the 5 mandatory criteria: Subject Recognizability & Focus, Composition & Aspect Framing, Lighting & Palette Harmony, Clean Copy Zone, Zero Third-Party Trademarks.
   - Non-vision fallback: If you are running on a text-only model without image vision capabilities, evaluate \`manifest.json\` (\`score\`, \`description\`, \`color\`, \`tags\`, \`license\`), set \`"inspectedByVision": false\`, and write \`"visionNotes": "unverified visually (non-vision model); selected via manifest metadata: <reason>"\`.
   - Reject any batch where all candidates fail; do not select a "least-bad" candidate.
   - **Query Refinement Constraint:** If retrying after a batch rejection, never drop core demographic, subject, or brand constraints specified in the brief.
3. **Step 3 (Select, Promote & Clean Up):**
   - Run \`node scripts/fetch-stock.mjs --promote <cand_file> --to ./assets/stock/<filename>.<ext> --output ./assets/stock-candidates\`.
   - (This copies the winner to \`assets/stock/\`, triggers the Unsplash download endpoint if applicable, and automatically cleans up \`./assets/stock-candidates/\`).
4. **Step 4 (Provenance & Attribution):**
   - Write \`assets/stock/<filename>.<ext>.provenance.json\` with provider, creator, license, source URL, and inspection notes.
   - If \`attribution.md\` does not yet exist, create it directly (or append to it). Append creator attribution and license credit (including UTM source parameters for Unsplash).
`;

const HOST_BRIEFS = {
  claude: `${SHARED_BRIEF_HEADER}
### Campaign Assets to Source (Complete Both 2):

1. **Artisanal Morning Pastry (API Sourcing - Food & Bakery):**
   - Query: \`"cinnamon roll fresh bakery pastry"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Subject Guidance: Freshly baked artisanal pastry or cinnamon roll with warm golden tones harmonizing with \`--accent-copper\` (\`#C86D3B\`) and clean space for copy.
   - Command: \`node scripts/fetch-stock.mjs --query "cinnamon roll fresh bakery pastry" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`
   - Target Output: \`assets/stock/bakery-pastry.jpg\` + sidecar \`assets/stock/bakery-pastry.jpg.provenance.json\`

2. **Ceramic Pour Over Dripper (Web Search Fallback / Craft Coffee):**
   - Subject: \`"ceramic coffee dripper kettle cafe"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Sourcing Method: **Test the Web Search Fallback Tool or use API query fallback!**
     - Step 1a: Use your host's web search tool to find 1 to 3 Wikimedia Commons public domain / CC0 image URLs for a pour-over ceramic dripper or kettle setup (e.g. \`site:commons.wikimedia.org "coffee" "dripper" filetype:bitmap\`).
     - Step 1b: Pass the discovered URL(s) to fetch-stock: \`node scripts/fetch-stock.mjs --url "<found_url>" --output ./assets/stock-candidates\`.
     - *(Fallback if web search is not enabled or discovered URLs 404: run \`node scripts/fetch-stock.mjs --query "ceramic coffee dripper kettle cafe" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`)*
   - Target Output: \`assets/stock/coffee-dripper.jpg\` + sidecar \`assets/stock/coffee-dripper.jpg.provenance.json\`
`,

  cline: `${SHARED_BRIEF_HEADER}
### Campaign Assets to Source (Complete Both 2):

1. **Coffee Cup Mascot Icon (API Sourcing - Vector/Illustration):**
   - Query: \`"coffee cup vector icon minimal"\`
   - Type: \`illustration\`
   - Orientation: \`square\`
   - Command: \`node scripts/fetch-stock.mjs --query "coffee cup vector icon minimal" --type illustration --orientation square --limit 5 --output ./assets/stock-candidates\`
   - Target Output: \`assets/stock/coffee-mascot.webp\` (or \`.png\` / \`.jpg\` / \`.svg\`) + sidecar \`assets/stock/coffee-mascot.<ext>.provenance.json\`
   - Format Note: WebP format is modern, web-ready, and fully accepted; do not attempt to convert WebP to JPG.

2. **Barista Crafting Latte Art (API Sourcing - Action Photo):**
   - Query: \`"barista pouring latte art espresso"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Subject Guidance: Action shot of steamed milk pouring into rich espresso crema forming latte art. Rich warm espresso tones (\`#231F1D\`) and clean negative space. Zero commercial logos.
   - Command: \`node scripts/fetch-stock.mjs --query "barista pouring latte art espresso" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`
   - Target Output: \`assets/stock/barista-latte.jpg\` + sidecar \`assets/stock/barista-latte.jpg.provenance.json\`
`,

  antigravity: `${SHARED_BRIEF_HEADER}
### Campaign Assets to Source (Complete Both 2):

1. **Drum Coffee Roasting (API Sourcing - Roastery Equipment):**
   - Query: \`"coffee beans roasting machine roastery"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Subject Guidance: Golden to deep-brown coffee beans tumbling in a roaster drum or cooling tray with copper/metallic highlights.
   - Command: \`node scripts/fetch-stock.mjs --query "coffee beans roasting machine roastery" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`
   - Target Output: \`assets/stock/roasting-beans.jpg\` + sidecar \`assets/stock/roasting-beans.jpg.provenance.json\`

2. **Friends Enjoying Coffee at Cafe (Web Search Fallback / Lifestyle):**
   - Subject: \`"friends talking at cafe table"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Sourcing Method: **Test the Web Search Fallback Tool or use API query fallback!**
     - Step 1a: Use your host's web search tool to find 1 to 3 Wikimedia Commons public domain / CC0 image URLs of friends talking and drinking coffee at a cafe table (e.g. \`site:commons.wikimedia.org "friends" "cafe" filetype:bitmap\`). Avoid non-human metaphors or empty rooms.
     - Step 1b: Pass the discovered URL(s) to fetch-stock: \`node scripts/fetch-stock.mjs --url "<found_url>" --output ./assets/stock-candidates\`.
     - *(Fallback if web search is not enabled or discovered URLs 404: run \`node scripts/fetch-stock.mjs --query "friends talking at cafe table" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`)*
   - Target Output: \`assets/stock/cafe-friends.jpg\` + sidecar \`assets/stock/cafe-friends.jpg.provenance.json\`
`,

  codex: `${SHARED_BRIEF_HEADER}
### Campaign Assets to Source (Complete Both 2):

1. **Modern Cafe Interior (API Sourcing - Architecture & Copy Space):**
   - Query: \`"modern cafe interior wooden counter empty"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Subject Guidance: Warm natural lighting on clean wooden counters with seating, warm dark roast accents (\`#231F1D\`), and ample clean negative space on the left or top for headline overlays.
   - Command: \`node scripts/fetch-stock.mjs --query "modern cafe interior wooden counter empty" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`
   - Target Output: \`assets/stock/cafe-interior.jpg\` + sidecar \`assets/stock/cafe-interior.jpg.provenance.json\`

2. **Asian Barista Crafting Pour Over (API Sourcing - Demographic Focus):**
   - Query: \`"asian woman barista brewing coffee"\`
   - Type: \`photo\`
   - Orientation: \`landscape\`
   - Demographic & Subject Requirement: Must feature an Asian barista brewing or preparing coffee in an artisanal coffee shop setting. If retrying after a batch rejection, NEVER drop the "asian" demographic requirement.
   - Command: \`node scripts/fetch-stock.mjs --query "asian woman barista brewing coffee" --type photo --orientation landscape --limit 5 --output ./assets/stock-candidates\`
   - Target Output: \`assets/stock/asian-barista.jpg\` + sidecar \`assets/stock/asian-barista.jpg.provenance.json\`
`,
};

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
  const envFile = path.join(ws, '.env');

  // Preserve existing .env content if user already configured their API keys
  let preservedEnv = null;
  if (fs.existsSync(envFile)) {
    try {
      preservedEnv = fs.readFileSync(envFile, 'utf8');
    } catch {}
  }

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

  // Actively remove any deprecated hero-coffee assets
  if (fs.existsSync(stockDir)) {
    for (const file of fs.readdirSync(stockDir)) {
      if (file.startsWith('hero-coffee')) {
        fs.rmSync(path.join(stockDir, file), { force: true });
      }
    }
  }

  const briefContent = HOST_BRIEFS[host] ?? HOST_BRIEFS.claude;
  fs.writeFileSync(path.join(ws, 'BRIEF.md'), briefContent, 'utf8');
  fs.writeFileSync(path.join(ws, 'design-tokens.json'), `${JSON.stringify(DESIGN_TOKENS, null, 2)}\n`, 'utf8');

  if (preservedEnv && !preservedEnv.includes('your_unsplash_access_key_here')) {
    fs.writeFileSync(envFile, preservedEnv, 'utf8');
  } else if (!fs.existsSync(envFile)) {
    fs.writeFileSync(
      envFile,
      `# Unsplash API Access Key (Client ID)
# Paste your Unsplash access key below:
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here

# (Optional) Pexels & Pixabay API Keys
# PEXELS_API_KEY=
# PIXABAY_API_KEY=
`,
      'utf8',
    );
  }

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
