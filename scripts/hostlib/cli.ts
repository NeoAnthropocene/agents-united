/**
 * Plan 032 — host docs library CLI (maintainer tooling; run with Node >= 22.18 type stripping).
 *
 *   npm run hostlib:check   -- [--host claude,cline] [--json] [--out report.json]
 *   npm run hostlib:refresh -- --host <h> (--types hook,skill | --all) [--advance-changelog]
 *   npm run hostlib:ingest  -- --host <h> --file <local.md> --as <snapshot path> --via <channel> [--advance-changelog]
 *   npm run hostlib:verify
 *   npm run hostlib:audit   -- <dir> [--mode skill|docs] [--baseline <dir>] [--json]
 *
 * Exit codes: 0 ok · 1 failure (audit fail, lock drift, bad input) · 3 audit needs-review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { auditDirectory, formatReport } from './audit.ts';
import type { AuditMode } from './audit.ts';
import { checkHost, httpFetcher, ingestSnapshot, listHosts, refreshHost, verifyLock } from './library.ts';
import type { HostCheckReport } from './library.ts';
import { ARTIFACT_TYPES } from './types.ts';
import type { ArtifactType } from './types.ts';

const ROOT = path.resolve(process.env.HOSTLIB_ROOT ?? 'host-library');

function hostsFrom(value: string | undefined): string[] {
  const all = listHosts(ROOT);
  if (!value) return all;
  const wanted = value.split(',').map(host => host.trim()).filter(Boolean);
  const unknown = wanted.filter(host => !all.includes(host));
  if (unknown.length > 0) throw new Error(`Unknown host(s): ${unknown.join(', ')} (known: ${all.join(', ')})`);
  return wanted;
}

function typesFrom(value: string | undefined): ArtifactType[] {
  if (!value) return [];
  const types = value.split(',').map(type => type.trim()).filter(Boolean);
  const invalid = types.filter(type => !(ARTIFACT_TYPES as readonly string[]).includes(type));
  if (invalid.length > 0) throw new Error(`Unknown artifact type(s): ${invalid.join(', ')}`);
  return types as ArtifactType[];
}

function summarise(report: HostCheckReport): string {
  const lines = [`## ${report.label} (${report.host})${report.reachable ? '' : ' — UNREACHABLE (partial)'}`];
  for (const error of report.errors) lines.push(`- error: ${error}`);
  if (report.changelog.newEntries.length === 0 && report.changelog.lostBaselines.length === 0) {
    lines.push('- changelog: no new entries');
  } else {
    lines.push(`- changelog: ${report.changelog.newEntries.length} new entr${report.changelog.newEntries.length === 1 ? 'y' : 'ies'}`);
    for (const entry of report.changelog.newEntries) {
      const where = entry.section ? `${entry.section} ` : '';
      lines.push(`  - ${where}${entry.version}${entry.title ? ` — ${entry.title}` : ''} [${entry.types.join(', ') || 'unclassified'}]`);
    }
    for (const section of report.changelog.lostBaselines) lines.push(`  - baseline lost for section "${section || '(root)'}" — capped scan`);
  }
  for (const index of report.indexes) {
    if (index.added.length === 0 && index.removed.length === 0) continue;
    lines.push(`- index ${index.url}: +${index.added.length} / -${index.removed.length} pages`);
    for (const link of index.added) lines.push(`  + ${link.title} <${link.url}>`);
    for (const link of index.removed) lines.push(`  - ${link.title} <${link.url}>`);
  }
  if (report.affectedPages.length > 0) lines.push(`- refresh: --types ${report.affectedTypes.join(',')}`);
  return lines.join('\n');
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      host: { type: 'string' },
      types: { type: 'string' },
      all: { type: 'boolean', default: false },
      'advance-changelog': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      out: { type: 'string' },
      file: { type: 'string' },
      as: { type: 'string' },
      via: { type: 'string' },
      mode: { type: 'string', default: 'skill' },
      baseline: { type: 'string' },
    },
  });

  switch (command) {
    case 'check': {
      const reports: HostCheckReport[] = [];
      for (const host of hostsFrom(values.host)) reports.push(await checkHost(path.join(ROOT, host), httpFetcher));
      const payload = { checkedAt: new Date().toISOString(), hasChanges: reports.some(r => r.hasChanges), hosts: reports };
      if (values.out) fs.writeFileSync(values.out, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(values.json ? JSON.stringify(payload, null, 2) : [`# Host docs check — ${payload.checkedAt}`, ...reports.map(summarise), payload.hasChanges ? '\nChanges detected.' : '\nNo changes.'].join('\n\n'));
      return 0;
    }
    case 'refresh': {
      const hosts = hostsFrom(values.host);
      const types = typesFrom(values.types);
      if (!values.all && types.length === 0 && !values['advance-changelog']) {
        console.error('refresh: pass --types <list>, --all, or --advance-changelog');
        return 1;
      }
      let blocked = 0;
      for (const host of hosts) {
        const report = await refreshHost(path.join(ROOT, host), httpFetcher, { types, all: values.all, advanceChangelog: values['advance-changelog'] });
        console.log(`## ${host}`);
        for (const outcome of report.outcomes) {
          console.log(`- ${outcome.status.padEnd(9)} ${outcome.file}${outcome.detail ? ` (${outcome.detail})` : ''}`);
          for (const finding of outcome.findings ?? []) console.log(`    [${finding.severity}] ${finding.rule} line ${finding.line}: ${finding.excerpt}`);
          if (outcome.status === 'blocked') blocked += 1;
        }
        console.log(`- lastSeen: ${JSON.stringify(report.lastSeen)}`);
      }
      return blocked > 0 ? 1 : 0;
    }
    case 'ingest': {
      const [host] = hostsFrom(values.host);
      if (!host || !values.file || !values.as || !values.via) {
        console.error('ingest: --host, --file, --as and --via are required');
        return 1;
      }
      const outcome = ingestSnapshot(path.join(ROOT, host), values.as, fs.readFileSync(values.file, 'utf8'), values.via, {
        advanceChangelog: values['advance-changelog'],
      });
      console.log(`${outcome.status} ${host}/${outcome.file}`);
      for (const finding of outcome.findings ?? []) console.log(`  [${finding.severity}] ${finding.rule} line ${finding.line}: ${finding.excerpt}`);
      return outcome.status === 'blocked' ? 1 : 0;
    }
    case 'verify': {
      const problems = hostsFrom(values.host).flatMap(host => verifyLock(path.join(ROOT, host)));
      problems.forEach(problem => console.error(`✖ ${problem}`));
      if (problems.length === 0) console.log('✔ host library snapshots match their lockfiles');
      return problems.length === 0 ? 0 : 1;
    }
    case 'audit': {
      const target = positionals[0];
      if (!target || !fs.existsSync(target)) {
        console.error('audit: pass the quarantined directory to scan');
        return 1;
      }
      const report = auditDirectory(target, { mode: values.mode as AuditMode, baselineDir: values.baseline });
      console.log(values.json ? JSON.stringify(report, null, 2) : formatReport(report));
      return report.verdict === 'pass' ? 0 : report.verdict === 'fail' ? 1 : 3;
    }
    default:
      console.error('usage: hostlib <check|refresh|ingest|verify|audit> [options]');
      return 1;
  }
}

main().then(
  code => process.exit(code),
  error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
