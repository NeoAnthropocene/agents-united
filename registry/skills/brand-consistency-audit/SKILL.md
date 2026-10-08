---
name: brand-consistency-audit
description: "Use when finished creatives, a banner set, a brand board or a built page must be checked against the brand before hand-off, or someone asks whether the work is on brand; trigger phrases: is this on brand, brand audit, brand consistency check, check the creatives against the brand, off-brand colours, wrong logo usage, brand drift, review the set before we ship. Produces a findings table (location, what differs, the rule it breaks, evidence, severity, owner, fix), the count of what was checked and the list of what was not; it reports and never edits. Skip it when no brand source exists yet (use brand-identity), for the accessibility gate on a built page (accessibility-audit) and for the truth of a claim (Defne)."
metadata:
  author: agents-united
  version: 1.0.0
  icon: 🔎
disable-slash-command: true
---

# Brand Consistency Audit

"On brand" is a claim with a count behind it: this many assets checked against these stated rules, these findings, these not checked. Audit against what the brand states, not against taste, and report: an audit never edits.

## Overview & Purpose
For the creative designer (a set before hand-off, or another hand's work), the front-end architect (a built page against the tokens) and the lead (the last gate). It compares assets with the brand's source of truth: tokens, guidelines, logo rules, copy. It does not write the guidelines (`brand-identity`), fix tokens (`design-system-tokens`), run the accessibility gate (`accessibility-audit`) or judge claims (Defne).

## Execution Triggers
Load it before a set leaves the team, when someone asks whether work is on brand, after a rebrand or a template change, or when assets from several hands merge. Skip it when nothing is stated yet (ask for a source, or hand off to `brand-identity`) and when the only question is one contrast pair (`color-theory`).

## Input/Output Requirements
Inputs: the source of truth (tokens file, guidelines, logo rules, copy file) and the assets in scope (a folder, a list, a published artifact).

Output: the report of [assets/audit-report-template.md](assets/audit-report-template.md). **Evidence to attach**: for every finding the file, the line or region, the value found, the rule and where the rule is stated; every count as a list.

## Step-by-Step Runbook
1. **Fix the source of truth and mark its gaps.** List what the brand states, dimension by dimension ([references/dimensions.md](references/dimensions.md)). What it does not state is "not stated": audit nothing against it. Nothing stated at all: stop and hand off to `brand-identity`.
2. **Take the inventory.** Glob the scope and open every asset. The number of assets is the denominator of the report: write the list, then count it.
3. **Scan what a scan can see**: colours and first fonts against the tokens, visible strings against the copy. With a shell, `node ${CLAUDE_SKILL_DIR}/scripts/audit-assets.mjs <tokens> <folder> --copy <copy file>`; without one, the `Grep` recipes of [references/scanning-without-a-shell.md](references/scanning-without-a-shell.md).
4. **Look at what a scan cannot see**: the logo (variant, clear space, minimum size, never stretched), imagery, layout against the grid and the safe zones, tone. Open images with `Read` and say what a downscaled copy did not let you judge.
5. **Write each finding with its evidence**: file, line or region, value found, the rule and its source, severity ([references/severity.md](references/severity.md)), owner, fix. A finding with no stated rule is a suggestion: list it apart.
6. **Count by listing.** Findings per dimension and per severity come from the table itself, never from memory; a clean dimension is "checked, none".
7. **Report and hand off.** The template filled; what was not checked; claims to Defne, copy to Kaan, token drift to `design-system-tokens`, contrast to `color-theory` and Emre. Fix nothing yourself.

## Code & Config Exemplars
[examples/worked-example.md](examples/worked-example.md) audits a three-file set with six planted drifts and writes the report.

Anti-patterns, each with its reason:
- "On brand" with no count: nobody can tell what was looked at.
- Fixing while auditing: the report stops matching what was delivered.
- A finding from taste ("too busy") with no stated rule: it is a suggestion; keep it apart.
- A count from memory ("about ten"): list the items, then count them.
- A scan's silence taken as proof for images or run-time values: it cannot see them.
- Averaging severities: one wrong logo outweighs ten spacing nits.

## Edge Cases & Error Recovery
- **Guidelines and tokens disagree**: report the conflict with both sources; do not pick one.
- **Only a logo and a few assets exist**: record the colours as found, label them "inferred from the logo", and audit against them only if the lead accepts that.
- **An approved exception** (a campaign breaking a rule): record who approved it; it is not a finding.
- **Run-time values and raster images**: not scanned; list them under not checked.
- **A very large set**: sample by placement and by author, say how many, and never call the sample the set.

## Verification Checklist
- [ ] Every dimension is stated, "not stated" or "checked, none".
- [ ] The inventory is a list, and every count was made from a list.
- [ ] Each finding has file, location, value, rule with its source, severity and owner.
- [ ] Nothing was edited; suggestions are apart from findings.
- [ ] The report says what was not checked and names the hand-offs.
