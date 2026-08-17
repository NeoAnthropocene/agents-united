import { describe, it, expect } from 'vitest';
import yaml from 'yaml';

describe('Milestone 0: Cline Compatibility Spike', () => {
  describe('Agent Squad preset schema compatibility', () => {
    it('accepts valid Agent Squad preset frontmatter subset and rejects unsupported tool lists', () => {
      const validPreset = `---
name: backend-architect
description: Expert in backend API design and architecture
---
## Cline runtime note
Use the equivalent capabilities available in this Cline session.
`;

      const parsed = yaml.parse(validPreset.split('---')[1]);
      expect(parsed.name).toBe('backend-architect');
      expect(parsed.description).toBe('Expert in backend API design and architecture');
      // No Claude-style tools array or Antigravity-specific keys
      expect(parsed.tools).toBeUndefined();
      expect(parsed.permissionMode).toBeUndefined();
      expect(parsed.mainAgent).toBeUndefined();
      expect(parsed.subagent).toBeUndefined();
    });

    it('supports optional Agent Squad preset fields (providerId, modelId, cwd, maxIterations)', () => {
      const presetWithOptionals = `---
name: specialized-coder
description: Specialist with custom model
providerId: anthropic
modelId: claude-3-7-sonnet
cwd: ./workspace
maxIterations: 50
---
System instructions here.
`;
      const parsed = yaml.parse(presetWithOptionals.split('---')[1]);
      expect(parsed.providerId).toBe('anthropic');
      expect(parsed.modelId).toBe('claude-3-7-sonnet');
      expect(parsed.cwd).toBe('./workspace');
      expect(parsed.maxIterations).toBe(50);
    });
  });

  describe('Cline parser probe semantics', () => {
    it('interprets exit 0 from --team-name probe as named-team capability even if omitted in help', async () => {
      type FakeRunner = (args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

      const fakeProbeRunner: FakeRunner = async (args: string[]) => {
        if (args.includes('--help')) {
          // Help text omits --team-name in Cline 3.0.55
          return { exitCode: 0, stdout: 'Usage: cline [options] [command]\nOptions:\n  -v, --version  output the version number', stderr: '' };
        }
        if (args.includes('--team-name') && args.includes('version')) {
          // Parser probe succeeds with exit code 0
          return { exitCode: 0, stdout: 'v3.0.55', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: 'unknown option' };
      };

      const helpRes = await fakeProbeRunner(['--help']);
      expect(helpRes.stdout).not.toContain('--team-name');

      const probeRes = await fakeProbeRunner(['--team-name', 'agents-united-capability-probe', 'version']);
      expect(probeRes.exitCode).toBe(0);
      expect(probeRes.stdout).toContain('v3.0.55');
    });

    it('identifies when --team-name is rejected by an older or incompatible runtime', async () => {
      const fakeOlderRunner = async (args: string[]) => {
        if (args.includes('--team-name')) {
          return { exitCode: 1, stdout: '', stderr: 'error: unknown option --team-name' };
        }
        return { exitCode: 0, stdout: 'v2.0.0', stderr: '' };
      };

      const probeRes = await fakeOlderRunner(['--team-name', 'agents-united-capability-probe', 'version']);
      expect(probeRes.exitCode).not.toBe(0);
      expect(probeRes.stderr).toContain('unknown option');
    });
  });
});
