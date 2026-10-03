import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every TypeScript source file must be valid UTF-8. An edit script that reads and writes with the Windows default code page (cp1252) turns
 * a typed em dash into the single byte 0x97, which git keeps and an editor shows as a replacement character; `src/core/doctor.ts` carried one
 * from the skill-copies change until this guard caught it.
 */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.name.endsWith('.ts') ? [full] : [];
  });

describe('source encoding', () => {
  it('every src/**/*.ts file is valid UTF-8', () => {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const invalid = walk(path.resolve('src')).filter(file => {
      try {
        decoder.decode(fs.readFileSync(file));
        return false;
      } catch {
        return true;
      }
    });
    expect(invalid.map(file => path.relative(process.cwd(), file))).toEqual([]);
  });
});
