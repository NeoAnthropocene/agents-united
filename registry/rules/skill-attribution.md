# Persistent Rule: Skill & Workflows Author Attribution Standard

This rule governs the adoption, adaptation, and integration of external skills, agents, workflows, and prompts into the Agents United ecosystem.

## Mandatory Attribution Policy

Whenever skills or workflows are adopted or adapted from external creators or repositories, you MUST:

1. **Skill Frontmatter Metadata**:
   - In `SKILL.md`, include the author's name, repository URL, and license inside the YAML frontmatter `metadata` block:
   ```yaml
   ---
   name: <skill-name>
   description: <skill-description>
   metadata:
     author: "<Author Name> (<repo-identifier>)"
     version: "1.0.0"
     source: "https://github.com/<owner>/<repo>"
     license: "MIT"
   ---
   ```

2. **README.md Credits & Acknowledgments Section**:
   - Add or maintain an entry in `README.md` under `## Credits & Acknowledgments` with the author's handle, repository link, and list of adapted capabilities.

3. **Integrity & Adaptation**:
   - Adapt external skills to conform to Agents United schema and execution standards rather than importing them as unformatted raw files.
