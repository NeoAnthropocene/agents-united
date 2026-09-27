# Interface Copy Patterns

In-house adaptation, credited to
[ui-skills.com/skills/mrstev3n/balise-ux-writing](https://www.ui-skills.com/skills/mrstev3n/balise-ux-writing)
(Apache-2.0 source: `github.com/mrstev3n/balise-skills`).

## Buttons
- Verb-first, specific to the action: "Save changes", not "OK" or "Submit" when a clearer verb
  exists.
- Primary action names the outcome ("Send invite"); secondary/cancel is plain ("Cancel", "Back").
- Destructive actions name what's destroyed ("Delete project", not "Delete").

## Forms
- Labels above fields, always visible (never placeholder-only — placeholders disappear on input and
  fail accessibility).
- Hints explain *why*, not just *what* ("We'll only use this for order updates").
- Required/optional marked consistently — pick one convention and use it everywhere in scope.

## Errors
- Say what happened, why (if known and true), and the specific next step. Never blame the user
  ("Invalid input" → "Enter a valid email address, like name@example.com").
- Field-level errors appear next to the field; page-level errors summarize and link to each field.

## Empty states
- Explain why it's empty and the one action that changes that ("No projects yet — Create your
  first project").
- Don't editorialize with false enthusiasm about an empty/failure state.

## Onboarding
- Progressive disclosure: teach only what's needed for the next step, not the whole feature set.
- Every step has a visible exit ("Skip", "Do this later").

## Confirmations & consent
- State the consequence and its reversibility honestly (see SKILL.md's high-stakes-content rule).
- Consent copy states what's collected/shared and why, in plain language — never bury it in legalese
  paraphrase that changes its meaning.

## Notifications & system feedback
- Lead with the outcome, not the mechanism ("Payment received", not "Webhook processed
  successfully").
- Loading states name what's loading if it's not obvious and may take >2s.
