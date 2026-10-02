import { describe, expect, it } from 'vitest';
import { explicitNativeFlag } from '../src/core/native-flag.js';

/**
 * The `--native` lane is opt-in (Plan 032 Phase 7, ADR 0026 decision 6). The CLI library defines `--no-native` beside `--native`,
 * and for such a pair it hands the action `native: true` when neither is typed, so the parsed option cannot tell "not given" from
 * "given". The flag is therefore read from the arguments themselves: only what the user typed counts, and an absent flag means
 * "inherit the recorded choice" (`undefined`).
 */
describe('explicitNativeFlag', () => {
  it('is undefined when neither flag was typed, so a recorded choice is inherited and the lane stays opt-in', () => {
    expect(explicitNativeFlag(['node', 'agents', 'add', 'software-engineering', '-t', 'cline', '-y'])).toBeUndefined();
    expect(explicitNativeFlag([])).toBeUndefined();
  });

  it('is true for --native and false for --no-native', () => {
    expect(explicitNativeFlag(['node', 'agents', 'add', 'x', '--native'])).toBe(true);
    expect(explicitNativeFlag(['node', 'agents', 'add', 'x', '--no-native'])).toBe(false);
  });

  it('lets the last one typed win', () => {
    expect(explicitNativeFlag(['--native', '--no-native'])).toBe(false);
    expect(explicitNativeFlag(['--no-native', '--native'])).toBe(true);
  });

  it('ignores look-alikes, values of other options, and anything after `--`', () => {
    expect(explicitNativeFlag(['--nativex', '--native-lane', '--no-native-x', '-n'])).toBeUndefined();
    expect(explicitNativeFlag(['add', 'x', '--', '--native'])).toBeUndefined();
  });
});
