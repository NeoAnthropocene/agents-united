import { McpLocationRegistry } from './mcp-locations.js';

/**
 * ADR 0079 - the add commands that the doctor and the install panel print, from one table.
 *
 * The creative, motion and sound designers declare their media servers by name. Four of them are hosted HTTP servers that the user signs in to; the fifth, `image-gen`, is a stdio
 * server that the user starts with their own key. None of the five has a stdio definition that agents-united could write, so none of them takes the generic `<command>` form or the
 * `npx -y <name>` fallback: the doctor and the install panel print the command that the `mcp-setup` references give, and no file is written. The URLs below are the ones in
 * `registry/skills/mcp-setup/references/media-setup.md`; the image command is the base command of `registry/skills/mcp-setup/references/claude-code.md`. Tests read both references
 * and compare.
 */

/** The four hosted HTTP servers of the motion and sound designers, and the endpoint of each (human OAuth sign-in follows in `/mcp`). */
export const HOSTED_MEDIA_SERVERS: Readonly<Record<string, string>> = {
  higgsfield: 'https://mcp.higgsfield.ai/mcp',
  klingai: 'https://kling.ai/mcp',
  elevenlabs: 'https://api.elevenlabs.io/v1/mcp',
  'fish-audio': 'https://api.fish.audio/mcp',
};

/** The name of the optional image server, which the creative designer reaches through its one tool. */
export const IMAGE_SERVER = 'image-gen';

/** The reviewed command for the image server with the Gemini key (another provider's key pair is in the same reference). The version is pinned to a number, not to a floating tag. */
export const IMAGE_SERVER_ADD_COMMAND =
  'claude mcp add --scope local image-gen --env GEMINI_API_KEY=<your-ai-studio-key> --env IMAGE_PROVIDER=gemini --env SKIP_PROMPT_ENHANCEMENT=true --env IMAGE_OUTPUT_DIR=<absolute path of the project>/assets/generated -- npx -y mcp-image@0.18.0';

/** Whether the server is one of the five that have no stdio definition to write: a hosted media server or the image server. */
export function hasNoStdioDefinition(server: string): boolean {
  const name = server.trim().toLowerCase();
  return name === IMAGE_SERVER || Object.prototype.hasOwnProperty.call(HOSTED_MEDIA_SERVERS, name);
}

/** The Claude Code command for one of the five, as a sentence for the user to act on, or undefined for any other server. */
export function claudeAddCommand(server: string): string | undefined {
  const name = server.trim().toLowerCase();
  if (name === IMAGE_SERVER) {
    return `from the project folder (cd <absolute path of the project>), run it yourself with your own key: ${IMAGE_SERVER_ADD_COMMAND} (the key pair of another provider is in the skill mcp-setup, references/claude-code.md)`;
  }
  if (Object.prototype.hasOwnProperty.call(HOSTED_MEDIA_SERVERS, name)) {
    return `claude mcp add --scope project --transport http ${name} ${HOSTED_MEDIA_SERVERS[name]}, then sign in through /mcp (agents-united never writes a credential)`;
  }
  return undefined;
}

/**
 * The host's own command for registering a server, PRINTED for the user to run. `agents doctor` never executes it, never installs a server and never writes an MCP config file.
 * The five servers of ADR 0079 get the command of the table on Claude Code. On Antigravity a hosted server gets the `serverUrl` entry for `.agents/mcp_config.json` (seen to connect, with the
 * sign-in through `/mcp`, on 2026-11-24) and the image server a statement that no command is verified (Antigravity generates images itself); every other server keeps the generic form.
 */
export function mcpAddCommand(host: string, server: string, workspaceRoot: string): string {
  const special = claudeAddCommand(server);
  if (host === 'antigravity') {
    const key = server.trim().toLowerCase();
    const url = Object.prototype.hasOwnProperty.call(HOSTED_MEDIA_SERVERS, key) ? HOSTED_MEDIA_SERVERS[key] : undefined;
    if (url !== undefined) {
      return `Add it to .agents/mcp_config.json under "mcpServers": "${server}": { "serverUrl": "${url}" }, then sign in through /mcp (agents-united never writes a credential)`;
    }
    if (special !== undefined) {
      return `No verified add command for ${server} on Antigravity (it generates images itself, through its built-in image-generator subagent, and ${server} is a stdio server that needs your own provider key); see the skill mcp-setup, references/claude-code.md.`;
    }
    return `Add it with: agy mcp add ${server} -- <command> [args...]`;
  }
  if (host === 'cline') {
    const settingsPath = McpLocationRegistry.getPrimaryWritePath('cline', workspaceRoot);
    return `Add it with the interactive wizard: cline mcp install|add <name> (or cline config mcp for the current list); settings live in ${settingsPath}.`;
  }
  return special !== undefined ? `Add it with: ${special}` : `Add it with: claude mcp add ${server} -- <command> [args...]`;
}
