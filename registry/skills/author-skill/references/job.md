# One-skill job contract

Use this before editing. A forked task must receive the complete record because it does not inherit the caller's conversation.

| Input | Required decision |
| --- | --- |
| Job / intended user | What repeated task improves, what the skill changes, and the output acceptance criteria. |
| Loading role / binding | Who loads the skill, entry and rule paths, invocation, surface and required files. |
| Host / target format | Separate the host executing authoring from the format being authored. Consult the target's reviewed guide/observations before native claims. |
| Intent | Private local draft or upstream preparation; neither implies publication. |
| Source checkout | Explicit reviewed validation/input checkout, its commit and available tools. It is not the output directory. |
| Draft root | Absolute user-selected source path outside managed outputs. Resolve parent paths and links before treating roots as disjoint. |
| Existing files / scope | Create or repair, allowed paths and baseline. For a repair, retain copies/hashes before editing. |
| References / provenance | Actual supplied sources, pins, licences, required notices and unresolved facts. |
| Constraints / budget | User choices, platform/runtime constraints and authorized evidence budget. Missing optional references do not block unrelated work. |

Reject equality or containment between the validation/source checkout and the private draft output. Refuse a draft under managed host outputs. Do not traverse a link into another source or output tree silently. If a proposed repair needs an unapproved path or behavior change, preserve the current draft and request that specific scope decision.

Before creating files, list the planned skill files and how each helps the job. Supporting files must be discoverable from the entry and required resources must survive installation. Keep optional material selective: a host-specific example is read only for that target. An intended runnable skill cannot be relabelled reference-only to bypass its loading gate.

Upstream preparation needs the selected checkout's guide and focused PR template. If either is unavailable, report the prerequisite; do not fabricate an equivalent workflow. Managed workspace-source installation and host-library updates remain separate operations.

## Bounded text helper

Use `scripts/draft.mjs` only after authoring the proposed text and approving its file scope. It runs with Node >=24 and built-in modules from any working directory, including an installed copy. It performs no network, host/model, validator, install or git command. Its stdout is a JSON evidence report; save stdout/stderr and its actual exit (0 prepared, 1 blocked). A prepared draft still needs the quality and provenance checks. Tool presence is reported separately from executed validation.

The one argument is an absolute JSON file containing this record. This JSON is input data, not a shell command. Absolute paths below are illustrative; replace them with the user's actual roots and reviewed binding paths.

```json
{
  "mode": "create",
  "intent": "local",
  "sourceRoot": "/selected/reviewed-checkout",
  "draftRoot": "/selected/private-drafts/incident-actions",
  "allowedPaths": ["SKILL.md", "examples/actions.md"],
  "changes": {
    "SKILL.md": "the complete authored entry, including scalar metadata",
    "examples/actions.md": "the complete authored worked example"
  },
  "provenance": {
    "disposition": "original",
    "owner": "Actual draft author",
    "version": "1.0.0",
    "license": "MIT"
  },
  "loading": {
    "role": "general-purpose",
    "entryPath": "/selected/workspace/.claude/skills/author-skill/SKILL.md",
    "attributionPath": "/selected/workspace/.claude/skills/author-skill/references/skill-attribution.md",
    "requiredFiles": ["/selected/workspace/.claude/skills/author-skill/references/job.md"]
  },
  "requiredTools": [
    { "name": "candidate layout validator", "path": "/selected/reviewed-checkout/tests/helpers/skill-layout.ts" }
  ]
}
```

The helper supports ordinary scalar `metadata` fields; arbitrary YAML belongs to the selected format validator. It verifies a nonempty author and matching version/licence and rejects upstream fields on original/inspired work. It does not decide whether authorship is truthful. For adapted work additionally provide `source` including the full `commit`, an absolute `licencePath`, absolute `comparisonEvidence`, and a relative `licenceTarget` (default `LICENSE`). Declare required notices as `{ "sourcePath": "<absolute inspected notice>", "targetPath": "<relative candidate notice>" }` records in `requiredNotices`. The final candidate must retain the inspected licence and required notice bytes exactly; weak-copyleft/share-alike candidates also need their own `NOTICE.md` changes note. Those paths must exist; read and review their contents first. Their existence does not establish the licence's legal effect, the upstream checkout's pin or originality. Retain applicable licence/notice files in the authored candidate and run the actual licence validator.

Create requires an absent draft directory. For repair, supply `mode: "repair"` and a `baseline` object mapping every existing file's relative path to its SHA-256. Capture that full inventory before proposing changes; a stale/incomplete baseline blocks replacement. The helper applies only `allowedPaths`, copies other existing files and directories, rejects link traversal/managed outputs/overlap, and stages the full result before replacing the draft. It never deletes a requested file; handle authorized removal explicitly outside this helper. Inspect its final inventory/diff and retain a separate baseline copy before editing.

For upstream intent, additionally supply `contributionTemplate`, an absolute path inside the reviewed checkout to the existing focused artifact template. The report's `upstreamPreparation` carries that template plus draft evidence. Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following the checkout's `docs/artifact-contribution.md`; no commit, push, pull request or publication follows. Fill the template's remaining review fields using the actual final checks; a prepared body is not a completed review.

The return record is written by `scripts/skill-return.mjs`, run once after the one `draft.mjs` run and never by hand: `node "${CLAUDE_SKILL_DIR}/scripts/skill-return.mjs" --job <absolute skill-task.json> --saved-job <file> --stdout <file> --stderr <file> --exit-code <0|1> [--report <file>] [--notes <file>]`, or `--no-helper` in place of the four helper flags when the helper never ran. Every file except the task lies under the producer root. The script computes the task id and digest, the status (draft after exit 0, otherwise blocked), the helper pins, the inventory, the changed list and the report pin from the bytes, and writes `<producer>/skill-return.json` with `JSON.stringify`, so Windows backslashes are escaped. The optional notes file (by convention `skill-notes.json`) holds only `openItems`, `unverified`, `claimedChecks` and `externalActions`; a blocked return needs an open item.

The notes file is one JSON object. Its keys are `openItems`, `unverified`, `claimedChecks` and `externalActions`, each optional (default `[]`); no other key is allowed, and `status` is not a note. `openItems` holds at most 16 `{ "id", "description" }` entries (`id` kebab-case, at most 80 characters, unique; `description` 1 to 8192 characters). `claimedChecks` holds at most 16 entries of exactly `{ "name", "command", "exitCode", "raw" }`: `name` 1 to 512 characters, `command` 1 to 8192 characters, `exitCode` an integer 0 to 255 or `null`, and `raw` either `null` or a pin of a saved output, exactly `{ "path", "bytes", "sha256" }` (an absolute path, the byte count at most 524288, the lowercase 64-hex sha256). No task budget lowers this byte limit for this script. `unverified` is at most 32 texts and `externalActions` at most 16 texts, each 1 to 8192 characters (the script refuses a non-empty `externalActions`). A claimed check is recorded, never run or resolved. One valid notes file:

```json
{
  "openItems": [{ "id": "licence-open", "description": "The licence of the source is not confirmed." }],
  "unverified": ["Live loading in a Host session."],
  "claimedChecks": [
    { "name": "layout", "command": "node --version", "exitCode": 0, "raw": null },
    { "name": "helper-log", "command": "node draft.mjs", "exitCode": 0, "raw": { "path": "<absolute path of the saved output>", "bytes": 120, "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" } }
  ],
  "externalActions": []
}
```

The `assets/report.md` outline is a hand-off guide, not the return.

Without a shell, follow the same bounded procedure manually: compare resolved roots, inspect each prerequisite and provenance source, capture all baseline hashes, apply only the proposed paths, preserve unrelated content, and compute the final inventory/diff. If required checks cannot run, preserve the draft and return the named blocked check. Do not substitute the helper's prerequisite checks for a quality verdict.
