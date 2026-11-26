# One-rule job contract

Use this before editing. A forked task does not inherit the caller's conversation, so the caller's brief must carry every input below.

| Input | Required decision |
| --- | --- |
| Purpose | The behaviour the rule changes, in terms a later reader can verify, and why a rule (always-on context) fits better than a skill or a hook. |
| Name | Lower-case kebab-case, no `.md`; the file becomes `registry/rules/<name>.md`. A host entry-point name (`claude`, `gemini`, `agents`, `cursor`) or a Windows device name is refused. |
| Target bundle | The key in `registry/bundles.json` whose `rules[]` receives the file name. One bundle per run. |
| Intent | Private local draft or upstream preparation; neither implies publication. |
| Source checkout | The absolute path of the contributor's checkout on a feature branch. The route writes into it, so confirm with `git branch --show-current` that the branch is not `main`, `dev`, `master`, `production` or `release/*`, and that the tree holds no unrelated edits to `registry/bundles.json`. |
| Existing file / scope | Create or repair. For a repair, keep a copy and the SHA-256 of the current rule before editing. |
| References / provenance | Actual supplied sources, pins and licences, and unresolved facts. |
| Constraints | The budgets in [quality](quality.md), user choices, and the evidence budget. |

Refuse a checkout whose `registry/rules` or `registry/bundles.json` is a link. If the name collides with an existing rule, or the bundle already lists the file, preserve the draft and ask for another name or a repair scope; never overwrite a rule silently.

## Bounded helper

`scripts/draft.mjs` creates one rule and its bundle entry. It runs with Node >=24 and built-in modules from any working directory, including an installed copy, and performs no network, host, validator or git command. Its one argument is the absolute path of a JSON job. The job holds the complete authored text, so write the rule before calling it:

```json
{
  "checkout": "/selected/contributor-checkout",
  "name": "release-notes",
  "bundle": "agent-factory",
  "content": "# Release notes\n\n- Name the user-visible change before the internal cause.\n- Link the issue or the pull request for every item.\n"
}
```

No other key is allowed. A prepared run exits 0 and prints this report on stdout (the bundle hashes are those of the manifest before and after, and the list is the bundle's `rules[]` afterwards):

```json
{
  "version": 1,
  "status": "written",
  "rule": {
    "path": "registry/rules/release-notes.md",
    "bytes": 128,
    "sha256": "3812307f9fcd41e58ac34c5b816138b2d8d25fa8a35d1d2324efa45940693c80"
  },
  "bundle": {
    "name": "agent-factory",
    "file": "registry/bundles.json",
    "rules": ["skill-attribution.md", "release-notes.md"],
    "sha256Before": "<64 hex characters>",
    "sha256After": "<64 hex characters>"
  },
  "validation": {
    "status": "unverified",
    "reason": "This helper runs no rule-check; run it on the written rule file."
  },
  "externalActions": []
}
```

A refusal exits 1, writes nothing and prints one line on stderr, `{"status":"blocked","reason":"..."}`. It refuses a name that is not kebab-case, an entry-point or device name, an existing rule (any letter case), an unknown bundle, a bundle that already lists the file, a link or junction in the checkout path or in `registry/` or `registry/rules`, text over 64 KiB, and a `bundles.json` it could not write back unchanged (it writes 2-space JSON and keeps the file's line endings). A rule without a final newline gets one. The helper holds the lock file `registry/.bundles.json.lock` while it works and refuses to start when that file exists (delete it only when no run is active); it re-reads `bundles.json` before the rename and refuses when the bytes changed. If a write fails, it removes the rule, the temporary file and the lock it created. Save stdout, stderr and the exit code with the other evidence.

The helper creates only. A repair edits the existing rule in place; the bundle entry stays as it is. Record the baseline hash first and compare the final inventory against it.

Without a shell, follow the same procedure by hand: write the file under `registry/rules/`, append the name to the bundle's `rules[]` in `registry/bundles.json` keeping its formatting, then run the checker.
