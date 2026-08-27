---
name: mcp-setup
description: Comprehensive setup, configuration, and hardening runbook for Model
  Context Protocol (MCP) servers across all AI clients (Antigravity, Cursor,
  Cline, Claude, OpenCode, Codex) in Fully Operational and Limited Operational
  modes.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🔌
---

# MCP Server Setup & Multi-Client Hardening

## Overview & Purpose
The `mcp-setup` skill provides deterministic instructions, configuration templates, and hardening procedures for installing and managing Model Context Protocol (MCP) servers across all supported AI developer clients and runtime environments.

It defines exact configuration patterns for:
1. **Fully Operational Mode**: Authenticated with API keys/bearer tokens for unlimited cloud access, private repository mutations, and deep crawling.
2. **Limited Operational Mode**: Unauthenticated, free-tier, local, or self-hosted configurations operating within public rate limits without external API keys.
3. **Brainstorming / Native Fallback**: Seamless fallback to native workspace tools (`run_command` with git/curl, `grep_search`, `write_to_file`) when MCP servers are omitted.

---

## Supported Host Clients & Config Locations

| AI Client / Host | Configuration File Path | Format / Provisioning Command |
|---|---|---|
| **Antigravity CLI / App** | `~/.gemini/antigravity/mcp/<serverName>` or `.gemini/antigravity/mcp/` | `agy mcp add <name> --type stdio|http --command <cmd> --args <args> --env KEY=VAL` |
| **Cursor** | `.cursor/mcp.json` (Workspace) or `~/.cursor/mcp.json` (Global) | Standard JSON `{ "mcpServers": { ... } }` |
| **Cline (VS Code)** | `cline_mcp_settings.json` (Workspace) or `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | JSON with `"disabled": false, "autoApprove": []` |
| **Claude Desktop** | `%APPDATA%/Claude/claude_desktop_config.json` (Win) / `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) | Standard JSON `{ "mcpServers": { ... } }` |
| **Claude Code (CLI)** | `.claude/mcp.json` (Workspace) or `claude.json` | `claude mcp add <name> <command> [args...]` |
| **OpenCode** | `opencode.json` or `.opencode/mcp.json` | `opencode mcp install <name>` |
| **OpenAI Codex CLI** | `codex_config.json` (Workspace) | Injected via environment / stdio tool descriptors |

---

## MCP Server Matrix & Setup Modes

### 1. GitHub MCP (`github`)
- **Purpose**: Repository management, branch creation, pull request workflows, issue triage.
- **Fully Operational (Auth)**:
  ```json
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourPersonalAccessTokenHere"
    }
  }
  ```
- **Limited Operational (Unauthenticated)**:
  ```json
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"]
  }
  ```
  *(Allows querying public repositories, issues, and releases subject to GitHub unauthenticated IP rate limit of 60 req/hr).*
- **Fallback (No MCP)**: Agents use native Git CLI commands (`git status`, `git checkout -b`, `git commit`, `git push`) via `run_command`.

---

### 2. Firecrawl MCP (`firecrawl`)
- **Purpose**: Deep web crawling, competitor SERP scraping, full-site markdown extraction.
- **Fully Operational (Auth)**:
  ```json
  "firecrawl": {
    "command": "npx",
    "args": ["-y", "firecrawl-mcp"],
    "env": {
      "FIRECRAWL_API_KEY": "fc-yourFirecrawlApiKeyHere"
    }
  }
  ```
- **Limited Operational (Self-Hosted / Local Instance)**:
  ```json
  "firecrawl": {
    "command": "npx",
    "args": ["-y", "firecrawl-mcp"],
    "env": {
      "FIRECRAWL_API_URL": "http://localhost:3002"
    }
  }
  ```
  *(Connects to a local open-source Firecrawl Docker container running on localhost).*
- **Fallback (No MCP)**: Agents use `curl` / `fetch` or static mock market models via `run_command`.

---

### 3. Context7 MCP (`context7`)
- **Purpose**: Up-to-date documentation retrieval, framework library resolution.
- **Fully Operational (Auth)**:
  ```json
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp"],
    "env": {
      "UPSTASH_REDIS_REST_URL": "https://your-upstash-url.upstash.io",
      "UPSTASH_REDIS_REST_TOKEN": "your-upstash-token"
    }
  }
  ```
- **Limited Operational (Unauthenticated Public Mode)**:
  ```json
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp"]
  }
  ```
  *(Queries public cached library docs without persistent user storage).*
- **Fallback (No MCP)**: Agents search local markdown documentation and codebase types via `grep_search` and `view_file`.

---

### 4. Playwright MCP (`playwright`)
- **Purpose**: Headless browser automation, visual snapshotting, CRO conversion funnel testing.
- **Fully & Limited Operational (Local Node Runner - No API Key Required)**:
  ```json
  "playwright": {
    "command": "npx",
    "args": ["-y", "@executeautomation/playwright-mcp-server"]
  }
  ```
- **Fallback (No MCP)**: Agents run Playwright scripts via terminal (`npx playwright test`) using `run_command`.

---

### 5. MarkItDown MCP (`markitdown`)
- **Purpose**: High-fidelity document conversion (PDF, DOCX, PPTX, XLSX, HTML) to clean Markdown.
- **Fully & Limited Operational (Local Python/Node CLI - No API Key Required)**:
  ```json
  "markitdown": {
    "command": "uvx",
    "args": ["markitdown-mcp"]
  }
  ```
  *Alternative via Python*:
  ```json
  "markitdown": {
    "command": "python",
    "args": ["-m", "markitdown_mcp"]
  }
  ```
- **Fallback (No MCP)**: Agents ingest plain text or markdown directly.

---

### 6. Chrome DevTools MCP (`chrome-devtools-mcp`)
- **Purpose**: Live DOM inspection, Core Web Vitals profiling (LCP, CLS, FID), network tracing.
- **Fully & Limited Operational (Local Chrome Instance - No API Key Required)**:
  ```json
  "chrome-devtools-mcp": {
    "command": "npx",
    "args": ["-y", "chrome-devtools-mcp"]
  }
  ```
  *Requires Chrome launched with remote debugging port*: `chrome.exe --remote-debugging-port=9222`.
- **Fallback (No MCP)**: Agents run static Lighthouse audits or bundle analyzers.

---

### 7. Google Stitch MCP (`stitch`)
- **Purpose**: AI visual UI generation, canvas rendering, design token construction.
- **Fully Operational (Auth)**:
  ```json
  "stitch": {
    "command": "npx",
    "args": [
      "-y",
      "mcp-remote",
      "https://stitch.googleapis.com/mcp",
      "--header",
      "X-Goog-Api-Key: your-google-stitch-api-key"
    ]
  }
  ```
- **Limited Operational (Unauthenticated / Remote Endpoint)**:
  ```json
  "stitch": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://stitch.googleapis.com/mcp"]
  }
  ```
- **Fallback (No MCP)**: Agents generate Tailwind CSS / HTML / React code directly in workspace files.

---

### 8. Figma MCP (`figma`)
- **Purpose**: Design system token extraction, canvas layout inspection, asset exports.
- **Fully Operational (Auth)**:
  ```json
  "figma": {
    "command": "npx",
    "args": ["-y", "ai-figma-mcp"],
    "env": {
      "FIGMA_ACCESS_TOKEN": "figd_yourFigmaAccessTokenHere"
    }
  }
  ```
- **Limited Operational (Community Server)**:
  ```json
  "figma": {
    "command": "npx",
    "args": ["-y", "ai-figma-mcp"]
  }
  ```
  "figma": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-figma"]
  }
  ```
  *(Queries public Community files by file ID without private organization access).*
- **Fallback (No MCP)**: Agents use local design tokens defined in `registry/skills/design-system-tokens`.

---

## Universal Multi-Client Configuration Templates

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourToken"
      }
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "fc_yourKey"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    },
    "markitdown": {
      "command": "uvx",
      "args": ["markitdown-mcp"]
    },
    "chrome-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp"]
    },
    "stitch": {
      "command": "npx",
      "args": ["-y", "@google/stitch-mcp"]
    },
    "figma": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-figma"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_yourToken"
      }
    }
  }
}
```

### Cline (`cline_mcp_settings.json`)
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourToken"
      },
      "disabled": false,
      "autoApprove": []
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "fc_yourKey"
      },
      "disabled": false,
      "autoApprove": []
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"],
      "disabled": false,
      "autoApprove": []
    },
    "chrome-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourToken"
      }
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "fc_yourKey"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

---

## Step-by-Step Orchestrator Execution Runbook

### Phase 1 — Host Discovery & Mode Detection
1. Inspect the active environment and workspace configuration files (`.cursor/mcp.json`, `cline_mcp_settings.json`, `.gemini/antigravity/mcp/`, `claude_desktop_config.json`).
2. Classify the execution envelope:
   - **Fully Operational**: Target MCP servers present with valid auth tokens.
   - **Limited Operational**: MCP servers present without auth tokens.
   - **Brainstorming / Native Fallback**: Zero MCP servers configured.

### Phase 2 — Guided Setup & User Choice
1. If prerequisites are missing or unauthenticated, the Orchestrator presents an interactive choice to the user:
   ```markdown
   > [!NOTE]
   > **MCP Tooling Setup Options**:
   > 1. **Fully Operational**: Provide API keys (e.g. `FIRECRAWL_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`) for full cloud capabilities.
   > 2. **Limited Operational**: Run free/local MCP servers (Playwright, MarkItDown, Chrome DevTools, Context7) without API keys.
   > 3. **Brainstorming Mode**: Use native workspace tools (`git`, `curl`, `write_to_file`) with zero MCP setup.
   ```
2. The user can switch modes anytime via `/mode operational`, `/mode limited-operational`, or `/mode brainstorming`.

### Phase 3 — Provisioning & Validation
1. If the user chooses to provision MCP servers, execute the corresponding client configuration or CLI commands:
   ```bash
   agy mcp add firecrawl --type stdio --command npx --args -y,firecrawl-mcp --env FIRECRAWL_API_KEY=fc_...
   ```
2. Validate server connectivity and report status in the session summary.

---

## Verification & Validation Checklist
- [ ] Config paths match host OS conventions (Windows `%APPDATA%`, macOS `~/Library/Application Support`).
- [ ] JSON blocks contain valid syntax with escaped quotes.
- [ ] Both Fully Operational (with env vars) and Limited Operational (without env vars) configurations provided.
- [ ] Fallback native tool alternatives documented for all 8 MCP servers.
- [ ] Mode switching syntax (`/mode operational`, `/mode limited-operational`, `/mode brainstorming`) documented.
