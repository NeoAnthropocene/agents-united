import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { splitTools } from '../src/core/native-guard.js';
import { describeMarketingRole, OUT_OF_DEPARTMENT_HANDOFF } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `seo-specialist`: the second native file on the core the digital agency's SEO specialist stands on, in the Tier 1 form of `devops-engineer`, for the `seo-content-marketing` add-on.
 * What every marketing specialist keeps is in tests/helpers/native-marketing-role.ts (here with the shell and the add-on switched on); this file holds what only the SEO specialist says.
 * It is the one marketing role that holds a shell: its core grants the shell class, so it crawls with `curl` and runs Lighthouse, and the guard it carries blocks what the Boundaries section says.
 */

describeMarketingRole({
  role: 'seo-specialist',
  type: 'subagent-seo-specialist',
  agency: 'agency-seo-specialist',
  servers: ['firecrawl', 'chrome-devtools-mcp'],
  artifact: false,
  peers: ['marketing-content-strategist', 'marketing-growth-strategist', 'marketing-conversion-specialist'],
  returns: 'the audit report, the snippets',
  shell: true,
  bundle: 'seo-content-marketing',
});

const text = (): string => nativeText('seo-specialist');
const floorOf = (source: string): string => /<!-- agents-united:floor:start[\s\S]*?<!-- agents-united:floor:end -->/.exec(source)![0];
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';

describe('native seo-specialist: the same core and the same floor as the Tier 2 copy', () => {
  it('has the floor of agency-seo-specialist verbatim: the core is shared, so the floor is too', () => {
    expect(floorOf(text())).toBe(floorOf(nativeText('agency-seo-specialist')));
  });

  it('holds the shell, the web and the two crawl and measure servers of its canonical agent', () => {
    const tools = splitTools(/^tools: (.*)$/m.exec(text())![1]!);
    expect(tools).toEqual(expect.arrayContaining(['Bash', 'PowerShell', 'WebFetch', 'WebSearch', 'mcp__firecrawl', 'mcp__chrome-devtools-mcp']));
    const canonical = fs.readFileSync(path.resolve('registry/agents/subagent-seo-specialist.md'), 'utf8').replace(/\r\n/g, '\n');
    const front = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(canonical)![1]!) as { mcpServers: Array<{ name: string }> };
    expect(front.mcpServers.map(server => server.name).sort()).toEqual(['chrome-devtools-mcp', 'firecrawl']);
  });
});

describe('native seo-specialist: reconnaissance before any recommendation', () => {
  it('crawls and reads the indexation sources first, with the crawler it holds and a header trace through the shell as the fallback', () => {
    expect(step(1)).toMatch(/^1\. \*\*Crawl and indexation reconnaissance first\.\*\* Do it before you recommend anything\./);
    expect(step(1)).toContain('`mcp__firecrawl`');
    expect(step(1)).toContain('`curl -IL`');
    expect(step(1)).toContain('a staging site served without `noindex`');
  });

  it('keeps the metadata numbers of the core in the page-architecture step', () => {
    expect(step(3)).toContain('a title of 50 to 60 characters and a description of 120 to 155');
    expect(step(3)).toContain('an explicit canonical on every indexable page and an explicit robots directive on staging and admin routes');
  });

  it('checks every structured-data block against the rich-result requirements and puts no unsupported value in it', () => {
    expect(step(4)).toContain('Check every structured-data block against the rich-result requirements of its page type');
    expect(step(4)).toContain('put no value in it that the visible page and a real source do not support');
  });

  it('measures Core Web Vitals with the browser server or Lighthouse from the shell, and judges them at the 75th percentile', () => {
    expect(step(5)).toContain('`mcp__chrome-devtools-mcp`');
    expect(step(5)).toContain('run Lighthouse from `Bash`');
    expect(step(5)).toContain('Judge the results against the 75th-percentile thresholds in the floor, not against a single lab run');
  });
});

describe('native seo-specialist: build inputs go back to the lead', () => {
  it('hands the metadata, JSON-LD, rendering and header recipes and the Web Vitals fixes back to orchestrator-marketing as a fixed input, naming no engineering role', () => {
    expect(step(6)).toContain('Hand the metadata, the JSON-LD, the server-side rendering or canonical-header recipe and the Core Web Vitals fixes back to `orchestrator-marketing` as a fixed input for whoever builds the page (the user\'s implementation team)');
    expect(step(6)).toContain('Every finding carries a severity (critical, major or minor) and a concrete remediation');
    expect(text().split('<!-- agents-united:floor:end -->')[1]!.replace(OUT_OF_DEPARTMENT_HANDOFF, '')).not.toMatch(/engineering (role|team)|frontend|backend/i);
  });

  it('leaves application code to whoever builds the page and topic clusters to the content strategist, through the lead', () => {
    expect(section('Boundaries of this host')).toContain('- Stay analysis-first: the schema and metadata snippets are your deliverables, and application code belongs to whoever builds the page. Topic clusters are `marketing-content-strategist`\'s: ask through the lead.');
  });
});

describe('native seo-specialist: the guard and the shell, as the Boundaries section says', () => {
  it('opens the Boundaries with the shell and the guard sentence, word for word', () => {
    expect(section('Boundaries of this host')).toContain('- You hold a shell. Run crawls, header traces and Lighthouse with `Bash`. A guard blocks `git push --force` and `-f` (not `--force-with-lease`), `vercel --prod`, `.env` files (not `.env.example`) written with an editing tool or a `>` redirect, and the common forms of destructive shell commands (a recursive delete of a root, home or project folder, privilege escalation, shutdown, disk formatting, cloud resource-group, project or account deletion); it is a seat belt, not a boundary. As a subagent it comes from this file, when the host runs this file\'s hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case. Apart from that and a call whose input it cannot read, it enforces nothing, so the rules in your Safety section are your own obligation. Never try to get around it.');
  });

  it('carries nothing of the media-planning consultation that belongs to the digital agency copy', () => {
    expect(text()).not.toMatch(/Media planning|Media Request|motion|sound design/i);
  });
});

describe('native seo-specialist: the skill table is the five SEO skills of the add-on', () => {
  it('names exactly the skills the Tier 2 copy loads, all of them in seo-content-marketing', () => {
    const skills = (source: string): string[] => [...source.matchAll(/^\| [^|]+ \| `([a-z0-9-]+)` \|/gm)].map(match => match[1]!).sort();
    expect(skills(text())).toEqual(['debug-optimize-lcp', 'programmatic-seo', 'schema-markup-strategy', 'seo-audit', 'technical-seo-audit']);
    expect(skills(text())).toEqual(skills(nativeText('agency-seo-specialist')));
  });
});

describe('native seo-specialist: the hand-off outside the department', () => {
  it('carries the one sentence that sends a hand-off to a role outside marketing through the lead', () => {
    const body = nativeText('seo-specialist').split('<!-- agents-united:floor:end -->')[1]!;
    expect(body).toContain(OUT_OF_DEPARTMENT_HANDOFF);
    expect(body.split(OUT_OF_DEPARTMENT_HANDOFF).length).toBe(2);
  });
});
