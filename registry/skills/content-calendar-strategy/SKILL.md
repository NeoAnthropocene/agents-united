---
name: content-calendar-strategy
description: "Use when planning a 30, 60 or 90-day editorial calendar, a content relaunch, or a quarterly review of what to publish and what to refresh; trigger phrases: plan our content calendar, what should we publish this quarter, build a 90-day editorial plan, how many articles can we ship, which posts need refreshing. Produces a calendar with hours, owners, dependencies, gates and dates, a capacity check, a refresh list, briefs for the priority items and a measurement plan. Skip it for a single article's brief (write the ten-field brief directly) and for a social posting schedule (use social-media-campaign)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🗓️
disable-slash-command: true
---

# Content Calendar Strategy

A calendar is a statement of what will be finished, by whom, in what order, and why that order. Calendars fail four ways: topics with no hours behind them, cluster articles before the pillar they link to, no one scheduled to review, and no updates to what already ranks.

## Overview & Purpose
The editorial strategist's way of avoiding all four. It plans: Yavuz writes the briefs, writers or other roles produce the articles, and Selin validates keyword targets.

## Execution Triggers
Load it for a 30, 60 or 90-day editorial plan, a content relaunch, or a quarterly review of what to publish and what to refresh. Do not use it for one article's brief (write the ten-field brief directly) or a social posting schedule (`social-media-campaign`).

## Input/Output Requirements
Inputs: audience and funnel-stage priorities; the keyword and cluster map (or the task of building one, which comes first); existing content with its traffic; capacity in hours per week by role; review and legal lead times; launch dates or events; channels.

Output: the calendar table (week, title, keyword, search intent, format, owner, dependencies, status gate, publish date, channels); a capacity check; the refresh list; briefs for the priority items; the measurement plan. Shapes: [examples/templates.md](examples/templates.md). **Evidence to attach**: the source of every keyword and volume figure and the date it was read.

## Step-by-Step Runbook
1. **Count capacity first**: hours per week for writing, editing, design, expert review and legal review. Every item costs hours (ranges in [references/hour-estimates.md](references/hour-estimates.md); replace them with the team's own history). Keep scheduled hours under 80 percent of capacity, because one illness breaks a full plan.
2. **Order by dependency, not enthusiasm.** The pillar before its cluster articles (they link up to it), research before opinion, a release or launch date pins its related items, and anything needing a customer, an engineer or legal goes early because those people are slow.
3. **Assign every item** an owner, a reviewer, a status gate (brief approved, draft, review, published) and a publish date. An item without an owner is not scheduled.
4. **Balance the mix** for the funnel: most items serve the middle and bottom (comparisons, integration guides, documentation), a few serve awareness. A top-of-funnel-only calendar is the trap of topics whose keywords are easy to find.
5. **Schedule refreshes**: a 90-day review of pages that already earn traffic (update dates and facts, fix links, re-check the intent against the current top results). Refreshing a page that ranks often beats a new page.
6. **Atomise on the calendar**: each pillar creates derived items for Jale (social, email) dated after publication; the dependency is the publish date.
7. **Hand off.** Keyword and intent checks to Selin; copy-heavy items (landing pages) to Kaan; creative and diagram requests to Jamileh with the date needed; distribution to Jale; factual or regulated claims to Defne. Tell the lead which items slip first if capacity drops.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a 13-week plan with its capacity arithmetic and four calendar rows to check yours against.

Anti-patterns, each with its reason:
- A calendar with no hours behind it: nobody can tell whether it is possible.
- Cluster articles before the pillar they point to: they link to a page that does not exist yet.
- 100 percent of capacity scheduled: one illness breaks the plan.
- New pages only: refreshing what already ranks often does more.
- Keywords with a volume and no source or date: nobody can check them.
- Items with no owner or review step: they are listed, not scheduled.

## Edge Cases & Error Recovery
- **Capacity unknown**: ask; if you must plan, state the assumption in the first line and plan to a smaller number.
- **A launch date moves**: the pinned items and everything dependent on them move; show the list, do not silently shift one row.
- **A subject expert is unavailable**: switch that item to a format that does not need them, or move it later; publish no unreviewed technical claims.
- **A cluster keyword cannibalises an existing page**: ask Selin; merge or re-target, do not publish a duplicate.
- **Legal review adds a week**: put it in the dependency column from the start for regulated topics (Defne).

## Verification Checklist
- [ ] Capacity in hours per role is stated and total scheduled hours are under 80 percent.
- [ ] Every item has an owner, a reviewer, dependencies, a gate and a date; pillars precede their clusters.
- [ ] Every keyword and volume figure carries a source and the date it was read.
- [ ] A refresh list for existing pages is included.
- [ ] Hand-offs name Selin, Kaan, Jamileh, Jale and Defne with what each delivers and by when.
- [ ] Hour estimates are labelled estimates unless taken from the team's own history.
