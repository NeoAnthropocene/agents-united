/**
 * ADR 0082: where `agents workflow-check` may read. The checker is given an absolute path and finds the registry from its
 * spelling (the folder four levels up, named exactly `registry`), so the path alone proves nothing about where the bytes live: a link or junction in a
 * folder above the file, or a lower-case spelling of an upper-case entry on Windows, would let the read land outside the tree
 * the path names. This module closes that, for the workflow-check only (the shared `bounded-file.ts` keeps rule-check's
 * messages). The file system is only read: lstat, readdir and realpath, never a write. No terminal I/O.
 *
 * The rule, as `author-rule`'s helper applies it to a checkout: take the real path of the checkout (the folder that holds the
 * registry); then each folder from the registry down to the file must be present in its parent's listing spelled exactly as
 * written, must not be a link or junction, and the real path of the whole file must be exactly the checkout's real path
 * followed by those names (compared without regard to case on Windows, where the listing check has already enforced the case).
 */
import fs from 'node:fs';
import path from 'node:path';
import { errorCode } from './skill-check.js';

export type WorkflowTree = { ok: true; registry: string; file: string } | { ok: false; message: string };

const sameName = (a: string, b: string): boolean => a.normalize('NFC') === b.normalize('NFC');

/**
 * `artifact` is an absolute path that has passed the pure name and placement checks (it ends in
 * `registry/hosts/claude/workflows/<name>.js`, the folder named exactly `registry`, and it has a parent). Returns the real registry folder and the real
 * file path to read, or why the path is refused.
 */
export function resolveWorkflowTree(artifact: string): WorkflowTree {
  const workflows = path.dirname(artifact);
  const claude = path.dirname(workflows);
  const hosts = path.dirname(claude);
  const root = path.dirname(hosts);
  const checkout = path.dirname(root);
  // The caller's placement check has already required this name; the walk does not take another one, so it holds on its own.
  if (path.basename(root) !== 'registry') {
    return { ok: false, message: `The registry folder must be named exactly "registry"; it is named ${JSON.stringify(path.basename(root))}: ${artifact}` };
  }
  const names = ['registry', 'hosts', 'claude', 'workflows', path.basename(artifact)];

  let current: string;
  try {
    current = fs.realpathSync(checkout);
  } catch (error) {
    return { ok: false, message: `The folder that holds the registry cannot be read (${errorCode(error)}): ${checkout}` };
  }
  const realCheckout = current;

  for (const [index, name] of names.entries()) {
    const last = index === names.length - 1;
    let listing: string[];
    try {
      listing = fs.readdirSync(current);
    } catch (error) {
      return { ok: false, message: `The folder ${current} cannot be listed (${errorCode(error)}), so the path cannot be confirmed: ${artifact}` };
    }
    if (!listing.some(entry => sameName(entry, name))) {
      const alias = listing.find(entry => entry.toLowerCase() === name.toLowerCase());
      return {
        ok: false,
        message: alias !== undefined
          ? `The path spells ${JSON.stringify(name)} where the file system holds ${JSON.stringify(alias)} (the same name in another case); pass the path spelled exactly as it is on disk: ${artifact}`
          : `The path does not exist (${JSON.stringify(name)} is not in ${current}): ${artifact}`,
      };
    }
    const next = path.join(current, name);
    let entry: fs.Stats;
    try {
      entry = fs.lstatSync(next);
    } catch (error) {
      return { ok: false, message: `The path cannot be read (${errorCode(error)}): ${next}` };
    }
    if (entry.isSymbolicLink()) {
      return { ok: false, message: `The path goes through a link or junction at ${next}, so the file may not be inside the registry; pass the real path of the workflow: ${artifact}` };
    }
    if (last ? !entry.isFile() : !entry.isDirectory()) {
      return { ok: false, message: `The path is not ${last ? 'a regular file' : 'a folder'}: ${next}` };
    }
    current = next;
  }

  // The listing and lstat checks above cover each folder; this one covers anything they cannot see (a reparse point that is not
  // reported as a link) by requiring that the whole path resolves to itself.
  let real: string;
  try {
    real = fs.realpathSync(current);
  } catch (error) {
    return { ok: false, message: `The path cannot be resolved (${errorCode(error)}): ${artifact}` };
  }
  const same = process.platform === 'win32' ? real.toLowerCase() === current.toLowerCase() : real === current;
  if (!same) return { ok: false, message: `The path resolves elsewhere (to ${real}), so it goes through a link or junction; pass the real path of the workflow: ${artifact}` };
  return { ok: true, registry: path.join(realCheckout, names[0]), file: current };
}

export type SkillPair = { kind: 'found' } | { kind: 'missing' } | { kind: 'unavailable'; message: string };

/**
 * Whether the Skill `<registry>/skills/<stem>/SKILL.md` is there as the projector would find it. `registry` is the real registry
 * folder (`resolveWorkflowTree` returns it). Each of `skills`, `skills/<stem>` and `SKILL.md` must be inspected with lstat: not
 * a link or junction (unavailable, as for the workflow path), a folder or, for the last, a regular file (anything else, or
 * nothing there, is `missing`: the Skill does not exist). The real path of the file must then be exactly the expected one, so
 * nothing outside the registry can stand in for the Skill. A name that vanishes between the lstat and the real-path call is
 * unavailable: the file was seen, so its disappearance is not "no Skill". The tree is checked as it is when the walk reads it;
 * a folder swapped for a link after this call is outside what a read-only check can prevent.
 */
export function resolveSkillPair(registry: string, stem: string): SkillPair {
  const names = ['skills', stem, 'SKILL.md'];
  let current = registry;
  for (const [index, name] of names.entries()) {
    const last = index === names.length - 1;
    const next = path.join(current, name);
    let entry: fs.Stats;
    try {
      entry = fs.lstatSync(next);
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'missing' };
      return { kind: 'unavailable', message: `The Skill of the same name cannot be inspected (${code}): ${next}` };
    }
    if (entry.isSymbolicLink()) {
      return { kind: 'unavailable', message: `The Skill path goes through a link or junction at ${next}, so the SKILL.md may not be inside the registry; the Skill must be a real file in the registry.` };
    }
    if (last ? !entry.isFile() : !entry.isDirectory()) return { kind: 'missing' };
    current = next;
  }
  let real: string;
  try {
    real = fs.realpathSync(current);
  } catch (error) {
    return { kind: 'unavailable', message: `The SKILL.md of the same name cannot be resolved (${errorCode(error)}), so it is not shown to be inside the registry: ${current}` };
  }
  const same = process.platform === 'win32' ? real.toLowerCase() === current.toLowerCase() : real === current;
  if (!same) return { kind: 'unavailable', message: `The SKILL.md of the same name resolves elsewhere (to ${real}), so it goes through a link or junction; the Skill must be a real file in the registry: ${current}` };
  return { kind: 'found' };
}
