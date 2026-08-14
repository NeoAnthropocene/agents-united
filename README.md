# Agents United

Universal package manager and registry CLI for open AI agents, skills, workflows, and rules across agent ecosystems.

## 🛡️ Built-in Safety & Git Guardrails

Agents United keeps your repositories and developer environments safe by default:

- **Protected Branch Guardrails**: Prevents autonomous agents from directly committing to `main`, `master`, or release branches without explicit review.
- **Zero Force-Pushes**: Hard-coded safety policies disallow destructive force pushes (`git push -f`).
- **Pre-Staging Secret Scanning**: Intercepts accidental staging of `.env` files, API keys, and access tokens before any commit is generated.
- **Deterministic Health Doctor**: Run `agents doctor` anytime to audit local agent directories, verify schema validity, and ensure safe working tree states.

## Credits & Acknowledgments

Special thanks and attribution to **Matt Pocock** ([@mattpocock](https://github.com/mattpocock)) and the open-source community behind [mattpocock/skills](https://github.com/mattpocock/skills) for pioneering agent skills and workflows including:

- **`/grill-with-docs`** & **`/grill-me`**: Socratic alignment grilling and requirements clarification.
- **`/domain-modeling`**: Ubiquitous language definition and `CONTEXT.md` domain dictionary maintenance.
- **`/to-spec`** & **`/to-tickets`**: PRD/spec generation and task ticket decomposition.
- **`/diagnosing-bugs`**: Evidence-driven bug diagnosis and root-cause analysis.
- **`/git-guardrails`**: Version control safety rules and protection policies.
- **`/handoff`**: Session progress persistence and context handoff notes.
