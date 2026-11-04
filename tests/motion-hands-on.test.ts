import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('scripts/prepare-motion-hands-on.mjs');
describe('hands-on motion preparation', () => {
  it('copies only pilot media and audio, installs each lane, and refuses to replace it', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-kit-'));
    try {
      const source = path.join(tmp, 'pilot');
      for (const lane of ['native', 'remotion']) {
        fs.mkdirSync(path.join(source, lane, 'media'), { recursive: true });
        fs.writeFileSync(path.join(source, lane, 'media', 'timeline.json'), '{}');
        fs.writeFileSync(path.join(source, lane, 'media', '.env'), 'secret');
      }
      const runtime = path.join(source, 'remotion', 'media', 'remotion', 'node_modules');
      fs.mkdirSync(runtime, { recursive: true });
      fs.writeFileSync(path.join(runtime, 'fixture-private.key'), 'secret');
      fs.writeFileSync(path.join(runtime, '.npmrc'), 'secret');
      fs.writeFileSync(path.join(source, 'native', 'package.json'), '{}');
      fs.mkdirSync(path.join(source, 'native', 'node_modules', 'ffmpeg-static'), { recursive: true });
      fs.writeFileSync(path.join(source, 'native', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), 'fixture');
      const cli = path.join(tmp, 'fake-cli.mjs');
      fs.writeFileSync(cli, "import fs from 'node:fs'; fs.appendFileSync('calls.txt', process.argv.slice(2).join(' ')+'\\n');");
      const destination = path.join(tmp, 'kit');
      const args = [script, '--source', source, '--destination', destination, '--cli', cli];
      const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      for (const lane of ['native', 'remotion']) {
        expect(fs.existsSync(path.join(destination, lane, 'media', 'timeline.json'))).toBe(true);
        expect(fs.existsSync(path.join(destination, lane, 'media', '.env'))).toBe(false);
        expect(fs.readFileSync(path.join(destination, lane, 'calls.txt'), 'utf8')).toContain('digital-agency');
      }
      expect(fs.readFileSync(path.join(destination, 'remotion', 'calls.txt'), 'utf8')).not.toContain('remotion-agent-skills');
      expect(fs.readFileSync(path.join(destination, 'remotion', 'BRIEF.md'), 'utf8')).toContain('official Skills');
      expect(fs.existsSync(path.join(destination, 'remotion', 'media', 'remotion', 'node_modules', 'fixture-private.key'))).toBe(false);
      expect(fs.existsSync(path.join(destination, 'remotion', 'media', 'remotion', 'node_modules', '.npmrc'))).toBe(false);
      expect(fs.existsSync(path.join(destination, 'native', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'))).toBe(true);
      expect(fs.readFileSync(path.join(destination, 'native', 'calls.txt'), 'utf8')).not.toContain('remotion-agent-skills');
      expect(JSON.parse(fs.readFileSync(path.join(destination, 'native', 'historical-sha256.json'), 'utf8'))['media/timeline.json']).toMatch(/^[a-f0-9]{64}$/);
      expect(spawnSync(process.execPath, args).status).not.toBe(0);
      expect(spawnSync(process.execPath, [...args, '--unknown', 'x']).status).not.toBe(0);
      expect(spawnSync(process.execPath, [...args, '--source', source]).status).not.toBe(0);
      const overlap = path.join(source, 'native', 'media', 'kit');
      expect(spawnSync(process.execPath, [script, '--source', source, '--destination', overlap, '--cli', cli]).status).not.toBe(0);
      expect(fs.existsSync(overlap)).toBe(false);
      expect(fs.readFileSync(path.join(destination, 'native', 'media', 'timeline.json'), 'utf8')).toBe('{}');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
});
