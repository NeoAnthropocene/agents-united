import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// Upstream-only boundary/lifecycle is tested in remotion-upstream-distribution.test.ts.
describe('Remotion production guidance', () => {
  it('documents that neither rendering mode has a licence quota', () => {
    const modes = fs.readFileSync('registry/skills/remotion-production/references/rendering-modes.md', 'utf8');
    expect(modes).toMatch(/neither mode has a render quota/i);
    expect(modes).toMatch(/governs \*\*who may use Remotion for free\*\*/i);
    expect(modes).toContain('@remotion/web-renderer');
    expect(modes).toContain('4.0.491');
    expect(modes).toMatch(/z-index/);
    expect(modes).toMatch(/backdrop-filter/);
    expect(modes).toMatch(/linear-gradient/);
    expect(modes).toMatch(/not\*\* in the scaffold's pinned dependency set|not\*\* in\s+the scaffold's pinned dependency set/i);
    expect(modes).toMatch(/usage_limit_reached/);
    expect(modes).toMatch(/always one event per render|always sends/i);
    const runtime = fs.readFileSync('registry/skills/remotion-production/references/runtime.md', 'utf8');
    expect(runtime).toContain('rendering-modes.md');
    const skill = fs.readFileSync('registry/skills/remotion-production/SKILL.md', 'utf8');
    expect(skill).toContain('references/rendering-modes.md');
  });

  it('is conditional on Remotion selection and documents every planned host plus optional Studio', () => {
    const production = fs.readFileSync('registry/skills/remotion-production/SKILL.md', 'utf8');
    const guide = fs.readFileSync('registry/skills/remotion-production/references/official-agent-skills.md', 'utf8');
    const studio = fs.readFileSync('registry/skills/remotion-production/references/studio.md', 'utf8');
    expect(production).toContain('references/official-agent-skills.md');
    expect(production).toContain('references/studio.md');
    expect(production).toMatch(/only when .*remotion|Remotion .*selected/i);
    expect(production).toMatch(/optional Studio|Studio .*optional/i);
    for (const host of ['Claude Code', 'Codex', 'Cursor', 'Antigravity', 'Cline', 'GitHub Copilot', 'Kimi Code']) {
      expect(guide, host).toContain(host);
    }
    for (const target of ['.claude/skills/', '.agents/skills/', '~/.claude/skills/', '~/.cursor/skills/', '~/.agents/skills/']) {
      expect(guide, target).toContain(target);
    }
    expect(guide).toContain('npx skills add remotion-dev/skills');
    expect(guide).toMatch(/official plugin/i);
    expect(studio).toMatch(/agent-only/i);
    expect(studio).toMatch(/hands-on/i);
    expect(studio).toContain('npx remotion studio');
    expect(studio).toMatch(/must not replace|final measured export|helper/i);
  });

  it('pins the current package release and ships a release drift checker', () => {
    const source = fs.readFileSync('registry/skills/remotion-production/scripts/project.mjs', 'utf8');
    const runtime = fs.readFileSync('registry/skills/remotion-production/references/runtime.md', 'utf8');
    const checker = fs.readFileSync('registry/skills/remotion-production/scripts/check-release.mjs', 'utf8');
    expect(source).toContain("REMOTION_VERSION = '4.0.541'");
    expect(source).toContain("['4.0.539', '4.0.540', REMOTION_VERSION]");
    for (const version of ['4.0.539', '4.0.540', '4.0.541']) expect(runtime).toContain(version);
    expect(runtime).not.toContain('4.0.538');
    expect(checker).toContain('registry.npmjs.org/remotion/latest');
    expect(checker).toMatch(/compareReleaseVersions/);
  });

  it('makes Studio an explicit user choice without replacing agentic production or final gates', () => {
    for (const file of ['registry/agents/orchestrator-digital-agency.md', 'registry/hosts/claude/agents/orchestrator-digital-agency.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/Remotion[\s\S]*Studio/i);
      expect(text, file).toMatch(/agent-only/i);
      expect(text, file).toMatch(/hands-on/i);
      expect(text, file).toMatch(/optional/i);
    }
    for (const file of ['registry/agents/subagent-motion-designer.md', 'registry/hosts/claude/agents/agency-motion-designer.md']) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).toMatch(/Remotion Studio/);
      expect(text, file).toMatch(/agentic|final measured export|helper/i);
      expect(text, file).toMatch(/remotion-best-practices/);
      expect(text, file).toMatch(/remotion-markup/);
    }
  });

});
