# Worked example (an invented brief, for checking your own work)

Brief (accepted): launch a webhook-retry feature, 400 connections in 14 days from a baseline of 60. Integrations: Limited Operational (no Figma).

## The delegation map

```text
S1 Ava      strategy and metric       in: brief            out: growth/playbook.md           evidence: LTV:CAC stated, ICE backlog
S2 Kaan     landing copy as props     in: S1               out: copy/hero.props.ts           evidence: five-second test written
S2 Jamileh  tokens and hero SVG       in: S1               out: design/design-tokens.json    evidence: contrast table
S2 Yavuz    guide and 4 posts brief   in: S1               out: content/briefs.md            evidence: keywords with source and date
S3 Deniz    page from tokens, props   in: S2 files         out: src/app/launch/page.tsx      evidence: build output, testids listed
S3 Selin    metadata and JSON-LD      in: S3 page, S2 kws  out: seo/snippets.md              evidence: validator output
S3 Jale     kit with UTM              in: S2 copy, URL     out: campaign/kit.md              evidence: every link tagged
S4 Emre     gate                      in: S3 page          out: qa/gate-report.md            evidence: run output, viewport matrix
S4 Defne    review                    in: S3 kit and page  out: compliance/review.md         evidence: checklist per asset
```

## How to read it

Every row names the slice, the owner, the inputs it needs, the file it writes and the evidence it reports. Slices of one phase run in parallel; a slice starts only when the artefacts in its `in:` column exist as files (Deniz needs Kaan's props and Jamileh's tokens, Selin needs Yavuz's keyword map). S4 verifies the whole before delivery: if it is red for a defect in S3, only that owner reworks.
