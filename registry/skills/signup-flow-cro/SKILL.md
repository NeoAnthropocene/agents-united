---
name: signup-flow-cro
description: "Use when signup-to-activation or visit-to-signup is the bottleneck, a signup flow is being specified, or support reports people who could not register; trigger phrases: audit our signup flow, too many form fields, people abandon registration, should we use social login, when should we verify email. Produces a field table with one reason per field, the screen order, the sign-in and verification choice, inline error and mobile specs, and test briefs. Skip it for legally identity-checked flows (financial, health, age-gated: audit order, wording and errors only) and for pricing or data-collection decisions."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📝
disable-slash-command: true
---

# Signup Flow CRO

Every field and screen between "I want this" and "I'm in" costs a share of the people who arrive: keep only what the first value needs, move the rest later, and make the remaining steps hard to fail.

## Overview & Purpose
A field-by-field method for web signup flows, with defaults for authentication and verification and rules for errors and mobile. It does not decide pricing or what personal data the business may collect: that is a legal question for Defne.

## Execution Triggers
Load it when signup-to-activation or visit-to-signup is the bottleneck, a new signup flow is being specified, or support reports people who "could not register". Do not use it for a flow that must verify identity by law (financial, health, age-gated): the fields are given, so audit only order, wording and errors.

## Input/Output Requirements
Inputs: the current flow as ordered screens with every field, the drop-off per screen if it exists, the device split, the sign-in options offered now, and what the business does with each piece of data.

Output: a field table (keep, move later, remove, one reason each); the screen order; the authentication and verification choice with its reason; the error and mobile specifications; one or two briefs for `ab-test-setup`. Shapes: [examples/templates.md](examples/templates.md). **Evidence to attach**: the screen-by-screen counts you read, and whether you walked the flow on a phone-sized viewport.

## Step-by-Step Runbook
1. **List every field and ask what breaks without it.** Needed to create the account: email (or phone) and a credential. Needed for first value: only what the first screen uses. Everything else moves to after activation or goes: a field kept "for later" is paid for now, by everyone.
2. **Count the cost**: fields, required taps and screens on mobile. Quote no per-field loss without this product's data, and label rules of thumb as such.
3. **Choose authentication.** Offer one-tap sign-in with providers your audience already has (work accounts for B2B, a platform account for consumers) beside a plain email path. Passwords only: allow paste, add a show/hide control, state the rule before the field, not after the error. Passwordless links suit low-frequency products.
4. **Verify late.** Let the person in, then require verification before the action that needs a trusted address (inviting, publishing, paying); block entry only where abuse is the main risk. Send the code at once, accept a pasted one, offer "resend" and "use a different email" on the same screen.
5. **Specify errors.** Validate on blur, show the message next to the field, say what to do ("Use at least 12 characters"), keep what was typed, never clear the form. An error shown only after submit, at the top of the page, is an S1 finding: people cannot see what to fix.
6. **Specify mobile**: the right keyboard per field (email, telephone), autofill attributes on, labels above fields, a primary button the keyboard does not hide, targets of at least 44 pixels.
7. **Hand off.** Typed copy and error strings to your own section props; screen layout to Jamileh; build, autofill attributes and an event per screen to Deniz; each field's purpose to Defne before anything is added. Emre verifies on a phone-sized viewport and by keyboard only.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a ten-field B2B flow cut to one screen, with the brief and the error specification filled in.

Anti-patterns, each with its reason:
- Phone, company size and role "for later" on screen one: everyone pays now for a benefit nobody has yet.
- Validation only after submit, form cleared: the person retypes everything and guesses the cause.
- Verification before any value is seen: they leave before they know why it matters.
- A password rule shown only when broken: they fail first and learn the rule second.
- Disabling paste in a password field: it defeats password managers.
- Pre-ticked consent boxes: consent that is not a choice (hand to Defne).

## Edge Cases & Error Recovery
- **Email already registered**: say so and offer sign-in or a reset link; where saying so discloses membership you must protect, ask Defne.
- **Verification email never arrives**: show a resend, a "wrong address" fix and a support route; ask Emre whether the sender domain is authenticated.
- **Corporate email filters or social sign-in fails**: always keep the plain email path.
- **Regulated fields cannot go**: keep them, put them last, say why in one line, measure that step alone.
- **A third-party sign-in changes**: its screens are outside your control; test the full round trip.

## Verification Checklist
- [ ] Every field has a verdict and a one-line reason; none is kept "for later".
- [ ] Authentication and verification choices are stated with the reason.
- [ ] Error handling is specified per field, with trigger and message text.
- [ ] Mobile behaviour is specified: keyboard type, autofill, label position, target size.
- [ ] Any rule-of-thumb figure is labelled; no invented field-level numbers.
- [ ] Hand-offs name Jamileh, Deniz, Defne and Emre with what each must deliver.
