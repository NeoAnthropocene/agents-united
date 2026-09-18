# Plan 015: Workflow Runtime Enforcement, Dynamic Rules Resolution & Cross-Client Projection Hardening

**Category**: Core Engine / Runtime Integration / Catalog Hardening  
**Target Date**: 2026-09-15  
**Author**: Antigravity Senior Advisor (`/improve` audit based on empirical test feedback)  
**Status**: **PROPOSED** — *peer-reviewed 2026-09-15; corrections §0/C1–C8 are binding on the executor*  
**Dependencies**: Plan 014 (Workflows to Skills Cutover), Plan 008 (Cline-Native Compound Projection)  
**Git Baseline**: Commit at branch `feat/workflows-to-skills-migration`

---

## 0. Peer Review Verdict & Corrections (2026-09-15)

**Verdict: directionally correct, but not executable as originally written.** Five load-bearing claims verified accurate; four are wrong or materially understated; the plan omits the propagation path that makes Step 1 risky; and its own premise for Step 6 was **misdiagnosed and is corrected in C9** (the renderer already implements workflow discoverability — the field failure was projection staleness). Apply C1–C9 before executing. This review modified only this plan file — no source code was touched.

### 0.1 Claim verification (evidence = working tree on `feat/workflows-to-skills-migration`)

| §1 claim | Verdict | Evidence |
|---|---|---|
| `resolve()` hardcodes `rules: ['GEMINI.md']` at lines 92, 103 | ✅ | `src/core/registry.ts:92`, `src/core/registry.ts:103` |
| `registry/rules/` holds "11 modular rules" | ⚠️ imprecise | 11 files = **7 rule modules** + **4 host entrypoints** (`AGENTS.md`, `CLAUDE.md`, `CURSOR.md`, `GEMINI.md`) |
| Every agent lists `rules:`, and nothing reads it | ✅ | **59** files in `registry/agents/` declare a `rules:` block; no code consumes it. Declared as a **block sequence**, not inline `[a, b]` |
| Those rules are never copied to `.agents/rules/` | ✅ | `src/core/installer.ts:712-737` copies only what `resolved.rules` contains |
| `planCompoundProjection()` emits exactly one rule | ✅ | `src/core/cline-projector.ts:479-487` |
| `.cline/rules/` is a genuine always-active Cline rules root | ✅ (upstream-verified) | ADR 0013 "Verified discovery registry": `AGENTS.md`, `.clinerules/`, **`.cline/rules/`** = always-active instructions |
| "64+ skills" hardcode the doctor command | ❌ understated | **114 occurrences across 91 files** of 160 `registry/skills/**/SKILL.md` |
| Greenfield git-hook defect is engineering-only | ❌ wrong | also `orchestrator-security.md:29` and `orchestrator-system-architecture.md:29` |
| Target subagent bodies "lack … verify gates" | ❌ wrong | `subagent-backend-architect.md:100-108` and `subagent-frontend-architect.md:103-110` already define test + build verification phases |
| The `bundle.rules` branch is meaningful | ❌ inert | `bundles.json` contains **zero** `"rules"` keys; the field exists only in `src/core/types.ts:369` |

### 0.2 Binding corrections

**C1 — Counts.** Step 3 scope is 91 files / 114 occurrences, not "64+". Gate: `grep -rl "node dist/cli.js doctor" registry/skills | wc -l` → 91 before, 0 after.

**C2 — Three orchestrators, not one.** `orchestrator-engineering.md:29`, `orchestrator-security.md:29`, `orchestrator-system-architecture.md:29` — plus each file's prose mirror (`:195`, `:175`, and the third file's "Explicit Lifecycle Hooks" section).

**C3 — Missing propagation path (highest-risk omission).** `resolved.rules` is not a Cline-only concern: `installer.ts:712-737` physically copies every resolved rule into `.agents/rules/` and records it in `agents-united.json` → `files[relPath]` with `owners` refcounting. Therefore Step 1 changes install output for **all 26 bundles**, `doctor.ts:99-164` cross-validates those owners, and this repository's own dogfooded `.agents/` install (plus its content hashes) drifts the moment `registry/**` changes. Required additions: installer/doctor/refcount tests (§4/3-4) and a dogfood re-sync (`agents update --all -y`) **before** claiming "doctor → 0 warnings".

**C4 — Command portability.** Bare `agents doctor` resolves only for a global install; the README documents `npx agents-united …` / `npx agents …` for project installs → standardize on `npx agents-united doctor`. The original hook draft is likewise POSIX-only (`>/dev/null`, `&&`, `||`) — see Step 4.

**C5 — Step 5 must be additive, not duplicative.** Add only: the `workflow-implement` skill binding, test-first ordering, and the structured completion report. Keep new text free of Antigravity-only tool names — Cline subagents never see that dialect.

**C6 — Resolver spec gaps.** (a) **YAML-parse** the `rules:` block (the `yaml` package is already a dependency) — never regex for inline brackets; (b) **sort** the result — projection content feeds lockfile hashing and doctor, so ordering must be byte-stable; (c) choose and test a missing-rule policy (`installer.ts:716` silently skips an absent rule → prefer fail-fast in `validateBundles()`); (d) keep the inert `bundle.rules` branch as forward compatibility (bundles.json is out of scope) and assert it is currently inert; (e) collect rules from **inherited parent-bundle** agents too, and mirror the logic into the `domain:` branch (`registry.ts:92`).

**C7 — Step 2 details + accepted trade-off.** Rule modules carry no frontmatter → the managed marker is line 1 (compatible with `HostProjector.hasManagedMarker`, whose no-frontmatter path is a plain `includes('managed-by: agents-united')`). Artifact numbering collides with the existing "4"/"5" (`cline-projector.ts:479-496`) → projected rules become 5, team manifest becomes 6. Raw projection is verified dialect-safe: all six rules referenced by agent frontmatter contain **zero** Antigravity tool names, so no `## Cline runtime note` translation is needed. Accepted trade-off: `.cline/rules/` files are always-active workspace-wide and Cline has no per-agent rule scoping — the inverse of CONTEXT.md's "Scoped Rule Binding" intent; mitigate by projecting only the deduplicated, agent-referenced set (≤6 files today). Never project into `.agents/plugins/<bundle>/rules/` — ADR 0013 decision 1 explicitly prunes that path.

**C8 — Test matrix.** See §4: `registry`, `cline-projector`, `installer`, `doctor`, the existing migration suite, a new catalog-wide regression guard, plus `npm run typecheck`, `npm test`, `npm run build`.

**C9 — CORRECTION TO THIS REVIEW (the original C9 was wrong; corrected after verification).** The first draft of this review claimed the coordinator rule never mentions workflows and that Step 6 must add a workflow section. **That is false.** `ClineProjector.renderCoordinatorRule()` already builds `workflowSection` (`src/core/cline-projector.ts:252-262`) from `bundle.workflows` **plus** `bundle.skills.filter(s => s.startsWith('workflow-'))` and interpolates it at line 340 (`${workflowSection}${addonSection}`). Measured catalog state: all 34 bundles declare their `workflow-*` skills correctly, **0 dangling** declarations, and only the 3 genuinely workflow-less bundles (`universal-skills`, `universal-orchestration`, `mock-organization-under-construction`) render no section.

The real root cause of the field failure is **projection staleness**: this repository's own installed `.cline/rules/agents-united-software-engineering.md` contains the ADR 0015 planning policy but **no** workflow section, i.e. it was projected when that bundle declared no `workflow-*` skills and was never refreshed. `agents doctor` validates projection *presence*, managed-marker integrity, and ownership — it cannot detect *outdated content*, and `lockfile.projections` records no content hash or renderer version. So a workspace keeps a stale coordinator rule indefinitely until someone runs `agents update`.

Corrected Step 6 = (6a) a permanent cross-bundle **contract test** that would have caught this class of failure, plus (6b) paying down the actual staleness gap. Renderer work is **deleted** from Step 6. Do not add a second workflow section — it would duplicate the existing one and break the byte-identical guarantees.

### 0.3 Expected outcome, risk & escape hatches

After these corrections, any installed bundle lands its rule modules in `.agents/rules/` **and** `.cline/rules/` (managed, refcounted), so Cline sessions finally receive the TDD / git-guardrail / coordination policies agent frontmatter has declared since Plan 010; skill runbooks stop printing a command that cannot resolve in user workspaces; greenfield folders stop breaking orchestrator invocation; and the workflow-discoverability contract test locks in the behaviour whose *stale projection* caused the original field failure (with the residual staleness-detection gap explicitly deferred to Plan 015b). Effort ≈ 1–1.5 days. Risk concentrates in C3 (lockfile/doctor invariants) and C6b (determinism).

**Stop and report if:** (a) any suite fails for a reason not traceable to a listed step; (b) `agents doctor` still reports ownership warnings after `agents update --all -y`; (c) a projected rule file turns out to contain Antigravity tool names (dialect leak → requires the runtime-note translation, a separate decision); (d) Cline does not load a second rule file from `.cline/rules/` in a live session — ADR 0013 verified the *root*, never a second file, so prove it once manually before mass-projecting.

**Maintenance note:** future rule additions need only the agent-frontmatter `rules:` entry — the resolver, installer, and Cline projector derive everything else. Any new host entrypoint rule (e.g. `copilot-instructions.md`) must be added to the projector's host-entrypoint exclusion list, or it will be projected into `.cline/rules/`.

### 0.4 Ratified decisions (2026-09-15 — no further discussion needed)

| # | Decision | Ratified resolution |
|---|---|---|
| **D1** | Which doctor command replaces `node dist/cli.js doctor` in the 91 skill files | **`npx agents-united doctor`** — resolves for global installs, local devDependencies, and ad-hoc/external workspaces. Bare `agents doctor` is rejected (global-only). |
| **D2** | Missing-rule policy when an agent frontmatter references a rule absent from `registry/rules/` | **Fail fast**: `validateBundles()` throws with the bundle name and the missing rule file. All six currently-referenced rules exist, so this is a guardrail, not a behavior change. |
| **D3** | Is Step 6 in scope, and in what form? | **In scope, corrected form.** The renderer already emits the workflow section (C9) — Step 6 is **not** a renderer change. It is: 6a a cross-bundle contract test (section renders iff `workflow-*` skills are declared; every declared workflow skill resolves on disk), and 6b projection-staleness handling. 6b's minimal, non-schema-changing part (re-project via `agents update` + verify) ships in §4/9; the full design (content-hash or renderer-version stamp in `lockfile.projections`) requires an ADR-level lockfile decision and is deferred as **Plan 015b**, not hacked in. |

## 1. Problem Statement & Empirical Diagnosis

A real-world test of `orchestrator-engineering` inside a fresh project workspace (`C:\github\test\au-test--workflow-transition`) revealed that while 69 workflows were converted to Agent Skills (Plan 014), the host agent in Cline **did not execute the workflow skills**. An in-depth audit of the workspace and `suggestion.md` isolated five concrete architectural defects (four in the original draft; §1.4 and §1.5 were corrected by review):

1. **Resolver Rules Blindness (`src/core/registry.ts`)**:
   - `RegistryResolver.resolve()` hardcodes `rules: ['GEMINI.md']` (lines 92, 103).
   - Although `registry/rules/` holds **7 rule modules** (`git-guardrails.md`, `test-driven-development.md`, `clean-code-and-architecture.md`, `multi-agent-coordination.md`, `domain-modeling-and-adr.md`, `quality-aesthetics-accessibility.md`, `skill-attribution.md`) alongside 4 host entrypoints (`GEMINI.md`, `AGENTS.md`, `CLAUDE.md`, `CURSOR.md`), none of the modules are resolved when installing a bundle.
   - Every agent's frontmatter declares `rules:` — as a **YAML block sequence** (`rules:\n  - git-guardrails.md`), not inline `[a, b]` — but those files are never copied to `.agents/rules/` because the resolver ignores agent rule declarations.
2. **Cline Rule Projection Gap (`src/core/cline-projector.ts`)**:
   - Cline configured subagents (`.cline/agents/*.yml`) drop `rules:` and most frontmatter keys during projection (keeping only `name`, `description`, `maxIterations`, and body).
   - Cline discovers active rules by reading `.cline/rules/*.md`.
   - `ClineProjector.planCompoundProjection()` only projects ONE rule into `.cline/rules/`: `.cline/rules/agents-united-${bundle.name}.md`.
   - None of the resolved rules (`git-guardrails.md`, `test-driven-development.md`, etc.) are projected into `.cline/rules/`. As a result, neither the coordinator nor the subagents receive the mandatory TDD, git guardrail, or coordination policies in Cline.
3. **Runbook Phase Gate Hallucination across 91 Skills (`registry/skills/**/SKILL.md`)** — *count corrected by review, see §0/C1*:
   - Measured: `node dist/cli.js doctor` appears **114 times across 91 of the 160** canonical `SKILL.md` files (the "64+" figure in the original draft was an estimate).
   - When installed in an external project workspace, `node dist/cli.js doctor` fails with `Cannot find module 'dist/cli.js'`.
   - The replacement must resolve in an external workspace — `npx agents-united doctor` (global install, local devDependency, or ad-hoc) — **not** a bare `agents doctor`, which requires a global install (§0/C4).
   - Secondary (pre-existing coherence issue, minimum-change rule applies in Step 3): several gate tables pair this command with success criteria the command cannot verify, e.g. `registry/skills/workflow-estimate/SKILL.md:61` gates "Phase 2 → 3" on `doctor` with the criterion "Project tasks properly formatted with explicit acceptance criteria".
4. **Git PreInvocation Hook in Greenfield Repositories** — *scope corrected by review, see §0/C2*:
   - `PreInvocation: git status --porcelain` exits 128 when the target folder is not yet a git repository (`fatal: not a git repository`).
   - The hook is declared in **three** orchestrators, not one: `orchestrator-engineering.md:29`, `orchestrator-security.md:29`, `orchestrator-system-architecture.md:29`. The remaining five lead orchestrators use workspace-agnostic `echo` hooks.
5. **Subagent Body Workflow-Contract Gap (`subagent-backend-architect.md`, `subagent-frontend-architect.md`)** — *diagnosis narrowed by review, see §0/C5*:
   - In Cline the only text reaching a subagent is the configured-agent **body** (`.cline/agents/<role>.yml`), because `ClineProjector.renderConfiguredAgent()` keeps only `name`, `description`, `maxIterations`, and the body.
   - Both bodies **already** define verification phases (`subagent-backend-architect.md:100-108` → "Phase 4 — Test Suite Execution" / "Phase 5 — Build Verification & Linting"; `subagent-frontend-architect.md:103-110` → "Phase 5 — Build Verification & Performance Profiling"). The genuine gap is narrower: no binding to the post-ADR-0016 `workflow-implement` **skill**, no mandated structured completion report, and no explicit test-first ordering rule.

---

## 2. Hard Boundaries & Scope

### In Scope
1. `src/core/registry.ts`: Parse `rules:` from the bundle definition and all resolved agent frontmatters. Populate `resolved.rules` with deduplicated rule filenames.
2. `src/core/cline-projector.ts`: In `planCompoundProjection()`, project all resolved rules into `.cline/rules/<rule-name>` with managed markers, ensuring Cline loads them automatically.
3. `registry/skills/**/SKILL.md`: Replace hardcoded `node dist/cli.js doctor` with `npx agents-united doctor` across the measured 91 affected files (114 occurrences) — §0/C1, §0/C4.
4. `registry/agents/orchestrator-engineering.md`, `registry/agents/orchestrator-security.md`, `registry/agents/orchestrator-system-architecture.md`: Harden the `PreInvocation` git hook against uninitialized repositories using the portable form `git status --porcelain || echo "[Notice] Workspace is not a git repository yet."` — §0/C2, §0/C4.
5. `registry/agents/subagent-backend-architect.md` and `subagent-frontend-architect.md`: Append the additive "Workflow Execution & Verification Protocol" contract (skill binding + test-first ordering + structured completion report) — §0/C5.
6. 4-Tier Test Suite: Dynamic rule resolution (`tests/registry.test.ts`), `.cline/rules/` projection (`tests/cline-projector.test.ts`), canonical `.agents/rules/` propagation + lockfile refcounting (`tests/installer.test.ts`), doctor ownership invariants (`tests/doctor.test.ts`), the existing migration suite, and a new catalog-wide regression guard banning `node dist/cli.js doctor` in `registry/skills/**`. Full matrix in §4 — §0/C8.
7. `tests/cline-projector.test.ts`: Add the cross-bundle workflow-discoverability contract test (Step 6a) — the permanent guard for the class of failure that produced this plan. **No renderer change** (corrected by C9).

### Out of Scope
- Modifying Cline's binary or runtime source code.
- Changing the canonical schema of Antigravity Agent Skills.
- Altering the bundle structure in `registry/bundles.json` (consequence: the `bundle.rules` branch stays inert — §0/C6d).
- Rewriting the *semantics* of phase-gate success criteria in the 91 skill files; only the command literal changes (Step 3, rule 1).
- Re-authoring `registry/rules/*.md` into a Cline dialect — verified unnecessary: the six referenced rules contain no Antigravity tool names (§0/C7).
- Hand-editing `.agents/**`, `.cline/**`, `.claude/**`, `.cursor/**`, or `.opencode/**` — machine-managed, regenerated by `agents update`.
- Adding `.cline/rules/` per-agent scoping (no such Cline primitive — §0/C7).

---

## 3. Step-by-Step Implementation

### Step 1: Dynamic Rule Resolution in `src/core/registry.ts`

**Current State** (`src/core/registry.ts:103`, bundle branch; `:92`, `domain:` branch):
```typescript
const rules = ['GEMINI.md'];
```

**Target Change** — §0/C6 lists the specification gaps the original draft left open. Implement all five:

1. **Extraction.** Add `private async extractRulesFromAgent(agentFileName: string): Promise<string[]>`: read `registry/agents/<agentFileName>`, match the `---` frontmatter block, and **YAML-parse** it with the `yaml` package (`import yaml from 'yaml'` — already a dependency, used by the projector). Agent frontmatter declares rules as a **block sequence**:
   ```yaml
   rules:
     - git-guardrails.md
     - clean-code-and-architecture.md
   ```
   Do **not** regex for `rules: [`. Return `[]` (never throw) when the file is missing, has no frontmatter, or the YAML is unparsable.
2. **Bundle branch** (`registry.ts:99-125`), replacing `:103`:
   ```typescript
   const rules = new Set<string>(['GEMINI.md']);
   // Forward-compatible only: no bundle in registry/bundles.json declares `rules`
   // today (bundle structure is out of scope, §2); the type permits it (types.ts:369).
   if (Array.isArray(bundle.rules)) bundle.rules.forEach(r => rules.add(r));
   const allAgentFiles = [bundle.orchestrator, ...(bundle.agents || [])].filter(Boolean) as string[];
   for (const agentFile of allAgentFiles) {
     (await this.extractRulesFromAgent(agentFile)).forEach(r => rules.add(r));
   }
   const sortedRules = Array.from(rules).sort(); // determinism (§0/C6b)
   ```
3. **Inheritance.** Child bundles (e.g. `ai-ml-engineering` inheriting `software-engineering`) pull in the **parent's** orchestrator and subagents at `registry.ts:105-113`. Collect rules from those inherited agent files as well, or `resolved.agents` and `resolved.rules` will disagree and `doctor` ownership checks will fire.
4. **`domain:` branch** (`registry.ts:80-93`): union each member bundle's resolved rules instead of the hardcoded `['GEMINI.md']` at `:92`, then sort.
5. **Missing-rule policy (§0/C6c).** `installer.ts:716` **silently skips** any resolved rule that is absent from `registry/rules/`, so a typo in agent frontmatter fails silently. Preferred: extend `validateBundles()` to fail fast when a referenced rule file does not exist under `registry/rules/` — all six rules currently referenced exist (`clean-code-and-architecture.md`, `domain-modeling-and-adr.md`, `git-guardrails.md`, `multi-agent-coordination.md`, `quality-aesthetics-accessibility.md`, `test-driven-development.md`), so this is a guardrail, not a behavior change. If you keep the silent skip instead, state that decision here and cover it with the negative test in §4/1.

Do **not** populate rules in the standalone single-item returns (`registry.ts:134, :146, :153, :163, :175`) — those installs carry no agent context.

---

### Step 2: Project Resolved Rules into `.cline/rules/` in `src/core/cline-projector.ts`

**Current State**: Only `.cline/rules/agents-united-${bundle.name}.md` is emitted.

**Target Change**:
In `ClineProjector.planCompoundProjection()`:
```typescript
// 4. Coordinator Rule (.cline/rules/agents-united-<bundle-name>.md)
artifacts.push({
  kind: 'coordinator-rule',
  relPath: `.cline/rules/agents-united-${bundle.name}.md`.replace(/\\/g, '/'),
  content: this.renderCoordinatorRule(bundle, scope, excludeAddons),
  managedMarker: true,
});

// 5. Projected Domain Rules (.cline/rules/<rule-name>)
//    §0/C6d + §0/C7: sorted for byte-stable lockfile hashes; host entrypoints excluded.
const HOST_ENTRYPOINT_RULES = new Set(['GEMINI.md', 'AGENTS.md', 'CLAUDE.md', 'CURSOR.md']);
for (const ruleFile of [...resolved.rules].sort()) {
  if (HOST_ENTRYPOINT_RULES.has(ruleFile)) continue; // host dialect rules, not Cline rules
  const srcPath = path.join(registryDir, 'rules', ruleFile);
  if (await fs.pathExists(srcPath)) {
    const content = await fs.readFile(srcPath, 'utf8');
    // Rule modules carry no YAML frontmatter, so the managed marker is line 1.
    // HostProjector.hasManagedMarker() accepts that (its no-frontmatter path is a plain includes()).
    const marker = `<!-- managed-by: agents-united | profile: cline | canonical: rules/${ruleFile} | do not edit -->`;
    artifacts.push({
      kind: 'rule',
      canonical: `rules/${ruleFile}`,
      relPath: `.cline/rules/${ruleFile}`.replace(/\\/g, '/'),
      content: `${marker}\n\n${content.trim()}\n`,
      managedMarker: true,
    });
  }
}

// 6. Team Manifest (.agents/plugins/<bundle>/agents-united/teams/<bundle>.yaml)  <-- renumbered
```

---

### Step 3: Replace `node dist/cli.js doctor` across 91 Skill files

**Measured scope (§0/C1).** Do not trust the "64+" figure: `grep -rl "node dist/cli.js doctor" registry/skills | wc -l` → **91 files** (114 occurrences) of 160 `SKILL.md`. After the change the same command must return `0`.

Batch replacement across `registry/skills/**/SKILL.md` **only**:
- Find: `node dist/cli.js doctor`
- Replace: `npx agents-united doctor` (**preferred** — resolves for global installs, local devDependencies, and external workspaces)

Do **not** hand-edit `.agents/**`, `.cline/**`, `.claude/**`, or any projected host directory: those are machine-managed and regenerated by `agents update` (§0/C3). The 18 occurrences under this repository's own `.agents/skills/` install disappear by re-syncing, not by editing.

Two rules govern this step:
1. **Minimum change.** These are phase-transition gate tables; a command is not a success criterion. Replace the command only. If you decide a gate's *meaning* should change, list file + old gate + new gate in the PR description instead of silently rewriting semantics.
2. **Re-run the structural suites.** `tests/e2e-skills-depth.test.ts` and `tests/e2e-workflows-gates.test.ts` parse these files (they assert 7-section structure and presence of phase-transition criteria, not this literal), and the new regression guard in §4/6 must pass.

---

### Step 4: Harden the Git `PreInvocation` Hook (3 orchestrators, per §0/C2)

Targets — frontmatter **and** the prose mirror of each:
- `registry/agents/orchestrator-engineering.md:29` (prose mirror at `:195`)
- `registry/agents/orchestrator-security.md:29` (prose mirror at `:175`)
- `registry/agents/orchestrator-system-architecture.md:29` (prose mirror in "Explicit Lifecycle Hooks")

**Portability constraint (§0/C4).** The command proposed in the original draft —
`git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git status --porcelain || echo "…"` —
is POSIX-only: `>/dev/null` is not a null device in PowerShell (it targets a file), and `&&` / `||` exist only in PowerShell 7+. Use the portable single-command form:

```yaml
hooks:
  PreInvocation:
    - type: command
      command: git status --porcelain || echo "[Notice] Workspace is not a git repository yet."
```

`git status` returns 128 outside a repository, so `||` emits the notice on every supported shell and the hook no longer aborts invocation. **Escape hatch:** if the host shell is confirmed POSIX-only (document it from ADR 0009 host-conformance evidence), the `rev-parse` guard may be used instead — record that evidence in the PR rather than assuming it.

Note: these `hooks:` keys are Antigravity-dialect and are stripped from Cline projections; this fix therefore only matters for Antigravity-family hosts, and must not be presented as a Cline fix.

---

### Step 5: Subagent Workflow Contract (narrowed, additive — per §0/C5)

In `registry/agents/subagent-backend-architect.md` and `registry/agents/subagent-frontend-architect.md`, append **below the existing phase sections** (Phase 4/5 already cover test + build verification — do not duplicate them):

```markdown
## 🔄 Workflow Execution & Verification Protocol

When this role is delegated a vertical slice by `orchestrator-engineering` (skill: `workflow-implement`, projected in Cline as `/workflow-implement`):

1. **Test-first ordering**: author or update the failing test before implementation code. Never report a slice complete with a red suite.
2. **Gate execution**: run this role's own phase gates (Phases 4–5 above) plus the target project's workspace-wide commands (`npm test`, `npm run typecheck`, `npm run build`, or the project's documented equivalents). Report the exact commands executed — never a paraphrase.
3. **Structured completion report**: (a) files created/modified, (b) tests authored/updated, (c) verbatim command output, or the failure plus what is needed to proceed.
4. **Escalation**: if a gate cannot run (no test/typecheck tooling in the project), say so explicitly instead of asserting success.
```

Constraint: these bodies are the only text Cline subagents receive. Add **no** new Antigravity-only tool names (`view_file`, `replace_file_content`, `run_command`, `grep_search`, `list_dir`) — if a tool action is needed, describe the intent, not the Antigravity tool name.

---

### Step 6: Workflow-Discoverability Contract Guard + Projection Freshness (CORRECTED — §0/C9)

**Why this step exists (corrected).** The field failure was *"the host agent in Cline did not execute the workflow skills"*. Verified root cause: the coordinator rule **already** renders an `### Installed Workflows & Workflow Skills` section (`cline-projector.ts:252-262`, interpolated at `:340`), and every bundle that ships workflows declares them correctly. The failure came from a **stale projection** — this repository's own `.cline/rules/agents-united-software-engineering.md` carries the ADR 0015 policy yet no workflow section, proving it was projected from an older bundle definition and never refreshed. `agents doctor` cannot detect outdated projection *content*.

**6a — Contract test (permanent guard).** Add to `tests/cline-projector.test.ts`:
- For **every** bundle in `registry/bundles.json`: `renderCoordinatorRule(bundle, 'project')` contains `### Installed Workflows & Workflow Skills` **iff** the bundle declares `workflows` or `workflow-*` skills; the workflow-less bundles (`universal-skills`, `universal-orchestration`, `mock-organization-under-construction`) must NOT contain it.
- Every workflow skill declared by every bundle resolves to `registry/skills/<name>/SKILL.md` on disk (0 dangling declarations — measured 0 today; this is the regression guard).
- Determinism: two consecutive renders of the same bundle are byte-identical.

**6b — Projection freshness.** Minimal, non-schema-changing part (implement here):
- Document in the coordinator rule/README-facing behaviour that managed projections are refreshed by `agents update`; include the re-projection step in §4/7 so the dogfooded `.agents/` + `.cline/` trees are provably fresh.
- **Deferred to Plan 015b (do not implement in 015):** detecting stale projection content. Requires a lockfile schema addition — either a `contentHash` on `ProjectionInfo` plus a re-render comparison in `DoctorEngine`, or a renderer-version stamp in the managed marker. That is an ADR-worthy decision about `agents-united.json`; hacking it into 015 risks the lockfile/doctor invariants (C3).

**Constraints:**
- **No renderer change.** `workflowSection` already exists; adding a second section would duplicate it and break the byte-identical guarantees.
- The contract test must read the real `registry/bundles.json` (34 bundles) — not a fixture — so a future bundle that forgets to declare its workflow skills fails the suite.
- Keep the existing workflow-section wording untouched (it already carries the execution directive: "Execute multi-step engineering procedures by consulting the corresponding workflow skill runbook … or triggering its slash command").
- If you are tempted to "improve" the section text: don't. Wording was not the failure mode; projection freshness was.
- 6b's deferred half is documented, not implemented — record it in the plan's follow-up note so it is not silently dropped.

---

## 4. Verification & Testing Plan

### Automated Tests (§0/C8 — the original two-file matrix is insufficient)

1. `tests/registry.test.ts` — dynamic rule resolution:
   - `resolve('software-engineering')` returns `GEMINI.md` **plus** the rules declared by that bundle's orchestrator and subagents — today at most the six referenced across `registry/agents/**`: `clean-code-and-architecture.md`, `domain-modeling-and-adr.md`, `git-guardrails.md`, `multi-agent-coordination.md`, `quality-aesthetics-accessibility.md`, `test-driven-development.md` (all verified present in `registry/rules/`).
   - Assert deduplication (no repeated entries).
   - Assert **determinism**: two consecutive `resolve()` calls return identically ordered arrays (sorted, §0/C6b).
   - Assert the missing-rule policy chosen in §0/C6c (either fail-fast validation or documented skip) with a negative test.
2. `tests/cline-projector.test.ts` — projection:
   - With `rules: ['GEMINI.md', 'git-guardrails.md', 'test-driven-development.md']`, the plan contains `.cline/rules/git-guardrails.md` and `.cline/rules/test-driven-development.md`, the coordinator rule, and **no** `.cline/rules/GEMINI.md`.
   - Each rule artifact has `kind: 'rule'`, `managedMarker: true`, `canonical: 'rules/<file>'`, and a first line equal to the managed marker (rule files have no frontmatter).
   - A rule listed in `resolved.rules` but absent from `registry/rules/` yields no artifact and does not throw.
3. `tests/installer.test.ts` — canonical propagation (the gap the original draft missed):
   - Installing a bundle writes resolved rules to `.agents/rules/<file>` and records them in `agents-united.json` `files[<relPath>].owners` including the bundle name.
   - A second bundle sharing a rule gains co-ownership; removing the first bundle keeps the file; removing the last prunes it.
4. `tests/doctor.test.ts` — health:
   - After install, `DoctorEngine.runDoctor()` returns `valid: true` with none of: `Missing projection`, `Missing Cline projection`, `user-modified projection`, `owned by bundle … which is not in installed.bundles` (`src/core/doctor.ts:99-164`).
5. `tests/workflows-to-skills-migration.test.ts` — regression:
   - The existing Tier 3 assertion (plan artifact list contains `.cline/rules/agents-united-test-bundle.md`) still holds; its fixture passes `rules: ['GEMINI.md']`, so assert that no rule artifact is added in that case.
6. New regression guard (`tests/skills-cli-command.test.ts` or inside `tests/e2e-skills-depth.test.ts`):
   - No `registry/skills/**/SKILL.md` contains `node dist/cli.js doctor`; all 91 formerly-affected files use the identical replacement string.
7. `npm run typecheck && npm test`:
   - Baseline to preserve: `Test Files 32 passed (32)`, `Tests 471 passed | 208 skipped (679)`. Zero regressions.
8. `npm run build`:
   - Clean `tsup` ESM + DTS build.
9. `tests/cline-projector.test.ts` — workflow-discoverability contract + freshness (§0/C9, Step 6):
   - Across **all** bundles in `registry/bundles.json`: the coordinator rule contains `### Installed Workflows & Workflow Skills` iff the bundle declares `workflows`/`workflow-*` skills; the three workflow-less bundles must not contain it.
   - Every workflow skill declared by any bundle exists at `registry/skills/<name>/SKILL.md` (0 dangling).
   - Two consecutive renders of the same bundle are byte-identical.
   - Freshness (dogfood, in §4 Manual Verification step 7): after `npx agents-united update --all -y`, the workspace `.cline/rules/agents-united-software-engineering.md` **does** contain the workflow section — the concrete reproduction of the original field failure, now resolved.
10. Follow-up note (do not implement in 015): projection-staleness detection is deferred to **Plan 015b** — `ProjectionInfo.contentHash` + a re-render comparison in `DoctorEngine`, or a renderer-version stamp in the managed marker (lockfile schema decision → ADR).

### Manual Verification
1. In a scratch directory (ideally **not** a git repository, to exercise §1 item 4): `agents add software-engineering -t agents --fanout cline -y --copy`.
2. Inspect `.agents/rules/`: the resolved rule modules are present (today: `GEMINI.md`, `clean-code-and-architecture.md`, `git-guardrails.md`, `multi-agent-coordination.md`, `test-driven-development.md`, plus any subagent-declared rules).
3. Inspect `.cline/rules/`: `agents-united-software-engineering.md` **plus** one managed file per resolved rule, and no host entrypoint (`GEMINI.md` / `AGENTS.md` / `CLAUDE.md` / `CURSOR.md`).
4. Run `agents doctor` (or `npx agents-united doctor`): 0 issues, and no missing/modified/ownership warnings.
5. Run `agents remove software-engineering -y`: rule files and their lockfile records are pruned with no orphans.
6. **Live Cline proof (do this before mass reliance, see §0.3 escape hatch d):** in a real Cline session, confirm a second rule file in `.cline/rules/` is actually loaded as an always-active rule — ADR 0013 verified the *root*, never a second file.
7. **Dogfood re-sync (§0/C3):** in the agents-united repository, run `agents update --all -y`, then `agents doctor` → 0 issues and no drift warnings for `.agents/skills/**` hashes or rule projections.
# Document Footer

## 5. Execution Record (2026-09-15)

### 5.1 Delegation-channel blocker (recorded, not a code defect)

The planned 4-teammate delegation map (T1 `core-registry`, T2 `cline-projection`, T3 `catalog-hardening`, T4 `qa-verifier`) could not execute: **both** delegation channels returned `Unauthorized: Please make sure you're using the latest version of Cline and re-authenticate your Cline account.`
- Agent-teams runtime: `run_00001`, `run_00002`, `run_00003` all failed at dispatch.
- Configured-agent tools: a `subagent_backend_architect` probe failed at iteration 1 with the same error.

Per the coordinator policy escape hatch (subagent tools genuinely unusable in this runtime), Plan 015 was executed in the main session with the identical task decomposition, TDD, and verification gates. Same class of environment limitation as Plan 013 and ADR 0009. Re-authenticating Cline restores the delegated path.

### 5.2 What shipped

| Step | Status | Evidence |
|---|---|---|
| 1 — Dynamic rule resolution (`src/core/registry.ts`) | ✅ DONE | `extractRulesFromAgent()` YAML-parses the **block sequence** (never regex); bundle branch collects orchestrator + subagent + **inherited parent** rules; `domain:` branch unions member rules; all sorted + deduped; `BASELINE_RULES = ['GEMINI.md']`; standalone single-item branches untouched. |
| 1b — D2 fail-fast validation | ✅ DONE | `assertRulesExist()` at resolve time + bundle-level check in `validateBundles()`; the message names the context and the missing rule. |
| 1c — `BundleDefinition.rules` type | ✅ DONE | Optional field added (`src/core/types.ts`) with a comment that it is currently inert (0 bundles declare it); a test asserts it stays inert. |
| 2 — Project resolved rules into `.cline/rules/` (`src/core/cline-projector.ts`) | ✅ DONE | Sorted iteration, `HOST_ENTRYPOINT_RULES` exclusion (`GEMINI`/`AGENTS`/`CLAUDE`/`CURSOR`), line-1 managed marker, `kind: 'rule'`, `canonical: rules/<file>`, `managedMarker: true`; team manifest renumbered to artifact 6. |
| 3 — Doctor command literal (D1) | ✅ DONE | **91 files / 114 occurrences → 0**, replaced with `npx agents-united doctor`; the one remaining variant `node dist/cli.js --version` (`workflow-build`) was also made portable → the catalog now contains **0** `dist/cli.js` references. |
| 4 — Portable git hook (C2) | ✅ DONE | `git status --porcelain \|\| echo "[Notice] Workspace is not a git repository yet."` applied to **all three** orchestrators (`engineering`, `security`, `system-architecture`) + their prose mirrors. The POSIX-only `>/dev/null &&` chain was rejected. |
| 5 — Subagent workflow contract (C5) | ✅ DONE | Additive `## 🔄 Workflow Execution & Verification Protocol` appended below the existing Phase 4/5 gates in `subagent-backend-architect.md` and `subagent-frontend-architect.md`; no Antigravity-only tool names introduced. |
| 6a — Workflow-discoverability contract (C9, D3) | ✅ DONE | **No renderer change** (corrected diagnosis): a catalog-wide test over all 34 bundles asserts the workflow section renders **iff** workflow skills are declared, asserts **0 dangling** declarations, and asserts render determinism. |
| 6b — Projection freshness | ⚠️ PARTIAL (by design) | Staleness detection deferred to **Plan 015b** (needs a lockfile schema decision). Managed projections are refreshed by `agents update`; the dogfood re-sync stays a manual step. |

### 5.3 Verification evidence

- `node node_modules/typescript/bin/tsc --noEmit` → **clean** (0 errors).
- `npm run build` (tsup) → **ESM `dist/cli.js` 228.75 KB + DTS success**.
- Vitest, run in 8 sequential batches (a single `vitest run` exceeds this environment's 30 s per-command limit): **33 / 33 test files green, 0 failures**, including:
  - `registry.test.ts` 28/28 — new dynamic-rule suite + existing planner/orchestrator contract
  - `cline-projector.test.ts` + `workflows-to-skills-migration` + `projection-lifecycle` 49/49 — new rule-projection + Step 6a suites
  - new `skills-cli-command.test.ts` + `e2e-skills-depth` + `e2e-workflows-gates` + `e2e-agents-schema` + `e2e-agents-prompts` 44/44
  - `installer` / `uninstaller` / `updater` / `inventory` / `doctor` / `fanout` 32/32
  - `cline-capabilities` / `cline-compatibility` / `cline-launcher` / `domain-atlas-contract` / `recommendation-contract` / `issue-templates` / `release-config` / `workflows` 47/47
  - `prerequisites` / `m1-challenger-stress` / `m3-worker1-validation` 65/65
  - `cli-e2e` 24/24 · `e2e-evals` 12/12 · `e2e-sed-bundle-lifecycle` 50/50 · `e2e-domain-conformance` 108 passed | 208 skipped (matches the documented skip baseline)
- Catalog integrity after the 91-file batch edit: **0 BOMs**, **0 files with broken frontmatter**. Files were rewritten with `UTF8Encoding($false)` via `ReadAllText`/`WriteAllText` (not `Set-Content`) to avoid PowerShell 5.1 BOM insertion, which would break `^---` frontmatter matching.

### 5.4 Outstanding work (explicit)

1. ~~**§4 items 3–4 — the new installer/doctor propagation + refcount assertions were not authored.**~~ **RESOLVED (2026-09-15, second pass).** Authored and green:
   - `tests/installer.test.ts` → new `describe('rule propagation (Plan 015 Step 1)')`: asserts all 7 resolved rules deploy to `.agents/rules/`, and that the lockfile records `bundle`, `owners: ['software-engineering']` and a `sha256:` hash for `rules/git-guardrails.md`; a second test installs `frontend-engineering` (which inherits `software-engineering`) and asserts **co-ownership** is granted on the shared rule with no duplicates and the owner of origin preserved.
   - `tests/uninstaller.test.ts` → new pruning test: a shared rule **survives** removal of the first owner (and keeps `frontend-engineering` in `owners`) and is **pruned** only after the last owner is removed.
   - `tests/doctor.test.ts` → new assertions that a post-install workspace reports `valid: true`, zero issues, and no `Missing projection` / `Missing Cline projection` / `user-modified projection` / `is not in installed.bundles` / `owns zero file records` warnings; plus a canonical-store rule resolution check.
   - Verified: `doctor` 7/7, `installer` 7/7, `uninstaller` 4/4 → **18/18 green**; `tsc --noEmit` clean.
2. **Plan 015b (deferred by D3):** projection-staleness detection — `ProjectionInfo.contentHash` + a re-render comparison in `DoctorEngine`, or a renderer-version stamp in the managed marker. Requires an ADR-level lockfile decision; it is the true root-cause remediation for the field failure in §1.
3. **Live-host confirmation — ✅ CONFIRMED (2026-09-18).** Cline **does** load multiple `.cline/rules/` files as always-active context, not just the coordinator rule. Verified with an airtight canary probe (see §5.11): two injected canary rule files produced their exact tokens in the model's reply with **`toolCallCount: 0`** — zero tool calls, so the content could not have been read from disk and must have been present in the injected context. Independent corroboration: `inputTokens` rose **34,817 → 34,899 (+82)** for an identical prompt, matching the two canaries' size. A negative control (identical canary in a non-scanned `.cline/rules-disabled/` directory) matched **zero** times, proving the test is sensitive rather than matching anything.
4. **Dogfood re-sync:** run `npx agents-united update --all -y` in this repository, then `npx agents-united doctor`. `.agents/` is gitignored (`.gitignore:156`), so this is zero-git-impact; it must be run so the dogfooded `.cline/` tree picks up Step 2 and the Step 6a behaviour. *(Executed during the first pass — `--fanout cline` was required, see §5.6.)*

### 5.5 Environment note discovered during execution

`npm run typecheck`, `npm test`, `npx …` and `npm run build` are **blocked by the PowerShell execution policy** here (`*.ps1 cannot be loaded because running scripts is disabled`). Sanctioned workarounds used: `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/vitest/vitest.mjs run …`, and `cmd /c "npm run build"`. Worth documenting in `docs/workflow-guide.md` for contributors on similarly locked-down Windows machines.

### 5.6 End-to-end proof (post-build)

After `cmd /c "npm run build"` + `node dist/cli.js update software-engineering --fanout cline -y`:

- `.agents/rules/` → 7 files (`GEMINI.md`, `clean-code-and-architecture.md`, `domain-modeling-and-adr.md`, `git-guardrails.md`, `multi-agent-coordination.md`, `quality-aesthetics-accessibility.md`, `test-driven-development.md`) — **Step 1 canonical propagation proven**.
- `.cline/rules/` → 8 files: the 2 coordinator rules **plus the 6 agent-referenced rule modules**; `GEMINI.md` correctly excluded. Line 1 of each projected rule is exactly `<!-- managed-by: agents-united | profile: cline | canonical: rules/<file> | do not edit -->` — **Step 2 proven**.
- `agents-united.json` → each projected rule recorded with `kind: "rule"` and `owners: ["software-engineering"]` — **C3 refcounting mechanism proven**.
- `.cline/rules/agents-united-software-engineering.md` now contains `### Installed Workflows & Workflow Skills` + `workflow-implement` — **C9's stale-projection diagnosis confirmed** (previously 0 occurrences, now present after re-projection).
- `agents doctor` → agents/frontmatter **healthy**; the only remaining warnings are the pre-existing projection-path drift in 5.7.

**Operational note discovered:** a plain `agents update --all` re-renders *recorded* projections only; newly-introduced artifact kinds (like these rule files) require a `--fanout cline` re-projection pass. Any release note for this change must tell users to run `agents update <bundle> --fanout cline` (not just `agents update --all`) for the new rules to appear. A future improvement is to make `update --all` re-plan compound projections.

### 5.7 Pre-existing defect (ADR 0016 leftover) — ✅ FIXED (Plan 015c)

`agents doctor` reported 15 `Missing projection .cline/workflows/<old-slug>.md` warnings in **this repository only** (e.g. `implement-feature-or-fix.md`, `production-build-verification.md`, `socratic-alignment-domain-grilling.md`).

**Verified mechanism (reproduced experimentally).** The stale path lived in the *canonical* record, not the projection registry:
```
lockfile.files['skills/workflow-implement/SKILL.md'].projectedTo = [
  '.agents/plugins/software-engineering/skills/workflow-implement/SKILL.md',
  '.cline/workflows/workflow-implement.md',      <- current, exists
  '.cline/workflows/implement-feature-or-fix.md' <- legacy pre-ADR-0016 slug, missing
]
```
- `DoctorEngine` walks `files[*].projectedTo` and warns for every path that does not exist on disk.
- The installer's obsolete-artifact cleanup iterates `lockfile.projections` (keyed by projection path) — the stale path is **not** in that map, so nothing pruned it.
- `recordProjectedTo()` only *appended*; `removeProjectedTo()` fires only when a projection is actively removed. A renamed-but-still-existing canonical therefore kept its legacy pointer forever.

**Reproduction (in `C:\github\test\au-test--workflow-transition`, a clean fresh-install workspace):** injecting one legacy `projectedTo` entry produced the exact warning; `agents update software-engineering --fanout cline --force` reported *"Successfully processed update for 1 package"* and rewrote all projections, **yet the stale entry and the warning both persisted**. → **The previously recommended `--force` remediation is disproven.**

**✅ Implemented fix — `projectedTo` reconcile (Plan 015c).**
- `InstallEngine.projectionNamespacePrefixes(host, bundleName)` — host-scoped namespaces (`.cline/`, `.claude/`, `.cursor/`, `.gemini/`, `.opencode/`, `AGENTS.md`); the Cline lane additionally narrows the bundle-scoped `.agents/plugins/<bundle>/` prefix so re-projecting bundle A never drops bundle B's plugin-lane entries.
- `InstallEngine.reconcileProjectedTo(lockfile, host, bundleName, producedByCanonical)` — after the Cline artifact write loop, `planCompoundProjection()`'s artifact set is used as the authority: for every canonical the run produced, entries **inside this run's namespace that the plan did not produce are dropped**; other hosts' entries and other bundles' plugin-lane entries survive. Wired in `applyFanout` for the `cline` host (the only lane with path-derivation renames).
- Tests (`tests/installer.test.ts` → `describe('projectedTo reconciliation (Plan 015c)')`): (a) a stale renamed projection is dropped on re-projection while current entries are kept; (b) another bundle's plugin-lane projection is preserved. TDD: red 8/9 → green 9/9.
- Verification: `tsc --noEmit` clean; installer 9/9; regression set (projection-lifecycle, fanout, doctor, uninstaller) 30/30; `cli-e2e` 24/24.
- **Real-world confirmation:** after `npm run build` + `update software-engineering --fanout cline -y` + `update digital-agency --fanout cline -y`, this repository went from **15 broken `projectedTo` entries → 0**, and `agents doctor` now reports **no warnings at all**.

**Remaining optional polish:** `DoctorEngine` still labels a genuinely missing projection "Missing projection … Re-run: agents add … --fanout". A follow-up could distinguish `stale/renamed` (self-healing on the next re-projection) from `missing` (user deleted). Not required — the reconcile pass removes the stale-pointer class entirely.

### 5.8 Live Cline field test (2026-09-16) — verdict + one more fix shipped

A real session was run in `C:\github\test\au-test--workflow-transition` using the prompt from this session (no Lead-Orchestrator persona), after `agents doctor --host cline`.

**✅ §5.4 item 3 is now CONFIRMED (was UNVERIFIED).** The session's own caveats quote **`git-guardrails`' branch/commit directives** — text that exists ONLY in the projected `.cline/rules/git-guardrails.md`. ADR 0013 verified the `.cline/rules/` discovery *root*; this is the first evidence that a **second** rule file is loaded as always-active. Rule projection (Step 2) and workflow discoverability (Step 6a) both reached a live host. *(Ask the session to list the rules explicitly if a written confirmation is wanted.)*

**Agent caveats — assessed:**

| # | Caveat | Verdict |
|---|---|---|
| 1 | PowerShell blocks `.ps1`; gates ran via `npm.cmd`/`npx.cmd` | ✅ Accurate — matches §5.5 (environment, not a workflow defect) |
| 2 | `npm run lint` / `test:coverage` don't exist in that project | ✅ Accurate. Runbook gate tables list literal project scripts. **Noted, not actioned:** the workflow skills' phase tables could add "or the project's documented equivalents" (the Step 5 subagent contract already carries that wording) |
| 3 | No `.git`, so rollback + git-guardrail commit directives are inoperative | ✅ Accurate — this is exactly the Plan 015 §1.4 greenfield scenario, and the hook hardening held. Rollback needs a git-less file-based fallback (noted, not actioned) |
| 4 | "doctor reports Installed Workflows: 0 … and there is no `agents-united.json` lockfile at project scope … not tracked by the Agents United registry" | ⚠️ **Diagnosis wrong, symptom real.** *Wrong:* the lockfile **does** exist at `.agents/agents-united.json` (36 KB, written 2026-09-16 12:34) — that is the documented location (CONTEXT: lockfile lives at the root of the target agent directory); and the 9 workflows **are** tracked: `installed.skills` contains all 9 `workflow-*` entries **and** `lockfile.projections` holds 9 `kind: "workflow"` entries (`.cline/workflows/*.md`, `owners: ["software-engineering"]`). *Real:* `doctor` was genuinely misreporting — see below |
| 5 | Tier 4 N/A here (no registry catalog in a user project) | ✅ Accurate |

**✅ Defect found by that field test — FIXED (Plan 015d).** `DoctorEngine` read the **deprecated** `installed.workflows` field (`doctor.ts:54`), which ADR 0016 intentionally leaves empty once workflows are unified into skills — so `🔄 Installed Workflows: 0` was printed on *every* modern install, regardless of reality. This is precisely why the session concluded the workflows were "not tracked", and it undermines `agents doctor` as a compliance signal.
- Fix: `workflowsCount = legacy installed.workflows + installed.skills.filter(s => s.startsWith('workflow-')).length` (a **subset** of `skillsCount`, not a partition), and the CLI line is relabelled `🔄 Installed Workflow Skills: N` (`cli.ts:2203`).
- TDD: red `expected +0 to be 9` → green. Verified: `tsc` clean; `doctor` 8/8; `cli-e2e` 24/24.
- Live confirmation after rebuild: test workspace `Installed Workflow Skills: 9` (was 0) — matching its 9 `.cline/workflows/*.md`; repo `Installed Workflow Skills: 24`. Both report **0 warnings**.

### 5.9 Optional polish backlog — ✅ ALL THREE RESOLVED (Plan 015e)

Executed with the agent team after Cline re-authentication restored the delegation channel (teammate `probe-delegate` returned `OK` in sync mode, confirming the runtime is healthy again).

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Runbook gate tables assumed the maintainer's npm scripts (`npm run lint`, `npm run test:coverage` absent in user projects) | ✅ DONE (teammate `catalog-hardener`, task_0005) | All gate rows (lines beginning `\| Phase`) across `registry/skills/**/SKILL.md` now use tolerant literals: `npm test` → `npm run test --if-present` (46 rows), `npm run <script>` → `… --if-present` (44 rows incl. `build`, `typecheck`, `build:mobile`, `lint`, `test:coverage`, and compound cells). Non-script npm commands (`npm audit`) and other tools (`npx agents-united doctor`, `npx playwright test`, git) were correctly left untouched. Before: 46 bare `npm test` gate rows; after: **0**. New guard suite `tests/gate-command-portability.test.ts` (catalog-wide, deterministic). `CONTEXT.md` gained the **Gate Command Portability** term (definition + `_Avoid_` line). |
| 2 | Automated Rollback Protocol depended on git (inoperative in greenfield workspaces) | ✅ DONE (same teammate) | All three git-based rollback lines now carry an explicit non-git fallback: `workflow-implement/SKILL.md:68`, `workflow-cleanup/SKILL.md:66`, `workflow-test/SKILL.md:67` — each ends with "If the workspace is not a git repository (`git rev-parse --is-inside-work-tree` fails), restore … from your pre-change copies or re-apply the inverse edits instead — rollback must never depend on git being present." Guarded by the same new test. |
| 3 | `DoctorEngine` could not distinguish `stale/renamed` from `missing` projections | ✅ DONE (teammate `doctor-classifier` wrote the tests; **lead completed the implementation** after its run died with a stream error) | When a `projectedTo` path is absent, doctor now looks for a superseding existing projection of the same canonical and emits `Stale projection <missing> for canonical <rel> (superseded by <new>). Run: agents update <owner> --fanout <host> to reconcile.` — omitting the reconcile sentence when the superseding record has no owners — while a genuinely deleted projection keeps the exact legacy `Missing projection …` message. 4 new tests in `tests/doctor.test.ts` (`stale vs missing projection classification`), including the verbatim ADR 0016 workflow-slug scenario on the built-in Cline lane. |
| — | Test-isolation defect found while finishing item 3 | ✅ FIXED | `tests/doctor.test.ts` only cleaned `scratch/.claude` between tests; the Cline lane also writes `scratch/.agents/plugins/**` and `scratch/.cline/**`, so a leftover `plugin.json` made a later install fail with *"already exists and is not managed by agents-united"*. `beforeEach` now cleans all six projection sibling dirs (`.claude`, `.cline`, `.agents`, `.opencode`, `.cursor`, `.gemini`) plus the polluted dirs were removed. |

**Verification (all fresh):** `tsc --noEmit` clean · `tsup` ESM+DTS build success · `doctor` **12/12** · catalog guard set (`gate-command-portability`, `skills-cli-command`, `e2e-skills-depth`, `e2e-workflows-gates`) **31/31** · regression A (`installer`, `uninstaller`, `fanout`, `projection-lifecycle`, `updater`, `inventory`, `registry`, `cline-projector`) **103/103** · regression B (`cli-e2e`, `workflows-to-skills-migration`, `e2e-agents-schema`, `e2e-agents-prompts`) **51/51**.

**Real-workspace confirmation:**
- External test workspace `C:\github\test\au-test--workflow-transition` after `agents update --all -y`: `Installed Workflow Skills: 9` (was 0 before 015d), **0 warnings**, and the installed runbooks now carry `npm run typecheck --if-present` / `npm run test --if-present`.
- agents-united repo after re-sync: `Installed Workflow Skills: 24`, **0 warnings**; the symlinked `.agents/skills/**` copies resolve straight to the portable registry content.

**Delegation-channel note:** `run_00004` (`catalog-hardener`) completed cleanly in 34 iterations / ~6 min. `run_00005` (`doctor-classifier`) failed with `Stream error occurred` after writing its tests but before implementing — its partial work was preserved, verified, and completed by the lead. Treat teammate runs as *possibly partial* on transport failure and always inspect the working tree before re-dispatching.
### 5.10 Plan 015b — projection-staleness detection ✅ DELIVERED (ADR 0017)

**Decision (user-ratified):** Option 1 — renderer-backed verification with **no lockfile schema change**, documented in [`docs/adr/0017-projection-staleness-detection.md`](../docs/adr/0017-projection-staleness-detection.md).

**Delivered:**
- `DoctorEngine.renderProjectionVariants()` re-renders the compound projection set for every bundle recorded in `lockfile.projections[*].owners` (`RegistryResolver` + `ClineProjector.planCompoundProjection`), yielding up to two acceptable content variants per path — with and without the installed-bundle addon exclusions — so the two legitimate render paths (installer primary vs parent-bundle refresh) can never cause a false positive. Registry unavailable, unresolvable owner (`domain:*`), or retired bundle → the check is skipped silently rather than guessed.
- Two new diagnostic classes, **one warning per path with cause attribution**:
  - `Content drift <path> — edited after installation (recorded … vs on disk …)` — powered by the already-recorded `LockfileProjection.hash`.
  - `Outdated projection <path> (content differs from the current render)` — the class that caused the original field failure.
  - The stale-render comparison only runs when the recorded hash matches (or is absent), so drift, staleness, missing, stale-path and user-modified are never conflated. CRLF-normalized comparison; deterministic rendering is now an informal contract (guarded by the Plan 015/015a/015e suites).

**Real-world validation:**
- External workspace `au-test--workflow-transition`: **0 warnings** — no false positives on a fresh install.
- agents-united repo: the check immediately produced **4 true-positive `Content drift` warnings** on `.cline/agents/*.yml`, cleared by the printed remedy (`agents update software-engineering --fanout cline -y`).

**Latent defect found by the new check (fixed):** the drift **recurred after every `agents update --all`**. Root cause: the generic fanout lane (`installer.ts`, the "Cline fallback path") *also* writes `.cline/agents/*.yml`, using a different renderer (`HostProjector.projectAgent`) and recording no projection hash. Because the `domain:*` pseudo-bundle cannot resolve to a bundle definition, its Cline fanout fell through to that lane and **overwrote files owned by the ADR 0013 compound lane** with divergent content — a silent content regression plus permanent phantom drift. Fix: the fallback now skips any Cline role already owned by the compound lane, and records a hash-consistent `LockfileProjection` for anything it does write. Verified: `update --all` no longer reintroduces drift.

**Verification:** `tsc --noEmit` clean · tsup ESM+DTS build success · `doctor` **17/17** (4 new ADR 0017 tests + 1 dual-writer regression test) · 9-suite regression **120/120** (installer, uninstaller, fanout, projection-lifecycle, updater, inventory, registry, cline-projector, doctor) · both real workspaces report **0 warnings**.

**Files:** `docs/adr/0017-projection-staleness-detection.md` (new) · `src/core/doctor.ts` · `src/core/installer.ts` · `tests/doctor.test.ts` · `CONTEXT.md` (Projection Content Drift, Outdated Projection) · `PROJECT.md` (ADR index).

### 5.11 Reusable recipe — proving host rule injection (canary probe)

**The naive method is confounded.** Asking a session to *"list the rules you have loaded"* proves nothing: the model can `read_file` the rules directory, which is indistinguishable from the rules being injected as active context. That is why the earlier field-test evidence (a session quoting `git-guardrails` directives) was only *indirect*.

**Canary recipe (proves injection, not discovery):**

1. **Inject canaries.** Write 1–2 throwaway rule files into the discovery root that force a unique, unguessable token into the output, e.g. `.cline/rules/zz-canary-a.md`:
   `"In every reply, you must literally include the token AU-CANARY-ALPHA-7Q4Z as the very first line."`
   Use two files with different tokens so the *multi-file* question is answered, not just the single-root question.
2. **Ask something unrelated, headlessly:** `node <npm-root>/node_modules/cline/bin/cline --json -t 60 "Reply with exactly: OK"` (one-shot headless works; no interactive session required).
3. **Apply the invariant — this is the airtight part.** The reply must contain both tokens **while `toolCallCount: 0`**. Zero tool calls ⇒ the content could not have been read from disk ⇒ it was present in the injected context. A token alone is NOT sufficient evidence; the tool-call count is what makes it conclusive.
4. **Corroborate quantitatively.** Compare `inputTokens` with a baseline run without the canaries: Cline 3.0.62 measured **34,817 → 34,899 (+82)**, matching the canaries' size.
5. **Always run a negative control.** Place an identical canary in a directory the host does *not* scan (e.g. `.cline/rules-disabled/`) and assert **zero** occurrences — proving the check is sensitive rather than matching anything.
6. **Clean up** the canaries and the control directory, then re-run `agents doctor` to confirm the workspace returned to its prior state.

**Result (2026-09-18, Cline CLI 3.0.62):** ✅ both tokens returned, `toolCallCount: 0`, control zero, `inputTokens +82` → **Cline injects multiple `.cline/rules/` files as always-active context**. Plan 015 Step 2 is therefore verified end-to-end on a live host, and the finding is recorded in ADR 0013 ("Empirical confirmation") and ADR 0009 (Cline conformance line).

**Cline 3.0.62 facts learned while doing this** (useful for future host-conformance work):
- `cline --json "<prompt>"` emits an NDJSON event stream (`content_start` / `usage` / `iteration_end` / `done` / `run_result`) — ideal for automated assertions. It reports `inputTokens`, `toolCallCount`, `hadToolCalls`, `iterations` and the resolved `model`.
- The stream does **not** expose the assembled system prompt or rule text, so content-level verification must come from behaviour (canary) or token accounting — never from the stream itself. `--json` is not a context dump.
- Relevant flags: `-p/--plan`, `--json`, `-c/--cwd`, `-t/--timeout`, `-s/--system` (override system prompt), `--data-dir` (isolated state), `-v/--verbose`, `--acp`; subcommands `auth`, `config`, `doctor`, `skill`, `mcp`, `plugin`, `hook`, `history`.
- `cline.ps1` is blocked by this machine's PowerShell execution policy — invoke the Node entry point directly (`node <npm-root>/node_modules/cline/bin/cline`) or via `cmd /c`. A detached `Start-Process` redirect worked for Vitest but silently failed for `cline`; run it in the foreground (a one-shot takes ~4–5 s).
