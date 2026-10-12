// call-check.mjs: a read-only preflight for a planned call to mcp__image-gen__generate_image (the server mcp-image, pinned in mcp-setup).
// It says what the server would refuse, and what the server would NOT refuse but this team does: an input image outside the project.
// It never calls the tool, never reads a pixel and writes nothing. A role with a shell runs it; a PreToolUse hook could import checkCall.
//
// usage: node call-check.mjs <call.json> [--project <dir>] [--output-dir <dir>] [--images <n>] [--allow <path>]... [--default-provider <name>] [--json]
//   <call.json>        the arguments of the call, bare or as { "arguments": { ... } }
//   --project          the project root; required when the call names input images
//   --allow            a path the user typed in full in this task (repeatable): an input image outside the project is then a warning, not an error
//   --output-dir       the folder the server saves into (IMAGE_OUTPUT_DIR); a file name already used there is refused
//   --images           how many images the go-ahead covers (default 1), for the estimate
//   --default-provider the server's IMAGE_PROVIDER (default gemini)
// exit: 0 no error (warnings allowed), 1 at least one error, 2 usage or an unreadable file

import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RATIOS = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'];
export const PROVIDERS = ['gemini', 'openai', 'seedream'];
export const QUALITIES = ['fast', 'balanced', 'quality'];
export const SIZES = ['1K', '2K', '4K'];
/** The most reference images one call may carry, per provider (mcp-image 0.18.0). */
export const MAX_INPUT_IMAGES = { gemini: 14, openai: 16, seedream: 10 };
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const INPUT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
/** Ratios that OpenAI (beyond 3:1) and the Gemini Pro model (Google's size table) do not offer. */
const EXTREME_RATIOS = ['1:4', '1:8', '4:1', '8:1'];
const TOOL_FIELDS = ['prompt', 'fileName', 'inputImagePaths', 'blendImages', 'maintainCharacterConsistency', 'useWorldKnowledge', 'useGoogleSearch', 'aspectRatio', 'imageSize', 'purpose', 'quality', 'provider'];
const RETIRED_FIELDS = ['inputImagePath', 'inputImage', 'inputImageMimeType'];
const BOOLEAN_FIELDS = ['blendImages', 'maintainCharacterConsistency', 'useWorldKnowledge', 'useGoogleSearch'];
const CALLS_PER_ASSET = 3;

const GEMINI_DEFAULT = { model: 'gemini-nano-banana-2.1', '1K': 0.0336, '2K': 0.0504, '4K': 0.113 };
/** Prices read on 2026-10-09 from each provider's own page (see references/providers.md). USD per output image, paid tier, standard. */
export const PRICES = {
  gemini: { fast: GEMINI_DEFAULT, balanced: GEMINI_DEFAULT, quality: { model: 'gemini-3-pro-image', '1K': 0.134, '2K': 0.134, '4K': 0.24 } },
  seedream: { model: 'dola-seedream-5-0-pro-260628', '1K': 0.045, '2K': 0.09, extraReference: 0.003 },
  openai: { fast: 'gpt-image-2.5-flare', balanced: 'gpt-image-2.5-flare', quality: 'gpt-image-2.5-sunburst', perImage: null },
};

const SENSITIVE_NAME = /passport|licen[cs]e|id[-_ ]?card|national[-_ ]?id|\bssn\b|selfie|screen[-_ ]?shot|statement|invoice|receipt|\bbank|credit[-_ ]?card|medical|\bscan\b/i;
const QUOTED_TEXT = /["“][^"”]{2,}["”]/;
const ASKED_OF_THE_PICTURE = /\b(logo|slogan|tagline|trademark|watermark)\b|\b(named|called)\s+[A-Z][a-z]+|\b(customer|reviewer|endorser|testimonial|CEO|founder)\b|\b(text|headline|words|lettering|typography|caption)\b.{0,30}\b(says|saying|reads|reading)\b/i;

const round = value => Math.round(value * 1e6) / 1e6;

/** True when `file` is `root` or lies under it. Both are compared as real paths when they exist. */
export function isInside(root, file) {
  const relative = path.relative(root, file);
  if (relative === '') return true;
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function realOrResolved(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

/** True when one of the paths the user typed names the file that was judged (compared as real paths when they exist, and without regard to case on Windows). */
function isTyped(allowed, entry, real) {
  return (allowed ?? []).some(typed => {
    const candidate = realOrResolved(typed);
    return candidate === real || candidate === path.resolve(entry) || (process.platform === 'win32' && candidate.toLowerCase() === real.toLowerCase());
  });
}

function priceFor(provider, quality, size, referenceCount) {
  if (provider === 'gemini') {
    const row = PRICES.gemini[quality];
    return { model: row.model, perImageUsd: row[size], basis: 'published', note: 'Input images add a small token charge; useGoogleSearch adds $14 per 1,000 searches beyond the 5,000 free each month.' };
  }
  if (provider === 'seedream') {
    const base = PRICES.seedream[size];
    return {
      model: PRICES.seedream.model,
      perImageUsd: round(base + PRICES.seedream.extraReference * Math.max(0, referenceCount - 1)),
      basis: 'published',
      note: 'The first reference image is free, each further one costs $0.003. BytePlus rewrites the prompt on its side.',
    };
  }
  return {
    model: PRICES.openai[quality],
    perImageUsd: null,
    basis: 'unpublished',
    note: 'OpenAI publishes token prices only ($30 per million image output tokens), not a price per image. Make the first image a probe, ask the user to read its charge on the OpenAI usage page, and set the ceiling for the rest from that.',
  };
}

/**
 * Checks one planned call.
 * @param {Record<string, unknown>} call the arguments of the call
 * @param {{ projectRoot?: string, outputDir?: string, defaultProvider?: string, images?: number, allow?: string[] }} [options]
 */
export function checkCall(call, options = {}) {
  const findings = [];
  const add = (severity, code, field, message) => findings.push({ code, severity, field, message });
  const args = call && typeof call === 'object' && !Array.isArray(call) ? call : {};
  if (args !== call) add('error', 'call', 'arguments', 'The call must be an object of arguments.');

  for (const field of RETIRED_FIELDS) {
    if (args[field] !== undefined) add('error', 'retired-field', field, `${field} is retired: the server rejects it. Use inputImagePaths, an array of absolute paths.`);
  }
  for (const field of Object.keys(args)) {
    if (!TOOL_FIELDS.includes(field) && !RETIRED_FIELDS.includes(field)) add('warn', 'unknown-field', field, `${field} is not a parameter of the tool; the server ignores it.`);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (args[field] !== undefined && typeof args[field] !== 'boolean') add('error', 'field-type', field, `${field} must be true or false.`);
  }

  // prompt
  const prompt = args.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length === 0) add('error', 'prompt', 'prompt', 'prompt must be 1 to 4,000 characters of text.');
  else if (prompt.length > 4000) add('error', 'prompt', 'prompt', `prompt is ${prompt.length} characters; the limit is 4,000.`);
  else if (QUOTED_TEXT.test(prompt) || ASKED_OF_THE_PICTURE.test(prompt)) {
    add('warn', 'prompt-content', 'prompt', 'The prompt asks the picture for text, a logo, a slogan or a named or endorsing person. Raster text drifts, a logo or a name is not ours to invent, and an invented customer is never allowed: write a scene, and put any text over it.');
  }

  // provider and quality
  const defaultProvider = PROVIDERS.includes(options.defaultProvider) ? options.defaultProvider : 'gemini';
  let provider = defaultProvider;
  if (args.provider !== undefined) {
    if (PROVIDERS.includes(args.provider)) provider = args.provider;
    else add('error', 'provider', 'provider', `provider must be one of ${PROVIDERS.join(', ')}.`);
  }
  let quality = 'fast';
  if (args.quality !== undefined) {
    if (QUALITIES.includes(args.quality)) quality = args.quality;
    else add('error', 'quality', 'quality', `quality must be one of ${QUALITIES.join(', ')}.`);
  }

  // ratio and size
  const ratio = args.aspectRatio;
  if (ratio === undefined) add('warn', 'aspect-ratio-missing', 'aspectRatio', 'No aspectRatio: the server makes a square. Set the ratio of the placement.');
  else if (!RATIOS.includes(ratio)) add('error', 'aspect-ratio', 'aspectRatio', `aspectRatio must be one of ${RATIOS.join(', ')}.`);
  else if (EXTREME_RATIOS.includes(ratio) && provider === 'openai') add('error', 'aspect-ratio', 'aspectRatio', `OpenAI has no ${ratio}: it stops at 3:1. Use another ratio or another provider.`);
  else if (EXTREME_RATIOS.includes(ratio) && provider === 'gemini' && quality === 'quality') add('error', 'aspect-ratio', 'aspectRatio', `gemini-3-pro-image (quality "quality") has no ${ratio}. Use fast or balanced, or another ratio.`);

  let size = '1K';
  if (args.imageSize === undefined) add('warn', 'image-size-missing', 'imageSize', 'No imageSize: the estimate assumes 1K, and the placement may need 2K.');
  else if (!SIZES.includes(args.imageSize)) add('error', 'image-size', 'imageSize', `imageSize must be one of ${SIZES.join(', ')}.`);
  else if (args.imageSize === '4K' && provider === 'seedream') add('error', 'image-size', 'imageSize', 'Seedream has no 4K. Use 1K or 2K.');
  else size = args.imageSize;

  if (args.useGoogleSearch === true && provider !== 'gemini') add('error', 'google-search', 'useGoogleSearch', `Google Search grounding is Gemini only; ${provider} refuses it.`);

  // file name
  const name = args.fileName;
  if (name === undefined) add('warn', 'file-name-missing', 'fileName', 'No fileName: the server invents image-<time>-<hex>, which no record names. Give a new descriptive name.');
  else if (typeof name !== 'string' || name.length === 0 || /[\\/\0]|\.\./.test(name)) add('error', 'file-name', 'fileName', 'fileName must be a plain name with no folder, no "..", no null byte. The server saves into its own folder only.');
  else if (options.outputDir) {
    const base = name.replace(/\.(png|jpe?g|webp)$/i, '');
    const taken = [name, `${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`].find(candidate => existsSync(path.join(options.outputDir, candidate)));
    if (taken) add('error', 'overwrite', 'fileName', `${taken} already exists in ${options.outputDir}; the server overwrites a file of the same name, and its record with it. Use a new name.`);
  }

  // input images
  let referenceCount = 0;
  const inputs = args.inputImagePaths;
  if (inputs !== undefined) {
    const limit = MAX_INPUT_IMAGES[provider];
    if (!Array.isArray(inputs) || inputs.length === 0) add('error', 'input-count', 'inputImagePaths', `inputImagePaths must be an array of 1 to ${limit} paths. Leave it out for a text-only call.`);
    else {
      referenceCount = inputs.length;
      if (inputs.length > limit) add('error', 'input-count', 'inputImagePaths', `${provider} accepts at most ${limit} input images; this call has ${inputs.length}.`);
      let rootReal = null;
      if (!options.projectRoot) add('error', 'input-project-unknown', 'inputImagePaths', 'This check was not told where the project is (--project), so it cannot tell an image inside it from one outside. The server does not check either.');
      else rootReal = realOrResolved(options.projectRoot);
      for (const [index, entry] of inputs.entries()) {
        const where = `inputImagePaths[${index}]`;
        if (typeof entry !== 'string' || entry.trim().length === 0) {
          add('error', 'input-relative', where, 'Each path must be a non-empty string.');
          continue;
        }
        if (entry.includes('\0') || entry.includes('..')) {
          add('error', 'input-traversal', where, `${entry} contains ".." or a null byte; the server refuses it. Write the real absolute path.`);
          continue;
        }
        if (!path.isAbsolute(entry)) {
          add('error', 'input-relative', where, `${entry} is not an absolute path; the server refuses it. Build it from the project root.`);
          continue;
        }
        let stat = null;
        try {
          stat = statSync(entry);
        } catch {
          stat = null;
        }
        if (!stat || !stat.isFile()) {
          add('error', 'input-missing', where, `${entry} is not an existing regular file.`);
          continue;
        }
        const real = realOrResolved(entry);
        const extension = path.extname(real).toLowerCase();
        if (!INPUT_EXTENSIONS.includes(extension) || (provider === 'seedream' && extension === '.webp')) {
          add('error', 'input-extension', where, `${path.basename(real)}: ${provider === 'seedream' ? 'Seedream takes PNG and JPEG only' : 'the server reads PNG, JPEG and WebP only'}.`);
        }
        if (stat.size > MAX_INPUT_BYTES) add('error', 'input-size', where, `${path.basename(real)} is ${(stat.size / 1048576).toFixed(1)} MiB; the limit is 10 MiB.`);
        if (rootReal && !isInside(rootReal, real)) {
          if (isTyped(options.allow, entry, real)) add('warn', 'input-outside-project-typed', where, `${entry} is outside the project (${rootReal}); the user typed this exact path, so it may go, and it goes to ${provider}: the card says so.`);
          else add('error', 'input-outside-project', where, `${entry} is outside the project (${rootReal}). The server would read and send it all the same: pass it only if the user typed its full path in this task (--allow); otherwise ask for the full path, or for a copy in assets/source/.`);
        }
        try {
          if (lstatSync(entry).isSymbolicLink()) add('warn', 'input-symlink', where, `${entry} is a link to ${real}; the real file is what is judged and sent.`);
        } catch {
          // the file was just stat-ed; a race here changes nothing
        }
        if (SENSITIVE_NAME.test(path.basename(real))) {
          add('warn', 'input-sensitive-name', where, `${path.basename(real)} looks like an identity, a document, a screen or a personal picture. Send it only if the user named this file and said it may go to ${provider}.`);
        }
      }
    }
  }

  // estimate
  const images = Number.isInteger(options.images) && options.images >= 1 ? options.images : 1;
  const priced = priceFor(provider, quality, size, referenceCount);
  const estimate = {
    provider,
    model: priced.model,
    perImageUsd: priced.perImageUsd,
    images,
    totalUsd: priced.perImageUsd === null ? null : round(priced.perImageUsd * images),
    worstCaseUsd: priced.perImageUsd === null ? null : round(priced.perImageUsd * images * CALLS_PER_ASSET),
    basis: priced.basis,
    note: priced.note,
  };
  return { findings, estimate };
}

function usage() {
  console.error('usage: node call-check.mjs <call.json> [--project <dir>] [--output-dir <dir>] [--images <n>] [--allow <path>]... [--default-provider <name>] [--json]');
  return 2;
}

export function main(argv) {
  const positional = [];
  const options = {};
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (['--project', '--output-dir', '--images', '--allow', '--default-provider'].includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return usage();
      i += 1;
      if (arg === '--project') options.projectRoot = path.resolve(value);
      else if (arg === '--output-dir') options.outputDir = path.resolve(value);
      else if (arg === '--images') options.images = Number(value);
      else if (arg === '--allow') (options.allow ??= []).push(path.resolve(value));
      else options.defaultProvider = value;
    } else if (arg.startsWith('--')) return usage();
    else positional.push(arg);
  }
  if (positional.length !== 1) return usage();
  let call;
  try {
    call = JSON.parse(readFileSync(positional[0], 'utf8'));
  } catch (error) {
    console.error(`cannot read ${positional[0]} as JSON: ${error.message}`);
    return 2;
  }
  const args = call && typeof call === 'object' && call.arguments && typeof call.arguments === 'object' ? call.arguments : call;
  const { findings, estimate } = checkCall(args, options);
  if (json) {
    console.log(JSON.stringify({ findings, estimate }, null, 2));
  } else {
    for (const f of findings) console.log(`${f.severity.padEnd(5)}  ${f.code}  ${f.field}  ${f.message}`);
    const money = value => (value === null ? 'no published price' : `$${value}`);
    console.log(`estimate: ${estimate.provider} ${estimate.model}, ${estimate.images} image${estimate.images === 1 ? '' : 's'}: ${money(estimate.perImageUsd)} each, ${money(estimate.totalUsd)} in all, ${money(estimate.worstCaseUsd)} at most (${CALLS_PER_ASSET} calls per asset). ${estimate.note}`);
  }
  return findings.some(f => f.severity === 'error') ? 1 : 0;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
