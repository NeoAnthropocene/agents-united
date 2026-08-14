# Agents United

Universal package manager and registry CLI for open AI agents, skills, workflows, and rules across agent ecosystems.

## 🛡️ Built-in Safety & Git Guardrails

Agents United keeps your repositories and developer environments safe by default:

- **Protected Branch Guardrails**: Prevents autonomous agents from directly committing to `main`, `master`, or release branches without explicit review.
- **Zero Force-Pushes**: Hard-coded safety policies disallow destructive force pushes (`git push -f`).
- **Pre-Staging Secret Scanning**: Intercepts accidental staging of `.env` files, API keys, and access tokens before any commit is generated.
- **Deterministic Health Doctor**: Run `agents doctor` anytime to audit local agent directories, verify schema validity, and ensure safe working tree states.

## Credits & Acknowledgments

Agents United proudly builds upon and integrates open-source contributions across the autonomous agent and developer tooling ecosystem:

- **Matt Pocock** ([@mattpocock](https://github.com/mattpocock) / [mattpocock/skills](https://github.com/mattpocock/skills)):
  - **`/grill-with-docs`** & **`/grill-me`**: Socratic alignment grilling and requirements clarification.
  - **`/domain-modeling`**: Ubiquitous language definition and `CONTEXT.md` domain dictionary maintenance.
  - **`/to-spec`** & **`/to-tickets`**: PRD/spec generation and task ticket decomposition.
  - **`/diagnosing-bugs`**: Evidence-driven bug diagnosis and root-cause analysis.
  - **`/git-guardrails`**: Version control safety rules and protection policies.
  - **`/handoff`**: Session progress persistence and context handoff notes.
- **Vercel Engineering** ([@vercel](https://github.com/vercel) / [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)):
  - **`react-best-practices`**: Next.js App Router, Server Components & Core Web Vitals optimization.
- **Currents & Microsoft Playwright Community** ([currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill)):
  - **`playwright-best-practices`**: Resilient Page Object Models and deterministic auto-waiting browser tests.
- **wshobson** ([wshobson/agents](https://github.com/wshobson/agents)):
  - **`mobile-ios-design`** & **`mobile-android-design`**: SwiftUI & Jetpack Compose design system patterns.
- **Salesforce** ([forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills)):
  - **`mobile-platform-offline-validate`**: Offline-first local database caching and conflict resolution.
- **tovimx** ([tovimx/maestro-mobile-testing-skill](https://github.com/tovimx/maestro-mobile-testing-skill)):
  - **`maestro-mobile-testing`**: Declarative cross-platform mobile UI test automation.

