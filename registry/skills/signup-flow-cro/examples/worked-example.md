# Worked example (invented numbers, for checking your own work)

A B2B scheduling tool asks for: first name, last name, work email, password, company name, company size, role, phone, "how did you hear about us", and a terms checkbox, over three screens. Of 100 people who start, 61 finish screen 1, 38 finish screen 2 and 29 finish screen 3.

## The field table

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

## The new flow

One screen (email, name, password) with a Google or Microsoft button above it. The verification email is sent at once and entry is allowed. The three moved questions are asked as a card on the dashboard after the first scheduled meeting.

## The brief for ab-test-setup

Primary metric: signup start to first meeting scheduled within 24 hours. Guardrail: the share of unverified accounts that invite others.

## The error specification

```text
Field: Work email    Trigger: blur   Message: "Enter an address like name@company.com"
Field: Password      Trigger: input  Message (live): "12+ characters, a mix is optional" ; never block paste
On submit failure: keep all values, scroll to the first error, move focus to its field
```
