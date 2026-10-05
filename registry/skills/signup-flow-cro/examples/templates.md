# Templates

Copy a block and fill every line. A line you cannot fill is a gap: name it and who can close it.

## The field table (one row per field, none left out)

```text
| Field | Verdict (keep | move later | remove) | Reason (needed to create the account, needed for first value, or neither) |
```

## The screen order and the sign-in choice

```text
SCREENS     1: <fields>   2: <fields, only if unavoidable>
SIGN-IN     <one-tap providers, and why>  +  plain email path (always)
VERIFY      <when: before which action>   code sent at once; paste accepted; resend and "use a different email" on the same screen
LATER       <the moved questions, and the moment each is asked>
```

## The error specification (one line per field)

```text
Field: <name>   Trigger: <blur | input | submit>   Message: "<what to do, in the person's words>"
On submit failure: keep all values, scroll to the first error, move focus to its field
```

## The mobile specification

```text
KEYBOARD    <email | telephone | text> per field        AUTOFILL    <autocomplete attributes on>
LABELS      above the field                             BUTTON      reachable with the keyboard open
TARGETS     at least 44 pixels
```

## The brief for ab-test-setup

```text
PRIMARY     <signup start to first value within 24 hours>
GUARDRAIL   <a metric that must not worsen, with its threshold>
CHANGE      <the field or screen cut, in one sentence>
```
