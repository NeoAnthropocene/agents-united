# Comprehensive Skill Registry Survey & Analysis

**Author**: Survey Explorer 2  
**Target Project**: `agents-united` (`c:\github\agents-united`)  
**Date**: 2026-08-13  
**Working Directory**: `c:\github\agents-united\.agents\teamwork_preview_explorer_survey_2`  
**Original Request Reference**: `c:\github\agents-united\ORIGINAL_REQUEST.md` (Requirement R2)

---

## 1. Executive Summary

A comprehensive investigation was conducted across the `registry/skills/` directory of `agents-united`, as well as its core engine implementation in `src/` (`registry.ts`, `installer.ts`, `doctor.ts`, `adapter.ts`) and test suites (`tests/`).

### Key Findings
1. **Directory Count**: Exactly **48 skill directories** exist under `registry/skills/`.
2. **Missing Playbooks (16.7%)**: **8 out of 48 skills** (`dependency-management`, `finishing-a-development-branch`, `performance-optimization`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`) are **completely empty directories with missing `SKILL.md` files**.
3. **Boilerplate Playbooks (83.3%)**: **40 out of 48 skills** contain a stub `SKILL.md` file averaging **10–14 lines**, consisting of identical generic placeholder text.
4. **Frontmatter Schema Gap (0/48 Passing)**: All existing 40 `SKILL.md` files contain basic frontmatter with only `name` and `description`. **0 skills contain the required progressive disclosure `metadata: { author, version }` object**.
5. **Runbook Depth Deficit (0/48 Passing)**: **0 skills meet the target minimum line count of 50 lines**. Average existing line count is 14 lines (or 0 for missing skills).
6. **Execution Components Missing (0/48 Passing)**: None of the 48 skills currently specify:
   - Execution Triggers
   - Input / Output Specifications
   - Edge-case handling rules
   - Error-recovery procedures
   - Concrete code or configuration exemplars
7. **System Engine Gap**: `src/core/doctor.ts` tracks installed skill counts in `lockfile.json`, but **lacks frontmatter or content integrity validation** for skills (unlike agent files which are validated).

---

## 2. Core Engine Architecture & Parsing/Validation Mechanics

An analysis of `src/` and `tests/` reveals how skill files are parsed, installed, and validated within `agents-united`.

```
           +-------------------------+
           |   registry/bundles.json |
           +------------+------------+
                        |
                        v
+-----------------------+-----------------------+
|                RegistryResolver               |
|            (src/core/registry.ts)             |
+-----------------------+-----------------------+
                        |
                        v
+-----------------------+-----------------------+
|                 AgentInstaller                |
|           (src/core/installer.ts)             |
+-----------------------+-----------------------+
   | (Deploy directory)             | (Hash check if SKILL.md exists)
   v                                v
+-----------------------+   +-------------------+
|  .agents/skills/<name>|   |   lockfile.json   |
+-----------------------+   +-------------------+
                                    |
                                    v
                            +---------------+
                            |  DoctorEngine |
                            |  (doctor.ts)  |
                            +---------------+
```

### 2.1 Resolution (`src/core/registry.ts`)
- **Bundle Resolution**: When `RegistryResolver.resolve(identifier)` is called with a bundle name (e.g. `software-engineering`), it extracts the list of skill names defined in `bundle.skills` in `registry/bundles.json`.
- **Single Skill Resolution**: When called with a skill directory name (e.g. `test-driven-development`), `RegistryResolver` checks `path.join(registryDir, 'skills', identifier)`. If the directory exists, it returns `{ agents: [], skills: [identifier], workflows: [], rules: [] }`.
- *Observation*: The resolver only checks directory existence on disk (`fs.pathExists(skillPath)`). It does not check if `SKILL.md` exists within that directory.

### 2.2 Installation & Deployment (`src/core/installer.ts`)
- **File Copying/Symlinking**: `AgentInstaller.install()` copies or symlinks the entire skill directory `registry/skills/<skillName>` to the destination directory (e.g. `.agents/skills/<skillName>`).
- **Lockfile Hash Recording**:
  ```typescript
  const skillFile = path.join(src, 'SKILL.md');
  if (await fs.pathExists(skillFile)) {
    const hash = await this.calculateHash(skillFile);
    const relPath = path.relative(targetDir, path.join(subPaths.skillsDir, skillName, 'SKILL.md'));
    lockfile.files[relPath] = { hash, bundle: resolved.targetBundle, method: actualMethod, installedAt: now };
  }
  ```
- *Observation*: If `SKILL.md` is missing, `installer.ts` still installs the empty folder and records `skillName` in `lockfile.installed.skills`, but bypasses hash generation in `lockfile.files`.

### 2.3 Verification & Doctor Engine (`src/core/doctor.ts`)
- **Current Health Checks**: `DoctorEngine.runDoctor()` reads `lockfile.json` and records `skillsCount = manifest.installed.skills.length`.
- **Validation Deficit**: While `doctor.ts` actively parses YAML frontmatter for agents (checking `name`, `description`, `model`), **it does not inspect skill frontmatter or check for missing `SKILL.md` files**.

---

## 3. Comprehensive Catalog of All 48 Skills

Below is the complete audit of all 48 skills in `registry/skills/`, organized across the 6 domain bundles defined in `registry/bundles.json`.

### Legend
- **Status**: `MISSING` (Directory empty, no `SKILL.md`), `BOILERPLATE` (10-14 lines stub), `PRODUCTION` (>=50 lines, full specification).
- **Frontmatter**: `NONE` (No frontmatter), `BASIC` (`name`, `description` only), `VALID` (`name`, `description`, `metadata: { author, version }`).

---

### Table 1: Software Engineering Domain (8 Skills)

| # | Skill Identifier | Bundles | File Status | Lines | Frontmatter | Code Exemplars | Execution Triggers |
|---|------------------|---------|-------------|-------|-------------|----------------|--------------------|
| 1 | `test-driven-development` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 2 | `systematic-debugging` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 3 | `receiving-code-review` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 4 | `requesting-code-review` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 5 | `subagent-driven-development` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 6 | `finishing-a-development-branch` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 7 | `dependency-management` | software-engineering, full | MISSING | 0 | NONE | No | No |
| 8 | `performance-optimization` | software-engineering, full | MISSING | 0 | NONE | No | No |

---

### Table 2: System Architecture Domain (4 Skills)

| # | Skill Identifier | Bundles | File Status | Lines | Frontmatter | Code Exemplars | Execution Triggers |
|---|------------------|---------|-------------|-------|-------------|----------------|--------------------|
| 9 | `architecture-design` | system-architecture, full | BOILERPLATE | 14 | BASIC | No | No |
| 10 | `writing-plans` | system-architecture, business-strategy, full | BOILERPLATE | 14 | BASIC | No | No |
| 11 | `executing-plans` | system-architecture, full | BOILERPLATE | 14 | BASIC | No | No |
| 12 | `confidence-check` | system-architecture, security-operations, business-strategy, full | BOILERPLATE | 14 | BASIC | No | No |

---

### Table 3: Product Design Domain (8 Skills)

| # | Skill Identifier | Bundles | File Status | Lines | Frontmatter | Code Exemplars | Execution Triggers |
|---|------------------|---------|-------------|-------|-------------|----------------|--------------------|
| 13 | `ui-design` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 14 | `ux-strategy` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 15 | `interaction-design` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 16 | `design-systems` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 17 | `design-research` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 18 | `design-ops` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 19 | `designer-toolkit` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |
| 20 | `prototyping-testing` | product-design, full | BOILERPLATE | 14 | BASIC | No | No |

---

### Table 4: Growth Marketing Domain (24 Skills)

| # | Skill Identifier | Bundles | File Status | Lines | Frontmatter | Code Exemplars | Execution Triggers |
|---|------------------|---------|-------------|-------|-------------|----------------|--------------------|
| 21 | `campaign-strategy` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 22 | `copywriting` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 23 | `copy-editing` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 24 | `marketing-ideas` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 25 | `marketing-psychology` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 26 | `launch-strategy` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 27 | `pricing-strategy` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 28 | `page-cro` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 29 | `onboarding-cro` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 30 | `signup-flow-cro` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 31 | `popup-cro` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 32 | `paywall-upgrade-cro` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 33 | `form-cro` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 34 | `ab-test-setup` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 35 | `analytics-tracking` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 36 | `paid-ads` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 37 | `programmatic-seo` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 38 | `seo-audit` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 39 | `schema-markup` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 40 | `email-sequence` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 41 | `social-content` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 42 | `referral-program` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 43 | `competitor-alternatives` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |
| 44 | `free-tool-strategy` | growth-marketing, full | BOILERPLATE | 14 | BASIC | No | No |

---

### Table 5: Security Operations Domain (1 Skill)

| # | Skill Identifier | Bundles | File Status | Lines | Frontmatter | Code Exemplars | Execution Triggers |
|---|------------------|---------|-------------|-------|-------------|----------------|--------------------|
| 45 | `security-review` | security-operations, full | BOILERPLATE | 14 | BASIC | No | No |

---

### Table 6: Deep Research Domain (3 Skills)

| # | Skill Identifier | Bundles | File Status | Lines | Frontmatter | Code Exemplars | Execution Triggers |
|---|------------------|---------|-------------|-------|-------------|----------------|--------------------|
| 46 | `deep-research` | deep-research, full | BOILERPLATE | 14 | BASIC | No | No |
| 47 | `brainstorming` | deep-research, full | BOILERPLATE | 14 | BASIC | No | No |
| 48 | `browser-agent` | deep-research, full | BOILERPLATE | 14 | BASIC | No | No |

---

## 4. Gap Analysis & R2 Requirements Compliance

### 4.1 Requirement R2 Standard
Requirement R2 in `ORIGINAL_REQUEST.md` specifies that every skill must contain:
1. **YAML Progressive Disclosure Frontmatter**:
   ```yaml
   ---
   name: <skill-identifier>
   description: <Comprehensive 1-2 sentence description>
   metadata:
     author: "Agents United"
     version: "1.0.0"
   ---
   ```
2. **Comprehensive Execution Runbooks**: Minimum 50 lines of clear, production-grade instructions.
3. **Structured Operational Sections**:
   - **Execution Triggers**: Explicit criteria for when an agent should load and execute the skill.
   - **Input / Output Requirements**: Required parameters, pre-conditions, and expected artifacts.
   - **Edge-Case Handling & Boundary Rules**: Strategies for handling unexpected conditions, missing resources, or rate limits.
   - **Error-Recovery Procedures**: Step-by-step resolution when execution fails or tests break.
   - **Code & Configuration Exemplars**: Verbatim code snippets, JSON/YAML configs, or template patterns.

### 4.2 Current Deficit Summary

| Evaluation Criteria | Target Requirement | Current State Across 48 Skills | Deficit Rate |
|---------------------|--------------------|--------------------------------|--------------|
| `SKILL.md` File Presence | 48 / 48 files | 40 present / 8 missing | **16.7% missing** |
| Frontmatter `metadata` Schema | `{ author, version }` present | 0 / 48 present | **100% missing** |
| Runbook Line Count | >= 50 lines per skill | Avg 11.7 lines (0–14 lines) | **100% deficient** |
| Execution Triggers | Defined | 0 / 48 present | **100% missing** |
| Input/Output Requirements | Defined | 0 / 48 present | **100% missing** |
| Edge-Case & Error Recovery | Defined | 0 / 48 present | **100% missing** |
| Code / Config Exemplars | Verbatim examples | 0 / 48 present | **100% missing** |

---

## 5. Specification Blueprint for Production Skill Playbooks

To upgrade all 48 skills to production-grade compliance, every `SKILL.md` must follow the standardized specification template below.

### 5.1 Standardized Production `SKILL.md` Template

```markdown
---
name: <skill-name>
description: <Comprehensive description detailing capability, domain, and usage.>
metadata:
  author: "Agents United"
  version: "1.0.0"
---

# <Skill Title>

## 1. Overview & Operational Intent
[Detailed summary of the skill's purpose, architectural context, and role within its bundle.]

## 2. Execution Triggers & Activation Rules
- **Explicit Call**: Invoked when an agent or workflow directly delegates `<skill-name>`.
- **Implicit Conditions**: Triggered when [specific conditions/keywords appear in context].
- **Pre-conditions**: [Dependencies or prior step outputs required before activation].

## 3. Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `targetPath` | string | Yes | Target directory or file path |
| `options` | object | No | Configuration flags |

### Outputs & Artifacts
| Artifact | Type | Description |
|----------|------|-------------|
| `report.md` | Markdown | Comprehensive analysis or status report |
| `status` | string | Execution status (`success` \| `failure`) |

## 4. Step-by-Step Execution Runbook
1. **Phase 1: Initialization & Context Gathering**
   - Step 1.1: Verify required files and inputs.
   - Step 1.2: Check workspace pre-requisites.
2. **Phase 2: Core Execution Protocol**
   - Step 2.1: Execute main domain logic.
   - Step 2.2: Apply quality gates and checks.
3. **Phase 3: Validation & Artifact Output**
   - Step 3.1: Run verification commands.
   - Step 3.2: Write output summary.

## 5. Edge-Case Handling & Boundary Rules
- **Scenario A**: [Description of edge case]
  - *Resolution*: [Step-by-step mitigation]
- **Scenario B**: [Description of edge case]
  - *Resolution*: [Step-by-step mitigation]

## 6. Error Recovery & Fallback Procedures
- **Failure Mode 1**: [Description]
  - *Recovery Protocol*: [Step-by-step recovery]
- **Failure Mode 2**: [Description]
  - *Recovery Protocol*: [Step-by-step recovery]

## 7. Code & Configuration Exemplars
```ts
// Verbatim production snippet or configuration exemplar
export function exampleProcedure(): void {
  // Implementation pattern
}
```
```

---

## 6. Actionable Implementation Roadmap

To achieve 100% compliance with Requirement R2, the implementation team should execute the following 3-step remediation plan:

### Step 1: Create the 8 Missing `SKILL.md` Files
Create `SKILL.md` files for:
1. `registry/skills/test-driven-development/SKILL.md`
2. `registry/skills/systematic-debugging/SKILL.md`
3. `registry/skills/receiving-code-review/SKILL.md`
4. `registry/skills/requesting-code-review/SKILL.md`
5. `registry/skills/subagent-driven-development/SKILL.md`
6. `registry/skills/finishing-a-development-branch/SKILL.md`
7. `registry/skills/dependency-management/SKILL.md`
8. `registry/skills/performance-optimization/SKILL.md`

### Step 2: Expand All 48 `SKILL.md` Playbooks
Upgrade frontmatter and write comprehensive >=50 line runbooks for all 48 skills using the standardized template in Section 5.1.

### Step 3: Enhance Workspace Doctor (`src/core/doctor.ts`)
Add frontmatter validation logic to `DoctorEngine.runDoctor()` for skill files:
- Validate that `SKILL.md` exists in each installed skill directory.
- Parse YAML frontmatter and report warnings/issues if `name`, `description`, or `metadata: { author, version }` is missing or malformed.
