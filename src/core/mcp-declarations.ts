import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

/**
 * Plan 029 A3 / Plan 032 Phase 8 — the MCP servers agents declare, read from each agent's `mcpServers:` frontmatter. Names only: a
 * credential, an `env` block or an inline server definition never reaches this set (Risk R4). `files` limits the read to those
 * file names; without it every `.md` file of the folder is read. A file that cannot be read or parsed is skipped, never guessed at
 * (the frontmatter check reports a malformed one).
 */
export async function declaredServerNames(agentsDir: string, files?: readonly string[]): Promise<string[]> {
  const names = new Set<string>();
  if (!(await fs.pathExists(agentsDir))) return [];
  const candidates = files ? [...files] : (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'));
  for (const file of candidates) {
    const content = await fs.readFile(path.join(agentsDir, file), 'utf8').catch(() => null);
    if (content === null) continue;
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    let meta: { mcpServers?: unknown } | undefined;
    try {
      meta = YAML.parse(match[1]) ?? undefined;
    } catch {
      continue;
    }
    const entries = Array.isArray(meta?.mcpServers) ? (meta?.mcpServers as unknown[]) : [];
    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : (entry as { name?: unknown } | null)?.name;
      if (typeof name === 'string' && name.trim().length > 0) names.add(name.trim());
    }
  }
  return [...names].sort();
}
