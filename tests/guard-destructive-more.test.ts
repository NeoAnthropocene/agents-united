import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUARD_SCRIPT } from '../src/core/guard.js';
import { sessionGuardScript } from '../src/core/session-guard.js';

/**
 * ADR 0074, second round (the independent review): here-documents, wrappers, unquoted shell tails, verb paths, comments, PowerShell quoting,
 * Windows system folders, and every rule part and near miss the first suite did not have a row for. Same method as
 * tests/guard-destructive-commands.test.ts: the real script, one process per row, the hook payload on stdin.
 */

const HOOK_FILE = path.resolve('registry/hosts/claude/hooks/agents-united-guard.js');
interface Form { name: string; args: string[] }
const forms: Form[] = [
  { name: 'the generated hook file', args: [HOOK_FILE] },
  { name: 'the inline form (GUARD_SCRIPT)', args: ['-e', GUARD_SCRIPT] },
  { name: 'the session script (project)', args: ['-e', sessionGuardScript('project')] },
];
const run = (form: Form, tool: string, command: string, node: string[] = []): { status: number | null; stderr: string; ms: number } => {
  const started = Date.now();
  const result = spawnSync(process.execPath, [...node, ...form.args], { input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stderr: result.stderr, ms: Date.now() - started };
};

const commit = (body: string): string => `git commit -m "$(cat <<'EOF'\n${body}\nEOF\n)"`;
const pr = (body: string): string => `gh pr create --title "t" --body "$(cat <<'EOF'\n${body}\nEOF\n)"`;
const nest = (levels: number): string => {
  let command = 'sudo x';
  for (let i = 0; i < levels; i += 1) command = `bash -c ${JSON.stringify(command)}`;
  return command;
};
const BODIES = [
  'fix(shutdown): x',
  'Shutdown the pool before exit',
  'Reboot handler',
  'Halt on error',
  'Sudo is not used here',
  'If sudo is missing, say so',
  'The text `rm -rf /` in backticks and (sudo) in parentheses',
  'it\'s a "quoted" word; and another | pipe && sign',
  'Co-Authored-By: Someone <someone@example.com>',
  'line one\n\nsudo apt install x\nrm -rf /\nline four',
];

/** Rows that must block: [tool, command, fragment of the reason]. */
const BLOCK: Array<[string, string, string]> = [
  // here-documents fed to a real shell or evaluator are read; the same text fed to anything else is data (see ALLOW)
  ['Bash', "bash <<'EOF'\nsudo x\nEOF", 'privilege'],
  ['Bash', 'sh <<EOF\nrm -rf /\nEOF', 'recursive delete'],
  ['Bash', "pwsh <<'EOF'\nRestart-Computer\nEOF", 'shutdown'],
  ['Bash', 'cat <<EOF | bash\nsudo x\nEOF', 'privilege'],
  ['Bash', 'cat <<-EOF | sh\n\tsudo x\n\tEOF', 'privilege'],
  ['Bash', 'cd x && sh <<EOF\nreboot\nEOF', 'shutdown'],
  // the target through braces and quotes
  ['Bash', 'rm -rf "${HOME}"', 'recursive delete'],
  ['Bash', "rm -rf '${HOME}'", 'recursive delete'],
  ['Bash', 'rm -rf "${HOME}"/*', 'recursive delete'],
  ['Bash', 'rm -rf "$HOME"', 'recursive delete'],
  ['Bash', 'rm -rf "$HOME/"', 'recursive delete'],
  ['PowerShell', 'Remove-Item -Recurse -Force "$env:USERPROFILE"', 'recursive delete'],
  ['PowerShell', 'Remove-Item -Recurse -Force $env:USERPROFILE', 'recursive delete'],
  ['Bash', 'rm -rf %USERPROFILE%', 'recursive delete'],
  // wrappers, their own flags and flag values
  ['Bash', 'timeout 60 bash -c "sudo x"', 'privilege'],
  ['Bash', 'timeout -s KILL 5 sudo x', 'privilege'],
  ['Bash', 'nice -n 10 sudo x', 'privilege'],
  ['Bash', 'env -i bash -c "sudo x"', 'privilege'],
  ['Bash', 'xargs -I{} sh -c "sudo x"', 'privilege'],
  ['Bash', 'FOO="a b" sudo x', 'privilege'],
  ['Bash', 'env A=1 B="x y" nohup sudo x', 'privilege'],
  ['Bash', 'time sudo x', 'privilege'],
  // an unquoted shell tail, and az with global flags
  ['PowerShell', 'cmd /c rd /s /q .', 'recursive delete'],
  ['PowerShell', 'powershell -Command Remove-Item -Recurse -Force .', 'recursive delete'],
  ['PowerShell', 'pwsh -c Restart-Computer', 'shutdown'],
  ['PowerShell', 'pwsh -NoProfile -Command Stop-Computer', 'shutdown'],
  ['Bash', 'bash -c sudo x', 'privilege'],
  ['Bash', 'eval sudo x', 'privilege'],
  ['Bash', 'az --subscription s group delete -n x', 'cloud'],
  ['Bash', 'gcloud --project p projects delete q', 'cloud'],
  ['Bash', 'aws --profile p organizations delete-organization', 'cloud'],
  ['Bash', 'aws organizations delete-organization', 'cloud'],
  // verb reduction: an absolute path or a leading backslash is the same program
  ['Bash', '/usr/bin/sudo x', 'privilege'],
  ['Bash', '/sbin/shutdown -h now', 'shutdown'],
  ['PowerShell', 'C:\\Windows\\System32\\shutdown.exe /s', 'shutdown'],
  ['Bash', '\\rm -rf /', 'recursive delete'],
  ['Bash', 'C:/Windows/System32/runas.exe /user:a b', 'privilege'],
  // comments do not hide the next line
  ['Bash', "echo ok # it's fine\nsudo x", 'privilege'],
  ['Bash', '# done\nsudo x', 'privilege'],
  // PowerShell: a backslash is not an escape inside double quotes
  ['PowerShell', '"C:\\repo\\"; sudo x', 'privilege'],
  ['PowerShell', 'Write-Output "C:\\repo\\"; Restart-Computer', 'shutdown'],
  // Windows system folders, any drive
  ['PowerShell', 'Remove-Item -Recurse -Force C:\\Windows', 'recursive delete'],
  ['PowerShell', 'Remove-Item -Recurse -Force "C:\\Program Files"', 'recursive delete'],
  ['PowerShell', 'Remove-Item -Recurse -Force "C:\\Program Files (x86)"', 'recursive delete'],
  ['PowerShell', 'Remove-Item -Recurse -Force D:\\Users', 'recursive delete'],
  ['Bash', 'rm -rf C:/Windows', 'recursive delete'],
  ['PowerShell', 'rd /s /q E:\\ProgramData', 'recursive delete'],
  // every system folder family, glob and double dash
  ...['/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/lib64', '/opt', '/root', '/sbin', '/usr', '/var'].map((folder): [string, string, string] => ['Bash', `rm -rf ${folder}`, 'recursive delete']),
  ['Bash', 'rm -rf /*', 'recursive delete'],
  ['Bash', 'rm -rf /usr/', 'recursive delete'],
  ['Bash', 'rm -rf -- /', 'recursive delete'],
  ['Bash', 'rm -rf -- .', 'recursive delete'],
  // every rule part
  ['Bash', 'pkexec x', 'privilege'],
  ['Bash', 'wipefs -a /dev/sda', 'format'],
  ['Bash', 'shred -n 3 /dev/sda', 'format'],
  ['PowerShell', 'Clear-Disk -Number 1 -RemoveData', 'format'],
  ['PowerShell', 'Initialize-Disk -Number 1', 'format'],
  ['PowerShell', 'saps cmd -Verb RunAs', 'privilege'],
  ['PowerShell', 'start x -Verb RunAs', 'privilege'],
  ['PowerShell', 'Start-Process x -Verb:RunAs', 'privilege'],
  ['Bash', 'init 6', 'shutdown'],
  ['Bash', 'systemctl poweroff', 'shutdown'],
  ['Bash', 'systemctl halt', 'shutdown'],
  ['Bash', 'mkfs.vfat disk.img', 'format'],
  ['Bash', 'dd if=x of=/dev/nvme0n1', 'format'],
  // nesting: three shells deep is read
  ['Bash', nest(1), 'privilege'],
  ['Bash', nest(2), 'privilege'],
  ['Bash', nest(3), 'privilege'],
];

const ALLOW: Array<[string, string]> = [
  // the standard commit and pull-request form: the here-document body is data, whatever it says
  ...BODIES.flatMap((body): Array<[string, string]> => [['Bash', commit(body)], ['Bash', pr(body)], ['PowerShell', commit(body)]]),
  ['Bash', 'git commit -m "subject\n\nShutdown line\nsudo line\nrm -rf /"'],
  ['Bash', 'git commit -m "$(cat <<\'EOF\'\nfix: a (b) and (c) end\nEOF\n)" && git status'],
  ['Bash', "cat > install.sh <<'EOF'\nsudo apt install x\nEOF"],
  ['Bash', 'tee notes.md <<EOF\nrm -rf /\nEOF'],
  ['Bash', 'cat <<EOF | grep x\nsudo x\nEOF'],
  ['Bash', "node - <<'EOF'\nconsole.log('sudo x')\nEOF"],
  ['Bash', "python - <<'EOF'\nprint('shutdown')\nEOF"],
  ['Bash', 'cat <<EOF\nnever closed: sudo x'],
  // comments
  ['Bash', '# done; sudo later'],
  ['Bash', 'echo a #b; sudo x'],
  ['Bash', 'echo "#not a comment" && ls'],
  // verb reduction: a relative path with a separator is the project's own program
  ['Bash', './scripts/su'],
  ['Bash', 'bin/reboot'],
  ['Bash', './deploy/halt'],
  ['PowerShell', '.\\tools\\format.ps1'],
  ['Bash', 'scripts/shutdown now'],
  // wrappers around ordinary programs
  ['Bash', 'timeout 60 npm test'],
  ['Bash', 'nice -n 10 make'],
  ['Bash', 'env FOO=1 node x.js'],
  ['Bash', 'FOO="a b" node x.js'],
  ['Bash', 'xargs -I{} echo {}'],
  // unquoted tails of other programs
  ['Bash', 'ssh host bash -c "sudo x"'],
  ['Bash', 'az --subscription s group list'],
  ['Bash', 'az group create -n x -l y'],
  ['Bash', 'az group show -n x'],
  ['Bash', 'aws --profile p organizations list-accounts'],
  // dd to a harmless device, mkfs on a plain image still blocks (see BLOCK)
  ['Bash', 'dd if=/dev/zero of=/dev/null bs=1M count=1'],
  ['Bash', 'dd if=x of=/dev/stdout'],
  ['Bash', 'dd if=x of=/dev/stderr'],
  ['Bash', 'dd if=x of=/dev/tty'],
  ['Bash', 'dd if=x of=/dev/fd/3'],
  ['Bash', 'dd if=in.img of=out.img'],
  // ordinary recursive deletes and tools whose names look dangerous
  ['Bash', 'rm -rf ./node_modules/.cache'],
  ['Bash', 'rm -rf .next'],
  ['Bash', 'rm -rf .turbo dist'],
  ['Bash', 'rm -rf *.log'],
  ['Bash', 'rm -rf ./*.tmp'],
  ['Bash', 'rm -rf "$TMPDIR/x"'],
  ['Bash', 'find . -name "*.pyc" -delete'],
  ['Bash', 'git rm -r --cached .'],
  ['Bash', 'rm -rf .git/hooks/pre-commit'],
  ['Bash', 'rm -f .git/index.lock'],
  ['PowerShell', 'Remove-Item -Recurse -Force .\\node_modules'],
  ['Bash', 'docker run --rm -v "$PWD":/app img'],
  ['Bash', 'docker system prune -af'],
  ['Bash', 'prettier --write .'],
  ['Bash', 'cargo fmt'],
  ['Bash', 'dotnet format'],
  ['Bash', 'git format-patch -1'],
  ['PowerShell', 'Get-ChildItem | Format-Table'],
  ['Bash', 'systemctl restart nginx'],
  ['Bash', 'kubectl rollout restart deploy/x'],
  ['PowerShell', 'cd C:\\repo; rd /s /q build'],
  ['PowerShell', 'del /s /q *.obj'],
  ['PowerShell', 'Remove-Item -Recurse -Force "C:\\Program Files\\MyApp\\cache"'],
  ['PowerShell', 'Remove-Item -Recurse -Force C:\\Users\\me\\repo\\dist'],
  // PowerShell quoting is not Bash quoting: under Bash this is one unclosed string
  ['Bash', '"C:\\repo\\"; sudo x'],
  // a fourth nested shell is not read (known miss, kept on purpose; ADR 0074)
  ['Bash', nest(4)],
];

describe.each(forms)('$name', form => {
  it.each(BLOCK)('%s blocks %j', (tool, command, fragment) => {
    const result = run(form, tool, command);
    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('Blocked by agents-united guard: ');
    expect(result.stderr.toLowerCase()).toContain(fragment.toLowerCase());
  });

  it.each(ALLOW)('%s allows %j', (tool, command) => {
    const result = run(form, tool, command);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
  });
});

describe('the block reason for a cloud deletion says resource-group, project or account', () => {
  it('uses one wording', () => {
    expect(run(forms[0]!, 'Bash', 'az group delete -n x').stderr).toContain('a cloud resource-group, project or account deletion requires explicit human approval');
  });
});

describe('a script error while judging a command blocks it ("could not analyse")', () => {
  let dir: string;
  let preload: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'au-guard-seam-'));
    preload = path.join(dir, 'throw-on-marker.cjs');
    // Makes String.prototype.split throw for a command that carries the marker: the first thing the shell rules do with the command.
    await fs.writeFile(preload, "const split = String.prototype.split;\nString.prototype.split = function (...args) { if (String(this).includes('BOOM-ANALYSE')) throw new Error('boom'); return split.apply(this, args); };\n");
  });
  afterAll(async () => { await fs.remove(dir); });

  it.each(forms)('$name: blocks with the could-not-analyse reason, and an ordinary command still passes under the same preload', form => {
    const blocked = run(form, 'Bash', 'echo BOOM-ANALYSE', ['--require', preload]);
    expect(blocked.status, blocked.stderr).toBe(2);
    expect(blocked.stderr).toContain('Blocked by agents-united guard: a command the guard could not analyse requires explicit human approval');
    expect(run(form, 'Bash', 'echo fine', ['--require', preload]).status).toBe(0);
  });
});

describe('long inputs of the new shapes stay fast', () => {
  const LONG = 100_000;
  const shapes: Array<[string, string]> = [
    ['here-document operators with no newline', '<<'.repeat(LONG / 2)],
    ['many unterminated here-documents', '<<EOF\n'.repeat(LONG / 6)],
    ['many closed here-documents', 'cat <<EOF\nx\nEOF\n'.repeat(LONG / 16)],
    ['comment marks', '#'.repeat(LONG)],
    ['words that start comments', '# '.repeat(LONG / 2)],
    ['wrappers with flags', 'env -i '.repeat(LONG / 7)],
    ['timeout wrappers', 'timeout -s KILL 5 '.repeat(LONG / 18)],
    ['quoted assignments', 'A="b c" '.repeat(LONG / 8)],
    ['one very long quoted string', `"${'a '.repeat(LONG / 2)}"`],
    ['parentheses inside a command substitution', `"$(${'('.repeat(LONG)}"`],
  ];
  it.each(shapes)('%s: allowed, well under two seconds', (_name, command) => {
    expect(command.length).toBeGreaterThanOrEqual(LONG - 20);
    for (const form of forms.slice(0, 2)) {
      for (const tool of ['Bash', 'PowerShell']) {
        const result = run(form, tool, command);
        expect(result.status, result.stderr.slice(0, 300)).toBe(0);
        expect(result.ms).toBeLessThan(2000);
      }
    }
  });
});
