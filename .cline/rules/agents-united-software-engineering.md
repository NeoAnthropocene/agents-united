# Agents United — software-engineering Coordinator Rule
<!-- managed-by: agents-united | profile: cline | bundle: software-engineering | do not edit -->

> Installed bundle: **software-engineering** (project scope)
> Team Manifest: `.cline/agents-united/teams/software-engineering.yaml`
> Coordinator role: `orchestrator-engineering` (`.agents/agents/orchestrator-engineering.md`)

## Activation Protocol
1. At session start, read the Team Manifest (`.cline/agents-united/teams/software-engineering.yaml`) and coordinator role prompt (`.agents/agents/orchestrator-engineering.md`).
2. Delegate specialist tasks using **Agent Teams** (`team_spawn_teammate`, `team_delegate_task`) when available, assigning non-overlapping scopes.
3. For lightweight read-only research, use session subagents.
4. Only specialist roles declared in the Team Manifest are active in this workspace.

### Installed Specialist Roles
- **subagent-backend-architect**: `.agents/agents/subagent-backend-architect.md`
- **subagent-frontend-architect**: `.agents/agents/subagent-frontend-architect.md`
- **subagent-code-reviewer**: `.agents/agents/subagent-code-reviewer.md`
- **subagent-repo-index**: `.agents/agents/subagent-repo-index.md`

### Recommended Addon Policy
When user tasks require capabilities from: mobile-development, frontend-engineering, backend-distributed-systems, qa-automation, devops-engineering, ai-ml-engineering, explain the capability and request user confirmation to install via `agents add <addon> -t cline -y` before running the installation.
