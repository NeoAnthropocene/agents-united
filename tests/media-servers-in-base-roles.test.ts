import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { HOSTED_MEDIA_SERVERS, IMAGE_SERVER_ADD_COMMAND, mcpAddCommand } from '../src/core/mcp-add-commands.js';
import { PrerequisiteChecker } from '../src/core/prerequisites.js';
import { RegistryResolver } from '../src/core/registry.js';

/**
 * ADR 0079: the creative, motion and sound designers declare their media servers in their canonical agents, and so does the digital-agency lead. The servers stay name-only entries;
 * the bundles that hold the roles list them as optional extras (the doctor and the install gate leave those out); one table in `src/core/mcp-add-commands.ts` holds the add command that
 * the doctor and the install panel print; and no path writes `npx -y <name>` for a server that has no stdio definition.
 */

const FIVE = ['image-gen', 'higgsfield', 'klingai', 'elevenlabs', 'fish-audio'];
const HOSTED = ['higgsfield', 'klingai', 'elevenlabs', 'fish-audio'];
const read = (relative: string): string => fs.readFileSync(path.resolve(relative), 'utf8').replace(/\r\n/g, '\n');
const declared = (file: string): string[] => {
  const meta = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(read(path.join('registry/agents', file)))![1]!) as { mcpServers?: Array<{ name: string } | string> };
  return (meta.mcpServers ?? []).map(entry => (typeof entry === 'string' ? entry : entry.name));
};
const entriesOf = (file: string): unknown[] => (yaml.parse(/^---\n([\s\S]*?)\n---/.exec(read(path.join('registry/agents', file)))![1]!) as { mcpServers?: unknown[] }).mcpServers ?? [];

describe('the canonical agents declare the media servers by name', () => {
  it('has the creative designer declare the image server after Stitch and Figma, the motion designer its two video servers and the sound designer its two audio servers', () => {
    expect(declared('subagent-marketing-creative-designer.md')).toEqual(['stitch', 'figma', 'image-gen']);
    expect(declared('subagent-motion-designer.md')).toEqual(['higgsfield', 'klingai']);
    expect(declared('subagent-sound-designer.md')).toEqual(['elevenlabs', 'fish-audio']);
  });

  it('has the digital-agency lead declare the five after its eight', () => {
    expect(declared('orchestrator-digital-agency.md')).toEqual(['github', 'firecrawl', 'context7', 'playwright', 'markitdown', 'chrome-devtools-mcp', 'stitch', 'figma', ...FIVE]);
  });

  it('keeps every entry name-only (a server is referenced by name, never defined inline)', () => {
    for (const file of ['subagent-marketing-creative-designer.md', 'subagent-motion-designer.md', 'subagent-sound-designer.md', 'orchestrator-digital-agency.md']) {
      for (const entry of entriesOf(file)) expect(Object.keys(entry as Record<string, unknown>), file).toEqual(['name']);
    }
  });
});

describe('the bundles that hold the roles list the servers as optional extras', () => {
  type Mcp = { name: string; purpose?: string; optional?: boolean; optionalForBrainstorming?: boolean };
  const bundles = (): Record<string, { prerequisites?: { requiredMcps?: Mcp[] } }> => (JSON.parse(read('registry/bundles.json')) as { bundles: Record<string, { prerequisites?: { requiredMcps?: Mcp[] } }> }).bundles;
  const HOLDS: Record<string, string[]> = {
    'digital-agency': FIVE,
    full: FIVE,
    'growth-marketing': ['image-gen'],
    'performance-paid-acquisition': ['image-gen'],
  };

  it('lists each server in the bundles that hold the role that declares it, as `{ name, purpose, optionalForBrainstorming: true, optional: true }`, and in no other bundle', () => {
    for (const [name, bundle] of Object.entries(bundles())) {
      const media = (bundle.prerequisites?.requiredMcps ?? []).filter(mcp => FIVE.includes(mcp.name));
      expect(media.map(mcp => mcp.name).sort(), name).toEqual([...(HOLDS[name] ?? [])].sort());
      for (const mcp of media) {
        expect(Object.keys(mcp).sort(), `${name}/${mcp.name}`).toEqual(['name', 'optional', 'optionalForBrainstorming', 'purpose']);
        expect(mcp.optional, `${name}/${mcp.name}`).toBe(true);
        expect(mcp.optionalForBrainstorming, `${name}/${mcp.name}`).toBe(true);
      }
    }
  });

  it('takes each purpose from the mcp-setup references', () => {
    const providers = read('registry/skills/mcp-setup/references/media-providers.md').toLowerCase();
    const route = read('registry/skills/mcp-setup/references/claude-code.md').toLowerCase();
    const mcps = bundles()['digital-agency']!.prerequisites!.requiredMcps!;
    for (const name of HOSTED) {
      const purpose = mcps.find(mcp => mcp.name === name)!.purpose!;
      expect(providers, `${name}: ${purpose}`).toContain(purpose.toLowerCase());
    }
    const image = mcps.find(mcp => mcp.name === 'image-gen')!.purpose!.toLowerCase();
    expect(image).toContain('photographic images');
    expect(image).toContain('gemini, openai or seedream');
    expect(route).toContain('photographic images');
    expect(route).toContain('gemini');
    expect(route).toContain('seedream');
  });

  it('gives the same purpose to a server in every bundle that lists it', () => {
    for (const server of FIVE) {
      const purposes = new Set(Object.values(bundles()).flatMap(bundle => (bundle.prerequisites?.requiredMcps ?? []).filter(mcp => mcp.name === server).map(mcp => mcp.purpose)));
      expect(purposes.size, server).toBe(1);
    }
  });

  it('says in the digital-agency description that six servers are required and seven are optional extras', async () => {
    const agency = await new RegistryResolver().getBundle('digital-agency');
    expect(agency?.description).toMatch(/6 required MCP servers and 7 optional extras/);
  });
});

describe('the add command is printed from one table', () => {
  it('holds the four hosted URLs exactly as the media setup reference gives them', () => {
    const reference = read('registry/skills/mcp-setup/references/media-setup.md');
    const found = Object.fromEntries([...reference.matchAll(/^claude mcp add --scope project --transport http (\S+) (\S+)$/gm)].map(match => [match[1], match[2]]));
    expect(HOSTED_MEDIA_SERVERS).toEqual(found);
    expect(Object.keys(HOSTED_MEDIA_SERVERS).sort()).toEqual([...HOSTED].sort());
  });

  it('holds the image server command exactly as the reviewed Claude Code reference gives it (the Gemini base command)', () => {
    const reference = read('registry/skills/mcp-setup/references/claude-code.md');
    const base = reference.split('\n').find(line => line.startsWith('claude mcp add --scope local image-gen --env GEMINI_API_KEY='))!;
    expect(base).toBeDefined();
    expect(IMAGE_SERVER_ADD_COMMAND).toBe(base);
  });

  it('prints the HTTP form for a hosted server on Claude, with the sign-in step and no stdio placeholder', () => {
    for (const name of HOSTED) {
      const text = mcpAddCommand('claude', name, '/work/project');
      expect(text, name).toContain(`claude mcp add --scope project --transport http ${name} ${HOSTED_MEDIA_SERVERS[name]}`);
      expect(text, name).toContain('/mcp');
      expect(text, name).not.toContain('<command>');
    }
  });

  it('prints the reviewed command of the image server on Claude, after a cd into the project folder, and says the user runs it with their own key', () => {
    const text = mcpAddCommand('claude', 'image-gen', '/work/project');
    expect(text).toContain('cd <absolute path of the project>');
    expect(text).toContain(IMAGE_SERVER_ADD_COMMAND);
    expect(text).toMatch(/your own key/);
    expect(text).not.toContain('<command>');
  });

  it('keeps the generic form for every other server, and names no verified command for the five on Antigravity', () => {
    expect(mcpAddCommand('claude', 'github', '/work/project')).toBe('Add it with: claude mcp add github -- <command> [args...]');
    expect(mcpAddCommand('antigravity', 'github', '/work/project')).toBe('Add it with: agy mcp add github -- <command> [args...]');
    for (const name of FIVE) {
      const text = mcpAddCommand('antigravity', name, '/work/project');
      expect(text, name).toContain('No verified add command');
      expect(text, name).toContain('mcp-setup');
      expect(text, name).not.toContain('<command>');
    }
  });
});

describe('the stdio fallback is never reached for the five', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'au-media-fallback-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('returns no definition for the five and keeps the fallback only for an unknown name', () => {
    for (const name of FIVE) expect(PrerequisiteChecker.getMcpDefinition(name), name).toBeUndefined();
    expect(PrerequisiteChecker.getMcpDefinition('github')).toMatchObject({ command: 'npx' });
    expect(PrerequisiteChecker.getMcpDefinition('some-other-mcp')).toEqual({ command: 'npx', args: ['-y', 'some-other-mcp'] });
  });

  it('writes no entry for them into a generated client configuration', () => {
    const config = PrerequisiteChecker.generateClientConfig('claude', ['github', ...FIVE]);
    expect(Object.keys(config.mcpServers)).toEqual(['github']);
  });

  it('adds none of them to a host configuration file, and says which it left out', async () => {
    const file = path.join(dir, 'mcp.json');
    const result = await PrerequisiteChecker.autoConfigureConfigFile(file, ['github', ...FIVE]);
    expect(result.addedServers).toEqual(['github']);
    expect(result.skippedServers).toEqual(FIVE);
    const text = await fs.readFile(file, 'utf8');
    for (const name of FIVE) expect(text, name).not.toContain(name);
    expect(Object.keys((JSON.parse(text) as { mcpServers: Record<string, unknown> }).mcpServers)).toEqual(['github']);
  });
});

describe('the doctor and the install panel print the add command of the table', () => {
  let root: string;
  let workspace: string;
  const originalCwd = process.cwd();
  const KEYS = ['USERPROFILE', 'HOME', 'APPDATA', 'CLAUDE_BIN_PATH', 'CLINE_BIN_PATH'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-media-doctor-'));
    workspace = path.join(root, 'ws');
    await fs.ensureDir(workspace);
    await fs.ensureDir(path.join(root, 'home'));
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.USERPROFILE = path.join(root, 'home');
    process.env.HOME = path.join(root, 'home');
    process.env.APPDATA = path.join(root, 'appdata');
    delete process.env.CLAUDE_BIN_PATH;
    delete process.env.CLINE_BIN_PATH;
    process.chdir(workspace);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await fs.remove(root);
  });

  it('prints the HTTP command for a hosted server that an installed role declares and no bundle lists as an optional extra', async () => {
    const agentsDir = path.join(workspace, '.agents');
    await new InstallEngine().install('software-engineering', { targetDir: agentsDir, method: 'copy' });
    await fs.writeFile(path.join(agentsDir, 'agents', 'subagent-probe.md'), '---\nname: subagent-probe\ndescription: probe\nmcpServers:\n  - name: higgsfield\n---\nbody\n');
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    const warning = (report.warnings ?? []).find(line => line.includes('MCP server "higgsfield"'));
    expect(warning).toBeDefined();
    expect(warning).toContain('claude mcp add --scope project --transport http higgsfield https://mcp.higgsfield.ai');
    expect(warning).not.toContain('<command>');
  });

  it('has no warning for the image server once the growth-marketing bundle is installed, because the bundle lists it as an optional extra', async () => {
    const agentsDir = path.join(workspace, '.agents');
    await new InstallEngine().install('growth-marketing', { targetDir: agentsDir, method: 'copy' });
    const report = await DoctorEngine.runDoctor(agentsDir, 'claude');
    const text = [...(report.warnings ?? []), ...(report.issues ?? [])].join('\n');
    expect(text).not.toContain('MCP server "image-gen"');
  });

  it('puts the add command of the table into the install panel line of an unmet optional extra, for Claude only', async () => {
    const agency = (await new RegistryResolver().getBundle('digital-agency'))!;
    const claude = await new PrerequisiteChecker().evaluate(agency, { cwd: workspace, targetHosts: ['claude'] });
    const hosted = claude.items.find(item => item.name === 'higgsfield')!;
    expect(hosted).toMatchObject({ satisfied: false, optional: true });
    expect(hosted.details).toContain('claude mcp add --scope project --transport http higgsfield https://mcp.higgsfield.ai');
    const image = claude.items.find(item => item.name === 'image-gen')!;
    expect(image.details).toContain(IMAGE_SERVER_ADD_COMMAND);
    const antigravity = await new PrerequisiteChecker().evaluate(agency, { cwd: workspace, targetHosts: ['antigravity'] });
    expect(antigravity.items.find(item => item.name === 'higgsfield')!.details).not.toContain('claude mcp add');
    expect(claude.allSatisfied).toBe(false);
  });
});
