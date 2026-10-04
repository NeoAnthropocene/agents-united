---
name: content-calendar-strategy
description: "Plan a 90-day content calendar that a small team can actually ship: pillars before cluster articles, capacity in hours, dependencies and owners per item, a refresh cadence, and a brief for each priority piece."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🗓️
disable-slash-command: true
---

# Content Calendar Strategy

## Overview & Purpose
A calendar is a statement of what will be finished, by whom, in what order, and why that order. Calendars fail because they list topics without hours, put cluster articles before the pillar they link to, ignore who must review, and never schedule updates to what already ranks. This skill is the editorial strategist's way of avoiding all four.

It plans; it does not write the articles (Yavuz writes the briefs, the writers or other roles produce them) and it does not decide keyword targets (Selin validates them).

## Execution Triggers
Load it for a 30, 60 or 90-day editorial plan, a content relaunch, or a quarterly review of what to publish and what to refresh. Do not use it for a single article's brief (write the ten-field brief directly) or for a social posting schedule (use `social-media-campaign`).

## Input/Output Requirements
Inputs: audience and funnel stage priorities, the keyword and cluster map (or the task of building one, which comes first), existing content with its traffic, the team's capacity in hours per week by role, review and legal lead times, launch dates or events, and the channels in use.

Outputs: the calendar table (week, title, keyword, search intent, format, owner, dependencies, status gate, publish date, channels); a capacity check; the refresh list; briefs for the priority items; and the measurement plan. Evidence to attach: the source of every keyword and volume figure and the date it was read.

## Step-by-Step Runbook
1. **Count capacity first.** Hours per week for writing, editing, design, subject-expert review and legal review. An item costs hours: a pillar page about 12 to 20, a cluster article 4 to 8, a case study 8 to 12 plus the customer's approval time (rough ranges; replace them with the team's own history). Total scheduled hours must stay under 80 percent of capacity; the rest is slack.
2. **Order by dependency, not by enthusiasm.** Pillar before its cluster articles (they link up to it), research before opinion, a product release or launch date pins its related items, and anything that needs a customer, an engineer or legal goes early because those people are slow.
3. **Assign every item** an owner, a reviewer, a status gate (brief approved, draft, review, published) and a publish date. An item without an owner is not scheduled.
4. **Balance the mix** for the funnel: most items serve the middle and the bottom (comparisons, integration guides, documentation), a few serve awareness; do not build a calendar of only top-of-funnel topics because they are easiest to find keywords for.
5. **Schedule refreshes.** For the pages that already earn traffic, a review at 90 days: update dates and facts, fix links, re-check the intent against the current top results. Refreshing a page that ranks often beats a new page.
6. **Atomise on the calendar.** Each pillar creates derived items for Jale (social, email) with dates after publication; the dependency is the publish date.
7. **Hand off.** Keyword and intent checks to Selin; copy-heavy items (landing pages) to Kaan; creative and diagram requests to Jamileh with the date they are needed; distribution items to Jale; factual or regulated claims to Defne for review. Tell the lead which items slip first if capacity drops.

## Code & Config Exemplars
### Worked example
A developer-tools company, capacity 30 hours a week across Yavuz's team (writer 16, editor 6, designer 4, engineer review 4). 90 days is 13 weeks, so 390 hours; plan to 310 (80 percent).

Pillar 1, "webhook reliability": pillar page 18 h, six cluster articles at 6 h each = 36 h, one customer case study 10 h, one integration guide 8 h: 72 h. Pillar 2, "API versioning": pillar 16 h, five cluster articles 30 h: 46 h. Refresh of the three pages with traffic: 3 x 3 h = 9 h. Distribution derivatives (Jale), design and review: 60 h. Total 187 h, well under 310: add one pillar, or keep slack for the release in week 9.

| Wk | Item | Keyword (source, date) | Intent | Owner | Needs | Gate | Publish |
|---|---|---|---|---|---|---|---|
| 1 | Pillar: webhook reliability | webhook retries (tool X, 2026-10-01) | informational | Yavuz | engineer review wk 1 | brief approved | wk 3 |
| 4 | Cluster: idempotency keys | idempotent webhook | informational | writer | pillar published wk 3 | draft | wk 5 |
| 9 | Release note and guide | (release) | navigational | writer | release date wk 9 | pinned | wk 9 |
| 10 | Refresh: retries page | webhook retries | informational | editor | 90-day review | review | wk 10 |

### Anti-patterns
- A calendar with no hours behind it.
- Cluster articles published before the pillar they point to.
- 100 percent of capacity scheduled, so one illness breaks the plan.
- New pages only; no refresh of what already ranks.
- Keywords with a volume number and no source or date.
- Items with no owner or review step.

## Edge Cases & Error Recovery
- **Capacity unknown**: ask; if you must plan, state the assumption in the first line and plan to a smaller number.
- **A launch date moves**: the pinned items and everything dependent on them move; show the list, do not silently shift one row.
- **A subject expert is unavailable**: switch that item to a format that does not need them, or move it later; do not publish unreviewed technical claims.
- **A cluster keyword turns out to cannibalise an existing page**: ask Selin; merge or re-target, do not publish a duplicate.
- **Legal review adds a week**: put it in the dependency column from the start for regulated topics (Defne).

## Verification Checklist
- [ ] Capacity in hours per role is stated and total scheduled hours are under 80 percent.
- [ ] Every item has an owner, a reviewer, dependencies, a gate and a date; pillars precede their clusters.
- [ ] Every keyword and volume figure carries a source and the date it was read.
- [ ] A refresh list for existing pages is included.
- [ ] Hand-offs name Selin, Kaan, Jamileh, Jale and Defne with what each must deliver and by when.
- [ ] Hour estimates are labelled as estimates unless taken from the team's own history.
