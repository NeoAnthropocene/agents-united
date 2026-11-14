# Worked example: a review routed, then a briefed fix, with one fall-through

The user is on Windows with a WSL Ubuntu side and asks: "Review the `parser/` changes for race conditions, then fix the two worst, using my other CLIs." The headroom figures in step 2 are from a real `status` run on 2026-11-06; its MODEL column shows the current defaults, not the ones of that day. The Cline refusal in step 5 is constructed to show a fall-through, because a real limit refusal was never provoked. The shape of step 4 and 6 (a brief, a checkout, a report checked against `changed`) was run live on Cline on 2026-11-07 on a small test project, not on a real parser. The `--skill` flag in step 4 came later and was only dry-run.

## 1. Tier and access

- Review: `medium` (a diff review inside a known module), `read-only`.
- Fix: `medium`, `edit`: the user asked for changes, so the lead delegates them as a normal edit run, one task per worker with the guardrails, in its own worktree. No planning run: the fix list comes from the review.

## 2. Show the routing

```
node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" status --tier medium
```

```
HOST        SIDE     STATE         5H LEFT  WEEK LEFT  MODEL
cline       windows  ready         ?        ?          cline-pass/glm-5.3
cline       wsl      not runnable  ?        ?          cline-pass/glm-5.3
antigravity wsl      ready         100%     98.5%      gemini-4-hydrogen-medium
codex       windows  ready         74%      66%        gpt-6.1-sol
codex       wsl      ready         74%      66%        gpt-6.1-sol
claude      windows  ready         80%      84%        claude-sonnet-5-5
selected: cline on windows -> cline-pass/glm-5.3 (medium)
```

Reported to the user: Cline first as configured, headroom unknown; Codex and Claude show the same figures on both sides (one account each), so the side is a tie and Windows wins because that is where the session is. The user says yes to Cline, Antigravity, Codex and Claude as candidates.

## 3. Run the review (read-only)

The task goes in `review.md`, written to stand alone: the repository path, the diff to read (`git diff dev -- parser/`), the question (races, with file and line), and the answer format (a ranked list, worst first).

```
node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" run --tier medium --prompt-file review.md --cwd C:\work\app
```

`ok: true`, `ran` = cline / windows / `cline-pass/glm-5.3`. The two worst findings come back as a ranked list.

## 4. Brief the fix and give it its own checkout

```
git worktree add C:\work\app-fix -b task/parser-races
```

`fix.md`, from [../references/delegation-brief.md](../references/delegation-brief.md):

```
Goal: remove the two races the review found, without changing the parser's public API.
Context: findings 1 and 2 of the review (pasted below); the parser is single-threaded in tests, so the races show only under the worker pool.
Scope, may change: parser/lexer.ts, parser/queue.ts; one new file parser/queue.test.ts.
Out of scope, must not touch: everything else, package.json, lockfiles. Do not commit.
Requirements: <each finding, one line, with file and line>
Acceptance: `npm test -- parser` exits 0; quote the summary line.
Report: use the `handoff` skill if you have it; reply with the report, do not write a file.
```

```
node "${CLAUDE_SKILL_DIR}/scripts/router.mjs" run --tier medium --prompt-file fix.md --cwd C:\work\app-fix --access edit --allow-cmd "npm test -- parser" --skill test-driven-development --dry-run
```

The dry run lists Cline on Windows, then Antigravity on WSL, then Codex and Claude, and shows the working directory translated to `/mnt/c/work/app-fix` for the WSL candidates. It also lists the skill attached (`test-driven-development`, with its size) and the size of the prompt each host would get; the new worktree holds no installed skills, so the brief names the skill and the router carries its text.

## 5. Run it and meet a fall-through (constructed)

```json
{ "ok": true,
  "attempts": [
    { "host": "cline", "side": "windows", "rc": 1, "failure": "limit" },
    { "host": "antigravity", "side": "wsl", "rc": 0, "failure": null } ],
  "ran": { "host": "antigravity", "side": "wsl", "model": "gemini-4-hydrogen-medium", "effort": "medium", "label": "Gemini 4 Hydrogen (Medium)" },
  "changed": { "created": ["parser/queue.test.ts"], "modified": ["parser/lexer.ts", "parser/queue.ts"], "deleted": [], "head_moved": false, "count": 3 } }
```

Cline refused on a limit and the tree was unchanged, so the next candidate ran. Had Cline changed `parser/lexer.ts` before refusing, the result would instead carry `stopped` and the failed attempt's `changed`, and no other host would have started: the lead would then either send a new brief that says what already exists, or delete the worktree. Had the first attempt failed with no `failure` label (a real task failure), the router would have stopped and the lead would have reported it.

## 6. Review, then report

1. `changed` lists three files; the worker's "Changed files" lists the same three. A file in only one of the two would mean the report cannot be trusted.
2. Read `git diff` in `C:\work\app-fix`; confirm `package.json` and the lockfile are untouched and `head_moved` is false.
3. Run `npm test -- parser` yourself. Do not accept the quoted summary line.
4. Merge or cherry-pick the worktree branch, then `git worktree remove C:\work\app-fix`.

Report to the user:

- Review: cline / windows / `cline-pass/glm-5.3`, read-only, headroom unknown.
- Fix: antigravity / wsl / `gemini-4-hydrogen-medium` (effort medium), edit access in its own worktree, after cline / windows refused on a limit; Antigravity had 100% (5-hour) and 98.5% (weekly) left.
- Reviewed: report against `changed`, diff read, acceptance command re-run by the lead.
- Not verified: the Cline refusal text as it appears on stdout and stderr, and that the fix is right beyond the tests (hand that to the engineer who owns the module).
