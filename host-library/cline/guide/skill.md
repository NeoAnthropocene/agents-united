---
host: cline
artifact: skill
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: skills (including folder anatomy)

Distilled from the snapshots in `host-library/cline/pages/`. Primary source: [skills](../pages/skill/skills.md). Supporting sources: [commands](../pages/command/using-commands.md), [writing-plugins](../pages/hook/writing-plugins.md).

Native output lands in `registry/hosts/cline/skills/<skill>/` (Plan 032, Phase 8). Adoption is upstream first: read `host-library/_upstream/<skill>/` in full, then map its folders onto the Cline anatomy below.

## Rules

### Anatomy

- **A skill is a directory with a required `SKILL.md`; `docs/`, `templates/` and `scripts/` are optional.** `SKILL.md` holds YAML frontmatter and the instructions; `docs/` is for detail too long for the entry file, `templates/` for config and scaffolding, `scripts/` for deterministic operations. [Skill structure](../pages/skill/skills.md#skill-structure), [Bundling supporting files](../pages/skill/skills.md#bundling-supporting-files)
- **The page documents exactly two required frontmatter fields: `name` and `description`.** `name` must match the directory name exactly (lowercase kebab-case, descriptive, never PascalCase or underscores) and `description` is at most 1024 characters. [Skill structure](../pages/skill/skills.md#skill-structure), [Naming conventions](../pages/skill/skills.md#naming-conventions)
- **Keep `SKILL.md` under 5k tokens and put the common cases first.** Cline reads the file sequentially, so front-load the common path, use clear section headers, and move reference material into `docs/` files that Cline reads only when the instructions point at them. [Keeping skills focused](../pages/skill/skills.md#keeping-skills-focused), [Writing your SKILL.md](../pages/skill/skills.md#writing-your-skillmd)
- **Use a script when the operation must be deterministic.** Only a script's output enters the context, not its code, so validation, parsing and calculations belong in `scripts/`, while flexible decisions stay in the instructions. [scripts/](../pages/skill/skills.md#scripts), [Referencing bundled files](../pages/skill/skills.md#referencing-bundled-files)

### Loading and triggering

- **Loading is progressive: metadata at startup, the body when triggered, resources on demand.** Metadata (`name`, `description`) costs about 100 tokens per skill and is always loaded; the `SKILL.md` body loads only when the skill is triggered. [How skills work](../pages/skill/skills.md#how-skills-work)
- **Cline triggers a skill with the `use_skill` tool when the request matches its `description`.** A vague description means the skill will not trigger when expected, so start with what it does (action verbs), include phrases a user would say, and name the file types, tools or domains. [How skills work](../pages/skill/skills.md#how-skills-work), [Writing effective descriptions](../pages/skill/skills.md#writing-effective-descriptions)
- **Every enabled skill is also a slash command, `/<skill-name>`, that forces it immediately.** Skills are enabled by default when discovered and each has a toggle, so a skill can be switched off without deleting its folder. [Triggering skills with slash commands](../pages/skill/skills.md#triggering-skills-with-slash-commands), [Toggling skills](../pages/skill/skills.md#toggling-skills), [Skills via slash commands](../pages/command/using-commands.md#skills-via-slash-commands)

### Locations

- **Project skills are read from `.cline/skills/` (recommended), `.clinerules/skills/` and `.claude/skills/`; global skills from `~/.cline/skills/`.** Commit the project folder so a team shares it. [Where skills live](../pages/skill/skills.md#where-skills-live)
- **When a global skill and a project skill share a name, the global one wins.** Keep general-purpose skills global and project-specific ones in the repo. [Where skills live](../pages/skill/skills.md#where-skills-live)
- **A package plugin can bundle skills in a top-level `skills/` directory next to `package.json`;** Cline discovers them when the plugin is installed or loaded. [Bundling skills](../pages/hook/writing-plugins.md#bundling-skills)

## Authoring notes (agents-united, not host behaviour)

- **Observed, and it disagrees with the docs (CLI 3.0.68, [observations](../observations/2026-10-02-cli-3.0.68.md)):** `.claude/skills/` was not loaded, `.agents/skills/` (project and `~/.agents/skills/`) was, and for a same-named skill `.agents/skills` won over `.cline/skills`. So a Claude install and a Cline install do not overlap in this build, but an `.agents/` install (the Antigravity lane) shadows a Cline-native skill of the same name, so names must not collide across lanes. The docs still say `.claude/skills/` is read; treat that as open and do not rely on either.
- Only `name` and `description` are documented. Other frontmatter keys (for example Claude's `allowed-tools`) have no documented meaning on Cline, so a skill carried over byte-for-byte keeps only keys that are harmless when ignored, and the package says which it relied on.
- The `description` limit (1024 characters) is Cline's; the Claude listing truncates differently. A portable skill's description must satisfy the stricter of the two.
