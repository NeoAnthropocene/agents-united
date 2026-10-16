import {test, expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

test('GUI image harness: offline hook, containment and collector regressions', () => {
  const files=['guard','path-setup','collect','control','integrity'].map(name=>path.resolve(`scripts/image-client-test/${name}.checks.cjs`));
  const run=spawnSync(process.execPath,['--test',...files],{encoding:'utf8',windowsHide:true});
  expect(run.status,run.stdout+'\n'+run.stderr).toBe(0);
});
