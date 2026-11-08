import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {describe,it} from 'vitest';
const run=promisify(execFile);
describe('3D browser runtime',()=>{it('checks local setup, copied CLI and dependency containment offline',async()=>{await run(process.execPath,['--test','tests/media-3d-browser.runtime.mjs'],{timeout:120_000});},150_000);});
