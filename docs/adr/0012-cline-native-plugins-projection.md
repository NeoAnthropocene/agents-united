# ADR 0012: Cline Native Plugins Projection Architecture

## Status
Accepted

> Accepted 2026-08-27 alongside the implementation of Plan 011: Migrate Cline Projection to Native Plugins (v4.0.0+).

## Context
Cline 4.0.0+ introduced a native Plugin architecture with modular capabilities (`skills`, `tools`, `workflows`) and a Customize marketplace. In earlier versions of Cline, custom agents, skills, and rules were projected as loose files directly into the workspace's `.cline/` folder (`.cline/agents/`, `.cline/skills/`, `.cline/rules/`, `.cline/agents-united/teams/`).

Scattering loose files across `.cline/` presented several challenges:
1. It lacked compatibility with modern Cline v4.0.0+ native plugin management and atomic enable/disable controls.
2. It polluted workspace root configs when multiple bundles were installed.
3. It prevented bundles from being packaged as cohesive units with metadata manifests (`package.json`).

## Decision
1. **Self-Contained Plugin Packaging in `.agents/plugins/<bundle-name>/`**:
   All compound artifacts projected for Cline are now written into `.agents/plugins/<bundle-name>/` as a standard Cline plugin package.
2. **Deterministic `package.json` Manifest**:
   Every plugin directory contains a `package.json` adhering to the `ClinePluginManifest` schema:
   ```json
   {
     "name": "agents-united-<bundle-name>",
     "version": "1.0.0",
     "description": "<bundle-description>",
     "cline": {
       "plugins": [
         {
           "capabilities": ["skills", "tools", "workflows"],
           "skills": ["./skills"]
         }
       ]
     }
   }
   ```
3. **Compound Structure Preservation**:
   Within `.agents/plugins/<bundle-name>/`, the compound projection preserves:
   - `agents/`: Role definition markdown (`*.md`) with frontmatter and managed markers.
   - `skills/`: Preserved `SKILL.md` documents and auxiliary assets.
   - `rules/`: Coordinator rule (`agents-united-<bundle-name>.md`).
   - `agents-united/teams/`: Team Manifest (`<bundle-name>.yaml`).
4. **Lifecycle Migration & Backward Compatibility**:
   - `InstallEngine` and `UpdateEngine` automatically detect and cleanly prune obsolete legacy `.cline/` projection files and directories during updates.
   - `lockfile.projections` and `lockfile.files[...].projectedTo` track the new paths and refcounting seamlessly.
5. **Runtime Activation Instruction**:
   `ClineLauncher` injects an explicit plugin installation instruction into the bootstrap prompt:
   `"Before proceeding, ensure you have installed this bundle's plugin by running: cline plugin install .agents/plugins/<bundle-name>"`

## Consequences
- Cline users can manage Agents United bundles as native Cline plugins via the Cline CLI (`cline plugin install`) and UI.
- All bundle artifacts are cleanly isolated per bundle under `.agents/plugins/<bundle>/`.
- Legacy workspaces upgrading via `agents update` automatically migrate from loose `.cline/` files without manual cleanup.
