# Fixed job and scope

The caller supplies a job ID and caller-held digest; operation (`create`, `update`, `reuse`); Domain or Organization template; literal name, version, status, domain, category and description; applicable parent, roster, leader and shared-core identities; local or upstream intent; and complete constraints and acceptance IDs. Explicitly record empty lists. Preserve fixed values and obtain missing required inputs from the caller without repeating answered questions.

Pin source registry, validation checkout and actual HEAD, runtime and selected offline checks; reviewed target Host/surface separately from the Host running authoring; source, draft, evidence, managed and protected roots; allowed changes, full baseline and input hashes; provenance, prerequisite table, required inputs and budgets. A named target claim requires that target's reviewed guide, locked citations, observations, profile, tool policy and availability. A shared proposal can leave target realization pending.

Use a new or explicitly authorized update directory disjoint from source, evidence, managed installs and protected roots. Preserve unrelated baseline files as preservation-only. Write only `bundles.json` (existing manifest envelope with proposed record), `leader-responsibility.md`, `bindings.json` and `report.json`. Do not write the source registry, `.claude/agents`, managed configuration, credentials or global files. Do not install the candidate or claim managed Option A.

Task-path mode: when the invocation text is one absolute path to a `bundle-task.json`, that file is the job, and its fields (`bundle`, `fixedValues`, `constraints`, `acceptance`, `roots`, `allowedPaths`, `protectedNotes`, `baseline`, `inputPins`, `provenance`, `budget`) answer the inputs above. Read it, write the four files only inside `roots.draft` (an update changes only `allowedPaths`), then run `node "${CLAUDE_SKILL_DIR}/scripts/bundle-return.mjs" --job <task path>` once. The helper inventories the draft without following links, compares it with the task's `baseline`, pins `report.json` and writes exactly one file, `<roots.producer>/bundle-return.json`; it writes nothing in the draft and executes nothing. What only you know goes in an optional notes file you write in `roots.producer` and pass as `--notes <absolute path>`: one JSON object with `status` (`draft` or `blocked`; blocked needs an open item), `openItems` (`{ id, description }`), `unverified`, `claimedChecks` (`{ name, command, exitCode, raw }`; `raw` is `null` or a pin of a saved output, exactly `{ path, bytes, sha256 }` with an absolute path, bytes at most 524288 and the lowercase 64-hex sha256; at most 6 entries and the task's check budget; the byte limit of a `raw` pin is the smaller of 524288 and the task's `budget.maxCheckLogBytes`), `externalActions` and, for upstream intent, `upstreamEvidence`. Without notes the status is `draft` and the lists are empty. One valid notes file:

```json
{
  "status": "draft",
  "openItems": [{ "id": "licence-open", "description": "The licence of the source is not confirmed." }],
  "unverified": ["Live loading in a Host session."],
  "claimedChecks": [
    { "name": "layout", "command": "node --version", "exitCode": 0, "raw": null },
    { "name": "helper-log", "command": "node bundle-return.mjs", "exitCode": 0, "raw": { "path": "<absolute path of the saved output>", "bytes": 120, "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" } }
  ],
  "externalActions": []
}
```

A blocked task leaves the draft as it was. Exit 0 prints one JSON line; exit 1 prints a blocked reason on stderr and writes nothing: fix the cause or return the open item. Reply with the task, draft and return paths; the caller checks everything.

Limits: at most four authored files, 256 KiB each and 1 MiB total; 32 preserved files/2 MiB; 32 pinned text inputs/4 MiB; six caller-selected offline checks, ten minutes and 512 KiB raw output each. If a cap is exceeded, return the scoped open item without silently truncating. These are guidance and budgets, not an OS sandbox. Zero live/model/provider runs, private transcript reads or spend. Repository implementation gates have separate durations.

Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following the checkout's `docs/artifact-contribution.md`; no commit, push, pull request or publication follows. The prepared evidence goes with the template. Contribution and publication need separate authorization. The caller retains the original job outside returned text and independently checks scope, digest and output.
