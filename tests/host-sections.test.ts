import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hostSectionProblems, hostSections } from '../src/core/host-sections.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { ClineProjector } from '../src/core/cline-projector.js';
import { InstallEngine } from '../src/core/installer.js';
import { HostProjector } from '../src/core/projector.js';
import { scanCoreForHostTokens, validateCoreSchema } from '../src/core/semantic-core.js';

/**
 * ADR 0079: a marked section of a canonical agent body is for one host. `<!-- agents-united:host antigravity -->` opens it and `<!-- agents-united:host-end -->` closes it. The one
 * function `hostSections` keeps the text of a section, without its marker lines, for the named host and removes the whole section for every other host; it refuses (throws) a
 * body that is not well formed, so a reader that forgets to apply it fails and does not leak. Only `antigravity` is a host name for now.
 */

const OPEN = '<!-- agents-united:host antigravity -->';
const END = '<!-- agents-united:host-end -->';
const read = (relative: string): string => fs.readFileSync(path.resolve(relative), 'utf8').replace(/\r\n/g, '\n');
const body = (inner: string): string => `Before.\n\n${OPEN}\n${inner}\n${END}\n\nAfter.\n`;
const LEADS = ['orchestrator-digital-agency', 'orchestrator-marketing'];
/** A phrase of the Antigravity paragraph that no other text of the leads contains. */
const PARAGRAPH = "Antigravity's own image generation";

describe('hostSections', () => {
  it('keeps the inner text and drops the two marker lines for the named host', () => {
    expect(hostSections(body('For Antigravity only.'), 'antigravity')).toBe('Before.\n\nFor Antigravity only.\n\nAfter.\n');
  });

  it('removes the whole section, markers included, for every other host', () => {
    for (const host of ['claude', 'cline', 'cursor', 'opencode', 'codex', 'agents', 'gemini']) {
      expect(hostSections(body('For Antigravity only.'), host), host).toBe('Before.\n\n\nAfter.\n');
    }
  });

  it('leaves a body without a section byte for byte, and keeps its line ends', () => {
    expect(hostSections('One.\r\nTwo.\r\n', 'claude')).toBe('One.\r\nTwo.\r\n');
    expect(hostSections(body('Inner.').replace(/\n/g, '\r\n'), 'antigravity')).toBe('Before.\r\n\r\nInner.\r\n\r\nAfter.\r\n');
  });

  it('handles several sections and an empty one', () => {
    const text = `a\n${OPEN}\nb\n${END}\nc\n${OPEN}\n${END}\nd\n`;
    expect(hostSections(text, 'antigravity')).toBe('a\nb\nc\nd\n');
    expect(hostSections(text, 'claude')).toBe('a\nc\nd\n');
  });
});

describe('a body that is not well formed is refused, not dropped', () => {
  it('refuses any other host name', () => {
    for (const host of ['claude', 'cline', 'cursor', 'opencode', 'codex', 'agents', 'Antigravity', '']) {
      const text = `x\n<!-- agents-united:host ${host} -->\ny\n${END}\n`;
      expect(hostSectionProblems(text), host).not.toEqual([]);
      expect(() => hostSections(text, 'antigravity'), host).toThrow(/host section/i);
      expect(() => hostSections(text, 'claude'), host).toThrow(/host section/i);
    }
  });

  it('refuses a section that is not closed', () => {
    const text = `x\n${OPEN}\ny\n`;
    expect(hostSectionProblems(text).join('\n')).toMatch(/not closed/);
    expect(() => hostSections(text, 'claude')).toThrow(/not closed/);
  });

  it('refuses a nested section', () => {
    const text = `x\n${OPEN}\ny\n${OPEN}\nz\n${END}\n${END}\n`;
    expect(hostSectionProblems(text).join('\n')).toMatch(/nested/);
    expect(() => hostSections(text, 'antigravity')).toThrow(/nested/);
  });

  it('refuses an end marker without a start', () => {
    const text = `x\n${END}\n`;
    expect(hostSectionProblems(text).join('\n')).toMatch(/without a start/);
    expect(() => hostSections(text, 'claude')).toThrow(/without a start/);
  });

  it('takes a marker only as a whole line, so a sentence that quotes one is not a marker', () => {
    const quoted = `We write ${OPEN} in prose.\n`;
    expect(hostSectionProblems(quoted)).toEqual([]);
    expect(hostSections(quoted, 'claude')).toBe(quoted);
  });
});

describe('the registry', () => {
  const agents = (): string[] => fs.readdirSync(path.resolve('registry/agents')).filter(file => file.endsWith('.md'));

  it('has no canonical agent with a malformed section, and sections only in the two leads, one each, for antigravity', () => {
    const withSections: string[] = [];
    for (const file of agents()) {
      const text = read(path.join('registry/agents', file));
      expect(hostSectionProblems(text), file).toEqual([]);
      const count = text.split('\n').filter(line => line.startsWith('<!-- agents-united:host ')).length;
      if (count > 0) {
        withSections.push(file.replace(/\.md$/, ''));
        expect(count, file).toBe(1);
        expect(text, file).toContain(OPEN);
      }
    }
    expect(withSections.sort()).toEqual([...LEADS].sort());
  });

  it('has no purity rule for the prose of a canonical agent, and the core purity rule still refuses a host section in a core', () => {
    // Purity (`scanCoreForHostTokens`, a corpus of host tool names) is applied to registry/core files only; the canonical agents already use those names. A host section is no exemption in a core.
    expect(scanCoreForHostTokens(body('Call run_command here.')).length).toBeGreaterThan(0);
    expect(scanCoreForHostTokens('Call run_command here.').length).toBeGreaterThan(0);
    expect(scanCoreForHostTokens('Before.\n\nAfter.\n')).toEqual([]);
    const core = { identity: 'You are a role.', mission: body('Call run_command here.'), scope_boundaries: 'Scope.', safety: 'Safe.', output_contract: 'Out.', invariants: ['One.'], capabilities: ['messaging'] };
    expect(() => validateCoreSchema(core)).toThrow(/purity/);
  });

  it('shows the paragraph in each lead inside its one section, with the five routes in order and the recommended one first', () => {
    for (const lead of LEADS) {
      const text = read(path.join('registry/agents', `${lead}.md`));
      const section = text.slice(text.indexOf(OPEN), text.indexOf(END));
      expect(section, lead).toContain(PARAGRAPH);
      // The store copy is the Antigravity copy, and another host may open it: the paragraph names its host in its first words.
      expect(section.split('\n').slice(1).join('\n').startsWith('If you are running on Antigravity:'), lead).toBe(true);
      const order = ["Antigravity's own image generation", '`image-gen`', 'hosted media servers', 'Licensed stock', 'placeholder'].map(part => section.indexOf(part));
      expect(order.every(index => index >= 0), `${lead}: ${order.join(',')}`).toBe(true);
      expect([...order].sort((a, b) => a - b), lead).toEqual(order);
      expect(section, lead).toMatch(/recommended/);
      expect(section, lead).toMatch(/when your tools show it/);
      expect(text.replace(section, ''), lead).not.toContain(PARAGRAPH);
    }
  });

  it('leaves the Claude native lead files without the markers and the paragraph', () => {
    for (const lead of LEADS) {
      const text = read(path.join('registry/hosts/claude/agents', `${lead}.md`));
      expect(text, lead).not.toContain('agents-united:host');
      expect(text, lead).not.toContain(PARAGRAPH);
    }
  });
});

describe('the readers of a canonical agent body (the inventory of ADR 0079)', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-host-sections-'));
  });
  afterEach(async () => {
    await fs.remove(root);
  });

  const files = async (dir: string): Promise<string[]> => {
    const found: string[] = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...(await files(full)));
      else found.push(full);
    }
    return found;
  };
  const texts = async (dir: string): Promise<Array<{ file: string; text: string }>> => {
    const out: Array<{ file: string; text: string }> = [];
    for (const file of await files(dir)) if (/\.(md|yml|yaml|json)$/.test(file)) out.push({ file, text: (await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n') });
    return out;
  };

  it('has each projector drop the section: Claude non-native, Cline, and the generic frontmatter projector for Cursor, OpenCode and the Codex bridge', () => {
    for (const lead of LEADS) {
      const text = read(path.join('registry/agents', `${lead}.md`));
      const outputs: Record<string, string> = {
        claude: ClaudeProjector.renderRole(text, `agents/${lead}.md`).content,
        cline: ClineProjector.renderConfiguredAgent(text, `agents/${lead}.md`),
        cursor: HostProjector.projectAgent(text, 'cursor', `agents/${lead}.md`).content,
        opencode: HostProjector.projectAgent(text, 'opencode', `agents/${lead}.md`).content,
        'claude-code': HostProjector.projectAgent(text, 'claude-code', `agents/${lead}.md`).content,
        agentsmd: HostProjector.projectAgent(text, 'agentsmd', `agents/${lead}.md`).content,
        clineGeneric: HostProjector.projectAgent(text, 'cline', `agents/${lead}.md`).content,
      };
      for (const [name, output] of Object.entries(outputs)) {
        expect(output, `${lead} -> ${name}`).not.toContain('agents-united:host');
        expect(output, `${lead} -> ${name}`).not.toContain(PARAGRAPH);
      }
    }
  });

  it('has the Antigravity projection keep the paragraph and no marker', () => {
    for (const lead of LEADS) {
      const output = HostProjector.projectAgent(read(path.join('registry/agents', `${lead}.md`)), 'antigravity', `agents/${lead}.md`).content;
      expect(output, lead).toContain(PARAGRAPH);
      expect(output, lead).not.toContain('agents-united:host');
    }
  });

  it('refuses a malformed body at every projector, so that a reader cannot leak a half-marked section', () => {
    const text = read('registry/agents/orchestrator-marketing.md').replace(END, '');
    expect(() => ClaudeProjector.renderRole(text, 'agents/x.md')).toThrow(/not closed/);
    expect(() => ClineProjector.renderConfiguredAgent(text, 'agents/x.md')).toThrow(/not closed/);
    expect(() => HostProjector.projectAgent(text, 'cursor', 'agents/x.md')).toThrow(/not closed/);
    expect(() => HostProjector.projectAgent(text, 'antigravity', 'agents/x.md')).toThrow(/not closed/);
  });

  for (const bundle of ['digital-agency', 'growth-marketing']) {
    it(`installs ${bundle} for Codex with exactly .agents and AGENTS.md, an index without the paragraph, and a store copy that names its host first`, async () => {
      const agentsDir = path.join(root, 'ws', '.agents');
      await new InstallEngine().install(bundle, { targetDir: agentsDir, method: 'copy', fanout: ['codex'] });
      const lead = bundle === 'digital-agency' ? 'orchestrator-digital-agency' : 'orchestrator-marketing';
      expect((await fs.readdir(path.join(root, 'ws'))).sort()).toEqual(['.agents', 'AGENTS.md']);
      const index = (await fs.readFile(path.join(root, 'ws', 'AGENTS.md'), 'utf8')).replace(/\r\n/g, '\n');
      expect(index).not.toContain('agents-united:host');
      expect(index).not.toContain(PARAGRAPH);
      expect(index).toContain(`(.agents/agents/${lead}.md)`);
      const store = (await fs.readFile(path.join(agentsDir, 'agents', `${lead}.md`), 'utf8')).replace(/\r\n/g, '\n');
      expect(store).not.toContain('agents-united:host');
      expect(store).toContain(PARAGRAPH);
      expect(store.indexOf('If you are running on Antigravity:')).toBeGreaterThanOrEqual(0);
      expect(store.indexOf('If you are running on Antigravity:')).toBeLessThan(store.indexOf(PARAGRAPH));
      for (const { file, text } of await texts(path.join(root, 'ws'))) {
        if (file !== path.join(agentsDir, 'agents', `${lead}.md`)) expect(text, file).not.toContain(PARAGRAPH);
      }
    });

    for (const method of ['copy', 'symlink'] as const) {
      it(`installs ${bundle} (${method}) with the paragraph in the Antigravity store copy only, and no marker anywhere`, async () => {
        const agentsDir = path.join(root, 'ws', '.agents');
        await new InstallEngine().install(bundle, { targetDir: agentsDir, method, fanout: ['claude', 'cline'] });
        const lead = bundle === 'digital-agency' ? 'orchestrator-digital-agency' : 'orchestrator-marketing';
        const all = await texts(path.join(root, 'ws'));
        const store = path.join(agentsDir, 'agents', `${lead}.md`);
        for (const { file, text } of all) {
          expect(text, file).not.toContain('agents-united:host');
          if (file === store) continue;
          expect(text, file).not.toContain(PARAGRAPH);
        }
        const copy = all.find(entry => entry.file === store);
        expect(copy, 'the store copy of the lead').toBeDefined();
        expect(copy!.text).toContain(PARAGRAPH);
        expect((await fs.lstat(store)).isSymbolicLink(), 'a copy that is rendered is never a link into the registry').toBe(false);
      });
    }
  }

  it('keeps the lockfile hash of a store copy equal to the bytes written, so that a re-install and the doctor see no edit', async () => {
    const agentsDir = path.join(root, 'ws', '.agents');
    await new InstallEngine().install('growth-marketing', { targetDir: agentsDir, method: 'copy' });
    const lock = await fs.readJson(path.join(agentsDir, 'agents-united.json')) as { files: Record<string, { hash: string }> };
    const record = lock.files['agents/orchestrator-marketing.md'];
    expect(record).toBeDefined();
    const crypto = await import('node:crypto');
    const bytes = await fs.readFile(path.join(agentsDir, 'agents', 'orchestrator-marketing.md'));
    expect(record!.hash).toBe('sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'));
    await new InstallEngine().install('growth-marketing', { targetDir: agentsDir, method: 'copy' });
  });
});
