# Official Remotion Agent Skills: upstream installation

Use for Remotion-selected production or an explicit request to research/install official Skills. A research install in a Native project does not switch its renderer. Follow [setup and Elements](setup-and-elements.md) for one setup owner and actual loading evidence.

## Distribution and licence boundary

Agents United does **not distribute** the official Remotion Skills. The former `remotion-agent-skills` Bundle and its twelve copied folders were removed after the standalone snapshot's licence scope and redistribution permission could not be established. This resolves our packaging route by removal; it does not establish new rights or declare the upstream unlicensed. ADR 0059 retains the historical decision and its publication hold; its upstream-only amendment supersedes the vendoring decision.

The original `remotion-production` Skill, helpers and templates remain MIT. Runtime eligibility and upstream Skill terms are separate. Inspect the selected upstream revision and applicable licence before installing; reuse an existing acknowledgement only within its stated purpose and scope. Never infer entitlement from a successful installation, a free evaluation or our MIT licence. Do not copy official Skill contents back into this repository.

## Install from upstream or reuse one official plugin

Inspect the host's actual inventory first. Reuse one compatible official plugin or existing upstream installation. Otherwise, complete authorized project-local setup using the [official documented installer](https://www.remotion.dev/docs/ai/skills):

```text
npx skills add remotion-dev/skills -a claude-code
```

Run from the chosen project root. Replace the host selector and choose only required Skills using the installer's documented options. Record actual installer version, resolved source revision (or explicitly mark it unverified), installed hashes and output location. Inspect managed/user-edited directories before changing them. Never install duplicate plugin and local triggers. Required project-local setup reuses the production authorization; an explicit no-install brief remains binding. Rendering and hooks do not initiate installation.

The project-local [Remotion CLI](https://www.remotion.dev/docs/cli/skills) also exposes `remotion skills add` and `update`; inspect its output location before invoking it from the nested renderer package. This guide documents alternatives, not a reason to run both installers. There is no `agents add remotion-agent-skills` replacement Bundle.

| Host | Project Skills | User-global Skills | Installer selector |
|---|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` | `-a claude-code` |
| Codex | `.agents/skills/` | `~/.agents/skills/` | `-a codex` |
| Cursor | `.agents/skills/` | `~/.cursor/skills/` | `-a cursor` |
| Antigravity | `.agents/skills/` | `~/.gemini/antigravity/skills/` | `-a antigravity` |
| Cline | `.agents/skills/` | `~/.agents/skills/` | `-a cline` |
| OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` | `-a opencode` |
| GitHub Copilot | `.agents/skills/` | `~/.copilot/skills/` | `-a github-copilot` |
| Kimi Code | `.agents/skills/` | `~/.agents/skills/` | `-a kimi-code-cli` |

The host-path table was reviewed on 2026-10-29; recheck the selected installer's current host support before setup. Host-wide invocation is **unverified** until its actual result is inspected. [Official plugins](https://www.remotion.dev/docs/ai/plugins) are another route for the listed supported hosts. No plugin is required for Antigravity or Cline to use their native Skill paths.

## Existing Agents United-managed installations

Removing source folders from a new package does not uninstall previously copied files. Inventory the existing installation and back up customized Skills and project source before migration. Keep the agency installed as its own Bundle if it must survive removing the historical child Bundle. The dry run must show the intended scope:

```text
agents remove remotion-agent-skills --dry-run
agents remove remotion-agent-skills
```

Run in the installed project and select the actual scope/state location. Do not use `--force` to bypass edited-file conflicts. If a conflict occurs, preserve/reconcile the edits and repeat the dry run. Check the removed paths and remaining agency roles, shared Skills and project source. Then install upstream into the now-vacant chosen host path, or reuse its existing plugin. Do not allow an upstream installer to overwrite an old managed folder while its lockfile still claims ownership. Global and other-host migrations need their matching scope/location; the local fixture proof does not establish every host.

## Route and verify actual loading

Invoke discovered `remotion-best-practices`, then `remotion-markup` for composition work. Follow the discovered router’s applicable new-project `remotion-create` reference direction; record reference use, not a Skill invocation, when reading that reference. Load other guidance only when needed. Add `remotion-render`, `remotion-studio`, `remotion-docs`, `remotion-license` or other Skills only when needed. Names and plugin namespaces come from actual host discovery. Record installed, discovered, invoked and used separately: shell-reading `SKILL.md` is reference use, not a successful Skill invocation. If loading fails, use host guidance and report the exact limitation.

Official guidance informs authoring; our [preflight](preflight.md), purpose-specific licence record, canonical timeline/fingerprint, Sound handoff, proof review, measured helper render and encoded QC remain authoritative. Updating upstream Skills does not upgrade the project's runtime. Existing locked projects keep their reviewed exact version unless an upgrade is accepted. [Runtime setup](runtime.md) documents supported versions and the release checker. Current official installation and revised orchestration must still be verified from real maintainer-supplied Host records.
