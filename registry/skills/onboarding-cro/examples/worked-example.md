# Worked example (invented numbers, for checking your own work)

A team task tool. Signup 5,000 in 28 days; activation (created a project and added a task within 24 hours) 1,300, so 26 percent; the median time to value for those who activate is 14 minutes.

## The stall map

Signup 5,000; verified email 4,100; finished the 6-question survey 3,000; created a project 1,700; added a task 1,300. The survey loses 1,100 people (27 percent of those who verified) and feeds nothing the first screen uses.

## The changes, in order

1. Move the survey after the first task and ask two questions, one at a time, on the dashboard. Expected to lift activation (an estimate, to be tested).
2. Skip verification until the first invite.
3. The empty project shows a sample project the user can edit.
4. A checklist only if the survey change leaves a stall at "added a task": "Name your project" (30 seconds), "Add your first task", "Invite someone".

## The test brief for change 1

Primary metric: activation within 24 hours of signup. Guardrail: the share of accounts with a company size recorded within 14 days.

Two weeks at about 180 signups a day is enough for a 6-point lift: 16 x 0.26 x 0.74 / 0.06 squared is about 860 per arm, about 1,720 in all, so about 9.5 days at 180 signups a day. An estimate; check it with `ab-test-setup`.

## The events to hand to Deniz

Names are a suggestion; match the product's existing convention.

```text
signup_completed, email_verified, first_project_created, first_task_added(activation),
checklist_item_completed(item), question_answered(question), sample_project_opened
properties on every event: user_id, timestamp, source, device
```
