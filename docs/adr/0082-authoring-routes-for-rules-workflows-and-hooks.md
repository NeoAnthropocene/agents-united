# ADR 0082: Authoring routes for rules, workflows and hooks

- **Status**: Proposed, 2026-11-26. Decisions 1 to 4 were made by the maintainer on 2026-11-26 after the read-only prep of [Plan 052](../../plans/052-factory-maintainer-workbench.md) step 5. Decisions 5 to 10 are proposed defaults from that prep, recorded here so the maintainer can revise them.
- **Context**:
  - The `agent-factory` bundle authors Skills (`author-skill`), shared pairs, Claude agent drafts and Bundle proposals, but has no route for rules, workflows or hooks ([ADR 0080](0080-factory-maintainer-workbench.md) context; Plan 052 "Where the factory stands").
  - No CLI command checks a rule, a workflow or a standalone hook. The four read-only checks are `skill-check`, `contract-check`, `factory-check` and `bundle-check` (`src/cli.ts`), and `bundle-check` only checks that a referenced rule or workflow exists.
  - Partial checks exist outside the CLI:
    - The Claude projector's 200-line rule budget (`maxRuleLines`, ADR 0018 decision 5). It throws in `ClaudeProjector.renderRule`, but the install loop silently skips an oversize rule that is not bound to a Skill.
    - `lintWorkflow`, kept in `tests/helpers/workflow-lint.ts` only.
  - The native guard set is a closed union, `NativeGuardKind` in `src/core/guard.ts`, with install, refcount, uninstall and doctor support tied to it.
  - The evaluator (`evaluate-artifact`) accepts only the subject kinds `skill`, `shared-pair` and `claude-agent` (`scripts/review-job.mjs`).
  - The native Skill binding (`src/core/claude-skill-binding.ts`) is fixed to `author-skill`.

## Decision

**Maintainer decisions, 2026-11-26:**

1. **Three Skills, not one.**
   - The routes are `author-rule`, `author-workflow` and `author-hook`, each in the shape of `author-skill`: SKILL.md within the factory entry budget, references, a deterministic draft script, evals and a native Claude binding.
   - The three products differ (Markdown text, a Skill plus a host script, executable code with a registration), and so do their checks and their risk. One Skill would not fit the entry budget without moving most of its runbook into references.
2. **Order: rule, then workflow, then hook.** Each route ships and is shown live before the next starts.
3. **Each route has a read-only CLI checker in `src/` and an evaluator subject kind.**
   - The checkers are `rule-check`, `workflow-check` and `hook-check`. Like `skill-check`, they print JSON and exit 0 when passed, 1 when failed, and 2 when unavailable or misused. The one exception is `--help` (or `-h`), which prints the usage text and exits 0. This JSON guarantee covers the documented command-first form, `agents <command> ...`; an option-first form such as `agents --artifact /p rule-check ...` keeps the CLI library's own behaviour.
   - The evaluator gains the subject kinds `rule`, `workflow` and `hook`, each with host-fit wording of its own.
   - The repo doctor (Plan 052 step 1) and contributors can then run the same checks outside the test suite.
4. **The hook route delivers a reviewed draft only.**
   - Adding a hook to the shipped guard set stays a hand change through a normal reviewed PR.
   - An open, generically supported hook kind would need its own ADR.

**Proposed defaults (the maintainer may revise):**

5. **Workflow scope.** `author-workflow` writes the portable Skill (`registry/skills/workflow-<name>/`, ADR 0016). It may also write a native Claude workflow script (`registry/hosts/claude/workflows/<name>.js`) that passes `workflow-check`. Cline `.md` workflows wait for the Cline factory stage.
6. **The rule route writes into the contributor's branch.**
   - `author-rule` writes `registry/rules/<name>.md` and the rule's entry in the chosen bundle's `rules[]` in the contributor's branch. It does not return a proposal for manual import.
   - There is no native `registry/hosts/claude/rules/` folder. The Claude projector renders `.claude/rules/<name>.md` from the canonical rule, and Cline gets a copy with the managed marker in `.cline/rules/`.
   - Antigravity is different. The installer copies or links the canonical file as it is into the store's `rules/` folder (`.agents/rules/`). The Antigravity guide says a modular rule there without frontmatter and a valid `trigger` is silently dropped, and a rule over 24,000 bytes is truncated (`host-library/antigravity/guide/rule.md`). A canonical rule without frontmatter therefore does not reach Antigravity unless a native rule under `registry/hosts/antigravity/rules/` replaces it. An Antigravity rule check (trigger frontmatter, the byte limit) belongs to the Antigravity factory stage, not to this route.
7. **One generalized Skill binding.** `claude-skill-binding.ts` and the installer's `author-skill` special cases are generalized once, so each new factory Skill adds a binding file, not a new module.
8. **Oversize rules fail at authoring time.**
   - `rule-check` fails a rule over the Claude budget.
   - An installer warning for the rule the Claude projector skips is proposed but out of scope for these slices; it needs its own slice in the installer and doctor, with the maintainer's word. Changing the skip into a refusal is not part of this ADR either.
9. **A small host guide page.** `host-library/claude/guide/rule.md` is added before `author-rule`. Rules are the only artifact kind without a Claude guide page, and `realize-for-host` works from the guides.
10. **Path scoping is out of the first rule route.**
    - `renderRule` accepts `paths`, but no caller passes them, so a canonical rule is always unscoped.
    - A canonical rule therefore carries no front matter, and `rule-check` refuses one that does. Without that check, the Claude projector would put the author's front matter after its own marker.
    - This is the Claude and Cline shape. Antigravity needs the opposite (frontmatter with a `trigger`, decision 6); that conflict is left to the Antigravity stage.

## What `rule-check` checks (first slice)

One canonical rule file, given by absolute path. Nothing in it is executed. Its scope is the Claude and Cline delivery of a canonical rule; it says nothing about Antigravity (decision 6). The checks:

- The file name is a lower-case kebab-case `.md` name, portable on Windows: no reserved device name (CON, PRN, AUX, NUL, COM1 to COM9, LPT1 to LPT9, any case, with or without an extension). It is not a host entry-point file (`CLAUDE.md`, `CLAUDE.local.md`, `GEMINI.md`, `AGENTS.md`, `CURSOR.md`, compared without regard to case), which the projectors skip.
- The file is readable UTF-8 text within a size limit.
- It is within the Claude rule budget, counted the way the projector counts.
- There is no front matter (decision 10).
- There is a level-1 title and a non-empty body.
- There is no Agents United managed marker, which the projector writes itself.
- The Claude rendering keeps the rule's content. The Claude projector's residue safety net drops any section whose heading names another host's routing (for example a heading containing "Host Routing") and rewrites a few phrases, and its section overrides replace some headed sections. A rule that would lose or change text that way fails, with the heading or phrase named, and the rendered body must keep the title and a non-empty body.

Passing means only these deterministic checks passed. The JSON keeps `quality: pending` and `live: unverified`, as `skill-check` does.

## What `workflow-check` checks

A portable workflow is a Skill, `registry/skills/workflow-<name>/` (ADR 0016), so `skill-check` covers it. `workflow-check` covers the other half of decision 5: one native Claude workflow script, `registry/hosts/claude/workflows/<name>.js`, given by absolute path. The script is never executed. Its `meta` is read as data by a strict literal parser (strings, numbers, booleans, `null`, arrays and objects with plain keys, comments and trailing commas; a getter, method, call, spread, computed or `__proto__` key, identifier value or template interpolation is a parse failure, and the values have no prototype, so nothing is coerced). The body is only compiled as an async function body, which parses it and runs nothing. Cline `.md` workflows are out of scope. The checks, in the order they run:

- **Name.** The file name is a lower-case kebab-case `.js` name, and not a name Windows reserves for a device. The native package lists only such names, so any other file is never installed.
- **Placement.** The file sits at `registry/hosts/claude/workflows/<name>.js`; the registry is the folder four levels up and must be named exactly `registry` (another name, or the same name in another case, is refused). The projector looks nowhere else. This check and the name check are pure: they read the spelling of the path and touch no file. When either fails, no file is read and the later checks are not run.
- **Where the read goes.** Before the file is opened, the real path of the folder that holds the registry is taken, and each folder from the registry down to the file must be listed in its parent spelled exactly as written (on Windows an alias in another case is refused) and must not be a link or junction. The real path of the file must equal the expected one. After the open, the file's device and inode must equal those of the file inspected, so a file swapped in between is refused. A path that fails any of this is unavailable (exit 2): no file in the tree was shown to be the one named.
- **Size and encoding.** The file is readable UTF-8 text within a size limit, with no byte order mark and no NUL byte.
- **Lint.** The script passes the workflow lint the repository already applies to its own workflows: `export const meta` first and a pure literal with a string `name` and `description` and, when `phases` is present, an array of objects that each have a string `title`; phase titles that match `meta.phases`; no module loading; none of the calls that break resume. A malformed `meta` is a lint finding (exit 1), never an error.
- **Name match.** `meta.name` equals the file name without `.js`. Claude Code runs a saved workflow as `/<name>`.
- **Skill pair.** `<registry>/skills/<name>/SKILL.md` exists, so `foo.js` needs a Skill named `foo`; a portable Skill `workflow-foo` pairs with `workflow-foo.js`. The projector installs a native workflow only in place of a Skill of the same name, so a workflow without one is never installed. The same holds when the Claude host profile lists that Skill as unsupported, because the projector skips it. The profile is read like the workflow: a regular file, no link, at most 256 KiB, validated by the profile validator; one that is oversize, a link, not a regular file or not valid makes the result unavailable (exit 2). A registry with no profile lists no unsupported Skill.
- **Agent types.** The `agentType` requests are found by a lexical scan (a tokenizer that skips comments, strings, template text and regular expressions, and reads the key bare, quoted or as a computed string). A request whose value is one string literal must name a native Claude agent: a regular `.md` file (not a folder, not a link) in `<registry>/hosts/claude/agents/`. A missing one fails as `AGENT_TYPE`. Literal agent types are verified against the native roles; run-time ones are listed, not verified. Any other value (a variable, a call, a template with `${`, a concatenation, a shorthand) is not a finding: the checker cannot resolve it statically, so the result lists it in `unresolvedAgentTypes` as an entry `{ code: 'AGENT_TYPE_UNRESOLVED', line, excerpt }` (the line number and the trimmed source line, cut to 120 characters and ending in `...` when cut) and the check passes on it. `unresolvedAgentTypes` is on every result, empty when there are none or when the check did not run; `AGENT_TYPE_UNRESOLVED` is the name of the entry and never appears in `findings`. The check does not say that every `agentType` is valid: a listed site is not verified, a type passed through a spread is not seen, and whether the role is installed with a given Bundle (the projector installs roles from the resolved Bundle, with Bundle-specific native names) is out of reach. The JSON `notes` field states these limits on every result. The committed `workflow-implement` and `workflow-test` choose a specialist at run time, so they pass and list their sites; `workflow-review` writes its types as literals and lists none.
  - Possible later rule, not adopted now (for the maintainer to decide): `author-workflow` could require a declared roster comment in the script, such as `// agent-types: backend-architect, frontend-architect`, which the checker would verify against the native roles. It is not adopted because it would change the bytes of two shipped native workflows (moving the native tests and the hashes installed in users' workspaces) and would still be declared, not proven.
- **Rendering.** The installed form keeps the script's text. The installed form is the native package's own rendering: line endings normalised to LF, trailing newlines collapsed to one, and the managed marker appended as the last line. The script carries no managed marker itself, and the rendered script still passes the lint.

The checks that need the content (size, encoding, lint, name match, Skill pair, agent types, rendering) run only when the name and placement checks pass and the read is confirmed; the Skill pair, agent types and rendering checks also need the registry that placement found.

**Parity with the projector.** `workflow-check` is stricter than the projector, not equal to it. A workflow that passes is one the projector would emit intact. The projector also emits some files the checker refuses (a symlinked source, a source that fails the size, byte order mark, lint, name-match, agent-type or existing-marker gates, a Windows-reserved stem on Linux), and the checker does not establish installability: whether a Bundle lists the paired Skill and the agent roles, and an unmanaged file at the destination that needs `--force`, are outside what a source file can show.

Passing means only these deterministic checks passed: `quality: pending` and `live: unverified`, as for `rule-check`.

## Consequences

- Positive:
  - Each artifact kind gets a route sized to its risk.
  - The checkers can be used without the factory, by the repo doctor and in CI.
  - The silent rule skip becomes visible.
- Cost:
  - Three Skills and bindings to maintain.
  - New evaluator kinds touch the evaluator's job and result schemas and its checking scripts.
  - Generalizing the binding touches installer code that `author-skill` relies on, so that slice needs the full gate.
- Hooks stay the riskiest kind: they run code, may fail open, and headless runs skip agent-frontmatter hooks (ADR 0042). A draft-only route keeps the shipped guard set under hand review.
- Not decided here:
  - the Workspace Source Registry (ADR 0046; its design is reviewed separately);
  - the other hosts' factory stages;
  - any change to how the installer treats an oversize rule (decision 8);
  - an Antigravity rule check (decision 6).

## Slices

1. This ADR.
2. `rule-check` (`src/core/rule-check.ts`, `src/cli.ts`), tests first.
3. The generalized binding.
4. `host-library/claude/guide/rule.md` and `author-rule`, with the evaluator kind `rule`.
5. `workflow-check` (moving `lintWorkflow` into `src/core/`), then `author-workflow` with the evaluator kind `workflow`.
6. `hook-check` and `author-hook` (draft only), with the evaluator kind `hook`.
7. Records: the completion matrix, `CONTEXT.md` terms, and a host-library observation of one live run per route.

Each slice gets its own tests, one independent review, and a push only at the maintainer's word.
