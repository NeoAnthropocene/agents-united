---
host: antigravity
artifact: skill
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: skills (including folder anatomy)

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary source: [skills](../pages/skill/skills.md). Supporting sources: [plugins](../pages/plugin/plugins.md), [SDK tools](../pages/tools/sdk-tools.md).

Native output lands in `registry/hosts/antigravity/skills/<skill>/` (Plan 032, Phase 8) only where a skill needs host-specific text; portable skills are installed as written from `registry/skills/` (the Cline lane made the same call, ADR 0029).

## Rules

### Anatomy

- **A skill is a folder with a required `SKILL.md`; `scripts/`, `examples/` and `resources/` are optional.** Skills follow the open Agent Skills standard. [Anatomy of a skill](../pages/skill/skills.md#anatomy-of-a-skill), [What are skills?](../pages/skill/skills.md#what-are-skills)
- **The frontmatter documents two fields: `description` is required, `name` is optional (lowercase with hyphens) and defaults to the folder name.** [Frontmatter fields](../pages/skill/skills.md#frontmatter-fields)
- **Write the description in third person, say what the skill does and when it applies, and include keywords that help the agent recognise it.** [Frontmatter fields](../pages/skill/skills.md#frontmatter-fields), [Write clear descriptions](../pages/skill/skills.md#write-clear-descriptions)
- **Keep a skill focused on one job, add a decision tree for complex ones, and encourage running bundled scripts with `--help` instead of reading their source.** [Keep skills focused](../pages/skill/skills.md#keep-skills-focused), [Include decision trees](../pages/skill/skills.md#include-decision-trees), [Use scripts as black boxes](../pages/skill/skills.md#use-scripts-as-black-boxes)

### Loading and invoking

- **Loading is progressive: the agent sees names and descriptions at the start, reads the full `SKILL.md` when a skill looks relevant, and then follows it.** Mentioning a skill by name makes sure it is used. [How the agent uses skills](../pages/skill/skills.md#how-the-agent-uses-skills)
- **In Antigravity 2.0, `/<skill-name>` invokes a skill explicitly; the CLI converts every skill into a slash command automatically.** [Invoking skills in Antigravity 2.0](../pages/skill/skills.md#invoking-skills-in-antigravity-20), [Slash command conversion](../pages/skill/skills.md#slash-command-conversion)

### Locations

- **Workspace skills are in `<workspace-root>/.agents/skills/<skill-folder>/`; the older `.agent/skills` is still read.** [Agent skills](../pages/skill/skills.md#agent-skills)
- **Global skills are in `~/.gemini/config/skills/` for Antigravity 2.0 and the IDE (the IDE also reads the legacy `~/.gemini/antigravity/skills/`) and in `~/.gemini/antigravity-cli/skills/` for the CLI.** [Antigravity 2.0 skill locations](../pages/skill/skills.md#antigravity-20-skill-locations), [CLI skill locations](../pages/skill/skills.md#cli-skill-locations), [Antigravity IDE skill locations](../pages/skill/skills.md#antigravity-ide-skill-locations)
- **Plugins can carry skills (`skills/<name>/SKILL.md`, and `~/.gemini/antigravity-cli/plugins/<name>/skills/` for the CLI), managed with `agy plugin`.** [Managing skills with plugins](../pages/skill/skills.md#managing-skills-with-plugins), [Directory structure](../pages/plugin/plugins.md#directory-structure)
- **In the SDK, `skills_paths` takes a skill directory or a parent holding several.** [Agent skills](../pages/tools/sdk-tools.md#agent-skills)

## Authoring notes (agents-united, not host behaviour)

- **The docs list no size limit and no description length limit for a skill.** `docs/host-primitive-matrix.md` records the same, and the portability lint (`skill-portability-lint.ts`) already holds every skill to the stricter Cline and Claude limits, which makes them safe here.
- **Only `name` and `description` are documented.** The registry's skills also carry `metadata:` and, for some, the Claude-only `disable-slash-command`; neither has a documented meaning here, so a native package says which keys it relied on being ignored (unverified on the CLI).
- **`.agents/skills/` is the canonical store of this repository and also a lane Cline reads** (and, observed, one that wins over `.cline/skills/`, ADR 0028), so a skill installed here is seen by both hosts; names must not collide across lanes.
- **Two registry names are not clean for this host** (recorded in the profile as `skillNames`, unverified): `generative_ui` keeps its underscore in the `.agents/skills/` copy although the docs ask for lowercase with hyphens, and `grill-me` is also a built-in slash command. `tests/native-antigravity-skills.test.ts` pins both as the only exceptions and reads the built-in names from the snapshots.
- The docs say `name` defaults to the folder name, while Cline requires it to equal the folder name; a portable skill keeps both equal.
- **Observed, not documented: a skill folder installed as a link is not listed.** On agy 1.2.16 (Windows, headless) real-folder skills were listed, including a copy of a registry skill with its `metadata:`, multi-line description and `disable-slash-command`, while the same skills installed as NTFS junctions (the default `agents add` method) were not (`observations/2026-10-03-agy-1.2.16-probes.md`). A native package for this host therefore needs `--copy` for its skills; POSIX symlinks and file symlinks were not tried.
