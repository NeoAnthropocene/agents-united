// Wiring smoke test of the image server `mcp-image@0.18.0` (the pin of the mcp-setup reference): it starts the server over stdio, lists its tool and calls `generate_image` for each provider
// with FAKE keys or none, to see that the tool call reaches the provider code and that the server's errors are the ones the skills tell the lead to expect. It makes no image and uses no real key:
// the child process gets a whitelist of the environment (no key of the user can reach it), a fresh empty working folder and an output folder inside it.
// usage: node mcp-smoke.mjs <work-folder> [case ...]      cases: list, openai-fake, seedream-fake, gemini-fake, openai-nokey, seedream-nokey, default-openai
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PKG = 'mcp-image@0.18.0';
const [work, ...wanted] = process.argv.slice(2);
if (!work) { console.error('usage: node mcp-smoke.mjs <work-folder> [case ...]'); process.exit(2); }
fs.mkdirSync(work, { recursive: true });
if (fs.readdirSync(work).length) { console.error(`${work} is not empty: use a fresh folder`); process.exit(2); }

const KEEP = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'ProgramFiles', 'ProgramData', 'windir'];
const baseEnv = () => Object.fromEntries(KEEP.filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
const FAKE = { gemini: 'FAKE_GEMINI_KEY_FOR_A_WIRING_TEST', openai: 'FAKE_OPENAI_KEY_FOR_A_WIRING_TEST', seedream: 'FAKE_ARK_KEY_FOR_A_WIRING_TEST' };

function run(label, extraEnv, steps) {
  return new Promise(resolve => {
    const cwd = path.join(work, label);
    const out = path.join(cwd, 'out');
    fs.mkdirSync(out, { recursive: true });
    const env = { ...baseEnv(), SKIP_PROMPT_ENHANCEMENT: 'true', IMAGE_OUTPUT_DIR: out, ...extraEnv };
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? 'cmd' : 'npx', isWin ? ['/c', 'npx', '-y', PKG] : ['-y', PKG], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map();
    let buffer = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try { const msg = JSON.parse(line); if (msg.id !== undefined && pending.has(msg.id)) pending.get(msg.id)(msg); } catch { /* not a JSON line */ }
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    const send = (message) => child.stdin.write(JSON.stringify(message) + '\n');
    const request = (id, method, params, ms = 90000) => new Promise(res => {
      const timer = setTimeout(() => { pending.delete(id); res({ id, timeout: true }); }, ms);
      pending.set(id, msg => { clearTimeout(timer); pending.delete(id); res(msg); });
      send({ jsonrpc: '2.0', id, method, params });
    });
    const finish = (result) => { try { child.stdin.end(); child.kill(); } catch { /* gone */ } resolve({ label, ...result, stderr: stderr.split('\n').filter(l => l.trim()).slice(0, 6).map(l => l.slice(0, 300)) }); };
    child.on('error', error => finish({ spawnError: String(error) }));
    (async () => {
      const init = await request(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wiring-smoke', version: '0.0.0' } }, 120000);
      if (init.timeout) return finish({ initialize: 'timeout' });
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      const result = { server: init.result?.serverInfo, protocolVersion: init.result?.protocolVersion };
      let id = 2;
      for (const step of steps) {
        const response = await request(id++, step.method, step.params);
        result[step.name] = response.timeout ? 'timeout' : (response.error ?? response.result);
      }
      finish(result);
    })();
  });
}

const call = (args, name = 'call') => [{ name, method: 'tools/call', params: { name: 'generate_image', arguments: { prompt: 'A plain grey square. Wiring test only; no key is real.', ...args } } }];
const list = [{ name: 'tools', method: 'tools/list', params: {} }];
const cases = {
  list: () => run('list', { IMAGE_PROVIDER: 'gemini', GEMINI_API_KEY: FAKE.gemini }, list),
  'openai-fake': () => run('openai-fake', { IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: FAKE.openai }, call({ provider: 'openai' })),
  'seedream-fake': () => run('seedream-fake', { IMAGE_PROVIDER: 'seedream', ARK_API_KEY: FAKE.seedream }, call({ provider: 'seedream' })),
  'gemini-fake': () => run('gemini-fake', { IMAGE_PROVIDER: 'gemini', GEMINI_API_KEY: FAKE.gemini }, call({ provider: 'gemini' })),
  'openai-nokey': () => run('openai-nokey', { IMAGE_PROVIDER: 'gemini', GEMINI_API_KEY: FAKE.gemini }, call({ provider: 'openai' })),
  'seedream-nokey': () => run('seedream-nokey', { IMAGE_PROVIDER: 'gemini', GEMINI_API_KEY: FAKE.gemini }, call({ provider: 'seedream' })),
  'default-openai': () => run('default-openai', { IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: FAKE.openai }, call({})),
  // All three keys on one server, the default Gemini: the provider named in a call is the one that answers, and a call that names none goes to the default.
  'multi-keys': () => run('multi-keys', { IMAGE_PROVIDER: 'gemini', GEMINI_API_KEY: FAKE.gemini, OPENAI_API_KEY: FAKE.openai, ARK_API_KEY: FAKE.seedream }, [
    ...call({ provider: 'openai' }, 'call-openai'),
    ...call({ provider: 'seedream' }, 'call-seedream'),
    ...call({}, 'call-default'),
  ]),
};
const names = wanted.length ? wanted : Object.keys(cases);
for (const name of names) {
  if (!cases[name]) { console.error(`unknown case ${name}`); process.exit(2); }
  const result = await cases[name]();
  console.log(`=== ${name}`);
  console.log(JSON.stringify(result, null, 2));
}
const leftovers = fs.readdirSync(work, { recursive: true }).filter(f => /\.(png|jpe?g|webp)$/i.test(String(f)));
console.log(`=== images written: ${leftovers.length}`);
