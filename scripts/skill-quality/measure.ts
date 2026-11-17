/**
 * Plan 035 S1, the skill quality measure (ADR 0040).
 *
 * A "templated" skill is one whose body is mostly lines that other skills also carry once the
 * skill's own name is taken out. The measure is deterministic and has no network or model step:
 *
 *   share(skill) = content lines found in the frozen boilerplate corpus / content lines
 *
 * The corpus (`tests/fixtures/skill-boilerplate-corpus.txt`) is frozen at the audit, so a rewrite
 * of one skill can never move the score of another. Regenerate it only by an ADR, never to make
 * a skill pass.
 *
 * The pure measure lives in src/core/skill-quality.ts (P8a); this file is the CLI adapter.
 * CLI: `node scripts/skill-quality/measure.ts report [--bundle <name>]` prints the table,
 *      `node scripts/skill-quality/measure.ts corpus` prints the corpus the catalog yields now.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCorpus, loadCorpus, measureAll, verdictOf } from '../../src/core/skill-quality.ts';

export {
  TEMPLATED_THRESHOLD,
  STUB_MAX_LINES,
  CORPUS_MIN_SKILLS,
  stripFrontMatter,
  normaliseLine,
  contentLines,
  listSkills,
  buildCorpus,
  loadCorpus,
  measureSkill,
  isWorkflowSkill,
  verdictOf,
  measureAll,
} from '../../src/core/skill-quality.ts';
export type { SkillMeasure, SkillVerdict } from '../../src/core/skill-quality.ts';

function main(argv: string[]): void {
  const root = process.cwd();
  const skillsDir = path.join(root, 'registry', 'skills');
  const [cmd, ...rest] = argv;
  if (cmd === 'corpus') {
    process.stdout.write(buildCorpus(skillsDir).join('\n') + '\n');
    return;
  }
  if (cmd === 'report') {
    const bundleName = rest[rest.indexOf('--bundle') + 1];
    const corpus = loadCorpus(path.join(root, 'tests', 'fixtures', 'skill-boilerplate-corpus.txt'));
    let names: string[] | undefined;
    if (rest.includes('--bundle')) {
      const bundles = JSON.parse(fs.readFileSync(path.join(root, 'registry', 'bundles.json'), 'utf8')).bundles;
      names = bundles[bundleName]?.skills;
      if (!names) throw new Error(`unknown bundle ${bundleName}`);
    }
    const rows = measureAll(skillsDir, corpus).filter((m) => !names || names.includes(m.name));
    rows.sort((a, b) => b.share - a.share);
    for (const m of rows) {
      console.log(`${m.share.toFixed(2)}\t${verdictOf(m)}\t${m.lines}\t${m.extraFiles}\t${m.thirdParty ? 'third-party' : 'in-house'}\t${m.name}`);
    }
    return;
  }
  console.error('usage: measure.ts corpus | report [--bundle <name>]');
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
