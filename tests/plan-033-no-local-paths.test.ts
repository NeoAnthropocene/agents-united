import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

// A home-folder path of someone's machine: a drive letter, /c/Users, /Users/<name>/ or /home/<name>/.
const HOME_PATH = /[A-Za-z]:[\\/]+Users[\\/]|\/c\/Users\/|\/Users\/[^/\s]+\/|\/home\/[^/\s<]+\//i;

// Lines that were already on origin/dev before Plan 033 (older worktree "ecb0"); not this branch's to rewrite.
const LEGACY_LINE = /worktrees[\\/]ecb0[\\/]/;

function listFiles(dir: string, accept: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const abs = path.join(root, dir);
  for (const name of readdirSync(abs)) {
    const full = path.join(abs, name);
    const rel = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...listFiles(rel, accept));
    else if (accept(rel)) out.push(rel);
  }
  return out;
}

function plan033Documents(): string[] {
  const docs = listFiles("docs", (r) => /^docs\/plan-033-[^/]*\.md$/.test(r) || /^docs\/adr\/0067-[^/]*\.md$/.test(r));
  const plans = listFiles("plans", (r) => /^plans\/033-[^/]*\.md$/.test(r));
  const skills = ["sync-host", "coordinate-artifact"].flatMap((s) =>
    listFiles(`registry/skills/${s}`, (r) => r.endsWith(".md")),
  );
  return [...docs, ...plans, ...skills].filter((r) => !r.startsWith("docs/plan-033-catalog-records/"));
}

describe("Plan 033 documents carry no local machine paths", () => {
  const files = plan033Documents();

  it("finds the Plan 033 documents", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("contains no home-folder path", () => {
    const hits: string[] = [];
    for (const rel of files) {
      readFileSync(path.join(root, rel), "utf8").split(/\r?\n/).forEach((line, i) => {
        if (HOME_PATH.test(line) && !LEGACY_LINE.test(line)) hits.push(`${rel}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
