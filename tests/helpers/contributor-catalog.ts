import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { RegistryResolver } from '../../src/core/registry.js';
import type { BundlesManifest } from '../../src/core/types.js';

/** Public custom-registry seam; each caller gets an isolated, populated catalog. */
export async function contributorCatalogFixture(
  amend?: (manifest: BundlesManifest) => void,
): Promise<{ resolver: RegistryResolver; remove: () => Promise<void> }> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-united-contributor-'));
  const manifest: BundlesManifest = await fs.readJson(path.resolve(process.cwd(), 'tests/fixtures/contributor-catalog/bundles.json'));
  amend?.(manifest);
  await fs.writeJson(path.join(directory, 'bundles.json'), manifest);
  for (const rule of ['GEMINI.md', 'shared-rule.md', 'contributor-rule.md']) {
    await fs.outputFile(path.join(directory, 'rules', rule), `# ${rule}\nFixture rule.\n`);
  }
  return { resolver: new RegistryResolver(directory), remove: () => fs.remove(directory) };
}
