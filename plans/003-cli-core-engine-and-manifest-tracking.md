# Plan 003: CLI Command Engine & Lockfile Manifest Manager

## Overview
Implement the CLI engine with Commander / CAC + Clack/Picocolors, handling:
- `add <bundle|agent|skill>`: resolves and installs to `.agents/` or `~/.gemini/config/`
- `remove <bundle|agent|skill>` (alias `uninstall`): cleanly removes files and unshared dependencies
- `list` (alias `ls`): displays bundles, installed vs available
- `find <query>` (alias `search`): searches the registry
- `init`: initializes `.agents/` structure and installs recommended bundle
- `doctor`: checks agent schema health and directory integrity

## Lockfile Architecture (`.agents/agents-united.json`)
```json
{
  "$schema": "https://agents-united.dev/schema/lockfile.v1.json",
  "version": 1,
  "installed": {
    "bundles": ["software-engineering"],
    "agents": ["orchestrator-engineering", "subagent-backend-architect"],
    "skills": ["test-driven-development"],
    "workflows": ["workflow-implement"]
  },
  "files": {
    "agents/orchestrator-engineering.md": {
      "hash": "sha256:...",
      "bundle": "software-engineering"
    }
  }
}
```

## Verification
Full unit tests with mock filesystem.
