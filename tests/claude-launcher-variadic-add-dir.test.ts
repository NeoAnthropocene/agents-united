import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import type { ClaudeCapabilityReport } from '../src/core/types.js';

/**
 * Plan 035 N2 slice (a): `agents start` never delivered its kickoff prompt.
 *
 * `claude --help` (2.1.292) declares `--add-dir <directories...>`: a variadic option takes every following
 * operand until the next token that starts with a dash. The launcher put the prompt right after
 * `--add-dir <workspace>`, so the host took the prompt as a second directory and the input box stayed empty
 * (seen by the maintainer in the second H9 retest, 2026-10-06).
 *
 * `parseLikeHost` models that rule for the flags the launcher emits, after the way the host's option parser
 * is documented to read them: a token `--name=value` carries its own single value and leaves no option open;
 * `--` ends the options. The first test pins the model to the defect on the old argv, so the others cannot
 * pass by a model that is too forgiving.
 */
interface HostParse {
  options: Record<string, string[]>;
  operands: string[];
  unknown: string[];
}

const VARIADIC = ['--add-dir'];
const VALUED = ['--agent', '--plugin-dir'];
const FLAGS = ['--bg'];

function parseLikeHost(argv: string[]): HostParse {
  const parsed: HostParse = { options: {}, operands: [], unknown: [] };
  let open: string | null = null;
  const push = (name: string, value: string): void => {
    (parsed.options[name] ??= []).push(value);
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') {
      parsed.operands.push(...argv.slice(i + 1));
      break;
    }
    if (open !== null && !token.startsWith('-')) {
      push(open, token);
      continue;
    }
    open = null;
    const equals = token.startsWith('--') ? token.indexOf('=') : -1;
    if (equals > 0 && (VARIADIC.includes(token.slice(0, equals)) || VALUED.includes(token.slice(0, equals)))) {
      push(token.slice(0, equals), token.slice(equals + 1));
    } else if (VARIADIC.includes(token)) {
      push(token, argv[++i]);
      open = token;
    } else if (VALUED.includes(token)) {
      push(token, argv[++i]);
    } else if (FLAGS.includes(token)) {
      parsed.options[token] = [];
    } else if (token.startsWith('-')) {
      parsed.unknown.push(token);
    } else {
      parsed.operands.push(token);
    }
  }
  return parsed;
}

describe('Plan 035 N2 slice (a): the kickoff prompt of `agents start` is not taken by a variadic flag', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-claude-launcher-variadic');

  const report = (prefixArgs: string[] = []): ClaudeCapabilityReport => ({
    installed: true,
    version: '2.1.292 (Claude Code)',
    command: prefixArgs.length === 0
      ? { executable: 'claude', prefixArgs: [], source: 'path-executable' }
      : { executable: 'node', prefixArgs, source: 'node-wrapper' },
    pluginSupport: true,
    agentTeamsExperimental: true,
    subagentHandback: true,
    diagnostics: [],
  });

  const plan = (options: Partial<Parameters<ClaudeLauncher['planActivation']>[0]> = {}) =>
    new ClaudeLauncher().planActivation({
      bundleName: 'digital-agency',
      orchestrator: 'orchestrator-digital-agency.md',
      workspace,
      scope: 'project',
      report: report(),
      prompt: 'Draft a launch plan for a flat SaaS.',
      ...options,
    });

  it('the model reads the old argv the way the host did (the defect)', () => {
    const parsed = parseLikeHost(['--agent', 'orchestrator-digital-agency', '--add-dir', '/w', 'KICKOFF']);

    expect(parsed.options['--add-dir']).toEqual(['/w', 'KICKOFF']);
    expect(parsed.operands).toEqual([]);
  });

  it('delivers the bootstrap prompt as the only operand and the workspace as the only added directory', () => {
    const activation = plan();
    const parsed = parseLikeHost(activation.argv);

    expect(parsed.unknown).toEqual([]);
    expect(parsed.options['--add-dir']).toEqual([workspace]);
    expect(parsed.options['--agent']).toEqual(['orchestrator-digital-agency']);
    expect(parsed.operands).toEqual([activation.bootstrapPrompt]);
  });

  it('holds with the background flag, a plugin directory and the teams scaffold together', () => {
    const activation = plan({ background: true, pluginDir: '.agents/plugins/digital-agency', teams: true });
    const parsed = parseLikeHost(activation.argv);

    expect(parsed.unknown).toEqual([]);
    expect(parsed.options['--add-dir']).toEqual([workspace]);
    expect(parsed.options['--plugin-dir']).toEqual(['.agents/plugins/digital-agency']);
    expect(parsed.options['--bg']).toEqual([]);
    expect(parsed.operands).toEqual([activation.bootstrapPrompt]);
  });

  it('holds behind the arguments of a node wrapper, and for a workspace path with a space and an equals sign', () => {
    const odd = path.join(path.parse(workspace).root, 'work space', 'a=b');
    const activation = plan({ workspace: odd, report: report(['/w/node_modules/@anthropic-ai/claude-code/cli.js']) });
    const parsed = parseLikeHost(activation.argv.slice(1));

    expect(parsed.unknown).toEqual([]);
    expect(parsed.options['--add-dir']).toEqual([odd]);
    expect(parsed.operands).toEqual([activation.bootstrapPrompt]);
  });

  it('keeps every value out of a joined command string', () => {
    const activation = plan();

    expect(activation.argv.every(entry => typeof entry === 'string')).toBe(true);
    expect(activation.argv.filter(entry => entry === activation.bootstrapPrompt)).toHaveLength(1);
    expect(activation.argv[activation.argv.length - 1]).toBe(activation.bootstrapPrompt);
  });
});
