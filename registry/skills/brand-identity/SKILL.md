---
name: brand-identity
description: Brand voice, visual identity, messaging frameworks, asset
  management, and brand-to-design-token sync. Activate for branded content,
  tone-of-voice guidance, marketing asset compliance, style guides, and
  syncing docs/brand-guidelines.md to design tokens. Renamed from the
  upstream "brand" (too generic to trigger reliably as a skill name).
metadata:
  author: nextlevelbuilder (github.com/nextlevelbuilder)
  version: 1.0.0
  source: https://www.ui-skills.com/skills/nextlevelbuilder/brand
  license: MIT
  icon: 🎨
disable-slash-command: true
---

# Brand Identity — Voice, Visual Identity & Token Sync

## Overview & Purpose
`brand-identity` (upstream name `brand`, renamed per owner decision 2026-09-27 because the bare
name is too generic to trigger reliably) is the source-of-truth workflow for a brand's voice,
visual identity, messaging framework, and asset consistency, plus a one-way sync from a written
`docs/brand-guidelines.md` into machine-readable design tokens (`assets/design-tokens.json` /
`assets/design-tokens.css`).

**Boundary vs. adjacent skills** (Plan 028 Step 0 overlap check):
- **`design-system-tokens`** owns the *token pipeline* once tokens exist: token architecture, naming
  scales, Style Dictionary-style build steps, and consumption in components. `brand-identity` owns
  the *authoring and sync* step that feeds it: turning a brand's written guidelines into an initial
  token file, and re-syncing it when guidelines change. `brand-identity`'s sync script explicitly
  refuses to run if it finds a project already has an independent token pipeline (see Step 4) —
  ownership of the tokens then belongs to `design-system-tokens`, not this skill.
- **`workflow-agency-brand-design-system`** is the digital-agency's end-to-end *engagement*
  (discovery call → guidelines doc → token handoff → design-system kickoff). `brand-identity`
  supplies the reusable voice/identity/token-sync mechanics that workflow calls into; it does not
  itself run client discovery or manage the engagement timeline.
- It does not duplicate `ad-creative-design`/`marketing-creative-design`/`banner-design` (those
  consume brand identity as an input to produce campaign or banner artifacts; this skill defines
  and maintains the identity itself).

## Execution Triggers & Prerequisites
### Execution Triggers
- Defining or auditing brand voice, tone, or messaging framework.
- Developing or reviewing visual identity standards and a style guide.
- Checking branded content, marketing assets, or a design file for brand consistency.
- Organizing, naming, or approving brand assets.
- Managing a color palette or typography spec, or syncing brand guidelines into design tokens.

### Prerequisites
- `docs/brand-guidelines.md` exists (or use `references/brand-guideline-template.md` to start one).
- Node.js available to run the audited scripts (all four are plain `.cjs`/`.mjs`, no OS-specific
  syntax — see Step-by-Step Runbook Step 0 for the source audit).
- For the sync step specifically: the requester's explicit go-ahead before any file is written (see
  Step 4 — this is a hard confirmation gate, not optional).

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `guidelines_path` | Path | Optional | Defaults to `docs/brand-guidelines.md` |
| `asset_path` | Path | For validate mode | Asset file to check against naming/size/format rules |
| `image_path` | Path | For color-extraction mode | Image to compare against the brand palette |
| `confirm_sync` | Boolean | Required for the sync step | Must be explicitly true/given by the requester before any write |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Brand context digest | stdout (text or `--json`) | Colors/type/voice/prohibited-terms summary for prompt injection |
| Design tokens | `assets/design-tokens.json`, `assets/design-tokens.css` | Only written after Step 4's confirmation gate |
| Asset validation report | stdout (text or `--json`), exit code 0/1 | Naming/size/format check against the rules in `references/asset-organization.md` |
| Color compliance report | stdout (text or `--json`) | Extracted vs. brand-palette color comparison |

## Step-by-Step Execution Runbook

### Step 0 — What the four upstream scripts actually do (source audit, Plan 028 Step 0)
The upstream `brand` skill ships four Node `.cjs` scripts. All four were fetched and read from the
MIT-licensed source (`github.com/nextlevelbuilder/ui-ux-pro-max-skill`, path
`.claude/skills/brand/scripts/`) rather than guessed. Findings:

| Script | Reads | Writes | Notes |
|---|---|---|---|
| `inject-brand-context.cjs` | `docs/brand-guidelines.md` (or a given path) | Nothing — stdout only | Regex-parses colors/typography/voice/attributes/image style, prints a prompt-injection block or `--json` |
| `sync-brand-to-tokens.cjs` | `docs/brand-guidelines.md` | **`assets/design-tokens.json`, `assets/design-tokens.css`** | The one write-capable script. Already refuses to run if it detects an existing independent token source (`:root` custom properties, Tailwind `@theme`, or a Tailwind color preset) unless re-run with `--force`; supports `--dry-run` |
| `validate-asset.cjs` | The given asset file's stats + `.assets/manifest.json` if present | Nothing — stdout + exit code only | Checks filename convention, dimensions class, and file-size ceilings; its own `--fix` flag is documented but not implemented upstream — treat `--fix` as a no-op and never claim it corrected anything |
| `extract-colors.cjs` | `docs/brand-guidelines.md` | Nothing | Parses the brand palette and prints an `ImageMagick` command plus instructions for a human/tool to run separately — it never shells out itself |

**Conclusion**: only one of the four scripts writes anything, and it already gates on detecting an
existing token pipeline. This skill adds one further gate on top: this skill's own workflow never
runs the sync script without the requester's explicit go-ahead for *this* run (Step 4). All four
are plain Node with no bash-only syntax, so they run unmodified on Windows, macOS, and Linux —
nothing needed porting or dropping (Plan 028 R2).

### Step 1 — Inject brand context (read-only, safe to run anytime)
```bash
node scripts/inject-brand-context.mjs                # human-readable digest
node scripts/inject-brand-context.mjs --json         # machine-readable digest
```
Use this before generating any branded copy or asset, to ground the request in the project's actual
colors, typography, voice traits, and prohibited terms — never invent brand rules that aren't in
`docs/brand-guidelines.md`.

### Step 2 — Validate an asset (read-only)
```bash
node scripts/validate-asset.mjs '<asset-path>'
node scripts/validate-asset.mjs '<asset-path>' --json
```
Checks filename convention (`{type}_{campaign}_{description}_{YYYYMMDD}[_variant].{ext}`), format,
and file-size ceilings from `references/asset-organization.md`. Exit code 0 = pass, 1 = fail.

### Step 3 — Extract / compare colors (read-only)
```bash
node scripts/extract-colors.mjs --palette             # print the brand palette
node scripts/extract-colors.mjs '<image-path>'         # print an extraction command + compliance context
```
This script never shells out on its own; if image color extraction is needed, run the printed
command (or use an available image-analysis capability) yourself and compare the result against the
printed palette.

### Step 4 — Sync brand guidelines to design tokens (WRITE-CAPABLE — confirmation gate)
**STOP. Do not run this step until the requester has explicitly confirmed they want
`assets/design-tokens.json`/`.css` created or overwritten in this run.** State plainly what will be
written and where, and wait for a yes before proceeding — this is not satisfied by an earlier
general "go ahead," it must be for this specific write.

Once confirmed:
```bash
# 1. Edit docs/brand-guidelines.md (or start from references/brand-guideline-template.md)
# 2. Dry run first — always
node scripts/sync-brand-to-tokens.mjs --dry-run
# 3. Only after reviewing the dry run output, write for real
node scripts/sync-brand-to-tokens.mjs
# 4. Verify
node scripts/inject-brand-context.mjs --json | head -20
```
If the script reports an existing independent token source (`:root` variables, Tailwind `@theme`,
or a Tailwind color preset already in the project), **stop and report that to the requester** rather
than re-running with `--force` on their behalf — `--force` is a decision only the requester makes,
never a default recovery step.

### Step 5 — Voice, visual identity, messaging & consistency review
Load only the reference file the task needs:
| Topic | File |
|---|---|
| Voice & tone | `references/voice-framework.md` |
| Visual identity standards | `references/visual-identity.md` |
| Messaging framework | `references/messaging-framework.md` |
| Consistency audit | `references/consistency-checklist.md` |
| New-brand starter | `references/brand-guideline-template.md` |
| Asset naming/organization | `references/asset-organization.md` |
| Color palette management | `references/color-palette-management.md` |
| Typography specs | `references/typography-specifications.md` |
| Logo usage rules | `references/logo-usage-rules.md` |
| Sign-off checklist | `references/approval-checklist.md` |

## Code & Config Exemplars

### Confirmation gate pattern (used by every write path in this skill)
```js
// scripts/lib/confirm-gate.mjs — shared by sync-brand-to-tokens.mjs
export function requireConfirmation(argv, whatWillBeWritten) {
  if (!argv.includes('--confirmed')) {
    console.error(
      `REFUSING TO WRITE without --confirmed.\n` +
      `This run would write: ${whatWillBeWritten}\n` +
      `Re-run with --confirmed only after the requester has explicitly said yes to this write.`
    );
    process.exit(1);
  }
}
```
`sync-brand-to-tokens.mjs` calls this before touching disk in non-dry-run mode; an orchestrating
agent must never pass `--confirmed` on the requester's behalf without having actually asked them.

### Brand context digest shape (`--json` from Step 1)
```json
{
  "colors": { "primary": ["#2563EB"], "secondary": ["#7C3AED"], "neutral": [], "semantic": [] },
  "typography": { "heading": "Inter", "body": "Inter", "mono": null },
  "voice": { "traits": ["Direct", "Warm", "Confident"], "prohibited": ["synergy", "disrupt"] },
  "source": "docs/brand-guidelines.md",
  "extractedAt": "2026-09-27T00:00:00.000Z"
}
```

## Edge Cases & Error Recovery
- **`docs/brand-guidelines.md` doesn't exist yet**: don't fabricate one silently — offer
  `references/brand-guideline-template.md` as the starting point and ask the requester to fill in
  the brand's actual colors/voice before any script runs against it.
- **Sync detects an existing token pipeline**: stop, report the detected source (file path), and let
  the requester decide whether `--force` is intentional — never decide that for them.
- **Requester asks to "just sync it" without reviewing the dry run**: still run `--dry-run` first and
  show the output before the real write; a verbal go-ahead does not skip the dry-run review, only
  the confirmation gate itself.
- **`validate-asset` is asked to "fix" a bad filename**: say plainly that `--fix` is not implemented
  upstream and this skill does not implement it either; propose the corrected filename as text for
  the requester to apply themselves.
- **Color extraction requested on an image with no ImageMagick installed**: print the palette and
  the command anyway, and say the command needs ImageMagick (or an available image-analysis
  capability) to actually run — don't claim extraction happened.

## Verification Checklist
- [ ] `inject-brand-context`, `validate-asset`, and `extract-colors` never write to disk — confirm
      no file-write call exists in their implementation before shipping a change to them.
- [ ] `sync-brand-to-tokens` never runs without an explicit `--confirmed` flag set only after the
      requester said yes to *this* write, and `--dry-run` output was shown first.
- [ ] `sync-brand-to-tokens` refuses (does not silently overwrite) when an existing independent
      token source is detected, unless the requester explicitly asked for `--force`.
- [ ] All four scripts run unmodified on Windows (`node script.mjs ...`), no bash-only syntax.
- [ ] Brand colors/type/voice applied to any output were read from `docs/brand-guidelines.md`, not
      invented.
- [ ] This skill's boundary against `design-system-tokens` and `workflow-agency-brand-design-system`
      was stated to the requester when both would plausibly apply.
