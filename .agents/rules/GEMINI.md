# Master Operational Rules for Agents United

## 1. Test-Driven Development (TDD)
- **Mandatory Red-Green-Refactor**: Write failing unit or E2E tests before implementing functional logic or bug fixes.
- **Deterministic Testing**: Never use arbitrary sleeps or timeouts (`setTimeout`); use auto-waiting assertions and deterministic mock factories.
- **4-Tier Test Coverage**:
  - *Tier 1 (Feature Coverage)*: Core function execution and expected outputs.
  - *Tier 2 (Boundary & Corner Cases)*: Empty inputs, malformed data, network interruptions, and error recovery.
  - *Tier 3 (Cross-Feature Pairwise)*: Module interoperability between Registry, Installer, Adapters, and CLI.
  - *Tier 4 (Full Real-World Scenarios)*: Complete inventory audits across all agents, skills, and workflows.

## 2. Code Quality, Modularity & Type Safety
- **Strict Typing**: Never use implicit or explicit `any` where structured TypeScript types, enums, or interfaces can be declared.
- **Single Source of Truth**: Centralize shared interfaces in `src/core/types.ts` and maintain schema integrity.
- **Seams & Decoupling**: Separate business logic, file system operations, and terminal presentation into modular layers.

## 3. Safety, Security & Git Guardrails
- **Zero Secret Exposure**: Never log, output, or commit API keys, authentication tokens, or `.env` files.
- **Protected Branch Guard**: Never commit directly to `main`, `master`, or release branches. Always work on feature/fix branches.
- **Zero Force-Pushes**: Disallow `git push --force` or `git push -f` under all circumstances.
- **Pre-Staging Diff Inspection**: Always audit staged diffs (`git diff --cached`) before committing.

## 4. Skill Attribution & Provenance Standards
- **Frontmatter Metadata**: All adopted or adapted skills must declare author metadata (`author`, `version`, `source`, `license`) in YAML frontmatter.
- **README Credits**: Credit open-source creators and original repositories under `## Credits & Acknowledgments` in `README.md`.
- **Adaptation Standard**: Adapt external skills to conform to Agents United schema and execution guidelines rather than importing raw unverified files.

## 5. UI/UX Quality, Aesthetics & Accessibility
- **Terminal Presentation**: Format listings and menus with structured folder tree branches (`├──`, `└──`, `│`), clear badges, and progressive two-stage drill-downs.
- **Web & Mobile Accessibility**: Enforce WCAG 2.1 Level AA compliance, 4.5:1 text contrast ratios, semantic HTML5, and touch target minimums (44pt iOS, 48dp Android).
- **Anti-Cliché Design**: Avoid unpadded layouts, purple-on-dark tropes, arbitrary animations, or icon-stuffed bento boxes without functional hierarchy.

## 6. Multi-Agent Delegation & Lifecycle Hooks
- **Orchestrator Mandate**: Orchestrators plan and coordinate; specialized sub-agents execute domain-specific tasks.
- **Lifecycle Hooks**: Enforce `PreInvocation`, `PostInvocation`, `PreToolUse`, and `PostToolUse` safety hooks to validate workspace state and audit outputs.
- **Structured Deliverables**: Provide complete, actionable code and structured markdown summaries with deterministic verification criteria.

## 7. Domain Modeling & Architecture Decision Records (ADRs)
- **Ubiquitous Language**: Maintain domain terminology consistency across agents, prompts, and documentation.
- **ADR Governance**: Document non-trivial architectural changes and tradeoffs in `docs/adr/` with Context, Decision, and Consequences.
- **Socratic Clarification**: Clarify ambiguous requirements via interactive questioning before committing to major architectural shifts.
