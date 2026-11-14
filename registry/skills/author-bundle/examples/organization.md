# Organization proposal: optional integration unavailable

The caller requests a local cross-functional planning draft. The optional GitHub integration is unavailable in the actual session, so a local supplied-input review may proceed with that limitation; no repository operation is claimed. Existing source identities are used for this example, while target delivery is separately unresolved.

`bundles.json`:

```json
{
  "version": 1,
  "bundles": {
    "example-cross-functional": {
      "name": "example-cross-functional",
      "version": "1.0.0",
      "description": "Coordinate supplied local engineering and creative review inputs.",
      "category": "Example",
      "domain": "organization",
      "tier": "organization",
      "status": "under-construction",
      "orchestrator": "orchestrator-digital-agency.md",
      "agents": ["subagent-code-reviewer.md", "subagent-marketing-creative-designer.md"],
      "skills": ["host-agent-router", "handoff", "git-guardrails"],
      "workflows": [],
      "prerequisites": {
        "requiredMcps": [{"name": "github", "purpose": "Optional repository access", "optional": true}],
        "requiredPackages": [],
        "requiredEnvVars": []
      }
    }
  }
}
```

The leader's provisioning responsibility remains in `leader-responsibility.md` even for an empty prerequisite list. Here it distinguishes the optional integration from any required action, reuses same-scope authorization, keeps secrets with the human, and checks actual tools after the selected surface's reviewed route. No setup is performed by this proposal.

| Edge | Status |
| --- | --- |
| Existing lead, specialists and shared Skills | Existing source identities; inspect source and resolver in the selected checkout. |
| GitHub access | Optional and unavailable in this example; local supplied-input work is disclosed as degraded. |
| Target native realization, permission and loading | Separate work; unverified. |
| Quality and live provisioning | Pending independent review; unverified. |
