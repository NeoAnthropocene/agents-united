#!/usr/bin/env node
/**
 * inject-brand-context.mjs
 *
 * Read-only. Extracts brand context (colors, typography, voice, prohibited
 * terms) from docs/brand-guidelines.md and prints a prompt-injection block
 * (or --json). Never writes to disk. Cross-platform: plain Node fs/path only.
 *
 * Behavior audited against, and re-implemented independently in-house from,
 * the upstream inject-brand-context.cjs documented at
 * https://www.ui-skills.com/skills/nextlevelbuilder/brand
 * (MIT-licensed source: github.com/nextlevelbuilder/ui-ux-pro-max-skill).
 *
 * Usage:
 *   node inject-brand-context.mjs [path-to-guidelines]
 *   node inject-brand-context.mjs --json [path-to-guidelines]
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_GUIDELINES_PATH = 'docs/brand-guidelines.md';

function extractHexColors(text) {
  return [...new Set(text.match(/#[0-9A-Fa-f]{6}\b/g) || [])];
}

function section(content, heading) {
  const match = content.match(new RegExp(`### ${heading}[\\s\\S]*?(?=\\n###|\\n##|$)`, 'i'));
  return match ? match[0] : '';
}

function extractColors(content) {
  return {
    primary: extractHexColors(section(content, 'Primary Colors')),
    secondary: extractHexColors(section(content, 'Secondary Colors')),
    neutral: extractHexColors(section(content, 'Neutral Colors')),
    semantic: extractHexColors(section(content, 'Semantic Colors')),
  };
}

function extractTypography(content) {
  const heading = content.match(/--font-heading:\s*['"]([^'"]+)['"]/);
  const body = content.match(/--font-body:\s*['"]([^'"]+)['"]/);
  const mono = content.match(/--font-mono:\s*['"]([^'"]+)['"]/);
  return {
    heading: heading?.[1] ?? null,
    body: body?.[1] ?? null,
    mono: mono?.[1] ?? null,
  };
}

function extractVoice(content) {
  const personality = section(content, 'Brand Personality');
  const traits = [...personality.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());

  const prohibitedSection = section(content, 'Prohibited Terms') || section(content, 'Forbidden Phrases');
  const prohibited = [...prohibitedSection.matchAll(/-\s*[`"']?([^`"'\n(]+)/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);

  return { traits, prohibited, personality: traits.join(', ') };
}

function buildDigest(guidelinesPath) {
  const resolved = path.isAbsolute(guidelinesPath) ? guidelinesPath : path.join(process.cwd(), guidelinesPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: brand guidelines not found at ${resolved}`);
    console.error(`Create them at ${DEFAULT_GUIDELINES_PATH} (see references/brand-guideline-template.md) or pass a path.`);
    process.exit(1);
  }
  const content = fs.readFileSync(resolved, 'utf-8');
  return {
    colors: extractColors(content),
    typography: extractTypography(content),
    voice: extractVoice(content),
    source: resolved,
    extractedAt: new Date().toISOString(),
  };
}

function renderPromptAddition(digest) {
  const { colors, typography, voice } = digest;
  return [
    'BRAND CONTEXT:',
    '==============',
    '',
    'VISUAL IDENTITY:',
    `- Primary Colors: ${colors.primary.join(', ') || 'Not specified'}`,
    `- Secondary Colors: ${colors.secondary.join(', ') || 'Not specified'}`,
    `- Typography: ${typography.heading || typography.body || 'System fonts'}`,
    '',
    'BRAND VOICE:',
    `- Personality: ${voice.personality || 'Not specified'}`,
    '',
    'CONTENT RULES:',
    `- Prohibited Terms: ${voice.prohibited.join(', ') || 'None specified'}`,
    '',
    'Apply these brand guidelines to all generated content.',
    'Never invent colors, voice traits, or rules not present above.',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const guidelinesPath = args.find((a) => !a.startsWith('--')) || DEFAULT_GUIDELINES_PATH;

  const digest = buildDigest(guidelinesPath);
  console.log(jsonOutput ? JSON.stringify(digest, null, 2) : renderPromptAddition(digest));
}

main();
