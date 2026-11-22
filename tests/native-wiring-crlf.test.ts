import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * ADR 0075: the wiring generator and the conformance runner must load on a Windows checkout, where `core.autocrlf=true` writes them with CRLF
 * line ends. A test file imports both through the test runner's transform, which failed on a CRLF copy with a leading `#!` line
 * ("SyntaxError: Invalid or unexpected token"). The scripts are run as `node scripts/<name>.mjs`, so they carry no `#!` line.
 */

const ROOT = path.resolve('.');
const SCRIPTS = ['native-wiring.mjs', 'run-native-conformance.mjs'];
let folder = '';
afterEach(async () => { if (folder) await fs.remove(folder); folder = ''; });

describe('the native wiring scripts on a CRLF checkout', () => {
  it('load through the test runner when written with CRLF line ends', async () => {
    // Inside the checkout so the copies resolve the same packages (`yaml`) as the originals, and outside node_modules so the test runner
    // transforms them as it does the originals (a file under node_modules is loaded by Node directly, which accepts the CRLF `#!` line).
    folder = await fs.mkdtemp(path.join(ROOT, 'tests', '.au-crlf-'));
    for (const name of SCRIPTS) {
      const text = (await fs.readFile(path.join(ROOT, 'scripts', name), 'utf8')).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
      await fs.writeFile(path.join(folder, name), text);
    }
    const wiring = await import(pathToFileURL(path.join(folder, 'native-wiring.mjs')).href);
    const runner = await import(pathToFileURL(path.join(folder, 'run-native-conformance.mjs')).href);
    expect(typeof wiring.planWiring).toBe('function');
    expect(typeof runner.conformanceFiles).toBe('function');
  });

  it('carry no #! line, since they are run with node by name', async () => {
    for (const name of SCRIPTS) expect((await fs.readFile(path.join(ROOT, 'scripts', name), 'utf8')).startsWith('#!'), name).toBe(false);
  });
});
