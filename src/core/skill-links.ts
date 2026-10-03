import fs from 'fs-extra';
import path from 'node:path';

/**
 * Plan 032 Phase 8 — what the 2026-10-03 probes found on Antigravity CLI 1.2.16: a skill folder installed as a link is not listed, a real
 * folder is (`host-library/antigravity/observations/2026-10-03-agy-1.2.16-probes.md`, probe b). On Windows the default install makes each
 * skill folder an NTFS junction. The observation covers junctions on Windows only; POSIX symlinks were not tried, so nothing is reported
 * elsewhere.
 */

/** The names of the skill folders under `skillsDir` that are links (a junction reads as a symbolic link). Windows only; `[]` elsewhere or if the folder is absent. */
export async function listLinkedSkills(skillsDir: string, platform: NodeJS.Platform = process.platform): Promise<string[]> {
  if (platform !== 'win32') return [];
  const entries = await fs.readdir(skillsDir).catch(() => [] as string[]);
  const linked: string[] = [];
  for (const entry of entries) {
    const stat = await fs.lstat(path.join(skillsDir, entry)).catch(() => null);
    if (stat?.isSymbolicLink()) linked.push(entry);
  }
  return linked.sort();
}

/** The warning for linked skill folders (`undefined` for none), naming what was observed, what was not, and the two ways out. */
export function linkedSkillAdvice(names: readonly string[], bundle?: string): string | undefined {
  if (names.length === 0) return undefined;
  const count = `${names.length} skill folder${names.length === 1 ? ' is' : 's are'}`;
  const fix = bundle ? `agents add ${bundle} --native (copies the skills) or agents add ${bundle} --copy` : 'agents add <bundle> --native (copies the skills) or agents add <bundle> --copy';
  return (
    `${count} installed as links (junctions on Windows) in .agents/skills. agy 1.2.16 did not list them in a real session (it lists real folders);` +
    `POSIX symlinks were not tried. To make them visible, reinstall with ${fix}.`
  );
}
