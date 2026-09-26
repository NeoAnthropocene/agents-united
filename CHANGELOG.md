# [0.13.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.12.0...v0.13.0) (2026-09-26)


### Bug Fixes

* **agents:** make the Tier-1 planning consult an unconditional gate (Finding F1) ([0776d16](https://github.com/NeoAnthropocene/agents-united/commit/0776d1669a13cd0417e24ae2c7004f895aadc804))
* **build:** make the type gate self-sufficient — build before type-checking the test tree ([dbbfc2d](https://github.com/NeoAnthropocene/agents-united/commit/dbbfc2d7045bc29c2ec1efe9cbba46716a70c1b4)), closes [#45](https://github.com/NeoAnthropocene/agents-united/issues/45) [tests/cli-e2e.test.ts#L10](https://github.com/tests/cli-e2e.test.ts/issues/L10)
* canonicalize golden comparisons to LF (CI EOL stability) ([895c4f0](https://github.com/NeoAnthropocene/agents-united/commit/895c4f05edb49f28684f4ffb1deabe21257b9a93))
* **claude:** give a coordinator the whole domain roster as its delegation allowlist\n\nThe allowlist was this bundle's declared agents, so an essentials install let the\ndomain lead call only 4 of the engineering domain's 15 specialists -- and it only\ngrew when the operator installed more and happened to re-project. bundles.json\nalready groups every bundle under a domain, so the roster is now the union of that\ndomain's agents minus the coordinator: stable across install state and complete for\nthe team it represents. digital-agency is unchanged (its domain roster IS its\ndeclared 9).\n\nThe delegation section now teaches the consequence honestly: a listed type whose\ndefinition is not installed yet fails to spawn, so recommend installing it and fall\nback to doing that slice yourself. The plugin mirror computes the same roster and\nasserts byte-identity to .claude/agents/. ([3dda30e](https://github.com/NeoAnthropocene/agents-united/commit/3dda30ef50623e180191e9bc62515536ca290e4e))
* **claude:** give unbundled coordinators the coordinator posture and Claude-native delegation text ([ba2843a](https://github.com/NeoAnthropocene/agents-united/commit/ba2843aca31b2bcc741c54d8695c34d221c06d91))
* **claude:** persist the plugin-lane opt-in and harden the launch references ([800d874](https://github.com/NeoAnthropocene/agents-united/commit/800d87432d584f96bff3797d454f0445b78eb84d))
* **claude:** render the unbundled fallback through the dialect and drop the bare Agent ([a260861](https://github.com/NeoAnthropocene/agents-united/commit/a2608619671213c7e17d9f90ace8fabbcfcfcefd))
* **claude:** rewrite send_message in prompt prose as well as frontmatter ([d2e2148](https://github.com/NeoAnthropocene/agents-united/commit/d2e2148d271000f371c1a328d68fbf41a5111eb2))
* **claude:** run the managed guard hook in exec form (Plan 023 A0) ([13f8988](https://github.com/NeoAnthropocene/agents-united/commit/13f89886d6084110f28b629bfbb81dd0b420fa63))
* **claude:** stop emitting an empty frontmatter block on unscoped rules ([58137bd](https://github.com/NeoAnthropocene/agents-united/commit/58137bd554804ed35725a17c90bc3d5127a8cfe8))
* **cline:** name the projected agent path in the coordinator roster ([eddaf0c](https://github.com/NeoAnthropocene/agents-united/commit/eddaf0c82039b47050c6a4de58206957e7975ab1))
* **cli:** report the subagent hand-back capability in the doctor block too ([6a0c980](https://github.com/NeoAnthropocene/agents-united/commit/6a0c980ecc560fcf9c12a037fb66e58f359313ed))
* **cli:** share one renderer for the Claude capability block ([aeefa37](https://github.com/NeoAnthropocene/agents-united/commit/aeefa378d3cc11e01a5a74bb40569870b4af68d8))
* Gate-7 remediations - bundle skill-reference completeness + skill reload guidance ([3701d7a](https://github.com/NeoAnthropocene/agents-united/commit/3701d7a75e62c49f4ed74e041a1b5526416b0a88))
* **lifecycle:** make every installed asset removable and refcounted ([fe42c80](https://github.com/NeoAnthropocene/agents-united/commit/fe42c802cdb31e73ffb1d39db9f992726848d53c))
* **lifecycle:** make projection sharing order-independent and report removal honestly ([015c13a](https://github.com/NeoAnthropocene/agents-united/commit/015c13ac23d07bb2bac2f09a2cea26ba38c4352f))
* **lifecycle:** say WHAT a removal deleted, and stop lying about file counts ([02758ed](https://github.com/NeoAnthropocene/agents-united/commit/02758ede637ef1b4e4648bb472885f063b92b17a))
* **lifecycle:** share projection ownership with the canonical's owners ([7351288](https://github.com/NeoAnthropocene/agents-united/commit/73512882d2c9a8255b4f8196be2f1d295d55205a))
* **lifecycle:** the Universal Coverage Rule ? a subset removal under a superset deletes nothing ([f00f45b](https://github.com/NeoAnthropocene/agents-united/commit/f00f45b21980b4d88d04585ad35bb4f460948fca))
* skill sidecar integrity (ADR 0017 amendment) ([f7d2a24](https://github.com/NeoAnthropocene/agents-united/commit/f7d2a24767864737b47500ce3a107be10d442c61))


### Features

* **agents:** grant send_message to the four engineering specialists ([c558f0d](https://github.com/NeoAnthropocene/agents-united/commit/c558f0de75aff45e21b8d51e82df763401adaaed))
* **agents:** grant send_message to the organization-tier specialists ([f2c5c1e](https://github.com/NeoAnthropocene/agents-united/commit/f2c5c1eda1fd94a8ca4b5ccdf25b128c88fed48d))
* **agents:** land the Plan 022 C1–C7 subagent comms law ([1bb4899](https://github.com/NeoAnthropocene/agents-united/commit/1bb48997cd74f3c7b9a99732ace507a681a6d689))
* **bundles:** label every Tier-1 bundle with an explicit domain tier ([cf55295](https://github.com/NeoAnthropocene/agents-united/commit/cf55295839e9b059704a089f1b2d5c530f78470d))
* **claude:** add the Claude compound projector with translation ledger, body rewriting and catalog conformance guards ([96ebdd4](https://github.com/NeoAnthropocene/agents-united/commit/96ebdd4304cebb82d663718fc1e31716695415a1))
* **claude:** add the claude launcher and wire agents start --host claude ([71a0de5](https://github.com/NeoAnthropocene/agents-united/commit/71a0de5c0b41b2e6fe37648eac057ff550e238e9))
* **claude:** add the opt-in claude plugin lane ([3e21e06](https://github.com/NeoAnthropocene/agents-united/commit/3e21e0643fbf7c36ee48a8f8fe2aa2e11a9aff37))
* **claude:** Claude Code projection lane (Plan 016) — Tier 1/2 posture, role model defaults, and the Universal Coverage Rule ([#45](https://github.com/NeoAnthropocene/agents-united/issues/45)) ([c12e616](https://github.com/NeoAnthropocene/agents-united/commit/c12e616a0652639df5fa0c1bebdfaa1a34614a88))
* **claude:** default the Agent Teams scaffold to organization-tier bundles ([93757bb](https://github.com/NeoAnthropocene/agents-united/commit/93757bb4f451870fe4aefe7114ee6bfac7956271))
* **claude:** Plan 022 H1–H7 hardening — least privilege, real guard hook, Tier-2-only caps ([97f6d29](https://github.com/NeoAnthropocene/agents-united/commit/97f6d292bd23eb5779e98cab4c9de17d3cffab6c))
* **claude:** report the tier posture on the Cline and Antigravity lanes ([effa9ee](https://github.com/NeoAnthropocene/agents-united/commit/effa9eec1e7b70c9f667fd9ecf0ee8e13427a6e6))
* **claude:** role model/effort posture, the hand-back tool, and a corrected ledger ([f26a6fa](https://github.com/NeoAnthropocene/agents-united/commit/f26a6fa07caf2e97836bcebeb3771aced3f897b7))
* **claude:** wire the claude compound projection lane into the installer ([710cbc8](https://github.com/NeoAnthropocene/agents-united/commit/710cbc8502f7a2677f4154f8d4e7b59685358162))
* **cli:** refuse under-development hosts in --fanout ([8f0a06f](https://github.com/NeoAnthropocene/agents-united/commit/8f0a06fa3fbbf5132ad8bcdd906f45d635b29889))
* **doctor:** dispatch projection variants by host and report claude capabilities ([ec30fdd](https://github.com/NeoAnthropocene/agents-united/commit/ec30fdd8a9a75c2cf43d37abc86ffe2fac48e28b))
* **planning consultation:** G4 - Tier-1 Planning Consultation Phase + Tier-2 layman wording (Plan 019 Step 3) ([942301f](https://github.com/NeoAnthropocene/agents-united/commit/942301fa2b51972a516a3a1c9a36716a28242191))
* **render contract:** un-skip Plan 017 Step-5 render lane + Plan 019 Step 4 host-keyed residue lint ([145e5f2](https://github.com/NeoAnthropocene/agents-united/commit/145e5f2229311df57567018cf8bc4f861a1089a2))
* Semantic Core + Claude Creation Engine (Plan 021 / ADR 0021 strangler step 1) ([84a57c5](https://github.com/NeoAnthropocene/agents-united/commit/84a57c5e353d72b0243df9d59a91e02541df42b7))
* **tui:** tag under-development hosts and list Kimi / Moonshot as planned ([01dc19f](https://github.com/NeoAnthropocene/agents-united/commit/01dc19f76439142c572c5bd8593964ada4f764a0))

# [0.12.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.11.0...v0.12.0) (2026-09-18)


### Features

* migrate workflows to Agent Skills and enforce workflow runtime (ADR 0016, ADR 0017) ([#43](https://github.com/NeoAnthropocene/agents-united/issues/43)) ([ab361da](https://github.com/NeoAnthropocene/agents-united/commit/ab361daa8e17bd1b269945fea1344a7e8672b74a))

# [0.11.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.10.0...v0.11.0) (2026-09-12)


### Features

* **registry:** modernize all 50 subagents and 9 orchestrators with self-contained skills and autonomous delegation gates ([#42](https://github.com/NeoAnthropocene/agents-united/issues/42)) ([a611b63](https://github.com/NeoAnthropocene/agents-united/commit/a611b631a592cb8fb0bec5756050222b0d674394))

# [0.10.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.9.1...v0.10.0) (2026-09-10)


### Features

* (digital-agency) platform modernization, 4-tier execution DAG, and Antigravity-to-Cline projection  ([#41](https://github.com/NeoAnthropocene/agents-united/issues/41)) ([776e14a](https://github.com/NeoAnthropocene/agents-united/commit/776e14a1b68c01207c0670db3443ea77ba7a2b7c))

## [0.9.1](https://github.com/NeoAnthropocene/agents-united/compare/v0.9.0...v0.9.1) (2026-09-10)


### Bug Fixes

* rename digital-agency orchestrator to orchestrator-digital-agency and update docs ([8756bf4](https://github.com/NeoAnthropocene/agents-united/commit/8756bf46df9467fadb8bc1b56b1562a223becdbb))
* renaming the digital-agency orchestrator  ([#40](https://github.com/NeoAnthropocene/agents-united/issues/40)) ([a928618](https://github.com/NeoAnthropocene/agents-united/commit/a9286182e6fe91f0e8d413fba90f85e4338a67f6))

# [0.9.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.8.0...v0.9.0) (2026-09-09)


### Features

* add comprehensive GitHub issue forms and PR templates ([#39](https://github.com/NeoAnthropocene/agents-united/issues/39)) ([7b3cbb8](https://github.com/NeoAnthropocene/agents-united/commit/7b3cbb8203259a706b5439b7d17d493468df3f6b))
* add comprehensive GitHub issue forms and PR templates for contributors ([ee34311](https://github.com/NeoAnthropocene/agents-united/commit/ee34311813196096608949e9e3ee3ea93e8f3086))

# [0.8.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.7.4...v0.8.0) (2026-09-09)


### Bug Fixes

* **ci:** add direct fast-forward push and workflow_dispatch to sync workflow ([#28](https://github.com/NeoAnthropocene/agents-united/issues/28)) ([8e39deb](https://github.com/NeoAnthropocene/agents-united/commit/8e39deb6685c271a8d1626deb32c6dbb52f2bddc))
* **ci:** direct merge and push in sync workflow to eliminate bot PR approval failures ([#31](https://github.com/NeoAnthropocene/agents-united/issues/31)) ([3414363](https://github.com/NeoAnthropocene/agents-united/commit/3414363ce1fb7ac0c44d1b0b6fb81fa7ac8d6517))
* **ci:** prefer immediate merge for sync PRs and update workflow guide ([#25](https://github.com/NeoAnthropocene/agents-united/issues/25)) ([a56df1e](https://github.com/NeoAnthropocene/agents-united/commit/a56df1e1357ce06ea0fe065683e21450587c92e6))
* **ci:** wire SYNC_TOKEN with fallback in sync-main-to-dev workflow ([#34](https://github.com/NeoAnthropocene/agents-united/issues/34)) ([cfc1512](https://github.com/NeoAnthropocene/agents-united/commit/cfc1512c4c9fe705a8bad0dd3b5f1f24fc6aab42))
* Planner-Orchestrator Mode for Tier-1 Domain Bundles (Plan 013 / ADR 0015) ([#22](https://github.com/NeoAnthropocene/agents-united/issues/22)) ([2d6c7ac](https://github.com/NeoAnthropocene/agents-united/commit/2d6c7aced7edb337a18848c07ff9976107819b21))
* prevent tui box overflow on add/init and enhance update inventory reporting ([#36](https://github.com/NeoAnthropocene/agents-united/issues/36)) ([4b29f3b](https://github.com/NeoAnthropocene/agents-united/commit/4b29f3bce0b2069e8e8bbae4fecf7b8c0531bb3c))


### Features

* **release:** configure releaseRules in .releaserc.json to treat Release: as minor releases ([#19](https://github.com/NeoAnthropocene/agents-united/issues/19)) ([c818c69](https://github.com/NeoAnthropocene/agents-united/commit/c818c696507d83491f32051a39bd7cb621194c2b))
* Subagent-First Planning Dialogue Loop for digital-agency (Plan 012 / ADR 0014) ([#12](https://github.com/NeoAnthropocene/agents-united/issues/12)) ([9daf529](https://github.com/NeoAnthropocene/agents-united/commit/9daf5290224c22a9cb09f1b9cdf8d0f827193229))

## [0.7.4](https://github.com/NeoAnthropocene/agents-united/compare/v0.7.3...v0.7.4) (2026-09-09)


### Bug Fixes

* prevent tui box overflow on add/init and enhance update inventory reporting ([#37](https://github.com/NeoAnthropocene/agents-united/issues/37)) ([c8b50a5](https://github.com/NeoAnthropocene/agents-united/commit/c8b50a5d33297a9d83dc34d69d6bceea5af6374d)), closes [#1](https://github.com/NeoAnthropocene/agents-united/issues/1) [#2](https://github.com/NeoAnthropocene/agents-united/issues/2) [#12](https://github.com/NeoAnthropocene/agents-united/issues/12) [#16](https://github.com/NeoAnthropocene/agents-united/issues/16) [#19](https://github.com/NeoAnthropocene/agents-united/issues/19) [#22](https://github.com/NeoAnthropocene/agents-united/issues/22)

## [0.7.3](https://github.com/NeoAnthropocene/agents-united/compare/v0.7.2...v0.7.3) (2026-09-08)


### Bug Fixes

* **ci:** wire SYNC_TOKEN with fallback in sync-main-to-dev workflow ([#35](https://github.com/NeoAnthropocene/agents-united/issues/35)) ([786a302](https://github.com/NeoAnthropocene/agents-united/commit/786a302e95d3cc26418bc64dfb06ddf713f778a2)), closes [#1](https://github.com/NeoAnthropocene/agents-united/issues/1) [#2](https://github.com/NeoAnthropocene/agents-united/issues/2) [#12](https://github.com/NeoAnthropocene/agents-united/issues/12) [#16](https://github.com/NeoAnthropocene/agents-united/issues/16) [#19](https://github.com/NeoAnthropocene/agents-united/issues/19) [#22](https://github.com/NeoAnthropocene/agents-united/issues/22)

## [0.7.2](https://github.com/NeoAnthropocene/agents-united/compare/v0.7.1...v0.7.2) (2026-09-08)


### Bug Fixes

* **ci:** direct merge and push in sync workflow to eliminate bot PR approval failures ([#32](https://github.com/NeoAnthropocene/agents-united/issues/32)) ([43efa60](https://github.com/NeoAnthropocene/agents-united/commit/43efa606cb3e439dc2c5ab508a076a7607fbea04)), closes [#1](https://github.com/NeoAnthropocene/agents-united/issues/1) [#2](https://github.com/NeoAnthropocene/agents-united/issues/2) [#12](https://github.com/NeoAnthropocene/agents-united/issues/12) [#16](https://github.com/NeoAnthropocene/agents-united/issues/16) [#19](https://github.com/NeoAnthropocene/agents-united/issues/19) [#22](https://github.com/NeoAnthropocene/agents-united/issues/22)

## [0.7.1](https://github.com/NeoAnthropocene/agents-united/compare/v0.7.0...v0.7.1) (2026-09-07)


### Bug Fixes

* Planner-Orchestrator Mode for Tier-1 Domain Bundles (Plan 013 / ADR 0015) ([#23](https://github.com/NeoAnthropocene/agents-united/issues/23)) ([7ac051b](https://github.com/NeoAnthropocene/agents-united/commit/7ac051b78bae6f2adc378327945494e649faedf0)), closes [#1](https://github.com/NeoAnthropocene/agents-united/issues/1) [#2](https://github.com/NeoAnthropocene/agents-united/issues/2) [#12](https://github.com/NeoAnthropocene/agents-united/issues/12) [#16](https://github.com/NeoAnthropocene/agents-united/issues/16) [#19](https://github.com/NeoAnthropocene/agents-united/issues/19) [#22](https://github.com/NeoAnthropocene/agents-united/issues/22)

# [0.7.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.6.0...v0.7.0) (2026-09-06)


### Features

* Subagent-First Planning Loop (Plan 012), developer docs & CI sync fix ([#17](https://github.com/NeoAnthropocene/agents-united/issues/17)) ([c21fa88](https://github.com/NeoAnthropocene/agents-united/commit/c21fa88d67425c952328d71c34fc41f42cc4924a)), closes [#1](https://github.com/NeoAnthropocene/agents-united/issues/1) [#2](https://github.com/NeoAnthropocene/agents-united/issues/2) [#12](https://github.com/NeoAnthropocene/agents-united/issues/12) [#16](https://github.com/NeoAnthropocene/agents-united/issues/16)

# [0.6.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.5.0...v0.6.0) (2026-09-03)


### Features

* **cline:** native discovery projection per ADR 0013 ([869fe48](https://github.com/NeoAnthropocene/agents-united/commit/869fe486c6efb4151eff31217ad411c3f15a0a16))

# [0.5.0](https://github.com/NeoAnthropocene/agents-united/compare/v0.4.0...v0.5.0) (2026-09-02)


### Features

* **core:** initialize agents-united 0.5.0 universal agent package manager ([133d4ea](https://github.com/NeoAnthropocene/agents-united/commit/133d4eaadf18d8e7cbff1e16eae5eb48b9943439))

# [0.5.0](https://github.com/NeoAnthropocene/agents-united/releases/tag/v0.5.0) (2026-09-02)

### Features

* **core:** universal package manager engine for AI agents across Antigravity, Cline, and extensible agent hosts
* **registry:** universal-orchestration bundle, Prime Orchestrator, and contract-tested Domain Atlas (ADR 0010)
* **cline:** project bundles as native plugins with team activation and single-command execution
* **mcp:** dynamic cross-platform McpLocationRegistry, multi-host partial evaluation & smart 1-click auto-remediation
* **workflows:** complete suite of digital-agency and engineering workflows
* **catalog:** interactive catalog explorer in `list`, hierarchical domain drill-down, and department-level installations
* **evals:** comprehensive lifecycle conformance and multi-agent evaluation suites

### Bug Fixes

* **lockfile:** multi-owner provenance, declared-set projection ownership, transactional remove, and POSIX key formatting
* **orchestrator:** detect deactivated MCPs, enforce Turn-1 tool inventory checks, and strict operational mode greetings
* **cli:** smart prerequisite auto-remediation wizard and cross-platform path resolution
