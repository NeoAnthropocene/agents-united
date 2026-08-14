# Persistent Rule: Test-Driven Development (TDD) Protocol

## Purpose & Scope
This rule enforces a strict, verifiable Test-Driven Development protocol across all software engineering, architecture, and tool development tasks within Agents United.

---

## 1. The Red-Green-Refactor Lifecycle
Autonomous agents must follow the three-phase cycle for all new features, refactors, and bug fixes:
1. **Red Phase (Write Failing Tests)**: Create or update test files specifying the expected behavior, types, or assertions before modifying implementation source code. Execute `npm test` and verify that the tests fail for the intended reason.
2. **Green Phase (Minimal Implementation)**: Write only the minimal necessary implementation code to satisfy the test assertions and achieve a green test pass.
3. **Refactor Phase (Clean Up & Optimize)**: Refactor code for clarity, performance, and modularity while ensuring all tests continue to pass.

---

## 2. The 4-Tier Testing Methodology
All test suites in the codebase should adhere to our 4-tier architectural testing model:

### Tier 1: Feature Coverage (Happy Path)
- Verify that standard valid inputs produce expected outputs.
- Test all exposed functions, classes, and exported interface methods.

### Tier 2: Boundary & Corner Cases (Negative Testing)
- Test empty strings, null/undefined inputs, and invalid type parameters.
- Test missing files, malformed YAML/JSON, and invalid enum values.
- Verify graceful error messages and structured exception handling.

### Tier 3: Cross-Feature Integration (Pairwise Consistency)
- Verify data flow across interconnected modules (e.g. `RegistryResolver` $\leftrightarrow$ `InstallEngine` $\leftrightarrow$ `FileAdapter`).
- Ensure lockfile updates match physical file system states.

### Tier 4: Real-World Scenarios & Full Inventory Audits
- Execute end-to-end tests against the complete registry catalog (all agents, skills, workflows).
- Verify zero schema drift, zero duplicate naming, and valid frontmatter parsing.

---

## 3. Flakiness Elimination Rules
- **No Hardcoded Sleeps**: Never use `setTimeout` or arbitrary delays. Always use auto-waiting assertions (`expect(locator).toBeVisible()`) or deterministic callbacks.
- **Isolated Workspaces**: Run test file mutations inside temporary directories (e.g. `scratch/test-workspace/`) and clean up in `afterEach()`.
- **Deterministic Factories**: Use predictable test fixtures rather than non-deterministic random data.
