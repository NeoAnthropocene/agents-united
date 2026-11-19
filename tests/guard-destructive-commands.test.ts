import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';
import { GUARD_SCRIPT } from '../src/core/guard.js';
import { sessionGuardScript } from '../src/core/session-guard.js';

/**
 * ADR 0074: the destructive-command guard also blocks the common forms of destructive shell commands. Every row runs the REAL script as
 * a separate process with the hook payload on stdin, exactly as the Host does: the generated hook file (`node <file>`), the inline form
 * (`node -e`), and the session script, each for a Bash and a PowerShell call. Offline; no Host and no live session.
 */

const HOOK_FILE = path.resolve('registry/hosts/claude/hooks/agents-united-guard.js');

interface Form { name: string; args: string[] }
const forms: Form[] = [
  { name: 'the generated hook file', args: [HOOK_FILE] },
  { name: 'the inline form (GUARD_SCRIPT)', args: ['-e', GUARD_SCRIPT] },
  { name: 'the session script (project)', args: ['-e', sessionGuardScript('project')] },
  { name: 'the session script (user)', args: ['-e', sessionGuardScript('user')] },
];

const run = (form: Form, tool: string, command: string): { status: number | null; stderr: string; ms: number } => {
  const started = Date.now();
  const result = spawnSync(process.execPath, form.args, { input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stderr: result.stderr, ms: Date.now() - started };
};

/** [command, reason fragment the message must carry]. */
const BLOCK: Array<[string, string]> = [
  // recursive deletes of a root, home or project folder
  ['rm -rf /', 'recursive delete'],
  ['rm -rf .git', 'recursive delete'],
  ['rm -fr ~/', 'recursive delete'],
  ['rm -rf ./', 'recursive delete'],
  ['rm -rf ./*', 'recursive delete'],
  ['rm -r -f .git', 'recursive delete'],
  ['rm --recursive --force .', 'recursive delete'],
  ['rm -rf *', 'recursive delete'],
  ['rm -rf ..', 'recursive delete'],
  ['rm -rf $HOME', 'recursive delete'],
  ['rm -rf "$HOME"', 'recursive delete'],
  ['rm -rf ${HOME}/', 'recursive delete'],
  ['rm -rf /etc', 'recursive delete'],
  ['rm -rf "/"', 'recursive delete'],
  ['rm -rf C:\\', 'recursive delete'],
  ['rm -Rf .', 'recursive delete'],
  ['/bin/rm -rf /', 'recursive delete'],
  ['\\rm -rf /', 'recursive delete'],
  ['cd build && rm -rf /', 'recursive delete'],
  ['ls; rm -rf ~', 'recursive delete'],
  ['true || rm -rf .', 'recursive delete'],
  ['echo ok | xargs rm -rf /', 'recursive delete'],
  ['env FOO=1 rm -rf .git', 'recursive delete'],
  ['nohup rm -rf / &', 'recursive delete'],
  ['bash -c "rm -rf /"', 'recursive delete'],
  ["sh -c 'cd x; rm -rf .git'", 'recursive delete'],
  ['echo $(rm -rf ~)', 'recursive delete'],
  ['echo "$(rm -rf /)"', 'recursive delete'],
  ['rm \\\n  -rf /', 'recursive delete'],
  ['cat <<EOF\nrm -rf /\nEOF', 'recursive delete'],
  ['rm -rf dist\r\nrm -rf /', 'recursive delete'],
  ['rimraf .', 'recursive delete'],
  ['Remove-Item -Recurse -Force C:\\', 'recursive delete'],
  ['Remove-Item -Recurse -Force .\\*', 'recursive delete'],
  ['Remove-Item .git -Recurse', 'recursive delete'],
  ['ri -r -fo $HOME', 'recursive delete'],
  ['remove-item -path C:\\ -recurse', 'recursive delete'],
  ['rm -Recurse -Force $env:USERPROFILE', 'recursive delete'],
  ['pwsh -Command "Remove-Item -Recurse -Force C:\\ -ErrorAction Ignore"', 'recursive delete'],
  ['powershell -NoProfile -Command "cd x; Remove-Item -Recurse -Force ."', 'recursive delete'],
  ['rd /s /q C:\\', 'recursive delete'],
  ['RD /S /Q C:\\', 'recursive delete'],
  ['del /s /q *', 'recursive delete'],
  ['rmdir /s .git', 'recursive delete'],
  ['cmd /c "rd /s /q C:\\ >nul"', 'recursive delete'],
  // privilege escalation
  ['sudo apt install x', 'privilege escalation'],
  ['/usr/bin/sudo x', 'privilege escalation'],
  ['bash -c "sudo rm x"', 'privilege escalation'],
  ['cd x && sudo make install', 'privilege escalation'],
  ['env FOO=1 sudo x', 'privilege escalation'],
  ['timeout 5 sudo x', 'privilege escalation'],
  ['xargs sudo x', 'privilege escalation'],
  ['doas ls', 'privilege escalation'],
  ['runas /user:Administrator cmd', 'privilege escalation'],
  ['su -', 'privilege escalation'],
  ['Start-Process pwsh -Verb RunAs', 'privilege escalation'],
  ['echo "$(sudo id)"', 'privilege escalation'],
  // shutdown and reboot
  ['shutdown -h now', 'shutdown'],
  ['shutdown /s /t 0', 'shutdown'],
  ['reboot', 'shutdown'],
  ['poweroff', 'shutdown'],
  ['halt', 'shutdown'],
  ['init 0', 'shutdown'],
  ['systemctl reboot', 'shutdown'],
  ['Restart-Computer -Force', 'shutdown'],
  ['Stop-Computer', 'shutdown'],
  ['pwsh -c "Stop-Computer; echo x"', 'shutdown'],
  // cloud resource-group, project and account deletion
  ['az group delete -n rg1 --yes', 'cloud'],
  ['gcloud projects delete my-project', 'cloud'],
  ['aws organizations close-account --account-id 1', 'cloud'],
  // disk and filesystem destroyers
  ['mkfs.ext4 /dev/sda1', 'format'],
  ['mkfs /dev/sda1', 'format'],
  ['dd if=image.iso of=/dev/sda bs=4M', 'format'],
  ['format D: /q', 'format'],
  ['diskpart', 'format'],
  ['Format-Volume -DriveLetter D', 'format'],
  // the three rules that were there before still match anywhere in the string
  ['echo git push --force', 'git push --force'],
  ['git push -f origin main', 'git push --force'],
  ['vercel --prod', 'vercel --prod'],
  ['echo x > .env', '.env'],
];

const ALLOW: string[] = [
  // ordinary recursive deletes
  'rm -rf node_modules',
  'rm -rf dist',
  'rm -rf ./dist',
  'rm -rf "$DIR"',
  'rm -rf "$DB_NAME"',
  'rm -rf build CMakeCache.txt CMakeFiles 2>/dev/null',
  'rm -rf "$OUTPUT_DIR/repos"',
  'rm -rf ../sibling-build',
  'rm -rf dist && npm run build',
  'rm file.txt',
  'rm -f .env.example',
  'Remove-Item -Recurse dist',
  'Remove-Item .\\build -Recurse -Force',
  'Remove-Item file.txt',
  'rd /s /q dist',
  'del file.tmp',
  'rmdir empty',
  'rimraf dist',
  'xargs -I{} rm -rf {}',
  // the word only appears as text, as part of another word, or inside a path
  'echo rm -rf /',
  'echo "rm -rf /"',
  'git commit -m "sudo fix"',
  'git commit -m "use sudo for x"',
  'git commit -m "fix: sudo; rm -rf /"',
  'git commit -m "fix (sudo) and shutdown"',
  'npx sudo-prompt',
  'sudoku-solver',
  'echo needs sudo',
  'grep -r sudo docs',
  './scripts/shutdown-test.sh',
  'cat docs/sudo.md',
  'grep shutdown app.log',
  'npm run graceful-shutdown-test',
  'kill -s TERM 123',
  'ssh host',
  // near neighbours
  'az group list',
  'az group show -n x',
  'gcloud projects list',
  'aws organizations list-accounts',
  'dd if=/dev/zero of=./big.img bs=1M count=10',
  'df -h',
  'npx prettier --format',
  'Format-Table',
  // decided to stay out of the guard (the maintainer, 2026-11-19; ADR 0074)
  'terraform destroy',
  'kubectl delete namespace staging',
  'aws cloudformation delete-stack --stack-name x',
  'git reset --hard',
  'git clean -fdx',
  // SQL is out of scope (a shell regex cannot see it)
  'psql -c "DROP DATABASE x"',
  // ordinary commands, and the old rules' near misses
  'ls -la',
  'echo hello world',
  'git push --force-with-lease',
  'git status',
];

describe.each(forms)('$name', form => {
  describe.each(['Bash', 'PowerShell'])('%s', tool => {
    it.each(BLOCK)('blocks %j', (command, fragment) => {
      const result = run(form, tool, command);
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain('Blocked by agents-united guard: ');
      expect(result.stderr.toLowerCase()).toContain(fragment.toLowerCase());
    });

    it.each(ALLOW)('allows %j', command => {
      const result = run(form, tool, command);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe('');
    });
  });
});

describe('the block message', () => {
  it('keeps its marker sentence, names what was blocked, and tells the human to run it themselves', () => {
    for (const form of forms) {
      const { stderr } = run(form, 'Bash', 'sudo rm x');
      expect(stderr).toContain('Blocked by agents-united guard: sudo or another privilege escalation requires explicit human approval outside the agent session.');
      expect(stderr).toContain('If you mean it, run it yourself in your own terminal.');
    }
  });

  it('is the same sentence for the earlier rules', () => {
    const { stderr } = run(forms[0]!, 'Bash', 'git push --force');
    expect(stderr).toBe('Blocked by agents-united guard: git push --force requires explicit human approval outside the agent session. If you mean it, run it yourself in your own terminal.\n');
  });
});

describe('fail-closed behaviour is unchanged', () => {
  it.each(forms)('$name: unreadable input exits 2 with the unreadable-input message', form => {
    for (const input of ['', '   ', 'not json', '[]', 'null', '"x"']) {
      const result = spawnSync(process.execPath, form.args, { input, encoding: 'utf8' });
      expect(result.status, input).toBe(2);
      expect(result.stderr).toContain('Blocked by agents-united guard: unreadable hook input.');
    }
  });

  it.each(forms)('$name: a valid object without tool_input, and a call with no command, pass', form => {
    for (const input of ['{}', JSON.stringify({ tool_name: 'Bash', tool_input: {} }), JSON.stringify({ tool_name: 'Bash', tool_input: { command: null } })]) {
      expect(spawnSync(process.execPath, form.args, { input, encoding: 'utf8' }).status, input).toBe(0);
    }
  });
});

describe('a very long command is judged quickly (no catastrophic backtracking)', () => {
  const LONG = 100_000;
  const shapes: Array<[string, string]> = [
    ['plain words', 'a '.repeat(LONG / 2)],
    ['one 100,000-character word', 'x'.repeat(LONG)],
    ['separators', ';'.repeat(LONG)],
    ['slashes after separators', 'a/;'.repeat(LONG / 3)],
    ['quote pairs', '"/"'.repeat(LONG / 3)],
    ['quotes that never close', '"\\'.repeat(LONG / 2)],
    ['-c flags before an open quote', '-c "\\'.repeat(LONG / 5)],
    ['nested open quotes', '\'"'.repeat(LONG / 2)],
    ['wrappers', 'env '.repeat(LONG / 4)],
    ['flags', 'rm ' + '-r '.repeat(LONG / 3)],
    ['long dollar-paren run', '$('.repeat(LONG / 2)],
  ];

  it.each(shapes)('%s: answers well under two seconds and allows it', (_name, command) => {
    expect(command.length).toBeGreaterThanOrEqual(LONG - 10);
    for (const form of forms.slice(0, 2)) {
      const result = run(form, 'Bash', command);
      expect(result.status, result.stderr.slice(0, 300)).toBe(0);
      expect(result.ms).toBeLessThan(2000);
    }
  });

  it('still blocks a destructive command at the end of a 100,000-character command', () => {
    const result = run(forms[0]!, 'PowerShell', `${'a '.repeat(LONG / 2)}; sudo ls`);
    expect(result.status).toBe(2);
    expect(result.ms).toBeLessThan(2000);
  });

  it('the generated hook file is the script text, one line, with no comment', () => {
    const text = fs.readFileSync(HOOK_FILE, 'utf8').replace(/\r\n/g, '\n');
    expect(text.trimEnd()).toBe(GUARD_SCRIPT.trimEnd());
    expect(GUARD_SCRIPT).not.toContain('\n');
  });
});
