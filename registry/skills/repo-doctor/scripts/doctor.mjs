#!/usr/bin/env node
// repo-doctor fast checks (Plan 052 step 1, ADR 0080). Reads an agents-united checkout and prints one JSON line:
// { ok, root, checks, skipped, findings: [{ check, evidence, proposedFix }] }. Writes nothing except the --out report.
// Exit 0: no finding. Exit 1: findings. Exit 2: usage error or not an agents-united checkout.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHECKS = ['readme-counts', 'relative-links', 'plans-index', 'adr-numbers'];
const ROOT_DOCS = ['README.md', 'PROJECT.md', 'CONTEXT.md', 'ROADMAP.md', 'AGENTS.md', 'CLAUDE.md', 'TEST_INFRA.md', 'CHANGELOG.md', 'TEST_READY.md', 'CONTRIBUTING.md'];
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const CODE_SPAN = /(?<!`)(`+)(?!`)((?:(?!\n[ \t]*\n)[\s\S])*?)(?<!`)\1(?!`)/g;
const INLINE_LINK = /((?<!\\)!)?\[((?:(?!\n[ \t]*\n)(?:[^[\]]|\[[^[\]]*\]))*)\]\(\s*<?([^()\s<>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

function parseArgs(argv) {
  const args = { root: undefined, out: undefined, offline: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--offline') args.offline = true;
    else if ((flag === '--root' || flag === '--out') && argv[i + 1] !== undefined) args[flag.slice(2)] = argv[++i];
    else return { error: `Unknown or incomplete option ${flag}.` };
  }
  if (!args.root) return { error: 'Missing --root <absolute checkout path>.' };
  return args;
}

function stop(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(2);
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');

function markdownUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? markdownUnder(full) : entry.name.endsWith('.md') ? [full] : [];
  });
}

/** Inline links and images outside fences; brackets inside code spans are blanked so an example is not read as a link. */
function inlineLinks(markdown) {
  const kept = [];
  let fence;
  for (const line of markdown.split(/\r?\n/)) {
    const open = FENCE.exec(line);
    if (fence !== undefined) {
      const close = CLOSING_FENCE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
      kept.push('');
    } else if (open) {
      fence = open[1];
      kept.push('');
    } else kept.push(line);
  }
  const text = kept.join('\n').replace(CODE_SPAN, span => span.replace(/[[\]()]/g, ' '));
  return [...text.matchAll(INLINE_LINK)].map(match => ({ image: match[1] === '!', target: match[3] }));
}

function relativeTarget(target) {
  if (target.startsWith('#') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith('/') || target.startsWith('~')) return undefined;
  let file = target.split('#')[0];
  try { file = decodeURI(file); } catch { /* a malformed escape is checked as written */ }
  return file === '' ? undefined : file;
}

function resolvedLinks(file) {
  return inlineLinks(fs.readFileSync(file, 'utf8')).flatMap(link => {
    const target = relativeTarget(link.target);
    return target === undefined ? [] : [{ ...link, absolute: path.resolve(path.dirname(file), target) }];
  });
}

/** Inside the checkout and present with this exact case in every segment, as on a case-sensitive file system. */
function existsExactly(root, absolute) {
  const inside = path.relative(root, absolute);
  if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) return false;
  let dir = root;
  for (const segment of inside.split(path.sep).filter(Boolean)) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || !fs.readdirSync(dir).includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

function readmeCounts(root) {
  const findings = [];
  const readme = path.join(root, 'README.md');
  if (!fs.existsSync(readme)) return [{ check: 'readme-counts', evidence: 'README.md is missing.', proposedFix: 'Restore README.md from the base branch.' }];
  const text = fs.readFileSync(readme, 'utf8');
  const line = text.split(/\r?\n/).find(row => row.includes('**In numbers:**'));
  if (!line) return [{ check: 'readme-counts', evidence: 'README.md has no "**In numbers:**" line.', proposedFix: 'Restore the "**In numbers:**" line in README.md.' }];

  const skillsDir = path.join(root, 'registry', 'skills');
  const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(name => fs.existsSync(path.join(skillsDir, name, 'SKILL.md'))) : [];
  const workflows = skills.filter(name => name.startsWith('workflow-')).length;
  const agentsDir = path.join(root, 'registry', 'agents');
  const agents = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter(name => name.endsWith('.md')) : [];
  const orchestrators = agents.filter(name => name.startsWith('orchestrator-')).length;
  const bundles = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'registry', 'bundles.json'), 'utf8')).bundles ?? {});
  const endUser = bundles.filter(bundle => bundle.status !== 'under-construction').length;

  const expected = [
    [/(\d+) end-user bundles/, endUser, 'end-user bundles', 'registry/bundles.json (status other than under-construction)'],
    [/(\d+) canonical agents/, agents.length, 'canonical agents', 'registry/agents'],
    [/\((\d+) orchestrators/, orchestrators, 'orchestrators', 'registry/agents (orchestrator-*)'],
    [/(\d+) sub-agents/, agents.length - orchestrators, 'sub-agents', 'registry/agents'],
    [/(\d+) skills/, skills.length, 'skills', 'registry/skills'],
    [/(\d+) domain skills/, skills.length - workflows, 'domain skills', 'registry/skills'],
    [/(\d+) workflow playbooks/, workflows, 'workflow playbooks', 'registry/skills (workflow-*)'],
  ];
  for (const [pattern, actual, label, source] of expected) {
    const match = pattern.exec(line);
    if (!match) continue;
    const stated = Number(match[1]);
    if (stated !== actual) {
      findings.push({
        check: 'readme-counts',
        evidence: `README.md says ${stated} ${label}; ${source.split(' ')[0]} has ${actual}.`,
        proposedFix: `Set the "**In numbers:**" line of README.md (and every other README.md sentence that repeats it) to ${actual} ${label}, counted from ${source}.`,
      });
    }
  }
  return findings;
}

function linkFiles(root) {
  return [
    ...ROOT_DOCS.map(name => path.join(root, name)).filter(file => fs.existsSync(file)),
    ...markdownUnder(path.join(root, 'docs')),
    ...markdownUnder(path.join(root, 'plans')),
  ];
}

function relativeLinks(root) {
  const findings = [];
  for (const file of linkFiles(root)) {
    for (const link of resolvedLinks(file)) {
      const first = path.relative(root, link.absolute).split(path.sep)[0].toLowerCase();
      if (first === 'scratch') {
        findings.push({ check: 'relative-links', evidence: `${rel(root, file)} links ${link.target}, inside the ignored scratch/ folder.`,
          proposedFix: `Name the local path as plain text in ${rel(root, file)}, or move the evidence into the repository and link it there.` });
      } else if (!existsExactly(root, link.absolute)) {
        findings.push({ check: 'relative-links', evidence: `${rel(root, file)} links ${link.target}, which does not exist.`,
          proposedFix: `Point the link in ${rel(root, file)} at the file that exists (check the ../ depth and the exact case), or remove it.` });
      }
    }
  }
  return findings;
}

function plansIndex(root) {
  const plansDir = path.join(root, 'plans');
  const index = path.join(plansDir, 'README.md');
  if (!fs.existsSync(index)) return [];
  const isPlan = file => path.dirname(file) === plansDir && /^\d{3}-.*\.md$/.test(path.basename(file));
  const plansFrom = file => resolvedLinks(file).filter(link => !link.image && isPlan(link.absolute)).map(link => link.absolute);
  const direct = new Set(plansFrom(index));
  const reached = new Set(direct);
  for (const plan of direct) if (fs.existsSync(plan)) for (const target of plansFrom(plan)) reached.add(target);
  return fs.readdirSync(plansDir).map(name => path.join(plansDir, name)).filter(isPlan).filter(plan => !reached.has(plan)).map(plan => ({
    check: 'plans-index',
    evidence: `${rel(root, plan)} is not reached from plans/README.md.`,
    proposedFix: `Add a row or line linking ${path.basename(plan)} to plans/README.md, or link it from the plan it belongs to.`,
  }));
}

function adrNumbers(root) {
  const dir = path.join(root, 'docs', 'adr');
  if (!fs.existsSync(dir)) return [];
  const byNumber = new Map();
  for (const name of fs.readdirSync(dir).filter(file => /^\d{4}-.*\.md$/.test(file)).sort()) {
    const number = name.slice(0, 4);
    byNumber.set(number, [...(byNumber.get(number) ?? []), `docs/adr/${name}`]);
  }
  return [...byNumber].filter(([, files]) => files.length > 1).map(([number, files]) => ({
    check: 'adr-numbers',
    evidence: `ADR ${number} is used by ${files.join(' and ')}.`,
    proposedFix: `Renumber the later ADR to the next free number and update every link to it.`,
  }));
}

/** ADR numbers that open pull requests to dev add, against dev's own and each other's. Needs gh; skipped offline. */
function openPrAdrNumbers(root) {
  const listed = spawnSync('gh', ['pr', 'list', '--base', 'dev', '--state', 'open', '--json', 'number,files', '--limit', '100'], { cwd: root, encoding: 'utf8' });
  if (listed.error || listed.status !== 0) return { skipped: `open-pr-adr-numbers: gh pr list failed${listed.stderr ? ` (${listed.stderr.trim().split(/\r?\n/)[0]})` : ''}` };
  const ownFiles = new Set(fs.existsSync(path.join(root, 'docs', 'adr')) ? fs.readdirSync(path.join(root, 'docs', 'adr')) : []);
  const own = new Set([...ownFiles].map(name => name.slice(0, 4)));
  const claimed = new Map();
  for (const pr of JSON.parse(listed.stdout)) {
    for (const file of pr.files ?? []) {
      const match = /^docs\/adr\/(\d{4})-.*\.md$/.exec(file.path);
      if (match && !ownFiles.has(path.basename(file.path))) claimed.set(match[1], [...(claimed.get(match[1]) ?? []), `#${pr.number}`]);
    }
  }
  const findings = [];
  for (const [number, prs] of claimed) {
    if (own.has(number) || prs.length > 1) {
      findings.push({ check: 'open-pr-adr-numbers', evidence: `ADR ${number} is added by ${prs.join(' and ')}${own.has(number) ? ' and already used in this checkout' : ''}.`,
        proposedFix: `Give the newer ADR the next number free on dev and in every open pull request.` });
    }
  }
  return { findings };
}

function report(result) {
  const lines = ['# Repo doctor report', '', `Checkout: \`${result.root}\``, `Checks run: ${result.checks.join(', ')}`];
  if (result.skipped.length) lines.push(`Skipped: ${result.skipped.join('; ')}`);
  lines.push('', result.findings.length ? `## Findings (${result.findings.length})` : '## Findings', '');
  if (!result.findings.length) lines.push('None from the fast checks.');
  for (const finding of result.findings) lines.push(`- **${finding.check}**: ${finding.evidence}`, `  - Proposed fix: ${finding.proposedFix}`);
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (args.error) stop(args.error);
const root = path.resolve(args.root);
let name;
try { name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name; } catch { name = undefined; }
if (name !== 'agents-united' || !fs.existsSync(path.join(root, 'registry', 'bundles.json'))) stop(`${root} is not an agents-united checkout (package.json name and registry/bundles.json).`);

const result = { ok: true, root, checks: [...CHECKS], skipped: [], findings: [] };
result.findings.push(...readmeCounts(root), ...relativeLinks(root), ...plansIndex(root), ...adrNumbers(root));
if (args.offline) result.skipped.push('open-pr-adr-numbers: --offline');
else {
  const open = openPrAdrNumbers(root);
  if (open.skipped) result.skipped.push(open.skipped);
  else { result.checks.push('open-pr-adr-numbers'); result.findings.push(...open.findings); }
}
result.ok = result.findings.length === 0;
if (args.out) fs.writeFileSync(path.resolve(args.out), report(result));
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.ok ? 0 : 1);
