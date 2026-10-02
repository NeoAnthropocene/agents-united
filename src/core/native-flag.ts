/**
 * Plan 032 Phases 7 and 8 — what the user typed for the native lane. The CLI library defines `--no-native` beside `--native`, and for
 * such a pair it reports `native: true` when neither is typed, which would switch the opt-in lane on for everyone. So the flag is read
 * from the arguments: `true` for `--native`, `false` for `--no-native` (the last one typed wins), `undefined` when neither was typed,
 * which means "inherit the recorded choice". Pure: arguments in, answer out.
 */
export function explicitNativeFlag(argv: readonly string[]): boolean | undefined {
  let flag: boolean | undefined;
  for (const arg of argv) {
    if (arg === '--') break;
    if (arg === '--native') flag = true;
    else if (arg === '--no-native') flag = false;
  }
  return flag;
}
