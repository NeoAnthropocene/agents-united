# 3. Bundle Manifest and Installation Tracking

We structure bundles as declarative collections within a central `registry.json` (or decentralized registry) that list constituent agents, skills, workflows, and rules.

To guarantee deterministic, clean uninstallations without risking user modifications:
- When a bundle or individual item is added to a workspace (`.agents/`) or global directory (`~/.gemini/config/`), an installation lockfile/manifest (`.agents/agents-united.json` or `~/.gemini/config/agents-united.json`) is maintained.
- `npx agents-united remove <bundle>` inspects the local manifest, verifies file checksums/ownership, cleanly purges unshared assets, and avoids deleting user-customized files unless `--force` is provided.
