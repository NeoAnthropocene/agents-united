# Picking Up Newly Installed Skills (per host)

> Owner finding, Gate 7 field test (2026-09-25): `agents add` installs skills while a host
> session is already open — but hosts discover skills **at session start**. Without a reload
> step, the new skills/slash commands are invisible to that session.

## The universal rule

**Slash commands only fire when the USER types them into the session prompt.** An agent can
never invoke a slash command itself. But an agent can ALWAYS read a skill directly —
the skill is a file (`Read`/`view_file` on `<host skills dir>/<name>/SKILL.md`) — so a
"missing" skill is never a hard blocker.

## Per-host reload matrix

| Host | How the current session picks up new skills | Notes |
|---|---|---|
| **Claude Code** | User types **`/reload-skills`** (feature tracked in [anthropics/claude-code#58733](https://github.com/anthropics/claude-code/issues/58733); verify availability on your version) | Fallback: start a new session, or have the agent read `.claude/skills/<name>/SKILL.md` directly |
| **Antigravity CLI** | User types **`/skills reload`** | Asynchronously reloads discovered skills and slash commands without restarting the session or blocking input |
| **Antigravity Desktop App** | No reload command — **close and reopen the app** | Workaround without restart: reference the skill explicitly with `@<skill_name>` |
| **Cline** | No reload command — the agent reads the skills folder directly (`.cline/skills/`, or the global Cline skills folder for global installs) | Projected skills are plain files; content is available immediately even before Cline's picker updates |
| **Cursor / OpenCode / Codex** | Restart the session (skills are scanned at startup) | Same file-read fallback applies |

## What the installer tells you

After every install/`agents add`, the CLI prints a **"Pick up new skills"** note with the rows
above for the hosts you selected. The host agent itself is also instructed (via the projected
rules) to look up freshly installed skills by reading the skills folder when a referenced skill
is not yet in its discovered list.

## Authoring rule (for registry editors)

Agents must reference skills by **name** (`grill-me`, `workflow-implement`), never assume a
typed slash command works mid-session. Where a slash form is mentioned for user convenience,
phrasing must make clear the USER types it.