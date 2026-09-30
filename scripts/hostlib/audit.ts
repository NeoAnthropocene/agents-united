/**
 * Plan 032 / ADR 0025 decision 7 — the Security Audit Gate (deterministic half).
 *
 * Nothing enters `host-library/_upstream/` and no pinned commit moves until a candidate — fetched
 * into a quarantine directory — passes this scan AND the read-only LLM review described in
 * `.claude/skills/host-update-sync/SKILL.md`. The same injection/obfuscation rules guard refreshed
 * host docs snapshots (`mode: 'docs'`), because the authoring LLM reads them.
 *
 * Every fetched file is untrusted DATA. This module only pattern-matches it; it never executes,
 * imports or follows anything it scans.
 */
import fs from 'node:fs';
import path from 'node:path';

export type AuditMode = 'skill' | 'docs';
export type Severity = 'high' | 'medium' | 'low';
export type Verdict = 'pass' | 'needs-review' | 'fail';

export interface AuditFinding {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  excerpt: string;
  message: string;
}

export interface AuditReport {
  mode: AuditMode;
  target: string;
  verdict: Verdict;
  filesScanned: number;
  findings: AuditFinding[];
}

export interface AuditAllow {
  file: string;
  rule: string;
}

interface LineRule {
  rule: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  /** Applies to: prose (SKILL.md, docs, references) and/or executable scripts. */
  scope: 'all' | 'script' | 'prose';
  modes: AuditMode[];
}

const BOTH: AuditMode[] = ['skill', 'docs'];
const SKILL: AuditMode[] = ['skill'];

const LINE_RULES: LineRule[] = [
  // ── Prompt injection ────────────────────────────────────────────────────────────────────────
  {
    rule: 'injection/override-instructions',
    severity: 'high',
    pattern: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier|preceding|all|any|your|these|the system)\b[^.\n]{0,25}\b(instructions?|prompts?|rules?|directions?|guidelines?|polic(y|ies))\b|\b(override|bypass)\s+(all\s+)?(your|previous|prior|the above|these|any)\s+(safety\s+|system\s+)?(instructions?|guidelines?|rules?|restrictions?|polic(y|ies))\b/i,
    message: 'Text tells the reader/agent to ignore or override its instructions.',
    scope: 'all',
    modes: BOTH,
  },
  {
    rule: 'injection/role-impersonation',
    severity: 'high',
    pattern: /<\|?(im_start|im_end|system|endoftext)\|?>|\[\/?INST\]|^\s*(system|assistant)\s*:\s*(you|ignore|new)\b|<\/?(system|assistant)(\s[^>]*)?>/i,
    message: 'System/assistant role markers or chat-template tokens embedded in content.',
    scope: 'all',
    modes: BOTH,
  },
  {
    rule: 'injection/new-instructions',
    severity: 'high',
    pattern: /\b(new|updated|real|actual|hidden|secret)\s+(system\s+)?(instructions?|prompt)\s*:/i,
    message: 'Content announces replacement instructions.',
    scope: 'all',
    modes: BOTH,
  },
  {
    rule: 'injection/jailbreak-persona',
    severity: 'high',
    pattern: /\byou are now (in )?(developer mode|DAN|jailbroken|unrestricted|an unfiltered)\b|\bdo anything now\b/i,
    message: 'Jailbreak persona switch.',
    scope: 'all',
    modes: BOTH,
  },
  {
    rule: 'injection/exfiltration',
    severity: 'high',
    pattern: /\b(send|post|upload|exfiltrate|forward|transmit|paste)\b[^.\n]{0,60}\b(api[_ -]?keys?|access tokens?|tokens|credentials?|secrets?|passwords?|\.env\b|ssh keys?|private keys?|cookies)\b[^.\n]{0,60}\b(to|at)\b[^.\n]{0,40}(https?:\/\/|webhook|server|endpoint|email)/i,
    message: 'Instruction to send secrets somewhere.',
    scope: 'all',
    modes: BOTH,
  },
  {
    rule: 'injection/conceal-from-user',
    severity: 'medium',
    pattern: /\b(do not|don't|never)\s+(tell|inform|mention|reveal|show|disclose)\b[^.\n]{0,30}\b(the )?user\b|\bwithout (telling|informing|asking|notifying) the user\b|\bsilently (run|execute|install|send|upload|delete)\b/i,
    message: 'Instruction to hide actions from the user.',
    scope: 'all',
    modes: BOTH,
  },
  {
    rule: 'injection/hidden-comment',
    severity: 'medium',
    pattern: /<!--(?:(?!-->).)*\b(ignore|execute|run|curl|wget|send|upload|assistant|claude|gemini|cline|agent|model|llm|instructions?)\b(?:(?!-->).)*-->/i,
    message: 'HTML comment addressed to the agent (invisible when rendered).',
    scope: 'prose',
    modes: SKILL,
  },
  {
    rule: 'injection/link-title',
    severity: 'medium',
    pattern: /\]\([^)\s]+\s+"[^"]*\b(ignore|instructions?|assistant|system prompt|execute|run this)\b[^"]*"\)/i,
    message: 'Markdown link title carries agent-directed text.',
    scope: 'prose',
    modes: BOTH,
  },
  // ── Obfuscation ─────────────────────────────────────────────────────────────────────────────
  {
    rule: 'obfuscation/base64-blob',
    severity: 'medium',
    pattern: /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{200,}={0,2}(?![A-Za-z0-9+/=])/,
    message: 'Long base64-like blob (possible encoded payload).',
    scope: 'all',
    modes: SKILL,
  },
  {
    rule: 'obfuscation/hex-blob',
    severity: 'medium',
    pattern: /(?:\\x[0-9a-fA-F]{2}){40,}|(?<![0-9a-fA-F])[0-9a-fA-F]{200,}(?![0-9a-fA-F])/,
    message: 'Long hex-encoded blob (possible encoded payload).',
    scope: 'all',
    modes: SKILL,
  },
  {
    rule: 'obfuscation/decode-and-run',
    severity: 'high',
    pattern: /(base64\s+(-d|--decode)|b64decode|atob\(|Buffer\.from\([^)]*['"]base64['"]\))[^\n]{0,80}(\|\s*(ba|z)?sh\b|eval|exec|Function\()/i,
    message: 'Decodes content and executes it.',
    scope: 'all',
    modes: SKILL,
  },
  // ── Risky script behaviour ──────────────────────────────────────────────────────────────────
  {
    rule: 'script/pipe-to-shell',
    severity: 'high',
    pattern: /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n]*\|\s*(sudo\s+)?(ba|z|da)?sh\b|\biex\s*\(\s*(iwr|Invoke-WebRequest|\(New-Object Net\.WebClient\))/i,
    message: 'Downloads and executes remote code.',
    scope: 'script',
    modes: SKILL,
  },
  {
    rule: 'prose/pipe-to-shell',
    severity: 'medium',
    pattern: /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i,
    message: 'Instructions pipe a remote download into a shell; confirm the source is the official installer.',
    scope: 'prose',
    modes: SKILL,
  },
  {
    rule: 'script/network-egress',
    severity: 'medium',
    pattern: /\b(curl|wget|nc|ncat|netcat|Invoke-WebRequest|Invoke-RestMethod)\b\s|\bfetch\(\s*['"`]https?:|\brequests\.(get|post|put)\(|\burllib\.request\b|\bhttp\.client\b|\baxios\b|\bXMLHttpRequest\b|\bsocket\.socket\(/,
    message: 'Script performs network egress.',
    scope: 'script',
    modes: SKILL,
  },
  {
    rule: 'script/credential-access',
    severity: 'medium',
    pattern: /~\/\.ssh|\bid_(rsa|ed25519)\b|\.aws\/credentials|\.netrc\b|\.docker\/config\.json|\bkeychain\b|security\s+find-(generic|internet)-password|\.env\b|\b(process\.env|os\.environ)\b[^\n]{0,20}(TOKEN|KEY|SECRET|PASSWORD)|\$\{?[A-Z_]*(TOKEN|SECRET|PASSWORD|API_KEY)\}?/,
    message: 'Script reads credentials or secret-bearing files/variables.',
    scope: 'script',
    modes: SKILL,
  },
  {
    rule: 'script/dynamic-eval',
    severity: 'medium',
    pattern: /\beval\s*\(|\bnew Function\(|\bexec\s*\(|\bsubprocess\.[a-z_]+\([^)]*shell\s*=\s*True|\bos\.system\(/,
    message: 'Dynamic code evaluation / shell execution.',
    scope: 'script',
    modes: SKILL,
  },
  {
    rule: 'script/destructive',
    severity: 'high',
    pattern: /\brm\s+-[a-zA-Z]*(rf|fr)[a-zA-Z]*\s+(\/|~|\$HOME|\*|\.\.)|\bchmod\s+(-R\s+)?777\b|\bmkfs(\.\w+)?\b|\bdd\s+if=[^\n]*of=\/dev\/|:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:|\bformat\s+[a-z]:|\bdiskpart\b|\bRemove-Item\b[^\n]*-Recurse[^\n]*-Force[^\n]*(C:\\|\$env:USERPROFILE|~)/i,
    message: 'Destructive filesystem/system command.',
    scope: 'all',
    modes: SKILL,
  },
  {
    rule: 'script/persistence',
    severity: 'high',
    pattern: /\bcrontab\b|\/etc\/cron|\blaunchctl\s+(load|bootstrap)|\bsystemctl\s+(--user\s+)?enable\b|>>?\s*~\/\.(bashrc|zshrc|profile|bash_profile|zprofile)|\breg\s+add\b[^\n]*\\Run\b|\bschtasks\s+\/create\b|Startup\\/i,
    message: 'Installs persistence (cron, launch agents, shell rc, autoruns).',
    scope: 'script',
    modes: SKILL,
  },
];

/** Invisible / direction-changing code points used for prompt smuggling. ZWJ (U+200D) is excluded: emoji sequences use it. */
const INVISIBLE = /[\u200B\u200C\u2060\u180E\u2061-\u2064\u202A-\u202E\u2066-\u2069\uFEFF]|[\u{E0000}-\u{E007F}]/u;

const SCRIPT_EXTENSIONS = new Set([
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.bat', '.cmd',
  '.py', '.js', '.mjs', '.cjs', '.ts', '.rb', '.pl', '.php', '.lua', '.go', '.rs',
]);

const TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml', '.html', '.css', '.csv', '.xml', '.svg',
  ...SCRIPT_EXTENSIONS,
]);

function describeInvisible(text: string): string {
  return text.replace(/[\u200B-\u200F\u2060-\u2064\u202A-\u202E\u2066-\u2069\uFEFF\u180E]|[\u{E0000}-\u{E007F}]/gu, ch =>
    `<U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}>`,
  );
}

function excerptOf(line: string): string {
  const shown = describeInvisible(line.trim());
  return shown.length > 160 ? `${shown.slice(0, 157)}...` : shown;
}

export function isScriptPath(file: string): boolean {
  const posix = file.split(path.sep).join('/');
  return SCRIPT_EXTENSIONS.has(path.extname(file).toLowerCase()) || /(^|\/)scripts\//.test(posix);
}

/** Scan one text file. `file` is only used for reporting and script detection. */
export function scanText(text: string, file: string, mode: AuditMode): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const script = mode === 'skill' && isScriptPath(file);
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  lines.forEach((line, index) => {
    if (INVISIBLE.test(index === 0 ? line.replace(/^\uFEFF/, '') : line)) {
      findings.push({
        rule: 'obfuscation/invisible-unicode',
        severity: 'high',
        file,
        line: index + 1,
        excerpt: excerptOf(line),
        message: 'Invisible or bidirectional-control Unicode (prompt smuggling / Trojan Source).',
      });
    }
    for (const rule of LINE_RULES) {
      if (!rule.modes.includes(mode)) continue;
      if (rule.scope === 'script' && !script) continue;
      if (rule.scope === 'prose' && script) continue;
      if (rule.pattern.test(line)) {
        findings.push({ rule: rule.rule, severity: rule.severity, file, line: index + 1, excerpt: excerptOf(line), message: rule.message });
      }
    }
  });

  // Multi-line HTML comments addressed to the agent (single-line ones are caught above).
  if (mode === 'skill' && !script) {
    for (const match of text.matchAll(/<!--([\s\S]*?)-->/g)) {
      if (!match[1].includes('\n')) continue;
      if (/\b(ignore|execute|run|curl|wget|send|upload|assistant|claude|gemini|cline|agent|model|llm|instructions?)\b/i.test(match[1])) {
        const line = text.slice(0, match.index).split('\n').length;
        findings.push({
          rule: 'injection/hidden-comment',
          severity: 'medium',
          file,
          line,
          excerpt: excerptOf(match[0].split('\n')[0]),
          message: 'Multi-line HTML comment addressed to the agent (invisible when rendered).',
        });
      }
    }
  }

  // A script that both reads secrets and talks to the network is an exfiltration candidate.
  if (script) {
    const reads = findings.some(f => f.rule === 'script/credential-access');
    const egress = findings.some(f => f.rule === 'script/network-egress');
    if (reads && egress) {
      findings.push({
        rule: 'script/credential-exfiltration',
        severity: 'high',
        file,
        line: 1,
        excerpt: '(file-level)',
        message: 'Script reads credentials AND performs network egress.',
      });
    }
  }

  // package.json install hooks run code at install time.
  if (path.basename(file) === 'package.json') {
    try {
      const pkg = JSON.parse(text) as { scripts?: Record<string, string> };
      for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
        if (pkg.scripts?.[hook]) {
          findings.push({
            rule: 'script/install-hook',
            severity: 'high',
            file,
            line: 1,
            excerpt: `${hook}: ${pkg.scripts[hook]}`,
            message: 'package.json install-time hook executes code on install.',
          });
        }
      }
    } catch {
      // malformed JSON is reported by hygiene below only if binary; otherwise ignore
    }
  }

  return findings;
}

export function verdictFor(findings: AuditFinding[]): Verdict {
  if (findings.some(f => f.severity === 'high')) return 'fail';
  if (findings.some(f => f.severity === 'medium')) return 'needs-review';
  return 'pass';
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git') continue;
    const abs = path.join(dir, entry.name);
    // Always POSIX separators: findings, allow entries and snapshots must read the same on every OS.
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (entry.isSymbolicLink()) {
      out.push(rel);
      continue;
    }
    if (entry.isDirectory()) out.push(...walk(abs, base));
    else out.push(rel);
  }
  return out;
}

const EXECUTABLE_MAGIC: Array<{ name: string; bytes: number[] }> = [
  { name: 'ELF', bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: 'PE/MZ', bytes: [0x4d, 0x5a] },
  { name: 'Mach-O', bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: 'Mach-O', bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: 'Mach-O universal', bytes: [0xca, 0xfe, 0xba, 0xbe] },
];

function licenseText(dir: string): string | undefined {
  const name = fs.readdirSync(dir).find(file => /^(licen[cs]e|copying)(\.[a-z]+)?$/i.test(file));
  return name ? fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n').trim() : undefined;
}

export interface AuditDirectoryOptions {
  mode?: AuditMode;
  /** Previously pinned version, to detect license changes. */
  baselineDir?: string;
  allow?: AuditAllow[];
}

/** Scan a quarantined skill folder (or a docs snapshot tree). Never executes anything. */
export function auditDirectory(dir: string, options: AuditDirectoryOptions = {}): AuditReport {
  const mode = options.mode ?? 'skill';
  const findings: AuditFinding[] = [];
  const files = walk(dir);

  for (const rel of files) {
    const abs = path.join(dir, rel);
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) {
      findings.push({ rule: 'hygiene/symlink', severity: 'high', file: rel, line: 0, excerpt: fs.readlinkSync(abs), message: 'Symbolic link (can point outside the snapshot).' });
      continue;
    }
    const bytes = fs.readFileSync(abs);
    const head = [...bytes.subarray(0, 4)];
    const magic = EXECUTABLE_MAGIC.find(m => m.bytes.every((b, i) => head[i] === b));
    if (magic) {
      findings.push({ rule: 'hygiene/executable-binary', severity: 'high', file: rel, line: 0, excerpt: magic.name, message: 'Compiled executable in a skill folder.' });
      continue;
    }
    const isText = TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase()) || path.extname(rel) === '' || /^(licen[cs]e|copying)/i.test(path.basename(rel));
    if (bytes.subarray(0, 8192).includes(0)) {
      if (!/\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf)$/i.test(rel)) {
        findings.push({ rule: 'hygiene/unexpected-binary', severity: 'medium', file: rel, line: 0, excerpt: `${bytes.length} bytes`, message: 'Unexpected binary file.' });
      }
      continue;
    }
    if (!isText) {
      findings.push({ rule: 'hygiene/unknown-file-type', severity: 'low', file: rel, line: 0, excerpt: path.extname(rel), message: 'Unrecognised file type; review manually.' });
    }
    if (mode === 'skill' && (stat.mode & 0o111) !== 0 && !isScriptPath(rel)) {
      findings.push({ rule: 'hygiene/executable-bit', severity: 'medium', file: rel, line: 0, excerpt: (stat.mode & 0o777).toString(8), message: 'Non-script file carries an executable bit.' });
    }
    findings.push(...scanText(bytes.toString('utf8'), rel, mode));
  }

  if (mode === 'skill') {
    const license = licenseText(dir);
    if (!license) {
      findings.push({ rule: 'hygiene/license-missing', severity: 'low', file: '.', line: 0, excerpt: '', message: 'No LICENSE file in the skill folder; confirm the repository licence covers it.' });
    }
    if (options.baselineDir && fs.existsSync(options.baselineDir)) {
      const previous = licenseText(options.baselineDir);
      if (previous !== undefined && previous !== license) {
        findings.push({ rule: 'hygiene/license-changed', severity: 'medium', file: '.', line: 0, excerpt: '', message: 'Licence text changed since the pinned version.' });
      }
    }
  }

  const allowed = (finding: AuditFinding): boolean =>
    (options.allow ?? []).some(entry => entry.rule === finding.rule && entry.file === finding.file);
  const kept = findings.filter(finding => !allowed(finding));

  return { mode, target: dir, verdict: verdictFor(kept), filesScanned: files.length, findings: kept };
}

/** Scan a single fetched document (docs snapshots): injection + obfuscation rules only. */
export function auditDocument(text: string, file: string, allow: AuditAllow[] = []): AuditReport {
  const findings = scanText(text, file, 'docs').filter(
    finding => !allow.some(entry => entry.rule === finding.rule && entry.file === file),
  );
  // Docs snapshots are blocked only by high-severity hits; medium ones are reported, not blocking.
  const verdict: Verdict = findings.some(f => f.severity === 'high') ? 'fail' : 'pass';
  return { mode: 'docs', target: file, verdict, filesScanned: 1, findings };
}

export function formatReport(report: AuditReport): string {
  const lines = [`Security audit (${report.mode}) — ${report.target}`, `Verdict: ${report.verdict.toUpperCase()} · files scanned: ${report.filesScanned} · findings: ${report.findings.length}`];
  for (const f of report.findings) {
    lines.push(`- [${f.severity}] ${f.rule} — ${f.file}${f.line ? `:${f.line}` : ''} — ${f.message}${f.excerpt ? ` \`${f.excerpt.replace(/`/g, "'")}\`` : ''}`);
  }
  return lines.join('\n');
}
