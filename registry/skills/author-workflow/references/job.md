# One-workflow job contract

Use this before editing. A forked task does not inherit the caller's conversation, so the caller's brief must carry every input below.

| Input | Required decision |
| --- | --- |
| Purpose | The multi-agent job the script runs, in terms a later reader can verify, and why a workflow script (an on-demand run) fits better than a Skill alone. |
| Name | Lower-case kebab-case, no `.js`; the file becomes `registry/hosts/claude/workflows/<name>.js` and the host runs it as `/<name>`. It must be the folder name of an existing Skill (the paired Skill). A Windows device name is refused. |
| Paired Skill | `registry/skills/<name>/SKILL.md` must already exist as a regular file. The projector installs a native workflow only in place of the Skill of the same name, so a script without one is never installed. If the Skill is missing, stop and tell the user to author it first through `author-skill`. |
| Intent | Private local draft or upstream preparation; neither implies publication. |
| Source checkout | The absolute path of the contributor's checkout on a feature branch. The route writes into it, so confirm with `git branch --show-current` that the branch is not `main`, `dev`, `master`, `production` or `release/*`. |
| Existing file / scope | Create mode (the name is free; the helper writes the script) or Repair mode (the script exists). For a repair, keep a copy and the SHA-256 of the current script before editing. |
| Agent roles | The native Claude roles the script may request with `agentType`; each must be a file in `registry/hosts/claude/agents/`. |
| References / provenance | Actual supplied sources, pins and licences, and unresolved facts. |
| Constraints | The limits in [quality](quality.md), user choices, and the evidence budget. |

Refuse a checkout whose path, `registry`, `registry/hosts`, `registry/hosts/claude` or `registry/hosts/claude/workflows` is a link. In Create mode, if the name collides with an existing workflow, or the paired Skill is missing, preserve the draft and ask for another name or for the Skill to be authored first; never overwrite a script silently. Repair mode does not need a free name: the script is expected to exist, but it must be a regular, unlinked file before you edit it, because an edit by pathname lands on a link's target. Check it first: in Node, `fs.lstatSync(p).isFile()` is true and `fs.lstatSync(p).isSymbolicLink()` is false (lstat does not follow a link); in a shell, `test -f "$p" && ! test -L "$p"`; in PowerShell, the item from `Get-Item -LiteralPath $p -Force` has no `LinkType` and is not a folder. Refuse a link or junction there.

## Bounded helper

`scripts/draft.mjs` creates one workflow script. It runs with Node >=24 and built-in modules from any working directory, including an installed copy, and performs no network, host, validator or git command. Its one argument is the absolute path of a JSON job. The job holds the complete authored text, so write the script before calling it:

```json
{
  "checkout": "/selected/contributor-checkout",
  "name": "release-flow",
  "content": "export const meta = {\n  name: 'release-flow',\n  description: 'Draft release notes from the merged pull requests',\n  phases: [{ title: 'Collect' }, { title: 'Review' }],\n}\n\nphase('Collect')\nconst merged = await agent('List the merged pull requests since the last release', { agentType: 'code-reviewer' })\nphase('Review')\nconst notes = await agent('Draft the release notes from ' + JSON.stringify(merged), { agentType: 'code-reviewer' })\nreturn { merged, notes }\n"
}
```

No other key is allowed. A prepared run exits 0 and prints this report on stdout (the Skill hash is that of the paired `SKILL.md`, which the helper only reads):

```json
{
  "version": 1,
  "status": "written",
  "workflow": {
    "path": "registry/hosts/claude/workflows/release-flow.js",
    "bytes": 461,
    "sha256": "0219b61c958fc8886a818ecb8dcd7702b48673c3ceac0ec090ffab146f14f33c"
  },
  "skill": {
    "path": "registry/skills/release-flow/SKILL.md",
    "sha256": "<64 hex characters>"
  },
  "bundleMembership": {
    "listed": true,
    "bundles": ["agent-factory"]
  },
  "validation": {
    "status": "unverified",
    "reason": "This helper runs no workflow-check; run it on the written workflow file."
  },
  "externalActions": []
}
```

A refusal exits 1, writes nothing and prints one line on stderr, `{"status":"blocked","reason":"..."}`. It refuses:

- a name that is not kebab-case or is a Windows device name;
- an existing workflow of that name (any letter case);
- a missing paired Skill, or a paired `SKILL.md` that is not a regular file or sits behind a link;
- a name whose Skill has a native Claude loader in `registry/hosts/claude/skills/`, which a workflow of that name would replace;
- content without `export const meta`, or whose `meta.name` is not a string literal equal to the name, or over 128 KiB as it will be written (the final newline the helper adds counts, so text of exactly 128 KiB with no final newline is refused);
- a link or junction in the checkout path or in any folder from `registry/` down to `registry/hosts/claude/workflows/`, and a workflows folder that is missing (the helper creates no folder).

A script without a final newline gets one; CRLF text is kept as it is. The helper writes only the workflow file. It does not touch `bundles.json` beyond reading it: Bundle membership of the paired Skill belongs to the Skill's own route, and the helper reads the Skill without changing it.

`bundleMembership` is a note for the hand-off. It names, in the order of `registry/bundles.json`, the Bundles whose `skills` list the paired Skill by exact name. The helper never refuses on membership. When no Bundle lists the Skill the report says `"listed": false` with `"bundles": []` and a `note`: the workflow is then never installed, because it is installed only in place of a Skill that a Bundle lists. The helper reads `bundles.json` as a regular file (not a link) of at most 1 MiB; when it cannot (missing, a link, a folder, too large, not JSON, no `bundles` map) the write still succeeds and the field is `"listed": null`, `"bundles": []`, an `unreadable` reason and a `note`: report that as unknown, never as no. The hand-off states yes or no whether a Bundle lists the paired Skill, and which Bundles do. Repair mode does not run the helper, so read `registry/bundles.json` and state the same by hand.

The helper holds the lock file `registry/.author-workflow.lock` while it works and refuses to start when that file exists (the refusal names it: check that no helper is running, then delete the lock file and run again). After the exclusive create of the script it reads the file back and compares its hash. If a step fails, it removes the script and the lock it created, but removes the script only while the path still names the file this run created (the same device and file number, which the helper records when the exclusive create succeeds, so a replacement with identical bytes is left alone) and its bytes are exactly what this run wrote, or, when this run's own write failed, a truncated start of them; it reads at most one byte more than it wrote, so a huge file is never read whole. A file that changed since (a replacement someone else created, even with identical bytes, a folder or a link, a longer file) is left in place and named in the refusal. The lock is removed the same way: only while the path still names the file this run created; any other file there is left in place and named in the warning. If the lock cannot be removed at the end, a successful run still exits 0 and adds a `warnings` list (with that one sentence) to the report, and a failed run appends it to the refusal; delete the lock file by hand before the next run. The lock keeps other runs of this helper out, so the helper walks the checkout and every folder down to `registry/hosts/claude/workflows/` again after it takes the lock, creates the script exclusively, and then checks that the created file's real path is the expected one; if a link or junction took the folder's place since the walk, it removes the file it just created (only while the path still names that file) and refuses. One window stays open and is accepted: a folder swapped for a link or junction between the final check and the create, by another process on the contributor's own machine, is caught only by that last check after the file exists. A process killed during the write can leave a partial workflow file and a stale lock together: the collision check comes before the lock check, so the next run refuses on the workflow file first (it exists), and that refusal gives the recovery order: check that no helper is running, look at the partial file and delete it if it is not yours, then delete the lock file, and run again. A stale lock alone, with no workflow file, is refused on the lock: check that no helper is running, then delete the lock file. The check of a file's identity and its removal are two steps, so a swap in that instant is outside what a pathname can prevent. A file number can be reused once a descriptor is closed, but only after another process has deleted the original file and created a new one at the same path, so that case falls under the same limit as a concurrent swap. The helper treats a contributor's own checkout as its threat model. Save stdout, stderr and the exit code with the other evidence.

The helper creates only; Repair mode never runs it. A repair records the baseline bytes and hash first, edits the existing script in place and compares the final inventory against the baseline.

Without a shell, follow the same procedure by hand: write the file under `registry/hosts/claude/workflows/` after confirming the paired Skill exists, then run the checker.
