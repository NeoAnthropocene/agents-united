#!/usr/bin/env node
/**
 * validate-asset.mjs
 *
 * Read-only. Validates a marketing asset's filename, format, and size
 * against the rules in references/asset-organization.md. Never writes to
 * disk (there is no --fix implementation here — an asset's correction is
 * always proposed as text for a human to apply). Cross-platform.
 *
 * Behavior audited against, and re-implemented independently in-house from,
 * the upstream validate-asset.cjs documented at
 * https://www.ui-skills.com/skills/nextlevelbuilder/brand
 * (MIT-licensed source: github.com/nextlevelbuilder/ui-ux-pro-max-skill).
 * Note: the upstream script's own --fix flag is documented but not
 * implemented; this port does not implement it either — see SKILL.md
 * Edge Cases.
 *
 * Usage:
 *   node validate-asset.mjs <asset-path> [--json]
 */
import fs from 'node:fs';
import path from 'node:path';

const NAME_PATTERN = /^[a-z]+_[a-z0-9-]+_[a-z0-9-]+_\d{8}(_[a-z0-9-]+)?\.[a-z]+$/;
const VALID_TYPES = ['banner', 'logo', 'design', 'video', 'infographic', 'icon', 'photo'];
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VECTOR_FORMATS = ['svg'];
const VIDEO_FORMATS = ['mp4', 'mov', 'webm'];
const DOCUMENT_FORMATS = ['pdf', 'psd', 'ai', 'fig'];
const SIZE_LIMITS = {
  image: { max: 5 * 1024 * 1024, recommended: 1 * 1024 * 1024 },
  video: { max: 100 * 1024 * 1024, recommended: 50 * 1024 * 1024 },
  svg: { max: 500 * 1024, recommended: 100 * 1024 },
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${units[i]}`;
}

function validateFilename(filename) {
  const issues = [];
  const suggestions = [];
  const matchesPattern = NAME_PATTERN.test(filename);
  if (!matchesPattern) {
    issues.push('Filename does not match naming convention');
    suggestions.push('Expected: {type}_{campaign}_{description}_{YYYYMMDD}[_variant].{ext}');
  }

  const parts = filename.replace(/\.[^.]+$/, '').split('_');
  const [type, campaign, description, timestamp] = parts;
  if (parts.length >= 4) {
    if (!/^\d{8}$/.test(timestamp)) issues.push('Timestamp should be YYYYMMDD format');
    if (campaign && !/^[a-z0-9-]+$/.test(campaign)) issues.push('Campaign segment should be kebab-case');
    if (description && !/^[a-z0-9-]+$/.test(description)) issues.push('Description segment should be kebab-case');
    if (type && !VALID_TYPES.includes(type)) suggestions.push(`Consider a type from: ${VALID_TYPES.join(', ')}`);
  }

  return { valid: issues.length === 0, issues, suggestions };
}

function validateFormat(extension) {
  const all = [...IMAGE_FORMATS, ...VECTOR_FORMATS, ...VIDEO_FORMATS, ...DOCUMENT_FORMATS];
  if (!all.includes(extension)) return { valid: false, issues: [`Unsupported file format: .${extension}`] };
  return { valid: true, issues: [] };
}

function validateFileSize(filepath, extension) {
  const size = fs.statSync(filepath).size;
  const limits = VIDEO_FORMATS.includes(extension)
    ? SIZE_LIMITS.video
    : extension === 'svg'
      ? SIZE_LIMITS.svg
      : SIZE_LIMITS.image;

  const issues = [];
  const warnings = [];
  if (size > limits.max) issues.push(`File size (${formatBytes(size)}) exceeds maximum (${formatBytes(limits.max)})`);
  else if (size > limits.recommended) warnings.push(`File size (${formatBytes(size)}) exceeds recommended (${formatBytes(limits.recommended)})`);

  return { valid: issues.length === 0, issues, warnings, size };
}

function validateAsset(assetPath) {
  const filename = path.basename(assetPath);
  const result = { path: assetPath, filename, valid: true, issues: [], warnings: [], suggestions: [] };

  if (!fs.existsSync(assetPath)) {
    result.valid = false;
    result.issues.push(`File not found: ${assetPath}`);
    return result;
  }

  const extension = path.extname(filename).slice(1).toLowerCase();
  const filenameResult = validateFilename(filename);
  const formatResult = validateFormat(extension);
  const sizeResult = validateFileSize(assetPath, extension);

  result.issues.push(...filenameResult.issues, ...formatResult.issues, ...sizeResult.issues);
  result.warnings.push(...sizeResult.warnings);
  result.suggestions.push(...filenameResult.suggestions);
  result.fileSize = sizeResult.size;
  result.valid = result.issues.length === 0;
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  if (args.includes('--fix')) {
    console.error('--fix is not implemented (upstream never implemented it either). Corrections are proposed as text only.');
  }
  const assetPath = args.find((a) => !a.startsWith('--'));
  if (!assetPath) {
    console.error('Usage: node validate-asset.mjs <asset-path> [--json]');
    process.exit(1);
  }

  const resolved = path.isAbsolute(assetPath) ? assetPath : path.join(process.cwd(), assetPath);
  const result = validateAsset(resolved);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\nASSET VALIDATION: ${result.filename}`);
    console.log(`Status: ${result.valid ? 'PASS' : 'FAIL'}`);
    if (result.issues.length) console.log(`Issues:\n${result.issues.map((i) => `  - ${i}`).join('\n')}`);
    if (result.warnings.length) console.log(`Warnings:\n${result.warnings.map((w) => `  - ${w}`).join('\n')}`);
    if (result.suggestions.length) console.log(`Suggestions:\n${result.suggestions.map((s) => `  - ${s}`).join('\n')}`);
  }

  process.exit(result.valid ? 0 : 1);
}

main();
