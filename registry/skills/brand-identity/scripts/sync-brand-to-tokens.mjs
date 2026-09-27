#!/usr/bin/env node
/**
 * sync-brand-to-tokens.mjs
 *
 * WRITE-CAPABLE. Syncs docs/brand-guidelines.md colors into
 * assets/design-tokens.json (and a matching assets/design-tokens.css).
 * This is the one write-capable script in the brand-identity skill — see
 * SKILL.md Step 4. It NEVER writes unless:
 *   1. --dry-run is not set, AND
 *   2. --confirmed is passed (only after a human requester said yes to
 *      this specific write), AND
 *   3. no existing independent token source was detected (unless --force
 *      is also passed, which is itself a requester decision, never a
 *      default).
 *
 * Behavior audited against, and re-implemented independently in-house from,
 * the upstream sync-brand-to-tokens.cjs documented at
 * https://www.ui-skills.com/skills/nextlevelbuilder/brand
 * (MIT-licensed source: github.com/nextlevelbuilder/ui-ux-pro-max-skill).
 * Cross-platform: pure Node fs/path, no shell/bash dependency, no
 * child_process calls (the upstream script's optional CSS-regeneration
 * step is treated here as informational only — this port always writes
 * assets/design-tokens.css directly instead of shelling out to a sibling
 * generator script, so there is nothing OS-specific to fail on Windows).
 *
 * Usage:
 *   node sync-brand-to-tokens.mjs --dry-run
 *   node sync-brand-to-tokens.mjs --confirmed
 *   node sync-brand-to-tokens.mjs --confirmed --force   (only if an
 *     existing token source was detected and the requester explicitly
 *     wants it replaced)
 */
import fs from 'node:fs';
import path from 'node:path';
import { requireConfirmation, isDryRun } from './lib/confirm-gate.mjs';

const BRAND_GUIDELINES = 'docs/brand-guidelines.md';
const DESIGN_TOKENS_JSON = 'assets/design-tokens.json';
const DESIGN_TOKENS_CSS = 'assets/design-tokens.css';
const CSS_TOKEN_SOURCES = [
  'src/index.css', 'src/globals.css', 'src/styles/globals.css', 'src/styles/tokens.css',
  'src/app/globals.css', 'app/globals.css', 'styles/globals.css', 'styles/tokens.css',
];
const TAILWIND_CONFIGS = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts'];

function findExistingTokenSources(projectRoot) {
  const sources = new Set();
  const addIfPresent = (rel) => {
    if (fs.existsSync(path.resolve(projectRoot, rel))) sources.add(rel);
  };
  addIfPresent(DESIGN_TOKENS_JSON);
  addIfPresent(DESIGN_TOKENS_CSS);

  for (const rel of CSS_TOKEN_SOURCES) {
    const abs = path.resolve(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    const hasRootTokens = /:root\b[^{}]*\{[^}]*--[A-Za-z0-9_-]+\s*:/.test(content);
    const hasTailwindTheme = /@theme(?:\s+[A-Za-z-]+)?\s*\{[^}]*--[A-Za-z0-9_-]+\s*:/.test(content);
    if (hasRootTokens || hasTailwindTheme) sources.add(rel);
  }

  for (const rel of TAILWIND_CONFIGS) {
    const abs = path.resolve(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf-8');
    if (/\btheme\s*:\s*\{[\s\S]*?\bcolors\s*:/.test(content) || /\bpresets\s*:/.test(content)) sources.add(rel);
  }

  return [...sources];
}

function section(content, heading) {
  const match = content.match(new RegExp(`### ${heading}[\\s\\S]*?(?=\\n###|\\n##|$)`, 'i'));
  return match ? match[0] : '';
}

function extractColorsFromMarkdown(content) {
  const rowRe = /\|\s*\*{0,2}([^*|]+?)\*{0,2}\s*\|\s*#([A-Fa-f0-9]{6})\b/g;
  const colors = { primary: {}, secondary: {}, accent: {} };

  const assignFromSection = (heading, target) => {
    for (const m of section(content, heading).matchAll(rowRe)) {
      const label = m[1].trim().toLowerCase();
      const hex = `#${m[2]}`;
      if (label.includes('dark')) target.dark = hex;
      else if (label.includes('light')) target.light = hex;
      else if (!target.base) target.base = hex;
    }
  };
  assignFromSection('Primary Colors', colors.primary);
  assignFromSection('Secondary Colors', colors.secondary);
  assignFromSection('Accent Colors', colors.accent);

  return colors;
}

function adjustBrightness(hex, percent) {
  if (typeof hex !== 'string') return '#000000';
  const num = parseInt(hex.replace('#', ''), 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
  const adjusted = channels.map((c) => {
    const v = percent >= 0 ? c + (255 - c) * percent : c * (1 + percent);
    return Math.min(255, Math.max(0, Math.round(v)));
  });
  return `#${((adjusted[0] << 16) | (adjusted[1] << 8) | adjusted[2]).toString(16).padStart(6, '0').toUpperCase()}`;
}

function generateColorScale(base, dark, light) {
  const scale = {};
  const stops = [
    ['50', light ?? adjustBrightness(base, 0.9)],
    ['100', light ?? adjustBrightness(base, 0.8)],
    ['200', adjustBrightness(base, 0.6)],
    ['300', adjustBrightness(base, 0.4)],
    ['400', adjustBrightness(base, 0.2)],
    ['500', base],
    ['600', dark ?? adjustBrightness(base, -0.15)],
    ['700', adjustBrightness(base, -0.3)],
    ['800', adjustBrightness(base, -0.45)],
    ['900', adjustBrightness(base, -0.6)],
  ];
  for (const [key, value] of stops) scale[key] = { $value: value, $type: 'color' };
  return scale;
}

function buildTokens(existingTokens, colors) {
  const tokens = { ...existingTokens };
  tokens.primitive = tokens.primitive || {};
  tokens.primitive.color = tokens.primitive.color || {};

  for (const role of ['primary', 'secondary', 'accent']) {
    const c = colors[role];
    if (!c.base) {
      console.warn(`No base hex found for ${role} — skipping its token scale.`);
      continue;
    }
    tokens.primitive.color[role] = generateColorScale(c.base, c.dark, c.light);
  }
  return tokens;
}

function renderCss(tokens) {
  const lines = [':root {'];
  for (const [role, scale] of Object.entries(tokens.primitive?.color ?? {})) {
    for (const [step, def] of Object.entries(scale)) {
      lines.push(`  --color-${role}-${step}: ${def.$value};`);
    }
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = isDryRun(argv);
  const force = argv.includes('--force');
  const projectRoot = process.cwd();

  const guidelinesPath = path.resolve(projectRoot, BRAND_GUIDELINES);
  if (!fs.existsSync(guidelinesPath)) {
    console.error(`Brand guidelines not found: ${guidelinesPath}`);
    process.exit(1);
  }

  const existingSources = findExistingTokenSources(projectRoot);
  if (existingSources.length > 0 && !force) {
    const details = existingSources.map((s) => `   - ${s}`).join('\n');
    const message =
      `Existing design-token source(s) detected:\n${details}\n` +
      'Refusing to create or replace token files. This is a requester decision — ' +
      'report it and only re-run with --force if they explicitly ask for replacement.';
    if (dryRun) console.warn(message);
    else {
      console.error(message);
      process.exit(1);
    }
  }

  const colors = extractColorsFromMarkdown(fs.readFileSync(guidelinesPath, 'utf-8'));
  console.log('Extracted colors:', JSON.stringify(colors));

  const tokensPath = path.resolve(projectRoot, DESIGN_TOKENS_JSON);
  const existingTokens = fs.existsSync(tokensPath) ? JSON.parse(fs.readFileSync(tokensPath, 'utf-8')) : {};
  const tokens = buildTokens(existingTokens, colors);
  const css = renderCss(tokens);

  if (dryRun) {
    console.log(`\n[dry run] Would write ${DESIGN_TOKENS_JSON}:`);
    console.log(JSON.stringify(tokens, null, 2).slice(0, 800));
    console.log(`\n[dry run] Would write ${DESIGN_TOKENS_CSS}:`);
    console.log(css);
    console.log('\nNo files changed (--dry-run).');
    return;
  }

  requireConfirmation(argv, `${DESIGN_TOKENS_JSON} and ${DESIGN_TOKENS_CSS}`);

  fs.mkdirSync(path.dirname(tokensPath), { recursive: true });
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  fs.writeFileSync(path.resolve(projectRoot, DESIGN_TOKENS_CSS), css);
  console.log(`Wrote ${DESIGN_TOKENS_JSON} and ${DESIGN_TOKENS_CSS}.`);
}

main();
