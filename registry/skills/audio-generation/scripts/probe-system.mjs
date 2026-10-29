import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Read-only system capability probe for the sound-route decision.
 *
 * It measures this machine (CPU, RAM, disk, GPU/VRAM, local runtimes) and derives route
 * verdicts from the documented planning floors in ../references/system-capability.md.
 * It never installs, downloads, renders, listens, reads credentials or contacts a network.
 * A verdict is a fit estimate against documented minimums, NOT proof that any model runs.
 */

export const SCHEMA_VERSION = 1;

/** Planning floors in GiB, cores and GiB-free-disk. See references/system-capability.md. */
export const FLOORS = Object.freeze({
  'local-bundled': { ramGiB: 1, diskGiB: 0.1, cores: 2, vramGiB: 0, gpu: 'optional' },
  'local-tts-small': { ramGiB: 8, diskGiB: 10, cores: 4, vramGiB: 0, gpu: 'optional' },
  'local-tts-large': { ramGiB: 16, diskGiB: 20, cores: 8, vramGiB: 8, gpu: 'preferred' },
  'local-music': { ramGiB: 16, diskGiB: 25, cores: 8, vramGiB: 12, gpu: 'required' },
  'local-asr-large': { ramGiB: 16, diskGiB: 10, cores: 4, vramGiB: 8, gpu: 'preferred' },
});

const ROUTE_LABEL = {
  'local-bundled': 'bundled synthesiser and music bed (no model)',
  'local-tts-small': 'local speech model, small (<=1B parameters)',
  'local-tts-large': 'local speech model, large or voice-cloning class',
  'local-music': 'local music or lyric-to-song model (diffusion class)',
  'local-asr-large': 'local transcription assistance, large class',
};

/**
 * OS-reported memory excludes firmware/hardware reservations, so a machine sold as 16 GiB reports
 * about 15.7 GiB. Floors are compared with this documented tolerance so an advertised size is not
 * failed by reservation overhead; the measured value is still reported unchanged.
 */
export const RAM_TOLERANCE_GIB = 0.5;

/** A dedicated GPU is required only where the floor says so; integrated graphics never counts. */
function dedicatedVramGiB(facts) {
  const values = (facts.gpu?.devices ?? [])
    .filter(d => d.vramReliable && !d.integrated && typeof d.vramGiB === 'number')
    .map(d => d.vramGiB);
  return values.length === 0 ? 0 : Math.max(...values);
}

/** Pure decision function: measured facts in, route verdicts out. */
export function decideRoutes(facts) {
  const ramGiB = facts.memory?.totalGiB ?? 0;
  const comparableRamGiB = Number((ramGiB + RAM_TOLERANCE_GIB).toFixed(1));
  const diskGiB = facts.disk?.freeGiB ?? 0;
  const cores = facts.cpu?.logicalCores ?? 0;
  const vramGiB = dedicatedVramGiB(facts);
  const routes = {};

  for (const [route, floor] of Object.entries(FLOORS)) {
    const missing = [];
    if (comparableRamGiB < floor.ramGiB) missing.push(`memory(${ramGiB.toFixed(1)}+${RAM_TOLERANCE_GIB}<${floor.ramGiB}GiB)`);
    if (diskGiB < floor.diskGiB) missing.push(`disk(${diskGiB.toFixed(1)}<${floor.diskGiB}GiB)`);
    if (cores < floor.cores) missing.push(`cpu(${cores}<${floor.cores} cores)`);
    if (floor.gpu === 'required' && vramGiB < floor.vramGiB) {
      missing.push(`dedicated-vram(${vramGiB.toFixed(1)}<${floor.vramGiB}GiB)`);
    }

    const caveats = [];
    if (floor.gpu === 'preferred' && vramGiB < floor.vramGiB) {
      caveats.push(`no dedicated GPU with ${floor.vramGiB}GiB: slower CPU or shared-memory path`);
    }
    if (missing.length === 0 && floor.ramGiB <= comparableRamGiB && comparableRamGiB - floor.ramGiB < 2) {
      caveats.push('memory headroom under 2GiB; other apps may cause a swap-heavy run');
    }
    if (route !== 'local-bundled' && !facts.tools?.python && !facts.tools?.uv) {
      caveats.push('no python/uv detected: the model runtime still has to be installed and reviewed');
    }

    const state = missing.length > 0 ? 'not-recommended' : caveats.length > 0 ? 'viable-with-caveats' : 'recommended';
    routes[route] = {
      label: ROUTE_LABEL[route],
      state,
      floor: { ...floor },
      missing,
      caveats,
      confirmedByProbe: false,
    };
  }

  routes['external-provider'] = {
    label: 'approved external provider (API)',
    state: 'available-with-consent',
    floor: null,
    missing: [],
    caveats: [],
    requires: ['user opt-in for uploads and spend', 'configured provider and credentials', 'acknowledged per-job cost ceiling'],
    confirmedByProbe: false,
  };
  return routes;
}

const INTEGRATED = /intel|iris|uhd graphics|hd graphics|radeon\(tm\) graphics|vega \d+ graphics|apple m\d|adreno|mali/i;

function spawnText(command, args, timeout = 4000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', timeout, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) return null;
  return (result.stdout ?? '').trim();
}

function parseNvidia(text) {
  if (!text) return null;
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const [name, memory, driver] = line.split(',').map(part => part.trim());
    const mib = Number.parseInt(memory, 10);
    return {
      name,
      vramGiB: Number.isFinite(mib) ? Number((mib / 1024).toFixed(1)) : null,
      driver: driver || null,
      integrated: false,
      vramReliable: Number.isFinite(mib),
      source: 'nvidia-smi',
    };
  });
}

function parseWindowsGpus(text) {
  if (!text) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const rows = Array.isArray(data) ? data : [data];
  return rows.filter(row => row?.Name).map(row => ({
    name: String(row.Name),
    // AdapterRAM is reported unreliably (frequently capped) and integrated GPUs share system memory.
    vramGiB: null,
    driver: row.DriverVersion ? String(row.DriverVersion) : null,
    integrated: INTEGRATED.test(String(row.Name)),
    vramReliable: false,
    source: 'wmi',
  }));
}

function parseDarwinGpus(text) {
  if (!text) return null;
  const name = /Chipset Model:\s*(.+)/.exec(text)?.[1]?.trim();
  const vram = /VRAM \(Total\):\s*(\d+)\s*MB/.exec(text) ?? /VRAM \(Dynamic, Max\):\s*(\d+)\s*MB/.exec(text);
  if (!name) return null;
  return [{
    name,
    vramGiB: vram ? Number((Number(vram[1]) / 1024).toFixed(1)) : null,
    driver: null,
    integrated: INTEGRATED.test(name),
    vramReliable: Boolean(vram),
    source: 'system_profiler',
  }];
}

/** Measure this machine. Any probe that fails is reported as absent, never guessed. */
export async function probe(options = {}) {
  const platform = options.platform ?? process.platform;
  const runText = options.spawnText ?? spawnText;
  const statfs = options.statfs ?? (target => fs.statfsSync(target));
  const cpus = os.cpus();
  // statfs on the project directory measures its actual filesystem, including mount points.
  const project = path.resolve(options.project ?? process.cwd());

  let freeGiB = null;
  try {
    const stats = statfs(project);
    freeGiB = Number(((stats.bsize * stats.bavail) / 2 ** 30).toFixed(1));
  } catch {
    freeGiB = null;
  }

  const gpuDevices =
    parseNvidia(runText('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'])) ??
    (platform === 'win32'
      ? parseWindowsGpus(runText('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress']))
      : platform === 'darwin'
        ? parseDarwinGpus(runText('system_profiler', ['SPDisplaysDataType']))
        : null) ??
    [];

  const tools = {
    ffmpegOnPath: runText('ffmpeg', ['-version']) !== null,
    // A project can ship its own FFmpeg (ffmpeg-static) without any PATH entry; report both.
    ffmpegProjectLocal: fs.existsSync(path.join(
      project, 'node_modules', 'ffmpeg-static', platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    )),
    python: runText('python', ['--version']) !== null || runText('python3', ['--version']) !== null,
    uv: runText('uv', ['--version']) !== null,
    nvidiaSmi: gpuDevices.some(device => device.source === 'nvidia-smi'),
  };

  const facts = {
    schemaVersion: SCHEMA_VERSION,
    probedAt: new Date().toISOString(),
    platform,
    arch: process.arch,
    release: os.release(),
    node: process.versions.node,
    cpu: { model: cpus[0]?.model?.trim() ?? null, logicalCores: cpus.length },
    memory: {
      totalGiB: Number((os.totalmem() / 2 ** 30).toFixed(1)),
      freeGiB: Number((os.freemem() / 2 ** 30).toFixed(1)),
      toleranceGiB: RAM_TOLERANCE_GIB,
      note: 'totalGiB is the OS-reported usable figure; floors are compared with toleranceGiB added for firmware reservations',
    },
    disk: { path: project, freeGiB },
    gpu: {
      devices: gpuDevices,
      dedicatedVramGiB: dedicatedVramGiB({ gpu: { devices: gpuDevices } }),
      note: gpuDevices.length === 0
        ? 'no GPU probe answered (no nvidia-smi, WMI or system_profiler result)'
        : gpuDevices.every(device => !device.vramReliable)
          ? 'VRAM not reliably reported; integrated/shared memory is not dedicated VRAM'
          : 'nvidia-smi VRAM reported',
    },
    tools,
  };

  return {
    ...facts,
    routes: decideRoutes(facts),
    floors: FLOORS,
    verified: { modelRuns: false, listening: false, installedModels: false },
    caveat: 'Verdicts compare measured facts with documented planning floors, not vendor model requirements. Confirm the model card, licence and a real run before promising output.',
  };
}

function flag(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(args) {
  const out = flag(args, '--out');
  const force = args.includes('--force');
  const known = new Set(['--out', '--force', '--project']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    if (!known.has(arg)) {
      console.error(`probe-system: unknown flag ${arg}. Use --out <path>, --project <dir> and optionally --force.`);
      return 2;
    }
    if (arg === '--out' || arg === '--project') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) {
        console.error(`probe-system: ${arg} needs a ${arg === '--out' ? 'destination path' : 'project directory'}.`);
        return 2;
      }
      index += 1;
    }
  }

  const report = await probe({ project: flag(args, '--project') ?? process.cwd() });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (out) {
    const target = path.resolve(out);
    if (fs.existsSync(target) && !force) {
      console.error(`probe-system: ${out} already exists; pass --force to replace a recorded probe.`);
      return 2;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, json, 'utf8');
  }
  process.stdout.write(json);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
