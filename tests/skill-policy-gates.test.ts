import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateRewrittenSkill } from '../src/core/skill-contract.js';
import { checkSkillLayout, supportingText } from '../src/core/skill-layout.js';
import * as skillLicenceLint from '../src/core/skill-licence-lint.js';

/**
 * Plan 033 P9 (skill policies), slice A: the gates behind `agents skill-check` become able to
 * serve the `private-owner` and `adapted-source` policies without changing what any existing
 * caller gets.
 *
 * - `validateRewrittenSkill` gains an optional `{ requireProjectAuthor, forbidSource }` fourth
 *   parameter whose defaults keep today's result for every input, and stops raising on front
 *   matter that is not a mapping or on a `description` that is not a string.
 * - `checkSkillLayout` stops raising on an `evals/evals.json` that is not valid JSON, not an
 *   object, has a non-array `evals` value or null entries, and on front matter that is not a
 *   mapping; findings collected before the defect stay.
 * - `supportingText` gains `{ excludeTopLevelNotices }` so top-level licence and notice prose
 *   cannot satisfy the worked-example, anti-pattern, evidence and hand-off checks.
 * - `lintSkillPolicyLicence` (new, pure, no file reads) enforces the licence rules of the two
 *   new policies.
 *
 * Every `today` array below was captured from the pre-change gates before any code changed:
 * an input that already produced findings must keep producing exactly those findings.
 */

const NAME = 'sample-skill';
const BODY = '\n# Sample Skill\n\n## Overview & Purpose\nText.\n\n## Execution Triggers\nText.\n\n## Input/Output Requirements\nEvidence to produce: a table.\n\n## Step-by-Step Runbook\nHand off the result to Kaan.\n\n## Code & Config Exemplars\n### Worked example\nNumbers.\n\nAnti-patterns: none.\n\n## Edge Cases & Error Recovery\nText.\n\n## Verification Checklist\n- [ ] Text.\n';
const DESC = 'description: A sample skill that explains, for one role, when and how to do one thing well.';
const GOOD = `---\nname: ${NAME}\n${DESC}\nmetadata:\n  author: agents-united\n  version: 3.0.0\n---\n${BODY}`;
const SUPPORT = 'some supporting text with evidence';
const BAD_AUTHOR = GOOD.replace('author: agents-united', 'author: someone-else');
const BAD_AUTHOR_SOURCE = GOOD.replace('author: agents-united', 'author: someone-else\n  source: https://example.com/x');
const BAD_SECTION = GOOD.replace('## Edge Cases & Error Recovery', '## Other');
const BAD_SECTION_AUTHOR = BAD_SECTION.replace('author: agents-united', 'author: someone-else');
const NAME42 = GOOD.replace(`name: ${NAME}`, 'name: 42');
const DESC_SHORT = GOOD.replace(DESC, 'description: short');
const DESC_NULL = GOOD.replace(DESC, 'description: null');
const DESC_ARRAY = GOOD.replace(DESC, 'description: [say, two, words]');
const DESC_NUMBER = GOOD.replace(DESC, 'description: 123');
const FM_STRING = `---\njust a plain string\n---\n${BODY}`;
const FM_LIST = `---\n- one\n- two\n---\n${BODY}`;
const FM_TILDE = `---\n~\n---\n${BODY}`;
const FM_EMPTY = `---\n\n---\n${BODY}`;
const YAML_BROKEN = `---\nmeta: [1, 2\n---\n${BODY}`;
const YAML_DUP_NAME = `---\nname: ${NAME}\nname: second-name\n${DESC}\nmetadata:\n  author: agents-united\n  version: 3.0.0\n---\n${BODY}`;
describe('the contract gate: policy options (requireProjectAuthor, forbidSource)', () => {
  /** The planned behaviour of the options; the `today` arrays are the findings captured from the gates before any code changed. */
  const CASES: Array<[string, string, string[]]> = [
    ['a valid skill', GOOD, []],
    ['an author finding', BAD_AUTHOR, ['sample-skill: metadata.author must be agents-united']],
    ['an author and a source finding', BAD_AUTHOR_SOURCE, [
      'sample-skill: metadata.author must be agents-united',
      'sample-skill: original work carries no metadata.source',
    ]],
    ['a missing section', BAD_SECTION, ['sample-skill: missing section "## Edge Cases & Error Recovery"']],
    ['an author finding and a missing section', BAD_SECTION_AUTHOR, [
      'sample-skill: metadata.author must be agents-united',
      'sample-skill: missing section "## Edge Cases & Error Recovery"',
    ]],
    ['a front matter name that is not a string', NAME42, ['sample-skill: front matter name is 42']],
    ['a too-short description', DESC_SHORT, ['sample-skill: description must be 40 to 1,024 characters, is 5']],
    ['a null description', DESC_NULL, ['sample-skill: description must be 40 to 1,024 characters, is 0']],
    ['front matter that parses to a plain string', FM_STRING, [
      'sample-skill: front matter name is undefined',
      'sample-skill: description must be 40 to 1,024 characters, is 0',
      'sample-skill: metadata.author must be agents-united',
    ]],
    ['front matter that parses to a list', FM_LIST, [
      'sample-skill: front matter name is undefined',
      'sample-skill: description must be 40 to 1,024 characters, is 0',
      'sample-skill: metadata.author must be agents-united',
    ]],
  ];

  it('returns today\'s exact findings for valid and invalid skills when called with no options', () => {
    for (const [label, content, today] of CASES) {
      expect(validateRewrittenSkill(NAME, content), label).toEqual(today);
    }
  });

  it('gives the same result for a call with no optional argument, an explicit support text, and an explicit default options object', () => {
    for (const [label, content] of CASES) {
      expect(validateRewrittenSkill(NAME, content, ''), label).toEqual(validateRewrittenSkill(NAME, content));
      expect(validateRewrittenSkill(NAME, content, '', {}), label).toEqual(validateRewrittenSkill(NAME, content, ''));
      expect(validateRewrittenSkill(NAME, content, SUPPORT), label).toEqual(validateRewrittenSkill(NAME, content, SUPPORT));
      expect(validateRewrittenSkill(NAME, content, SUPPORT, {}), label).toEqual(validateRewrittenSkill(NAME, content, SUPPORT));
      expect(validateRewrittenSkill(NAME, content, SUPPORT, { requireProjectAuthor: true, forbidSource: true }), label)
        .toEqual(validateRewrittenSkill(NAME, content, SUPPORT));
    }
  });

  it('requireProjectAuthor: false drops only the metadata.author finding', () => {
    expect(validateRewrittenSkill(NAME, BAD_AUTHOR, '', { requireProjectAuthor: false })).toEqual([]);
    expect(validateRewrittenSkill(NAME, BAD_AUTHOR, '', { requireProjectAuthor: false, forbidSource: true })).toEqual([]);
    expect(validateRewrittenSkill(NAME, BAD_AUTHOR_SOURCE, '', { requireProjectAuthor: false }))
      .toEqual(['sample-skill: original work carries no metadata.source']);
    expect(validateRewrittenSkill(NAME, BAD_SECTION_AUTHOR, '', { requireProjectAuthor: false }))
      .toEqual(['sample-skill: missing section "## Edge Cases & Error Recovery"']);
    expect(validateRewrittenSkill(NAME, GOOD, '', { requireProjectAuthor: false })).toEqual([]);
  });

  it('forbidSource: false drops only the metadata.source finding', () => {
    expect(validateRewrittenSkill(NAME, BAD_AUTHOR_SOURCE, '', { forbidSource: false }))
      .toEqual(['sample-skill: metadata.author must be agents-united']);
    expect(validateRewrittenSkill(NAME, BAD_AUTHOR_SOURCE, '', { requireProjectAuthor: false, forbidSource: false })).toEqual([]);
    expect(validateRewrittenSkill(NAME, BAD_AUTHOR, '', { forbidSource: false }))
      .toEqual(['sample-skill: metadata.author must be agents-united']);
    expect(validateRewrittenSkill(NAME, GOOD, '', { forbidSource: false })).toEqual([]);
  });

  it('drops both findings together for an authored-outside skill that carries an upstream source', () => {
    const adapted = GOOD.replace('author: agents-united', 'author: someone-else\n  source: https://github.com/example/skills/tree/30d4553ecd46fbc5212fd0ff006ae43af522158b/skills/demo');
    expect(validateRewrittenSkill(NAME, adapted, '', { requireProjectAuthor: false, forbidSource: false })).toEqual([]);
    expect(validateRewrittenSkill(NAME, adapted, SUPPORT, { requireProjectAuthor: false, forbidSource: false })).toEqual([]);
  });
});
describe('the contract gate: malformed front matter and metadata find defects instead of raising', () => {
  it('reports front matter that parses to null instead of a mapping', () => {
    const expected = [
      'sample-skill: front matter is not a YAML mapping',
      'sample-skill: front matter name is undefined',
      'sample-skill: description must be 40 to 1,024 characters, is 0',
      'sample-skill: metadata.author must be agents-united',
    ];
    expect(validateRewrittenSkill(NAME, FM_TILDE)).toEqual(expected);
    expect(validateRewrittenSkill(NAME, FM_EMPTY)).toEqual(expected);
    expect(validateRewrittenSkill(NAME, FM_TILDE, '', { requireProjectAuthor: false })).toEqual([
      'sample-skill: front matter is not a YAML mapping',
      'sample-skill: front matter name is undefined',
      'sample-skill: description must be 40 to 1,024 characters, is 0',
    ]);
    expect(validateRewrittenSkill(NAME, FM_TILDE, '', { forbidSource: false })).toEqual(expected);
  });

  it('reports front matter that is not valid YAML, keeping the metadata findings', () => {
    const broken: Array<[string, string]> = [['a broken flow sequence', YAML_BROKEN], ['a duplicated key', YAML_DUP_NAME]];
    for (const [label, content] of broken) {
      const joined = validateRewrittenSkill(NAME, content).join('\n');
      expect(joined, label).toContain('front matter is not valid YAML');
      expect(joined, label).toContain('front matter name is undefined');
      expect(joined, label).toContain('description must be 40 to 1,024 characters, is 0');
      expect(joined, label).toContain('metadata.author must be agents-united');
    }
  });

  it('reports a description that is not a string', () => {
    const expected = ['sample-skill: description must be 40 to 1,024 characters, is 0'];
    expect(validateRewrittenSkill(NAME, DESC_ARRAY)).toEqual(expected);
    expect(validateRewrittenSkill(NAME, DESC_NUMBER)).toEqual(expected);
    expect(validateRewrittenSkill(NAME, DESC_ARRAY, '', { requireProjectAuthor: false })).toEqual(expected);
  });
});

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A candidate folder named "demo" under a fresh folder in the OS temp directory, removed afterwards. */
function tmpSkill(files: Record<string, string>): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-policy-gates-')));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, 'demo', rel)), { recursive: true });
    fs.writeFileSync(path.join(root, 'demo', rel), text);
  }
  return root;
}

const FM = '---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it, show the layout. Skip it when there is nothing to demo."\n---\n# Demo\n';
const EVALS = JSON.stringify({
  skill_name: 'demo',
  evals: [
    { id: 1, prompt: 'a realistic prompt long enough to count as one for the demo skill', expected_output: 'a described outcome that is long enough to be a real expectation' },
    { id: 2, prompt: 'another realistic prompt, differently worded, for the demo skill too', expected_output: 'another described outcome that is long enough to be a real expectation' },
  ],
});
const OK_ENTRY = { id: 1, prompt: 'a realistic prompt long enough to count as one for the demo skill', expected_output: 'a described outcome that is long enough to be a real expectation' };
describe('the layout gate: evals robustness', () => {
  const KEPT: Array<[string, string, string[]]> = [
    ['a JSON array document', '[1,2]', ['demo: evals skill_name is undefined', 'demo: 0 evals (want 2 to 5)']],
    ['a JSON string document', '"hello"', ['demo: evals skill_name is undefined', 'demo: 0 evals (want 2 to 5)']],
    ['a null evals value', '{"skill_name":"demo","evals":null}', ['demo: 0 evals (want 2 to 5)']],
    ['string eval entries', '{"skill_name":"demo","evals":["x","y"]}', [
      'demo: an eval has no numeric id',
      'demo: eval undefined prompt is too short to be realistic',
      'demo: eval undefined has no expected_output',
      'demo: an eval has no numeric id',
      'demo: eval undefined prompt is too short to be realistic',
      'demo: eval undefined has no expected_output',
      'demo: duplicate eval prompts',
    ]],
  ];

  it('keeps today\'s exact findings for an evals document that already produced findings', () => {
    for (const [label, evalsJson, today] of KEPT) {
      expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': evalsJson }), 'demo'), label).toEqual(today);
    }
  });

  it('reports evals that are not valid JSON and keeps the findings collected before the defect', () => {
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': '{' }), 'demo'))
      .toEqual(['demo: evals/evals.json is not valid JSON']);
    const withEarlierFinding = '---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it, show the layout. Skip it when there is nothing to demo."\nwhen_to_use: "Trigger phrases: use it."\n---\nbody\n';
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': withEarlierFinding, 'evals/evals.json': '{' }), 'demo')).toEqual([
      'demo: do not use when_to_use yet; put the trigger phrases in the description',
      'demo: evals/evals.json is not valid JSON',
    ]);
  });

  it('reports an evals document that is JSON null', () => {
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': 'null' }), 'demo'))
      .toEqual(['demo: evals/evals.json is not a JSON object']);
  });

  it('reports an evals value that is not an array and does not run the entry checks on it', () => {
    const expected = ['demo: evals is not an array (evals/evals.json must hold a list of eval objects)'];
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': '{"skill_name":"demo","evals":5}' }), 'demo')).toEqual(expected);
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': '{"skill_name":"demo","evals":{}}' }), 'demo')).toEqual(expected);
  });

  it('reports null eval entries and keeps the count finding and the other entries', () => {
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': '{"skill_name":"demo","evals":[null,null]}' }), 'demo')).toEqual([
      'demo: an eval is not an object (each entry must be a JSON object)',
      'demo: an eval is not an object (each entry must be a JSON object)',
    ]);
    const mixed = JSON.stringify({ skill_name: 'demo', evals: [null, OK_ENTRY] });
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': mixed }), 'demo'))
      .toEqual(['demo: an eval is not an object (each entry must be a JSON object)']);
    const lone = '{"skill_name":"demo","evals":[null]}';
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': lone }), 'demo')).toEqual([
      'demo: 1 evals (want 2 to 5)',
      'demo: an eval is not an object (each entry must be a JSON object)',
    ]);
  });
});

describe('the layout gate: front-matter robustness', () => {
  it('keeps today\'s exact findings for front matter that parses to a list', () => {
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': '---\n- a\n- b\n---\n# Demo\n', 'evals/evals.json': EVALS }), 'demo')).toEqual([
      'demo: unknown front matter key "0" (Claude Code ignores it silently)',
      'demo: unknown front matter key "1" (Claude Code ignores it silently)',
      'demo: description must lead with the key use case ("Use when ...")',
      'demo: the description lists no trigger phrases',
      'demo: the description says nothing about when to skip the skill',
    ]);
  });

  it('reports front matter that parses to null instead of a mapping', () => {
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': '---\n~\n---\n# Demo\n', 'evals/evals.json': EVALS }), 'demo')).toEqual([
      'demo: front matter is not a YAML mapping',
      'demo: description must lead with the key use case ("Use when ...")',
      'demo: the description lists no trigger phrases',
      'demo: the description says nothing about when to skip the skill',
    ]);
  });
});
describe('supportingText: top-level licence and notice prose', () => {
  const folder = () => path.join(tmpSkill({
    'SKILL.md': '# Demo skill body\n',
    'NOTICE.md': 'top notice prose\n',
    'LICENSE.md': 'top licence prose\n',
    'LICENCE.md': 'top licence alt prose\n',
    'LICENSE': 'a bare licence file without a markdown extension\n',
    'LICENSE.txt': 'a plain-text licence file\n',
    'references/NOTICE.md': 'sub notice prose\n',
    'references/LICENSE.md': 'sub licence prose\n',
    'examples/a.md': 'an example with a worked example inside\n',
  }), 'demo');

  it('includes top-level notice and licence markdown today', () => {
    const text = supportingText(folder());
    expect(text).toContain('top notice prose');
    expect(text).toContain('top licence prose');
    expect(text).toContain('top licence alt prose');
    expect(text).toContain('sub notice prose');
    expect(text).toContain('sub licence prose');
    expect(text).toContain('an example with a worked example inside');
    expect(text).not.toContain('# Demo skill body');
  });

  it('is unchanged by an explicit default options object', () => {
    const dir = folder();
    expect(supportingText(dir, {})).toBe(supportingText(dir));
    expect(supportingText(dir, { excludeTopLevelNotices: false })).toBe(supportingText(dir));
  });

  it('excludeTopLevelNotices leaves out only the top-level NOTICE.md and LICEN[CS]E files', () => {
    const text = supportingText(folder(), { excludeTopLevelNotices: true });
    expect(text).not.toContain('top notice prose');
    expect(text).not.toContain('top licence prose');
    expect(text).not.toContain('top licence alt prose');
    expect(text).toContain('sub notice prose');
    expect(text).toContain('sub licence prose');
    expect(text).toContain('an example with a worked example inside');
  });
});

const { lintSkillPolicyLicence } = skillLicenceLint;
const SHA = '30d4553ecd46fbc5212fd0ff006ae43af522158b';
const SOURCE = `https://github.com/example/skills/tree/${SHA}/skills/demo`;
const NOTICE = `Adapted from upstream at ${SHA} under Apache-2.0; what changed: the runbook was compacted into references/.`;
const file = (p: string, bytes = 100): { path: string; bytes: number } => ({ path: p, bytes });

describe('lintSkillPolicyLicence: what both policies refuse', () => {
  it('reports a missing license identifier', () => {
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', files: [file('SKILL.md')] }))
      .toEqual(['Skill "x": metadata.license is missing; the private-owner policy needs a declared licence identifier.']);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', files: [file('SKILL.md')] }))
      .toEqual(['Skill "x": metadata.license is missing; the adapted-source policy needs a declared licence identifier.']);
  });

  it('reuses the blocked and unclassified findings of lintSkillLicence for both policies', () => {
    for (const policy of ['private-owner', 'adapted-source'] as const) {
      expect(lintSkillPolicyLicence(policy, { dirName: 'x', license: 'GPL-3.0-only', files: [file('SKILL.md')] })).toEqual([
        'Skill "x": licence "GPL-3.0-only" is blocked (NonCommercial, NoDerivatives or GPL-family) and may not be vendored.',
      ]);
      expect(lintSkillPolicyLicence(policy, { dirName: 'x', license: 'Made-Up-1.0', files: [file('SKILL.md')] })).toEqual([
        'Skill "x": licence "Made-Up-1.0" is not an SPDX identifier this catalog has classified; add it to src/core/skill-licence-lint.ts first.',
      ]);
    }
  });
});
describe('lintSkillPolicyLicence: private-owner (an original Skill by another author)', () => {
  it('accepts permissive licences with no licence-file, source or notice requirement', () => {
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MIT', files: [file('SKILL.md')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'Apache-2.0', files: [file('SKILL.md')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MIT', source: 'https://example.com/somewhere', files: [file('SKILL.md')] })).toEqual([]);
  });

  it('requires a non-empty top-level licence file for weak-copyleft and share-alike licences', () => {
    const finding = ['Skill "x": MPL-2.0 content must carry its licence file (LICENSE) in the skill folder.'];
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('SKILL.md')] })).toEqual(finding);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('LICENSE', 0)] })).toEqual(finding);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('references/LICENSE.md')] })).toEqual(finding);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('LICENSE')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('references\\LICENSE.md')] })).toEqual(finding);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('LICENCE.md')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'MPL-2.0', files: [file('LICENSE.txt')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'CC-BY-SA-4.0', files: [file('license')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: 'CC-BY-SA-4.0', files: [file('LICENSE'), file('NOTICE.md')] })).toEqual([]);
  });

  it('refuses a source-available licence, which only fits an upstream vendor\'s optional add-on', () => {
    expect(lintSkillPolicyLicence('private-owner', {
      dirName: 'x', license: 'LicenseRef-Remotion', source: SOURCE, files: [file('LICENSE'), file('NOTICE.md')], noticeText: 'ignored for private-owner',
    })).toEqual([
      'Skill "x": licence "LicenseRef-Remotion" is source-available (an upstream vendor\'s optional add-on tier) and is refused for a privately owned original skill.',
    ]);
  });
});
describe('lintSkillPolicyLicence: adapted-source (a Skill adapted from a pinned upstream commit)', () => {
  it('requires the upstream licence file on every tier, including MIT', () => {
    const finding = ['Skill "x": MIT content must carry its licence file (LICENSE) in the skill folder.'];
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('SKILL.md')], source: SOURCE })).toEqual(finding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE', 0)], source: SOURCE })).toEqual(finding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('references/LICENSE.md')], source: SOURCE })).toEqual(finding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('docs\\LICENSE.md')], source: SOURCE })).toEqual(finding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE'), file('SKILL.md')], source: SOURCE })).toEqual([]);
  });

  it('requires a 40-character lowercase hexadecimal commit SHA in source', () => {
    const finding = ['Skill "x": MIT content must pin metadata.source to a 40-character upstream commit SHA.'];
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE')] })).toEqual(finding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE')], source: 'https://github.com/example/skills/tree/main/skills/demo' })).toEqual(finding);
    const uppercase = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE')], source: `https://github.com/example/skills/tree/${uppercase}/skills/demo` })).toEqual(finding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE')], source: SOURCE })).toEqual([]);
  });

  it('for MIT a NOTICE.md is optional and, when present, is not inspected', () => {
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE'), file('NOTICE.md')], source: SOURCE, noticeText: '' })).toEqual([]);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE'), file('NOTICE.md', 0)], source: SOURCE })).toEqual([]);
  });

  it('for any licence other than MIT, a NOTICE.md must be carried and must name the pinned SHA and the licence', () => {
    const noticeFinding = ['Skill "x": Apache-2.0 content must carry a NOTICE.md saying what was changed from upstream.'];
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('LICENSE')], source: SOURCE })).toEqual(noticeFinding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('LICENSE'), file('NOTICE.md', 0)], source: SOURCE })).toEqual(noticeFinding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('LICENSE'), file('references/NOTICE.md')], source: SOURCE, noticeText: NOTICE })).toEqual(noticeFinding);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('LICENSE'), file('NOTICE.md')], source: SOURCE })).toEqual([
      'Skill "x": NOTICE.md is present but no notice text was supplied, so what it says cannot be checked.',
    ]);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('LICENSE'), file('NOTICE.md')], source: SOURCE, noticeText: 'nothing upstream named here' })).toEqual([
      'Skill "x": NOTICE.md does not quote the pinned 40-character commit SHA of metadata.source.',
      'Skill "x": NOTICE.md does not name the licence identifier "Apache-2.0".',
    ]);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('LICENSE'), file('NOTICE.md')], source: SOURCE, noticeText: NOTICE })).toEqual([]);
  });

  it('accepts a fully documented adaptation on the highest tiers', () => {
    for (const license of ['Apache-2.0', 'MPL-2.0', 'CC-BY-SA-4.0', 'LicenseRef-Remotion'] as const) {
      expect(lintSkillPolicyLicence('adapted-source', {
        dirName: 'x', license, files: [file('LICENSE'), file('NOTICE.md')], source: SOURCE,
        noticeText: `Adapted from upstream at ${SHA} under ${license}; what changed: the runbook was compacted into references/.`,
      })).toEqual([]);
    }
  });

  it('reports one finding per problem when everything is missing at once', () => {
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'Apache-2.0', files: [file('SKILL.md')] })).toEqual([
      'Skill "x": Apache-2.0 content must carry its licence file (LICENSE) in the skill folder.',
      'Skill "x": Apache-2.0 content must pin metadata.source to a 40-character upstream commit SHA.',
      'Skill "x": Apache-2.0 content must carry a NOTICE.md saying what was changed from upstream.',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Independent review of skill-check (P13 fixes): the gates behind it, called directly
// ---------------------------------------------------------------------------------------------

describe('lintSkillPolicyLicence: the licence is trimmed once (review 9)', () => {
  it('treats a licence with surrounding whitespace like the bare identifier', () => {
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT ', files: [file('LICENSE')], source: SOURCE })).toEqual([]);
    expect(lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: ' MIT', files: [file('LICENSE')], source: SOURCE })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: ' MPL-2.0 ', files: [file('LICENSE')] })).toEqual([]);
    expect(lintSkillPolicyLicence('private-owner', { dirName: 'x', license: ' MPL-2.0 ', files: [file('SKILL.md')] }))
      .toEqual(['Skill "x": MPL-2.0 content must carry its licence file (LICENSE) in the skill folder.']);
    expect(lintSkillPolicyLicence('adapted-source', {
      dirName: 'x', license: ' Apache-2.0 ', files: [file('LICENSE'), file('NOTICE.md')], source: SOURCE, noticeText: NOTICE,
    })).toEqual([]);
  });
});

describe('lintSkillPolicyLicence: NOTICE.md tokens stand outside HTML comments and are whole tokens (review 6)', () => {
  const lint = (license: string, noticeText: string, source = SOURCE): string[] => lintSkillPolicyLicence('adapted-source', {
    dirName: 'x', license, files: [file('LICENSE'), file('NOTICE.md')], source, noticeText,
  });
  const SHA_FINDING = 'Skill "x": NOTICE.md does not quote the pinned 40-character commit SHA of metadata.source.';
  const LICENCE_FINDING = (id: string): string => `Skill "x": NOTICE.md does not name the licence identifier "${id}".`;

  it('does not count tokens inside an HTML comment, terminated or not, on one line or several', () => {
    expect(lint('Apache-2.0', `<!-- ${SHA} Apache-2.0 -->`)).toEqual([SHA_FINDING, LICENCE_FINDING('Apache-2.0')]);
    expect(lint('Apache-2.0', `<!--\n${SHA}\nApache-2.0\n-->\n`)).toEqual([SHA_FINDING, LICENCE_FINDING('Apache-2.0')]);
    expect(lint('Apache-2.0', `visible text\n<!-- ${SHA} Apache-2.0\nstill inside`)).toEqual([SHA_FINDING, LICENCE_FINDING('Apache-2.0')]);
    expect(lint('Apache-2.0', `<!-- one --> ${SHA} <!-- two --> Apache-2.0`)).toEqual([]);
    expect(lint('Apache-2.0', `<!-- a --><!-- b --> adapted at ${SHA} under Apache-2.0.`)).toEqual([]);
  });

  it('does not take a longer licence name, or a licence glued to other letters, for the licence', () => {
    expect(lint('Apache-2.0', `from ${SHA} under Apache-2.0-with-LLVM-exception`)).toEqual([LICENCE_FINDING('Apache-2.0')]);
    expect(lint('Apache-2.0', `from ${SHA} under Apache-2.0.1`)).toEqual([LICENCE_FINDING('Apache-2.0')]);
    expect(lint('Apache-2.0', `from ${SHA} under XApache-2.0`)).toEqual([LICENCE_FINDING('Apache-2.0')]);
    expect(lint('ISC', `from ${SHA}: MISC changes`)).toEqual([LICENCE_FINDING('ISC')]);
    expect(lint('MPL-2.0', `from ${SHA} under MPL-2.0+`)).toEqual([LICENCE_FINDING('MPL-2.0')]);
  });

  it('does not take a longer hexadecimal run for the SHA', () => {
    expect(lint('Apache-2.0', `Apache-2.0 sha256:${SHA}${'0'.repeat(24)}`)).toEqual([SHA_FINDING]);
    expect(lint('Apache-2.0', `Apache-2.0 0${SHA}`)).toEqual([SHA_FINDING]);
    expect(lint('Apache-2.0', `Apache-2.0 ${SHA}a`)).toEqual([SHA_FINDING]);
    expect(lint('Apache-2.0', `Apache-2.0 g${SHA}`)).toEqual([SHA_FINDING]);
  });

  it('accepts the tokens in ordinary prose: punctuation, parentheses, a sentence end, a markdown link or code span', () => {
    expect(lint('Apache-2.0', `Adapted from ${SHA}, licensed under (Apache-2.0).`)).toEqual([]);
    expect(lint('Apache-2.0', `Apache-2.0. Commit: ${SHA}.`)).toEqual([]);
    expect(lint('Apache-2.0', `[upstream](https://github.com/example/skills/tree/${SHA}) is \`Apache-2.0\``)).toEqual([]);
    expect(lint('LicenseRef-Remotion', `Pinned at ${SHA}; LicenseRef-Remotion applies.`)).toEqual([]);
  });

  it('stays linear on a notice made of 200 KiB of unterminated comment openers', () => {
    const started = Date.now();
    expect(lint('Apache-2.0', '<!--'.repeat(50_000))).toEqual([SHA_FINDING, LICENCE_FINDING('Apache-2.0')]);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('lintSkillPolicyLicence: the commit is a whole segment of an https source URL (review 5)', () => {
  const lint = (source: string): string[] => lintSkillPolicyLicence('adapted-source', { dirName: 'x', license: 'MIT', files: [file('LICENSE')], source });
  const PIN_FINDING = ['Skill "x": MIT content must pin metadata.source to a 40-character upstream commit SHA.'];

  it('refuses a SHA that is not a whole path segment of an https URL without user-info', () => {
    for (const source of [
      `https://example.com/skills/${SHA}-not-a-commit/SKILL.md`,
      `https://example.com/repo?id=${SHA}`,
      `https://example.com/repo#${SHA}`,
      `http://example.com/repo/tree/${SHA}`,
      `https://user:secret@example.com/repo/tree/${SHA}`,
      `${SHA}`,
      `not a url ${SHA}`,
    ]) expect(lint(source), source).toEqual(PIN_FINDING);
  });

  it('accepts the forms the intake rule and the existing tests show', () => {
    for (const source of [
      SOURCE,
      `https://github.com/example/skills/commit/${SHA}`,
      `https://github.com/trailofbits/skills/tree/${SHA}/plugins/static-analysis/skills/codeql`,
    ]) expect(lint(source), source).toEqual([]);
  });
});

describe('supportingText: a top-level notice.md in any case (review 10)', () => {
  it('leaves out NOTICE.md in every letter case, and only at the top level', () => {
    for (const name of ['notice.md', 'Notice.md']) {
      const dir = path.join(tmpSkill({ 'SKILL.md': '# Demo skill body\n', [name]: 'top notice prose\n', 'references/notice.md': 'sub notice prose\n' }), 'demo');
      const text = supportingText(dir, { excludeTopLevelNotices: true });
      expect(text, name).not.toContain('top notice prose');
      expect(text, name).toContain('sub notice prose');
      expect(supportingText(dir), name).toContain('top notice prose');
    }
  });
});

describe('the layout gate: a support-folder link never leads to a lookup with a .. segment (review 4)', () => {
  const links = (target: string): string => `${FM}\nSee [x](${target}) for more.\n`;
  const inside = (dir: string, p: string): boolean => p === dir || p.startsWith(`${dir}${path.sep}`);

  it.each([
    'references/../../../outside.md',
    'references/>/../../../outside.md',
    'references/a>b/../../../outside.md',
    'examples/..\\..\\..\\outside.md',
  ])('reports ](%s) without asking the file system about anything outside the skill folder', target => {
    const root = tmpSkill({ 'SKILL.md': links(target), 'evals/evals.json': EVALS });
    fs.writeFileSync(path.join(root, 'outside.md'), '# Outside\n');
    const dir = path.join(root, 'demo');
    const spy = vi.spyOn(fs, 'existsSync');
    let errors: string[];
    try {
      errors = checkSkillLayout(root, 'demo');
    } finally {
      spy.mockRestore();
    }
    const asked = spy.mock.calls.map(call => path.resolve(String(call[0])));
    expect(asked.filter(p => !inside(dir, p))).toEqual([]);
    expect(errors.some(e => e.includes('".." segment'))).toBe(true);
  });

  it('reports a .. link that stays inside the folder too, and does not look the target up', () => {
    const root = tmpSkill({ 'SKILL.md': links('references/sub/../csv.md'), 'references/csv.md': '# CSV\n', 'evals/evals.json': EVALS });
    const dir = path.join(root, 'demo');
    const spy = vi.spyOn(fs, 'existsSync');
    let errors: string[];
    try {
      errors = checkSkillLayout(root, 'demo');
    } finally {
      spy.mockRestore();
    }
    const asked = spy.mock.calls.map(call => path.resolve(String(call[0])));
    expect(asked).not.toContain(path.join(dir, 'references', 'csv.md'));
    expect(errors.some(e => e.includes('".." segment'))).toBe(true);
  });

  it('keeps the exact finding for a link to a missing file without a .. segment', () => {
    const root = tmpSkill({ 'SKILL.md': links('references/missing.md'), 'evals/evals.json': EVALS });
    expect(checkSkillLayout(root, 'demo')).toEqual(['demo: SKILL.md links to references/missing.md which does not exist']);
  });
});

describe('the gates return findings, never an exception, for values that are objects with a toString key (review 7)', () => {
  const TOSTRING_DESC = `---\nname: demo\ndescription:\n  toString: x\nbogus: true\n---\n# Demo\n`;

  it('the layout gate keeps the unknown key and the description findings', () => {
    const errors = checkSkillLayout(tmpSkill({ 'SKILL.md': TOSTRING_DESC, 'evals/evals.json': EVALS }), 'demo');
    expect(errors).toContain('demo: unknown front matter key "bogus" (Claude Code ignores it silently)');
    expect(errors).toContain('demo: description must lead with the key use case ("Use when ...")');
  });

  it('the layout gate does the same for a when_to_use that is an object with a toString key', () => {
    const skill = '---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it. Skip it when idle."\nwhen_to_use:\n  toString: x\n---\n# Demo\n';
    expect(() => checkSkillLayout(tmpSkill({ 'SKILL.md': skill, 'evals/evals.json': EVALS }), 'demo')).not.toThrow();
  });

  it('the contract gate names an object name without raising', () => {
    const named = GOOD.replace(`name: ${NAME}`, 'name:\n  toString: x');
    const findings = validateRewrittenSkill(NAME, named);
    expect(findings.some(f => f.startsWith('sample-skill: front matter name is'))).toBe(true);
    expect(validateRewrittenSkill(NAME, GOOD.replace(`name: ${NAME}`, 'name: [a, b]')).some(f => f.startsWith('sample-skill: front matter name is'))).toBe(true);
  });

  it('keeps today\'s findings for an eval that has no prompt or expected_output, and for string and numeric ids', () => {
    expect(checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': JSON.stringify({ skill_name: 'demo', evals: [{ id: 1 }, { id: 2 }] }) }), 'demo')).toEqual([
      'demo: eval 1 prompt is too short to be realistic',
      'demo: eval 1 has no expected_output',
      'demo: eval 2 prompt is too short to be realistic',
      'demo: eval 2 has no expected_output',
      'demo: duplicate eval prompts',
    ]);
  });

  it('reports a prompt or expected_output that is not a string, whatever its length', () => {
    const evals = JSON.stringify({
      skill_name: 'demo',
      evals: [
        { id: 1, prompt: 123, expected_output: 456 },
        { id: 2, prompt: Array.from({ length: 60 }, () => 'a'), expected_output: { toString: 'x', padding: 'a long enough object to pass any length test, if one were made' } },
        { id: { toString: 'x' }, prompt: { toString: 'x' }, expected_output: true },
      ],
    });
    const errors = checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': evals }), 'demo');
    expect(errors).toContain('demo: eval 1 prompt is not a string');
    expect(errors).toContain('demo: eval 1 expected_output is not a string');
    expect(errors).toContain('demo: eval 2 prompt is not a string');
    expect(errors).toContain('demo: eval 2 expected_output is not a string');
    expect(errors.filter(e => e.endsWith('is not a string'))).toHaveLength(6);
  });

  it('reports a skill_name that is an object with a toString key', () => {
    const errors = checkSkillLayout(tmpSkill({ 'SKILL.md': FM, 'evals/evals.json': JSON.stringify({ skill_name: { toString: 'x' }, evals: [OK_ENTRY, { ...OK_ENTRY, id: 2, prompt: `${OK_ENTRY.prompt} (second)` }] }) }), 'demo');
    expect(errors.some(e => e.startsWith('demo: evals skill_name is '))).toBe(true);
  });
});
