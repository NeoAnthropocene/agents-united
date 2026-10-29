# Official Remotion Agent Skills add-on

Use this only after `media/project.json` selects `remotion`; never load it for a Native production. It is an optional add-on, not part of `full` or an essentials bundle.

## Licence boundary

`remotion-agent-skills` carries the official [Remotion Agent Skills](https://github.com/remotion-dev/skills/tree/30d4553ecd46fbc5212fd0ff006ae43af522158b) under the [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md). This is **source-available, not MIT**: free for individuals, non-profits, for-profit organizations with up to three employees, and noncommercial suitability evaluation; other for-profit organizations need a Remotion Company License. Selling, renting, licensing or sublicensing a Remotion derivative is prohibited. Every vendored skill keeps `LICENSE.md` and `NOTICE.md`. Installing the add-on requires the user's eligibility acknowledgement; it grants no runtime entitlement.

The official standalone repo has no licence file of its own; the parent Remotion `LICENSE.md` supplies the terms. This packaging records that resolution and does not relicense the official content as MIT.

## Install through this repository

The add-on exists only when the user opts in after choosing Remotion:

```text
agents add remotion-agent-skills -t claude --native
agents add remotion-agent-skills -t antigravity
agents add remotion-agent-skills -t cline
agents add remotion-agent-skills -t cursor
agents add remotion-agent-skills -t opencode
agents add remotion-agent-skills -t agentsmd
```

**Install footprint (verified 2026-10-29, Claude `--native`):** because this is an add-on, the CLI
also installs its parent `digital-agency` team — exit 0, 12 agents and 80 skills, of which 12 are
the official Remotion skills. Digital-agency and `full` do **not** contain the official skills;
they arrive only through this explicit add-on.

Claude's `--native` lane is the currently tested native path. Use the matching built host otherwise. Codex is on the factory sequence but has no dedicated package in this repository yet; use its native `.agents/skills/` path below or its official plugin.

## Host installation when using upstream directly

The official [skills installer](https://github.com/vercel-labs/skills) supports these hosts. Its host table was read on 2026-10-29; re-check the host's own documentation before a release.

| Host | Project skills | User-global skills | Install selector |
|---|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` | `-a claude-code` |
| Codex | `.agents/skills/` | `~/.agents/skills/` | `-a codex` |
| Cursor | `.agents/skills/` | `~/.cursor/skills/` | `-a cursor` |
| Antigravity | `.agents/skills/` | `~/.gemini/antigravity/skills/` | `-a antigravity` |
| Cline | `.agents/skills/` | `~/.agents/skills/` | `-a cline` |
| OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` | `-a opencode` |
| GitHub Copilot | `.agents/skills/` | `~/.copilot/skills/` | `-a github-copilot` |
| Kimi Code | `.agents/skills/` | `~/.agents/skills/` | `-a kimi-code-cli` |

Direct upstream installation, after eligibility review:

```text
npx skills add remotion-dev/skills -a claude-code
```

Replace the selector for the chosen host. This is an explicit user/install action, not something a render, hook or agent may run automatically.

## Official plugins

Remotion also ships host plugins that include Agent Skills: Claude Code, Codex (ChatGPT desktop), Cursor Marketplace, GitHub Copilot CLI and Kimi Code. See [official plugins](https://www.remotion.dev/docs/ai/plugins). If an official plugin is already installed, use it and do **not** also install this add-on: duplicate skills create competing triggers. Antigravity and Cline use the Agent Skills paths above; Remotion lists no plugin for them.

## Skill routing

`remotion-best-practices` is the router. Load only the specific skill needed: `remotion-markup` for React/effects/layout, `remotion-studio` for the optional interactive preview, `remotion-render` for CLI rendering, `remotion-docs` for current API lookup, `remotion-captions` for caption work, `remotion-multimedia` for Mediabunny, `remotion-maps` for geographic work, `remotion-interactivity` for Studio-editable structure, `remotion-create` for new projects/compositions, `remotion-saas` for product integrations and `remotion-upgrade` for an approved version change.

The official pack is subordinate to this repository's contracts: [preflight](preflight.md), licence eligibility, canonical timeline/fingerprint, deterministic composition, audio manifest, proof review, helper render and encoded QC remain authoritative. Never let the official pack override those gates or install/upgrade packages without approval.

## Update discipline

The add-on is pinned to skill version `4.0.539` at commit `30d4553ecd46fbc5212fd0ff006ae43af522158b`. Before changing the runtime pin, run the [release drift checker](runtime.md#release-drift) and review the new upstream commit, licence and skill layout. Use `remotion-upgrade` only for a reviewed upgrade. This 4.0.539 snapshot ships no separate licence skill; the terms come from the Remotion repository's `LICENSE.md`, reproduced in each folder.
