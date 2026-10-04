---
name: signup-flow-cro
description: "Audit a signup or registration flow field by field and step by step, deciding for each field whether it earns its place, choosing authentication and verification that fit the product, and specifying inline errors and mobile behaviour."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📝
disable-slash-command: true
---

# Signup Flow CRO

## Overview & Purpose
Every field and every screen between "I want this" and "I'm in" costs a share of the people who arrive. The job is to keep only what the product needs *before* the first value, move the rest to later, and make the remaining steps hard to fail. This skill gives the conversion specialist a field-by-field method, defaults for authentication and verification, and rules for errors and mobile.

It is for web signup flows. It does not decide pricing, and it does not decide what personal data the business may collect: that is a legal question that goes to Defne.

## Execution Triggers
Load it when signup-to-activation or visit-to-signup is the bottleneck, when a new signup flow is being specified, or when support reports people who "could not register". Do not use it for a flow that needs identity checks by law (financial, health, age-gated): the required fields are given and the audit is only about order, wording and errors.

## Input/Output Requirements
Inputs: the current flow as ordered screens with every field, the drop-off count at each screen if it exists, the device split, the authentication options now offered, and what the business does with each piece of data. Output: a field table (keep, move later, remove, with a reason for each), the recommended order of screens, the authentication and verification choice with its reason, the error and mobile specifications, and one or two experiment briefs for `ab-test-setup`. **Evidence to attach**: the screen-by-screen counts you read, and whether you walked the flow on a phone-sized viewport.

## Step-by-Step Runbook
1. **List every field and ask what breaks without it.** For each: is it needed to create the account, to deliver the first value, or neither? Needed to create: email (or phone) and a credential. Needed for first value: only what the first screen of the product uses. Everything else moves to after activation, or goes.
2. **Count the cost.** Count form fields, required taps and screens on mobile. As a working rule, each extra required field can lose a measurable share of completions; do not quote a number unless you have this product's field-level data, and label rules of thumb as such.
3. **Choose authentication.** Offer one-tap sign-in with the providers your audience already has (work accounts for B2B, a platform account for consumer), and a plain email path next to it. If you only offer passwords, allow paste, show a show/hide control and state the rule *before* the field, not after the error. Passwordless links are a good default for low-frequency products.
4. **Choose verification.** Verify late: let the person into the product, then require verification before the action that needs a trusted address (inviting, publishing, paying). Block entry only where abuse is the main risk. Send the code immediately, accept a pasted code, and offer "resend" and "use a different email" on the same screen.
5. **Specify errors.** Validate on blur, show the message next to the field, say what to do ("Use at least 12 characters"), keep what was typed, and never clear the form on failure. An error that only appears after submit at the top of the page is an S1 finding.
6. **Specify mobile.** The correct keyboard per field (email, telephone), autofill attributes on, labels above fields, a primary button reachable without hiding behind the keyboard, and targets of at least 44 pixels.
7. **Hand off.** Typed copy and error strings to your own section props; layout of the screens to Jamileh; the build, the autofill attributes and the event for each screen to Deniz; and what each field is *for* to Defne before anything is added. Emre verifies the flow on a phone-sized viewport and with the keyboard only.

## Code & Config Exemplars
### Worked example
A B2B scheduling tool asks for: first name, last name, work email, password, company name, company size, role, phone, "how did you hear about us", and a terms checkbox, over three screens (invented numbers: 100 start, 61 finish screen 1, 38 screen 2, 29 screen 3).

| Field | Verdict | Reason |
|---|---|---|
| Work email | keep | needed to create the account |
| Password | keep, or replace with an emailed link | a credential is needed |
| First name | keep, merge to "Your name" | the product greets the person |
| Last name | remove | no first-value use |
| Company, size, role | move to after the first meeting is scheduled | used for segmentation, not for first value |
| Phone | remove | unused; if kept it needs a stated purpose |
| How did you hear | move to a one-click question after activation | marketing data |
| Terms checkbox | keep, as a link line under the button | legal text, not a field to tick unless required |

New flow: one screen (email, name, password), a Google or Microsoft button above it, verification email sent at once with entry allowed, the three moved questions asked as a card on the dashboard after the first scheduled meeting. Brief for `ab-test-setup`: primary metric signup-start to first meeting scheduled within 24 hours; guardrail: share of unverified accounts that invite others.

Error specification:
```text
Field: Work email    Trigger: blur   Message: "Enter an address like name@company.com"
Field: Password      Trigger: input  Message (live): "12+ characters, a mix is optional" ; never block paste
On submit failure: keep all values, scroll to the first error, move focus to its field
```

### Anti-patterns
- Asking for phone, company size and role "for later" on the first screen.
- Validation only after submit, with the form cleared.
- Forcing verification before the person has seen any value.
- A password rule revealed only when it is broken.
- Disabling paste in a password field.
- Pre-ticked consent boxes (hand to Defne).

## Edge Cases & Error Recovery
- **Email already registered**: say so and offer sign-in or a reset link; do not reveal that for account types where it discloses membership you must protect (ask Defne).
- **Verification email never arrives**: show a resend, a "wrong address" fix and a support route; check with Emre whether the sender domain is authenticated.
- **Corporate email filters or social sign-in fails**: always keep the plain email path.
- **Regulated fields cannot be removed**: keep them, move them last, explain why in one line, and measure that step on its own.
- **Third-party sign-in changes**: the provider's own screens are outside your control; test the full round trip, not only your button.

## Verification Checklist
- [ ] Every field has a verdict and a one-line reason; none is kept "for later".
- [ ] Authentication and verification choices are stated with the reason.
- [ ] Error handling is specified per field, with trigger and message text.
- [ ] Mobile behaviour is specified (keyboard type, autofill, label position, target size).
- [ ] Any rule-of-thumb figure is labelled; no invented field-level numbers.
- [ ] Hand-offs name Jamileh, Deniz, Defne and Emre with what each must deliver.
