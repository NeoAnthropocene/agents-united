# Severity and owners

Severity measures the rule and where the drift shows. It is not how much you dislike the result.

| Severity | Meaning | Examples | Ships? |
|---|---|---|---|
| Blocker | The asset must not ship | A wrong, stretched or recoloured logo; a claim or a number that is not the approved copy's; text that fails contrast (hand to Emre) | No |
| Major | The brand states a rule and a prominent element replaces it | A colour or typeface that is not a token's on a headline, a fill or a large background; a headline or label that changes words or numbers | Not without an approved exception |
| Minor | The same drift in a small or hidden place, or a trivial change | A 1 px border or a hover state in a stray colour; a label that differs by punctuation or case | Yes, with the fix queued |
| Suggestion | No stated rule behind it | "Tighten the spacing", "this reads busy" | Not a finding; listed apart |

Rules:

- Order the table by severity, then by file. One blocker decides the ship decision for the set; never average severities.
- A rule that the brand states elsewhere but the asset set contradicts is a finding against the asset, with the source named.
- A drift an approved exception covers is recorded under Approved exceptions, with who approved it and when; it is not counted.
- When two sources disagree, the finding is the conflict, with both sources, and it goes to the person who owns the brand.

## Owners

| Drift in | Owner |
|---|---|
| Colour, type, layout, logo placement, imagery in a creative | Jamileh |
| A built page or component | Deniz |
| Copy, tone, a changed label | Kaan |
| A claim or a figure | Defne |
| The tokens or the guidelines themselves | `design-system-tokens`, `brand-identity` |
| Contrast on a built page | Emre, with `color-theory` for the decision |
