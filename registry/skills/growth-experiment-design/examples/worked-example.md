# Worked example (invented numbers, for checking your own work)

A freelancer invoicing tool with 6,200 signups a month. Funnel for the last 28 days: visit 41,000; signup 6,200 (15.1 percent); created a first invoice 1,550 (25.0 percent of signups); sent it 930 (60.0 percent of those who created one); day-30 active 410.

## The leak

Signup to first invoice is 25.0 percent against a self-serve benchmark of 35 to 40 percent (the playbook must name the source and the date). Acquisition is not the problem: do not recommend paid spend.

## The ranked backlog

| Rank | Experiment | Hypothesis | I | C | E | ICE |
|---|---|---|---|---|---|---|
| 1 | Pre-filled sample invoice on the first screen | Because 7 of 10 recordings show users leaving the blank invoice form, we believe a sample will lift first invoice from 25 to 30 percent within 14 days | 9 | 6 | 8 | 7.7 |
| 2 | Skip the company-profile step until after the first invoice | Because the profile step loses 22 percent of signups, removing it will lift activation by 4 points | 7 | 7 | 6 | 6.7 |
| 3 | Day-1 email with a one-click "send your first invoice" link | Because 38 percent open the welcome email and nothing in it asks for the action | 5 | 5 | 9 | 6.3 |

Why the scores: rank 1 moves the stage from 25 to 30 percent, which is 20 percent relative (Impact 9 to 10 band; scored 9 because the sample may not hold for everyone), its evidence is qualitative (Confidence 4 to 6) and it is a front-end change (Ease 7 to 8). Rank 2 is 4 points on 25, 16 percent relative (Impact 6 to 8), with a number from this funnel behind it (Confidence 7 to 8).

## The brief for rank 1

Primary metric: signups to first invoice within 24 hours. Guardrail: invoices sent within 7 days must not fall by more than 3 percent relative.

Traffic: 6,200 signups a month is about 1,430 a week, so two weeks give about 1,430 per arm. Detecting 5 points on a 25 percent base needs about 1,200 per arm (16 x 0.25 x 0.75 / 0.05 squared; an estimate, check it with `ab-test-setup`), so the test fits in 14 days.

Decision rule: ship at 30 percent or more with the guardrail holding. Owners: Kaan for copy, Deniz for the build, Emre to verify that the events fire.

## The log entry that follows it

```text
EXP-014 | 2026-10-04 | sample invoice on first screen
Hypothesis: ... | Primary: first invoice within 24h | Guardrail: invoices sent in 7 days
Result: 25.1 to 29.4 percent, n = 1,450 per arm | Decision: iterate (below the 30 percent bar, guardrail held)
Learning: the sample is read, but users edit the amounts; next, prefill from their last client.
```
