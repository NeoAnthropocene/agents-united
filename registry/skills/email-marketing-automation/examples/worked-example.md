# Worked example (invented numbers, for checking your own work)

A SaaS tool with 18,000 contacts, sending from a shared service. The complaint rate is 0.18 percent (from the dashboard export the client attached). DMARC is at `p=none` and no reports have been reviewed.

## Findings

The complaint rate is above the 0.1 percent warning line; activation emails still go to people who activated; there is no cap across flows.

## The plan

1. The client's IT verifies SPF and DKIM alignment and begins reading DMARC reports for two weeks, then moves to `p=quarantine`.
2. Suppress anyone with the activation event from the onboarding flow. Evidence: a check on a sample of 50 recipients.
3. A cap of one marketing email in 24 hours and three a week across all flows; activation beats win-back.
4. Win-back runs only for users inactive for 30 days: two emails, exit on any login.

## The win-back flow, as a spec

```text
FLOW   win-back
TRIGGER no login for 30 days AND plan = free or trial AND not suppressed
EXIT    login | upgrade | unsubscribe | complaint
STEP 1  day 0,  send 09:30 local, subject <=50 chars, one CTA "Open your workspace"
STEP 2  day 5,  only if no login, one CTA "Tell us what stopped you" (reply-to monitored)
CAP     max 1 marketing email / 24h, 3 / week across all flows; priority activation > win-back > promo
FOOTER  postal address, visible unsubscribe, one-click header, sender identity (see the footer checklist)
```
