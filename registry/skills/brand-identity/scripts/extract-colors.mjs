#!/usr/bin/env node
/**
 * extract-colors.mjs
 *
 * Read-only. Parses the brand palette out of docs/brand-guidelines.md and
 * either prints it (--palette) or prints an external-tool command plus
 * compliance context for a given image. Never shells out itself — it only
 * ever prints a command for a human or another capability to run.
 * Cross-platform (pure Node fs/path).
 *
 * Behavior audited against, and re-implemented independently in-house from,
 * the upstream extract-colors.cjs documented at
 * https://www.ui-skills.com/skills/nextlevelbuilder/brand
 * (MIT-licensed source: github.com/nextlevelbuilder/ui-ux-pro-max-skill).
 *
 * Usage:
 *   node extract-colors.mjs --palette
 *   node extract-colors.mjs <image-path>
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

function parseBrandColors(guidelinesPath) {
  const resolved = path.isAbsolute(guidelinesPath) ? guidelinesPath : path.join(process.cwd(), guidelinesPath);
  if (!fs.existsSync(resolved)) return null;
  const content = fs.readFileSync(resolved, 'utf-8');

  const palette = {
    primary: extractHexColors(section(content, 'Primary')),
    secondary: extractHexColors(section(content, 'Secondary')),
    neutral: extractHexColors(section(content, 'Neutral')),
    semantic: extractHexColors(section(content, 'Semantic')),
  };
  palette.all = [...new Set([...palette.primary, ...palette.secondary, ...palette.neutral, ...palette.semantic])];
  return palette;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const showPalette = args.includes('--palette');
  const imagePath = args.find((a) => !a.startsWith('--'));

  const palette = parseBrandColors(DEFAULT_GUIDELINES_PATH);
  if (!palette) {
    console.error(`Brand guidelines not found at ${DEFAULT_GUIDELINES_PATH}`);
    process.exit(1);
  }

  if (showPalette || !imagePath) {
    if (jsonOutput) {
      console.log(JSON.stringify(palette, null, 2));
    } else {
      console.log('\nBRAND COLOR PALETTE');
      console.log(`  Primary:   ${palette.primary.join(', ') || 'none'}`);
      console.log(`  Secondary: ${palette.secondary.join(', ') || 'none'}`);
      console.log(`  Neutral:   ${palette.neutral.join(', ') || 'none'}`);
      console.log(`  Semantic:  ${palette.semantic.join(', ') || 'none'}`);
      console.log(`Total: ${palette.all.length} colors`);
      if (!imagePath) console.log('\nTo compare an image: node extract-colors.mjs <image-path>');
    }
    return;
  }

  const resolvedImage = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
  if (!fs.existsSync(resolvedImage)) {
    console.error(`Image not found: ${resolvedImage}`);
    process.exit(1);
  }

  const command = `magick "${resolvedImage}" -colors 10 -depth 8 -format "%c" histogram:info:`;
  const result = {
    image: resolvedImage,
    brandPalette: palette,
    extractionCommand: command,
    instructions: [
      'This script does not shell out. To extract dominant colors, either:',
      `  1. Run: ${command}   (requires ImageMagick's "magick" CLI)`,
      '  2. Or use an available image-analysis capability to list the 10 most dominant hex colors',
      'Then compare the result against brandPalette.all below.',
    ],
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\nImage: ${result.image}`);
    result.instructions.forEach((line) => console.log(line));
    console.log(`\nBrand palette (${palette.all.length} colors): ${palette.all.join(', ')}`);
  }
}

main();
