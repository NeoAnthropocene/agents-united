# Domain proposal: supplied existing assets

The caller selected a local draft, a data-rich review workflow and an explicitly empty prerequisite table. This concrete manifest uses existing catalog assets; it is a proposal fixture for the selected checkout, not evidence of installation or live loading. No leader is proposed, so the responsibility record names that absence and applicable prerequisites as none.

`bundles.json`:

```json
{
  "version": 1,
  "bundles": {
    "example-review-domain": {
      "name": "example-review-domain",
      "version": "1.0.0",
      "description": "Review a supplied local change and hand off findings.",
      "category": "Example",
      "domain": "engineering",
      "tier": "domain",
      "status": "under-construction",
      "agents": ["subagent-code-reviewer.md"],
      "skills": ["requesting-code-review", "host-agent-router", "handoff", "git-guardrails"],
      "workflows": [],
      "prerequisites": {"requiredMcps": [], "requiredPackages": [], "requiredEnvVars": []}
    }
  }
}
```

| Edge | Status |
| --- | --- |
| Canonical reviewer and four named Skills | Existing sources in the pinned checkout; verify paths and selected resolver output. |
| Target native reviewer, loading and ownership | Not established by this example; separate target realization and delivery review. |
| Quality and live behavior | Pending independent review; unverified. |

The example declares the three shared Skills once. Their presence does not preload or authorize cross-Host routing. `bindings.json` records actual inspected edges and `report.json` records caller checks; neither is shown as an executed result here.
