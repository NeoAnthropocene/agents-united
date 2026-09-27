# Voice & Tone Framework

In-house adaptation, credited to the topic list at
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`).

## Define voice with a personality table
| Attribute | Description | We say | We don't say |
|---|---|---|---|
| Direct | Get to the point | "Ship it today" | "We might consider potentially shipping" |
| Warm | Human, not corporate | "You're all set" | "Your request has been processed" |
| Confident | Own the claim | "This works" | "This should probably work" |

Fill this table with 3–5 real attributes from `docs/brand-guidelines.md`'s `### Brand Personality`
section — `scripts/inject-brand-context.mjs` reads it automatically.

## Tone shifts by moment
Voice stays constant; tone flexes by context:
- **Onboarding**: encouraging, low-jargon.
- **Errors**: calm, specific, action-oriented — never blame the user.
- **Billing/legal**: precise, no jokes, no ambiguity.
- **Celebration** (success states): warmer, brief.

## Prohibited terms
List banned words/phrases in `docs/brand-guidelines.md` under `### Prohibited Terms` (or
`### Forbidden Phrases`). Scripts and any generated copy must check against this list before
shipping — never invent a prohibited-terms list that isn't there.
