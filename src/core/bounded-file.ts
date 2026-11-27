/**
 * The bounded read the read-only `*-check` commands share (`rule-check`, `workflow-check`): lstat first, so a link is refused
 * and a named pipe is never opened, then a read of the same file that never takes more than `maxBytes + 1` bytes. The file is
 * data: nothing in it is imported, required, spawned or evaluated. No terminal I/O; the callers print.
 */
import fs from 'node:fs';
import path from 'node:path';
import { errorCode } from './skill-check.js';

export type BoundedRead =
  /** `code` is the error code (`ENOENT`, ...) when the read failed with a system error, so a caller can tell "not there" from "unreadable". */
  | { kind: 'unavailable'; message: string; code?: string }
  | { kind: 'oversize' }
  | { kind: 'ok'; bytes: Buffer };

/** `label` names what the file is in the messages ("rule", "workflow"). */
export function readBoundedFile(file: string, maxBytes: number, label: string): BoundedRead {
  let fd: number | undefined;
  try {
    const last = file[file.length - 1];
    if (last === '/' || (path.sep === '\\' && last === '\\')) return { kind: 'unavailable', message: `The path ends with a path separator, so it does not name a file: ${file}` };
    const entry = fs.lstatSync(file, { bigint: true });
    if (entry.isSymbolicLink()) return { kind: 'unavailable', message: `The path is a link, not a regular file; pass the real path of the ${label}: ${file}` };
    if (!entry.isFile()) return { kind: 'unavailable', message: `The path is not a regular file: ${file}` };
    // O_NOFOLLOW and O_NONBLOCK do not exist on Windows (undefined there); where they do, they close the gap between the lstat and the open.
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile()) return { kind: 'unavailable', message: `The path is not a regular file: ${file}` };
    // The descriptor must be the file the lstat inspected. Without O_NOFOLLOW (Windows) a path swapped for a link or another file
    // between the two calls would otherwise be read, so device and inode are compared.
    if (opened.dev !== entry.dev || opened.ino !== entry.ino) {
      return { kind: 'unavailable', message: `The ${label} file changed between the check and the open (the opened file is not the file that was inspected): ${file}` };
    }
    if (opened.size > BigInt(maxBytes)) return { kind: 'oversize' };
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    for (;;) {
      const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
      if (length > maxBytes) return { kind: 'oversize' };
    }
    return { kind: 'ok', bytes: Buffer.from(buffer.subarray(0, length)) };
  } catch (error) {
    return { kind: 'unavailable', message: `The ${label} file cannot be read (${errorCode(error)}): ${file}`, code: errorCode(error) };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
