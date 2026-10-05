# Worked example (invented numbers, for checking your own work)

A developer-tools company with a capacity of 30 hours a week across Yavuz's team (writer 16, editor 6, designer 4, engineer review 4). 90 days is 13 weeks, so 390 hours; plan to 310 (80 percent, rounded down).

## The hours

- Pillar 1, "webhook reliability": pillar page 18 h, six cluster articles at 6 h each = 36 h, one customer case study 10 h, one integration guide 8 h: 72 h.
- Pillar 2, "API versioning": pillar page 16 h, five cluster articles 30 h: 46 h.
- Refresh of the three pages with traffic: 3 x 3 h = 9 h.
- Distribution derivatives (Jale), design and review: 60 h.

Total 187 h, well under 310: add one pillar, or keep the slack for the release in week 9.

## Four rows of the calendar

| Wk | Item | Keyword (source, date) | Intent | Owner | Needs | Gate | Publish |
|---|---|---|---|---|---|---|---|
| 1 | Pillar: webhook reliability | webhook retries (tool X, 2026-10-01) | informational | Yavuz | engineer review wk 1 | brief approved | wk 3 |
| 4 | Cluster: idempotency keys | idempotent webhook | informational | writer | pillar published wk 3 | draft | wk 5 |
| 9 | Release note and guide | (release) | navigational | writer | release date wk 9 | pinned | wk 9 |
| 10 | Refresh: retries page | webhook retries | informational | editor | 90-day review | review | wk 10 |
