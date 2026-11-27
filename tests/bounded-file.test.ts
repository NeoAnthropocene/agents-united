/**
 * The bounded read the read-only checkers share (`rule-check`, `workflow-check`). Its refusal messages are pinned by the
 * rule-check tests; this file pins the read itself and the descriptor check added for Codex round 1 (ADR 0082): the file opened
 * must be the file that was inspected, compared by device and inode.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBoundedFile } from '../src/core/bounded-file.js';

describe('readBoundedFile', () => {
  const folders: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });
  const folder = (): string => {
    const made = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-bounded-file-')));
    folders.push(made);
    return made;
  };

  it('reads a regular file within the limit, and reports one over it as oversize', () => {
    const file = path.join(folder(), 'a.txt');
    fs.writeFileSync(file, 'hello');
    const ok = readBoundedFile(file, 5, 'thing');
    expect(ok.kind === 'ok' && ok.bytes.toString()).toBe('hello');
    expect(readBoundedFile(file, 4, 'thing').kind).toBe('oversize');
  });

  it('reports a missing file with its error code, and a directory as not a regular file', () => {
    const dir = folder();
    const missing = readBoundedFile(path.join(dir, 'none.txt'), 10, 'thing');
    expect(missing.kind).toBe('unavailable');
    expect(missing.kind === 'unavailable' && missing.code).toBe('ENOENT');
    const notFile = readBoundedFile(dir, 10, 'thing');
    expect(notFile.kind === 'unavailable' && notFile.message).toMatch(/not a regular file/);
  });

  it('refuses the file when another file has taken its place between the inspection and the open', () => {
    const dir = folder();
    const file = path.join(dir, 'a.txt');
    const other = path.join(dir, 'b.txt');
    fs.writeFileSync(file, 'first');
    fs.writeFileSync(other, 'second');
    // The seam: openSync is the one call between the lstat and the descriptor, so a different file is renamed into place first.
    const real = fs.openSync;
    vi.spyOn(fs, 'openSync').mockImplementationOnce((...args: Parameters<typeof fs.openSync>) => {
      fs.renameSync(other, file);
      return real(...args);
    });
    const result = readBoundedFile(file, 100, 'thing');
    expect(result.kind).toBe('unavailable');
    expect(result.kind === 'unavailable' && result.message).toMatch(/changed/);
  });
});
