/**
 * confirm-gate.mjs
 *
 * Shared write-confirmation gate for brand-identity scripts. Cross-platform
 * (pure Node, no shell dependency) — safe on Windows, macOS, and Linux.
 *
 * Any script in this skill that writes to disk must call requireConfirmation()
 * before the first fs.writeFileSync/mkdirSync call, and must never be invoked
 * with --confirmed by an orchestrating agent unless a human requester actually
 * said yes to that specific write in this run.
 */
export function requireConfirmation(argv, whatWillBeWritten) {
  if (argv.includes('--confirmed')) return;

  console.error(
    [
      'REFUSING TO WRITE without --confirmed.',
      `This run would write: ${whatWillBeWritten}`,
      'Re-run with --confirmed only after the requester has explicitly said yes',
      'to this specific write. A general earlier go-ahead does not count — ask again.',
    ].join('\n'),
  );
  process.exit(1);
}

export function isDryRun(argv) {
  return argv.includes('--dry-run');
}
