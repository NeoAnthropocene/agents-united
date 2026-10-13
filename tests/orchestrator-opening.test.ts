import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The opening of a Tier-2 orchestrator (ADR 0053, 2026-10-13).
 *
 * The maintainer, after Sittings R to U of the digital-agency lead: the welcome message of the Tier-2 orchestrator "cause more damage than the harm it brings to us". It is to be removed for
 * digital-agency "and the other tier-2 bundle orchestrator agents too in the future", and replaced by the Operation Mode information as the first message. The welcome lived in four places: the
 * `<mandatory_first_turn_response>` of the canonical definition ("Welcome! I'm Chris" and a roster), the Claude lead's "Under the line, introduce yourself as Chris and name your team", and the default
 * kickoff of each launcher ("Please introduce your coordinator role to the user and ask for their first task."). What a Tier-2 orchestrator opens with is its Operation Mode information (the Tri-Tier mode
 * and what is callable or missing); this suite keeps a welcome out of every Tier-2 orchestrator that has a definition of its own, including the ones that do not exist yet: it reads the bundle registry.
 */

const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8').replace(/\r\n/g, '\n');
const registry = JSON.parse(read('registry/bundles.json')) as { bundles: Record<string, { tier: string; orchestrator?: string }> };
const bundles = Object.entries(registry.bundles);
const domainOrchestrators = new Set(bundles.filter(([, bundle]) => bundle.tier === 'domain').map(([, bundle]) => bundle.orchestrator));
// A Tier-2 orchestrator with a definition of its own. The mock organization bundle borrows the universal orchestrator, which a domain bundle uses too, so the rule is not asked of it.
const tier2 = bundles
  .filter(([, bundle]) => bundle.tier === 'organization' && bundle.orchestrator && !domainOrchestrators.has(bundle.orchestrator))
  .map(([name, bundle]) => ({ name, file: bundle.orchestrator! }));
const WELCOME = /welcome|👋|your (?:specialist )?team|delegation-first|introduce (?:yourself|your)|\bI['’]m Chris\b|\bI am Chris\b/i;
const firstTurnBlock = (text: string): string => /<mandatory_first_turn_response>([\s\S]*?)(?=<\/mandatory_first_turn_response>|\n## )/.exec(text)?.[1] ?? '';

describe('the opening of a Tier-2 orchestrator is its Operation Mode information, never a welcome (ADR 0053)', () => {
  it('finds the Tier-2 orchestrators that have a definition of their own, so that no test below passes on an empty list', () => {
    expect(tier2.map(entry => entry.file)).toContain('orchestrator-digital-agency.md');
  });

  for (const { name, file } of tier2) {
    describe(`${name} (${file})`, () => {
      const text = read(`registry/agents/${file}`);
      const block = firstTurnBlock(text);

      it('has a first-turn block that makes the Operation Mode information the first message, before anything is asked, consulted or spawned', () => {
        expect(block).not.toBe('');
        expect(block).toMatch(/Your first message in any session[^\n]*is the Operation Mode information/);
        expect(block).toMatch(/before you ask the user anything, consult a specialist or spawn anyone/);
        expect(block).toContain('Operational Mode:');
        expect(block).toContain('Live Integrations:');
      });

      it('says there is no welcome, and names what is left out', () => {
        expect(block).toContain('**No welcome.**');
        expect(block).toMatch(/Do not greet the user, do not welcome them, do not introduce yourself, and do not list the team or describe what you can do, unless they ask/);
        expect(block).toMatch(/If the user only says hello/);
      });

      it('carries no welcome, no greeting emoji and no roster blurb in the block', () => {
        const withoutRule = block.split('\n').filter(line => !line.includes('**No welcome.**')).join('\n');

        expect(withoutRule).not.toMatch(WELCOME);
        expect(text).not.toContain('👋');
        expect(text).not.toContain('Welcome!');
      });

      it('does not tell the lead to greet the user elsewhere in the definition', () => {
        const withoutRule = text.split('\n').filter(line => !line.includes('**No welcome.**')).join('\n');

        expect(withoutRule).not.toMatch(/greet the user/i);
      });
    });
  }

  describe('the native Claude orchestrators', () => {
    const dir = 'registry/hosts/claude/agents';
    const files = fs.readdirSync(path.resolve(dir)).filter(file => file.startsWith('orchestrator-') && file.endsWith('.md'));

    it('finds the native orchestrators, so that no test below passes on an empty list', () => {
      expect(files).toContain('orchestrator-digital-agency.md');
    });

    for (const file of files) {
      const text = read(`${dir}/${file}`);
      const section = /\n## The first message[^\n]*\n([\s\S]*?)(?=\n## )/.exec(text)?.[1];

      it(`${file} does not tell the lead to introduce itself or to name its team`, () => {
        expect(text).not.toMatch(/introduce yourself/i);
        expect(text).not.toMatch(/name your team/i);
      });

      if (section) {
        it(`${file}: the section "The first message" has the No welcome paragraph, with the examples that the lead was seen to ignore`, () => {
          expect(section).toContain('**No welcome.**');
          expect(section).toContain('(no "I\'m Chris", no "your digital agency lead")');
        });
      }
    }
  });

  describe('the launchers of the three hosts', () => {
    for (const file of ['claude-launcher.ts', 'cline-launcher.ts', 'antigravity-launcher.ts']) {
      it(`${file}: with no task typed, the kickoff asks the user for their first task and asks the coordinator to introduce nothing`, () => {
        const source = read(`src/core/${file}`);

        expect(source).toContain("'Please ask the user for their first task.'");
        expect(source).not.toMatch(/introduce your coordinator role/);
        expect(source).not.toMatch(/before the introduction/);
      });
    }
  });

  describe('the decision (ADR 0053)', () => {
    const name = fs.readdirSync(path.resolve('docs/adr')).find(file => file.startsWith('0053-'));
    const adr = name ? read(`docs/adr/${name}`) : '';

    it('exists as ADR 0053, with the maintainer\'s words and the places where the welcome lived', () => {
      expect(name).toBeDefined();
      expect(adr).toMatch(/^# ADR 0053: /);
      expect(adr).toContain('cause more damage than the harm it brings to us');
      for (const place of ['mandatory_first_turn_response', 'Under the line, introduce yourself as Chris', 'Please introduce your coordinator role', 'agents start']) expect(adr, place).toContain(place);
    });

    it('says what the opening of a Tier-2 orchestrator is, and that a new Tier-2 orchestrator follows the rule (this suite reads the bundle registry)', () => {
      expect(adr).toMatch(/Operation Mode information/);
      expect(adr).toMatch(/tests\/orchestrator-opening\.test\.ts/);
      expect(adr).toMatch(/other Tier-2 (?:bundle )?orchestrators? in the future|every Tier-2 orchestrator/i);
    });

    it('records the trials of 2026-10-13: the line first, written from the start list, disagreed with the searches of the lead in 4 of 15 runs, and the order of ADR 0051 plus the wait for the transcript is what it keeps', () => {
      expect(adr).toMatch(/4 of 15/);
      expect(adr).toContain('claude_ai_Firecrawl');
      expect(adr).toMatch(/settings-level hook/);
    });

    it('lifts the refusal of ADR 0044 and ADR 0051 to wait inside the hook, for the one reason and with the one limit: only the line releases a call', () => {
      expect(adr).toContain('No sleep or polling loop is added');
      expect(adr).toMatch(/only the line in the saved transcript releases a call/);
      expect(adr).toContain('AGENTS_UNITED_MODE_LINE_WAIT_MS');
      expect(read('docs/adr/0044-release-the-mode-line-gate-only-on-recorded-evidence.md')).toMatch(/Amended in part by ADR 0053/);
      expect(read('docs/adr/0051-the-lead-writes-its-mode-line-before-its-first-gated-call.md')).toMatch(/ADR 0053/);
    });

    // The cap was 10 s in the first version and the maintainer chose 8 s on 2026-10-13: every place that names it must say what the hook's default is.
    it('names the cap of the wait that the hook has, in the ADR, in the pointer of ADR 0044 and in the failure line of H11', () => {
      const hook = read('registry/hosts/claude/hooks/agents-united-mode-line-gate.js');
      const ms = Number(/AGENTS_UNITED_MODE_LINE_WAIT_MS \|\| (\d+)/.exec(hook)?.[1]);
      const seconds = ms / 1000;
      const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][seconds];

      expect(Number.isInteger(seconds) && words !== undefined).toBe(true);
      expect(adr).toContain(`for up to ${seconds} s (`);
      expect(adr).toContain(`The cap is ${seconds} s, the maintainer's choice on 2026-10-13`);
      expect(adr).toContain(`within ${words} seconds`);
      expect(adr).toContain(`up to ${words} seconds at each of its first two holds`);
      expect(read('docs/adr/0044-release-the-mode-line-gate-only-on-recorded-evidence.md')).toContain(`for up to ${words} seconds (the maintainer's choice)`);
      expect(read('docs/live-test-protocol.md')).toContain(`after a wait of ${words} seconds`);
    });

    it('is in the domain dictionary: the Operation Mode information is the opening of a Tier-2 orchestrator', () => {
      expect(read('CONTEXT.md')).toMatch(/\*\*Operation Mode information\*\*/);
    });
  });
});
