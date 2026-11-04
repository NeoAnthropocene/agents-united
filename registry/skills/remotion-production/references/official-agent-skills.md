# Official Remotion Agent Skills add-on

Use this for Remotion-selected production, or an explicit user request to research/install official Skills. A research install in a Native project does not switch its renderer. The vendored add-on is optional, not part of `full` or an essentials bundle. Follow [setup and Elements](setup-and-elements.md) for required project-local setup and actual loading evidence.

## Licence boundary

`remotion-agent-skills` carries the official [Remotion Agent Skills](https://github.com/remotion-dev/skills/tree/30d4553ecd46fbc5212fd0ff006ae43af522158b) with the [v4 Remotion License](https://github.com/remotion-dev/remotion/blob/v4.0.539/LICENSE.md). This is **source-available, not MIT**: free for individuals, non-profits, for-profit organizations with up to three employees, and noncommercial suitability evaluation; other for-profit organizations need a Remotion Company License. Selling, renting, licensing or sublicensing a Remotion derivative is prohibited. Every vendored skill keeps `LICENSE.md` and `NOTICE.md`. Reuse an existing eligibility acknowledgement within its scope; installation grants no runtime entitlement.

The pinned standalone snapshot has no licence file of its own. Packaging retained the parent Remotion `LICENSE.md`, but the applicability and redistribution scope remain unresolved below; it is not an established licence resolution and does not relicense official content as MIT.

## Publication review notice

The runtime licence describes eligibility for Remotion use, but copying it from the monorepo does
not by itself prove standalone-skills licence scope or permission to redistribute the snapshot.
The add-on is under a **merge/release hold**, pending pinned upstream evidence or clarification
(ADR 0059 amendment). The commands below document the proposed setup, not redistribution approval.
An optional install does not remove bundled files from the npm package. Do not claim that Pilot 041
used these 12 skills: its harness installed `digital-agency` only; Pilot 040 supplied install proof.

## Install through this repository

These commands describe the existing vendored option; do not choose it as a fresh distribution route while the hold is unresolved. Prefer an already installed compatible official plugin, or the direct upstream route below for authorized local setup:

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

Run from the selected project root, replace the selector for the chosen host, and select only required Skills using the installer's documented options. Inspect existing managed directories before changing them; never overwrite edited files or install duplicate plugin and local triggers. Record the actual installer version, resolved upstream revision when available and installed hashes. Current official [Remotion CLI](https://www.remotion.dev/docs/cli/skills) also provides `remotion skills add`/`update`; check its output location before using it from the nested renderer package. Reuse project-local setup already authorized by the selected production route or explicit install request. Rendering and hooks never initiate installs. An explicit no-install brief remains binding.

## Official plugins

Remotion also ships host plugins that include Agent Skills: Claude Code, Codex (ChatGPT desktop), Cursor Marketplace, GitHub Copilot CLI and Kimi Code. See [official plugins](https://www.remotion.dev/docs/ai/plugins). If an official plugin is already installed, use it and do **not** also install this add-on: duplicate skills create competing triggers. Antigravity and Cline use the Agent Skills paths above; Remotion lists no plugin for them.

## Skill routing

`remotion-best-practices` is the router. Load only the specific skill needed: `remotion-markup` for React/effects/layout, `remotion-studio` for the optional interactive preview, `remotion-render` for CLI rendering, `remotion-docs` for current API lookup, `remotion-captions` for caption work, `remotion-multimedia` for Mediabunny, `remotion-maps` for geographic work, `remotion-interactivity` for Studio-editable structure, `remotion-create` for new projects/compositions, `remotion-saas` for product integrations and `remotion-upgrade` for an approved version change.

The official pack is subordinate to this repository's contracts: [preflight](preflight.md), licence eligibility, canonical timeline/fingerprint, deterministic composition, audio manifest, proof review, helper render and encoded QC remain authoritative. Invoke the discovered router and relevant Skills and verify the returned tool results; installed files alone are not loading evidence. Never let the official pack override those gates or the user's setup scope.

## Update discipline

The add-on is pinned to skill version `4.0.539` at commit `30d4553ecd46fbc5212fd0ff006ae43af522158b`. Before changing the runtime pin, run the [release drift checker](runtime.md#release-drift) and review the new upstream commit, licence and skill layout. Use `remotion-upgrade` only for a reviewed upgrade. This 4.0.539 snapshot ships no separate licence skill; the terms come from the Remotion repository's `LICENSE.md`, reproduced in each folder.

On 2026-11-04 the official Skills page lists 13 Skills, including `remotion-license` added with 4.0.540. The repository still vendors the historical 12; do not claim they are the latest or add new upstream content without the attribution/audit review. Runtime support for 4.0.540 does not upgrade this snapshot. A current upstream install may supply the licence Skill; its presence is still not proof of entitlement.
