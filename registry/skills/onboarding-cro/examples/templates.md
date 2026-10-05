# Templates

Copy a block and fill every line. A line you cannot fill is a gap: name it and who can close it.

## The activation definition

```text
ACTIVATION   <the first action that predicts retention>, within <window>
EVIDENCE     <why it predicts day-30 use, with the date range>   or: UNCONFIRMED, confirming it is task one
TTV          median <minutes> from signup to activation; <share> never reach it   TARGET <minutes>
```

## The stall map (counts from the same 28 days)

```text
| Step | Reached | Lost against the step before | Share lost |
```

## A change

```text
<n>. <remove | replace | add> <what>   Because <count or evidence>   Moves <metric>   <test: brief to ab-test-setup | just do it>
```

Order: every "remove" before any "add".

## The checklist (only if a stall remains; three to five items)

```text
1. <item toward activation> (<time to do it>)     the first item takes under a minute
2. ...
Progress shown; dismissible.
```

## An empty state

```text
SCREEN     <name>
SHOWS      <a ready sample or a one-click starter that already works>
SAYS       "<what to do next>"
ACTION     <one click>
```

## The events

```text
<event_name>(<properties>), ...        activation event marked
properties on every event: user_id, timestamp, source, device
```
