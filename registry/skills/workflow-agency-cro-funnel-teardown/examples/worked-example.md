# Worked example (invented numbers, for checking your own work)

A course checkout. Funnel: pricing 7,360, checkout started 1,470 (20 percent), paid 590. Mobile 11 percent, desktop 28 percent; paid social 9 percent, organic 27 percent.

## The delegation map

```text
S1 Ava     bottleneck: pricing -> checkout on mobile paid social
S2 Kaan    findings: F1 S2 plan button below a 900 px table on mobile; F2 S2 ad promises a free lesson not shown; F3 S3 phone field with no reason
S2 Emre    walk-through at 375 px: confirms F1 (screenshot), finds the checkout error banner never clears (S1, new)
S3 Deniz   fix F1 and the S1 banner; test ids; S3 Jamileh: layout spec for F1; Kaan: copy for F2 as props
S3 Ava     experiment queue: F3 as the test; Kaan briefs with ab-test-setup (primary: checkout completion)
S4 Emre    re-walk and events; Defne: consent text for the phone field
```

## How to read it

F1, F2 and the new S1 banner are fixes, not experiments, so they go to the builders first (S1 and S2 findings are fixed, never tested). Only F3, an S3 finding, becomes an experiment, and its brief carries a decision rule written before launch. Emre walks the flow before and after, and Defne sees the consent text of the phone field before it ships.
