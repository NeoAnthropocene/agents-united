import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Two loose ends of the H9 retests (Plan 035 N1 slice 4, 2026-10-07), both in the Preflight of the Claude lead, after the generated Contract Floor:
 * - the credentialed branch did not load `mcp-setup`. In session `beb9938f` the lead printed a placeholder command in project scope: the key would have
 *   landed in a `.mcp.json` that the team shares. The reference gives `--scope local` and the lead has to read it before it prints;
 * - the re-check after a restart did not hold. In session `11611f74` the lead went from the restart to the team without checking which servers were
 *   ready; the starting prompt asked for it, and a lead whose starting prompt omits it must check anyway.
 */

const LEAD = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const AFTER_FLOOR = LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';
const PREFLIGHT = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf('## Preflight: the integrations the plan needs'), AFTER_FLOOR.indexOf('## Run the team'));
const step = (opening: RegExp): string => PREFLIGHT.split('\n').find(line => opening.test(line)) ?? '';

const CREDENTIAL = step(/^\d+\. \*\*Needs a credential\.\*\*/);
const RESTART = step(/^\d+\. \*\*When you are back after the restart/);

describe('the Preflight, the credentialed branch', () => {
  it('finds the Preflight and its two steps, so that no test below passes on an empty match', () => {
    expect(PREFLIGHT).not.toBe('');
    expect(CREDENTIAL).not.toBe('');
    expect(RESTART).not.toBe('');
  });

  it('loads mcp-setup and reads its Claude Code reference before it prints a command, and says what skipping it cost', () => {
    expect(CREDENTIAL).toContain('Load `mcp-setup` and read its Claude Code reference first');
    expect(CREDENTIAL).toMatch(/observed in the second H9 retest/);
  });

  it('prints the command as the reference gives it, in local scope, so that a key never lands in a shared .mcp.json', () => {
    expect(CREDENTIAL).toContain('`--scope local`');
    expect(CREDENTIAL).toMatch(/never `--scope project`/);
    expect(CREDENTIAL).toMatch(/`\.mcp\.json` that the team shares/);
  });

  it('still asks for no key and writes none', () => {
    expect(CREDENTIAL).toContain('Never ask for a key in the chat, and never write one in a file or in a command you run');
    expect(CREDENTIAL).toContain('`<your-token>`');
  });
});

describe('the Preflight, after the restart', () => {
  it('checks the servers with ToolSearch before any task or teammate, whatever the starting prompt says', () => {
    expect(RESTART).toContain('the first thing you do is `ToolSearch`');
    expect(RESTART).toMatch(/before any `TaskCreate` or `Agent` call/);
    expect(RESTART).toMatch(/even when your starting prompt does not ask for it/);
  });

  it('says which servers are ready and which are not, and stops on a server that is still missing', () => {
    expect(RESTART).toMatch(/which are ready and which are not/);
    expect(RESTART).toMatch(/still missing[^.]*is a stop, not a reason to spawn/);
    expect(RESTART).toContain('Pending approval');
  });
});
