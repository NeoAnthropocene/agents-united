import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Three loose ends of the N1 routes (Plan 035 N2 slice d, 2026-10-07), all in the Preflight of the Claude lead, after the generated Contract Floor. The route check
 * (session `fc849108`, Claude Code 2.1.292) showed the refined install question working and three things the text did not yet settle:
 * - the lead recommended the plugin route "so the team survives". The Preflight runs before any teammate exists, so that reason does not hold, and the maintainer
 *   decided on 2026-10-07 that the manual route is the recommended one (pinned versions, the names the roles carry, every environment);
 * - the install question came before any consultation in three of four N1 runs (H9b stopped at the credential first; the manual run loaded `mcp-setup` first);
 * - after `/reload-plugins --force` the lead checked the tools against the host's deferred-tools notice (54 plugin tool names) and made no `ToolSearch` call.
 */

const LEAD = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const AFTER_FLOOR = LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';
const PREFLIGHT = AFTER_FLOOR.slice(AFTER_FLOOR.indexOf('## Preflight: the integrations the plan needs'), AFTER_FLOOR.indexOf('## Run the team'));
const line = (opening: RegExp): string => PREFLIGHT.split('\n').find(candidate => opening.test(candidate)) ?? '';

const INTRO = line(/^Run this once the user has accepted the delegation map/);
const ROUTES = line(/^\*\*Routes\.\*\*/);

describe('the Preflight, the route that is recommended', () => {
  it('finds the introduction and the Routes paragraph, so that no test below passes on an empty match', () => {
    expect(INTRO).not.toBe('');
    expect(ROUTES).not.toBe('');
  });

  it('marks the manual option as the recommended one and gives pinned versions and stable names as the reason', () => {
    expect(ROUTES).toContain('Mark the manual option "(Recommended)" and give its reason: pinned versions and the tool names the roles carry');
  });

  it('never recommends the plugin route because the team would be lost, since no teammate exists at the Preflight, and quotes the run that did', () => {
    expect(ROUTES).toContain('never recommend the plugin route to save a team: the Preflight runs before any teammate exists');
    expect(ROUTES).toContain('"so the team survives"');
  });

  it('keeps the plugin option as the no-restart choice, and the user who said they do not want a restart gets it unasked', () => {
    expect(ROUTES).toContain('plugin (no restart: the user types `/reload-plugins --force`; it floats with the plugin\'s version)');
    expect(ROUTES).toContain('a user who has already said they do not want to restart gets the plugin route without being asked');
  });
});

describe('the Preflight, the consultation comes before the install question', () => {
  it('asks the install question after the consultation and the accepted map, never before', () => {
    expect(INTRO).toContain('The install question comes after the consultation and the accepted map, never before');
  });

  it('does not let an obvious missing integration stand in for the consultation: name it in the mode line, consult, then ask', () => {
    expect(INTRO).toContain('a missing integration that the brief makes obvious is not a reason to skip the consultation: name it in the mode line, consult first');
    expect(INTRO).toMatch(/observed in three of four N1 runs/);
  });
});

describe('the Preflight, the check after the reload', () => {
  it('says the deferred-tools notice is not the check, and that the lead calls ToolSearch itself and says what came back', () => {
    expect(ROUTES).toContain('A deferred-tools notice that follows the reload is not the check');
    expect(ROUTES).toContain('call `ToolSearch` for each integration yourself, before any `TaskCreate` or `Agent` call, and say what it returned');
    expect(ROUTES).toMatch(/54 plugin tool names/);
  });
});
