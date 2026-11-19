/**
 * The environment of a child process whose temp folder is `folder`. Node's os.tmpdir() reads TMPDIR on POSIX and TEMP, then TMP, on Windows,
 * so these three variables move every file the factory scripts keep in the temp folder (the review-job pointers and the hand-back hook's
 * counts, ADR 0070) into the test's own folder. Only the folder's location comes from the environment; no script or command does
 * (ADR 0070, decision 4). Put `folder` under the fixture root that the test removes, and the cleanup comes with it.
 */
export function isolatedTempEnv(folder: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, TEMP: folder, TMP: folder, TMPDIR: folder };
}
