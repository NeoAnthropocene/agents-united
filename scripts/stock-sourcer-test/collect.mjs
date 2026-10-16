#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const DEFAULT_ROOT = path.join(os.tmpdir(), 'agents-united-stock-sourcer-test');
const HOSTS = ['claude', 'cline', 'antigravity', 'codex'];

function evaluateHostWorkspace(rootDir, host) {
  const ws = path.join(rootDir, host);
  const stockDir = path.join(ws, 'assets', 'stock');
  const candidatesDir = path.join(ws, 'assets', 'stock-candidates');
  const attributionFile = path.join(ws, 'attribution.md');

  if (!fs.existsSync(ws) || !fs.existsSync(stockDir)) {
    return { host, status: 'UNVERIFIED', details: 'Workspace not initialized' };
  }

  const files = fs.readdirSync(stockDir);
  const mediaFiles = files.filter(f => /\.(jpg|jpeg|png|svg|mp4)$/i.test(f));
  const provenanceFiles = files.filter(f => f.endsWith('.provenance.json'));

  if (mediaFiles.length === 0) {
    return { host, status: 'PENDING', details: 'No promoted media files in assets/stock/ yet' };
  }

  const issues = [];
  if (fs.existsSync(candidatesDir) && fs.readdirSync(candidatesDir).length > 0) {
    issues.push('assets/stock-candidates/ was not cleaned up');
  }

  if (provenanceFiles.length === 0) {
    issues.push('Missing .provenance.json sidecar in assets/stock/');
  } else {
    for (const pf of provenanceFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(stockDir, pf), 'utf8'));
        for (const reqField of ['provider', 'creator', 'license', 'sourceUrl']) {
          if (!data[reqField]) issues.push(`${pf} missing ${reqField}`);
        }
        if (data.inspectedByVision !== true) {
          issues.push(`${pf} inspectedByVision is not true`);
        }
      } catch (err) {
        issues.push(`${pf} invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (!fs.existsSync(attributionFile) || fs.readFileSync(attributionFile, 'utf8').trim().length === 0) {
    issues.push('Missing or empty attribution.md');
  }

  if (issues.length > 0) {
    return { host, status: 'FAIL', details: issues.join('; ') };
  }

  return {
    host,
    status: 'PASS',
    details: `Promoted: ${mediaFiles.join(', ')}; provenance & attribution verified; candidates cleaned up`,
  };
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', default: DEFAULT_ROOT },
      json: { type: 'boolean', default: false },
    },
    strict: false,
  });

  const rootDir = path.resolve(String(values.root ?? DEFAULT_ROOT));
  const results = HOSTS.map(host => evaluateHostWorkspace(rootDir, host));

  if (values.json) {
    process.stdout.write(`${JSON.stringify({ rootDir, results }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`# Multi-Host Stock Sourcer Verification Report (${rootDir})\n\n`);
  process.stdout.write(`| Host | Status | Evidence / Notes |\n|---|---|---|\n`);
  for (const r of results) {
    process.stdout.write(`| ${r.host} | ${r.status} | ${r.details} |\n`);
  }
}

main();
