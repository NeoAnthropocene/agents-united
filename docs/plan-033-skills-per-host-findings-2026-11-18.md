# Plan 033: should a Skill be written once per Host? Findings (2026-11-18)

The maintainer asked, before the Claude lane of the remaining Bundles is started, whether "creating the Skills for every Host is the right choice for our case". This record holds what the lead of the session of 2026-11-18 (an AI session) found in the repository and in the Hosts' docs libraries, and its recommendation. It is a finding and a recommendation, not a decision: the maintainer has not decided.

No Host session was started for this record. Everything below is read from files in the repository at `dev` `c4156dd`, and from the Codex docs snapshot fetched on 2026-11-18, which is on a local branch and not yet on `dev`.

## What the repository does today

| Where | Count |
| --- | --- |
| Shared Skills, `registry/skills/` | 216 folders |
| Claude-native Skill files, `registry/hosts/claude/skills/` | 7 |
| Cline-native Skill files, `registry/hosts/cline/skills/` | 1 |
| Antigravity-native Skill files | 0 |

The seven Claude ones are the factory's own Skills (`author-bundle`, `author-contract`, `author-skill`, `coordinate-artifact`, `evaluate-artifact`, `realize-artifact`, `sync-host`). Each is ONE file, a `SKILL.md`; the scripts, references and assets of the Skill stay in `registry/skills/<name>/` (9 to 25 files each) and are installed from there. At install the native lane takes the native `SKILL.md` where one exists (`src/core/claude-projector.ts`, `nativeSkillSource`) and the shared one otherwise.

How far the seven differ from their shared `SKILL.md` (lines that differ, either side, of a file of 40 to 62 lines): `sync-host` 2, `coordinate-artifact` 5, `realize-artifact` 5, `author-skill` 9, `author-contract` 13, `evaluate-artifact` 13, `author-bundle` 38.

What the differences are, read in `author-skill` and `sync-host`:

- Claude frontmatter: `context: fork`, `agent: general-purpose`, `background: false`, `user-invocable: false`.
- Sentences about how the Skill is started on Claude Code (the invocation text is the path of a task record) and where an installed file sits.

So the practice today is a shared Skill with a thin Host layer for seven of 216, not a Skill written per Host. [ADR 0025](adr/0025-native-host-packages-and-host-docs-library.md) decision 6 reads "Skills are native per host, upstream first" and, in the same decision, "Host-neutral skills pass through byte-for-byte where the host's skill rules allow."

## What each Host's docs library says about the format

| Host | Format | Folder | Source in the library |
| --- | --- | --- | --- |
| Claude Code | a folder with `SKILL.md`; YAML frontmatter; `name` optional, `description` recommended; twenty documented fields in all | `.claude/skills/` | `host-library/claude/pages/skill/skills.md`, the frontmatter table |
| Cline | "Every skill is a directory containing a `SKILL.md` file with YAML frontmatter"; `name` "must exactly match the directory name"; `description` at most 1024 characters | `.cline/skills/` | `host-library/cline/pages/skill/skills.md` |
| Antigravity | "Skills are an open standard" (agentskills.io); a folder with a required `SKILL.md`; `name` optional, `description` required | `.agents/skills/` (and `.agent/skills/`) | `host-library/antigravity/pages/skill/skills.md` |
| Codex | follows the "open agent skills standard" (agentskills.io); a directory with `SKILL.md` that "must include `name` and `description`" | `.agents/skills/` | the Codex snapshot of 2026-11-18, `pages/skill/build-skills.md`, not yet on `dev` |

The common part is the same on all four: a folder, a `SKILL.md`, YAML frontmatter with `name` and `description`, a body the Host loads when the description matches. Three of the four name the same public standard.

Where the Hosts differ:

- **The folder.** That is the installer's work, not a reason for a second text.
- **Frontmatter beyond `name` and `description`.** Claude Code documents, among others, `context`, `agent`, `background`, `allowed-tools`, `disallowed-tools`, `user-invocable`, `disable-model-invocation`, `hooks`, `paths`, `model`, `effort`. The Antigravity page lists `name` and `description` only.
- **The rule for `name`.** Cline requires it to equal the folder name; Claude Code and Antigravity fall back to the folder name.
- **Body text that names a Host's own tool or command.** A sentence such as "start a foreground subagent with the Agent tool" is true on one Host only.

## Recommendation

One shared Skill per topic, and a Host layer only where a Host feature needs it. Three kinds, in order of preference:

1. **Shared.** The Skill lives in `registry/skills/<name>/` and is installed unchanged into each Host's folder. This is the default. Its `SKILL.md` carries `name` (equal to the folder name, which satisfies Cline) and `description`, and its body names no Host tool.
2. **Shared with a Host `SKILL.md`.** The scripts, references and assets stay shared; `registry/hosts/<host>/skills/<name>/SKILL.md` replaces the entry file for that Host. Use it when (a) the Skill needs frontmatter only that Host has, such as running as a fork or limiting tools, or (b) the body must name that Host's tool or command and cannot be worded neutrally.
3. **Host-only.** A Skill that exists for one Host because it is about a feature the others lack. Rare.

Why not a full copy per Host:

- The format is the one artifact kind the four Hosts share. Agents, hooks, rules, workflows, tool grants and MCP wiring are where they differ, and where a native version earns its cost.
- Copies drift. On 2026-11-18 one change of wording had to be made in two copies of `author-skill` in lockstep, and nothing but the author's care kept them the same.
- 216 Skills on four Hosts would be 864 entry files to keep in step, review and prove, most of them identical.

What the recommendation costs:

- A shared body is written for the least capable reader. Where a Host could do more, kind 2 is the way to use it, and that Skill then has two entry files to keep in step.
- A Host `SKILL.md` can drift from the shared one in the lines that should be the same. No test ties the two together today, beyond what each Bundle's own tests pin.

## Not verified

- Whether each Host ignores frontmatter fields it does not know. If all four do, one `SKILL.md` carrying Claude's extra fields could serve every Host and most of kind 2 would disappear. If one of them refuses or mis-reads an unknown field, kind 2 stays necessary. The libraries read here do not say; it needs a short check on each Host.
- How the shared Skills read today: how many of the 216 name a Host's tool in their body. That decides how much rewording kind 1 needs and was not counted.
- Whether Codex, Antigravity and Cline load a Skill's scripts and references the same way (relative links, the working folder of a script).
- Nothing here was observed in a Host session.

## What it would mean for the Claude lane of the remaining Bundles

Finishing a Bundle for Claude Code would be: native agents, hooks, rules and workflows for that Bundle, its Skills left shared, and a Claude `SKILL.md` added only for reason (a) or (b) above, each with the reason written beside it.
