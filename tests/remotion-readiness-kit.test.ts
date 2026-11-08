import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

it('prepares exclusive isolated eval kits, filters known credential names and launches no host', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-kit-'));
  try {
    const source = path.join(root, 'source'), destination = path.join(root, 'kit');
    for (const file of ['media/timeline.json', 'media/project.json', 'media/remotion/package.json', 'media/remotion/package-lock.json', 'media/remotion/Composition.jsx', 'media/remotion/node_modules/remotion/package.json', 'audio/manifest.json', 'audio/mix-r4/master.wav']) {
      const p = path.join(source, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '{}');
    }
    fs.writeFileSync(path.join(source, 'media/remotion/.env'), 'secret');
    fs.writeFileSync(path.join(source, 'media/remotion/credentials.json'), 'secret');
    fs.writeFileSync(path.join(source, 'media/remotion/.yarnrc.yml'), 'secret');
    fs.writeFileSync(path.join(source, 'media/remotion/node_modules/remotion/token-map.js'), 'export default {};');
    const cli = path.join(root, 'cli.mjs');
    fs.writeFileSync(cli, "import fs from 'node:fs'; fs.writeFileSync('installed.txt', process.argv.slice(2).join(' '));");
    const script = path.resolve('scripts/prepare-remotion-readiness-evals.mjs');
    const args = [script, '--source', source, '--destination', destination, '--cli', cli];
    const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(run().status).toBe(0);
    expect(fs.existsSync(path.join(destination, 'eval5/media/remotion'))).toBe(false);
    expect(fs.readFileSync(path.join(destination, 'eval5/BRIEF.md'), 'utf8')).toContain('internal noncommercial suitability evaluation');
    expect(fs.readFileSync(path.join(destination, 'eval5/installed.txt'), 'utf8')).toContain('digital-agency');
    expect(fs.readFileSync(path.join(destination, 'eval6/installed.txt'), 'utf8')).not.toContain('remotion-agent-skills');
    expect(fs.existsSync(path.join(destination, 'eval6/media/remotion/node_modules/remotion/package.json'))).toBe(true);
    expect(fs.existsSync(path.join(destination, 'eval6/media/remotion/.env'))).toBe(false);
    expect(fs.existsSync(path.join(destination, 'eval6/media/remotion/credentials.json'))).toBe(false);
    expect(fs.existsSync(path.join(destination, 'eval6/media/remotion/.yarnrc.yml'))).toBe(false);
    expect(fs.existsSync(path.join(destination, 'eval6/media/remotion/node_modules/remotion/token-map.js'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(destination, 'eval6/source-sha256.json'), 'utf8'))['media/timeline.json']).toMatch(/^[a-f0-9]{64}$/);
    expect(run().status).not.toBe(0);
    expect(spawnSync(process.execPath, [script, '--source', source, '--destination', path.join(source, 'nested'), '--cli', cli]).status).not.toBe(0);
    const linked = path.join(root, 'linked-source');
    fs.cpSync(source, linked, { recursive: true });
    const realMedia = path.join(linked, 'media', 'remotion');
    const movedMedia = path.join(root, 'linked-media'); fs.renameSync(realMedia, movedMedia);
    fs.symlinkSync(movedMedia, realMedia, 'junction');
    const linkedDest = path.join(root, 'linked-kit');
    expect(spawnSync(process.execPath, [script, '--source', linked, '--destination', linkedDest, '--cli', cli]).status).not.toBe(0);
    expect(fs.existsSync(linkedDest)).toBe(false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
