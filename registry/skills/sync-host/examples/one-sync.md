# Worked Example: Single Host-Update Sync Plan

> **Note**: This worked example is a static illustration of the input → output `computePlan` join rules, not an executed live result.

## Illustration Scenario

Suppose the caller prepared `/workspace/evidence/sync-job.json` (`id: "sync-claude-sample"`, `host: "claude"`, `source.checkout: "/workspace/repo"`) and obtained preflight `jobDigest` `"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"` from `node <installed skill folder>/scripts/check-sync.mjs --job /workspace/evidence/sync-job.json`:

- **Changed inputs**:
  1. `/workspace/repo/host-library/claude/pages/agent/sub-agents.md`: `oldSha256: "1111111111111111111111111111111111111111111111111111111111111111"`, `newSha256: "2222222222222222222222222222222222222222222222222222222222222222"` (lock-tracked page pinned by target job `realize-code-reviewer` at the old hash).
  2. `/workspace/repo/host-library/claude/guide/agent.md`: `oldSha256: "3333333333333333333333333333333333333333333333333333333333333333"`, `newSha256: "4444444444444444444444444444444444444444444444444444444444444444"` (guide pinned by target job `realize-code-reviewer` at the old hash).
  3. `/workspace/repo/host-library/claude/pages/skill/skills.md`: `oldSha256: "5555555555555555555555555555555555555555555555555555555555555555"`, `newSha256: "6666666666666666666666666666666666666666666666666666666666666666"` (lock-tracked page pinned by no target in `targets`).
- **Held source**:
  1. `/workspace/repo/host-library/claude/pages/mcp/mcp.md`: `lockedSha256: "7777777777777777777777777777777777777777777777777777777777777777"`, `candidateSha256: "8888888888888888888888888888888888888888888888888888888888888888"`, `rule: "injection/exfiltration"`, `reason: "Hold until upstream documentation audit clears the candidate page"` (pinned by target job `realize-code-reviewer` at `7777...`).
- **Target**:
  1. `path: "/workspace/evidence/code-reviewer.job.json"`, `sha256: "9999999999999999999999999999999999999999999999999999999999999999"`, `bytes: 1024`, pointing to a target realizer job record with:
     - `id: "realize-code-reviewer"`
     - `source: { checkout: "/workspace/repo" }`
     - `artifact: { type: "agent", definition: "subagent-code-reviewer", paths: [".claude/agents/code-reviewer.md"] }`
     - `inputs`:
       - `{ kind: "snapshot", path: "/workspace/repo/host-library/claude/pages/agent/sub-agents.md", sha256: "1111111111111111111111111111111111111111111111111111111111111111" }`
       - `{ kind: "guide", path: "/workspace/repo/host-library/claude/guide/agent.md", sha256: "3333333333333333333333333333333333333333333333333333333333333333" }`
       - `{ kind: "snapshot", path: "/workspace/repo/host-library/claude/pages/mcp/mcp.md", sha256: "7777777777777777777777777777777777777777777777777777777777777777" }`

## Resulting `host-update-sync-plan` Record (Illustration Only)

```json
{
  "version": 1,
  "kind": "host-update-sync-plan",
  "jobId": "sync-claude-sample",
  "host": "claude",
  "jobDigest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "proposalOnly": true,
  "implemented": false,
  "heldSourcesAdvanced": false,
  "quality": "pending",
  "live": "unverified",
  "artifacts": [
    {
      "job": {
        "path": "/workspace/evidence/code-reviewer.job.json",
        "sha256": "9999999999999999999999999999999999999999999999999999999999999999"
      },
      "jobId": "realize-code-reviewer",
      "artifact": {
        "type": "agent",
        "definition": "subagent-code-reviewer",
        "paths": [
          ".claude/agents/code-reviewer.md"
        ]
      },
      "affected": true,
      "changedPins": [
        {
          "kind": "snapshot",
          "path": "/workspace/repo/host-library/claude/pages/agent/sub-agents.md",
          "pinnedSha256": "1111111111111111111111111111111111111111111111111111111111111111",
          "oldSha256": "1111111111111111111111111111111111111111111111111111111111111111",
          "newSha256": "2222222222222222222222222222222222222222222222222222222222222222",
          "pinnedAtPrevious": true
        },
        {
          "kind": "guide",
          "path": "/workspace/repo/host-library/claude/guide/agent.md",
          "pinnedSha256": "3333333333333333333333333333333333333333333333333333333333333333",
          "oldSha256": "3333333333333333333333333333333333333333333333333333333333333333",
          "newSha256": "4444444444444444444444444444444444444444444444444444444444444444",
          "pinnedAtPrevious": true
        }
      ],
      "heldPins": [
        {
          "path": "/workspace/repo/host-library/claude/pages/mcp/mcp.md",
          "pinnedSha256": "7777777777777777777777777777777777777777777777777777777777777777"
        }
      ],
      "reason": "Pins pages/agent/sub-agents.md and guide/agent.md at their previous sha256 hashes before the library update; held pin pages/mcp/mcp.md stays held with no action."
    }
  ],
  "unpinnedChanges": [
    "/workspace/repo/host-library/claude/pages/skill/skills.md"
  ],
  "heldSources": [
    {
      "path": "/workspace/repo/host-library/claude/pages/mcp/mcp.md",
      "lockedSha256": "7777777777777777777777777777777777777777777777777777777777777777",
      "candidateSha256": "8888888888888888888888888888888888888888888888888888888888888888",
      "disposition": "not advanced, no action"
    }
  ]
}
```
