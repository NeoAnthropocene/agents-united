import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * P8a: the shipped copy of the frozen boilerplate corpus (`registry/quality/`, packaged through package.json "files")
 * carries the committed LF bytes of the fixture the ratchet freezes, on every platform (`.gitattributes` pins it
 * `text eol=lf`). The fixture itself is checked out with CRLF on Windows (core.autocrlf), so it is compared after
 * normalising its line endings. The corpus is regenerated only by an ADR.
 */
const FIXTURE = path.resolve('tests/fixtures/skill-boilerplate-corpus.txt');
const SHIPPED = path.resolve('registry/quality/skill-boilerplate-corpus.txt');
const SHA256_LF = '39840b497ae274b48be9220684c6d89ea8f886f06a687409e1c2ed887a51b705';

const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const toLf = (b: Buffer) => Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');

describe('shipped skill boilerplate corpus', () => {
  it('has exactly the frozen LF bytes', () => {
    const shipped = fs.readFileSync(SHIPPED);
    expect(shipped.includes(0x0d)).toBe(false);
    expect(sha(shipped)).toBe(SHA256_LF);
  });

  it('equals the frozen fixture once the checkout line endings are normalised', () => {
    expect(fs.readFileSync(SHIPPED).equals(toLf(fs.readFileSync(FIXTURE)))).toBe(true);
  });

  it('is pinned to LF and is part of the published package', () => {
    expect(fs.readFileSync(path.resolve('.gitattributes'), 'utf8')).toMatch(/^registry\/quality\/skill-boilerplate-corpus\.txt text eol=lf\r?$/m);
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { files: string[] };
    expect(pkg.files).toContain('registry');
  });
});
