# Worked example (invented numbers, for checking your own work)

Launch of a webhook-retry feature. Source material: the changelog, a measurement (retries now recover 94 percent of failed deliveries in a staging test of 10,000 events; invented here) and one customer quote.

Message: "Failed webhooks now recover on their own." One claim, one proof.

## The matrix

| Platform | Shape | Copy (excerpt) | Asset | CTA |
|---|---|---|---|---|
| X | claim then proof | "Failed webhooks now retry on their own. In a staging test of 10,000 events, 94% recovered with no code on your side." | one chart | link to the guide, UTM tagged |
| LinkedIn | short story | "Last year one of our customers lost a day to a missed webhook. We built retries so the next team does not." | founder photo, no stock image | link, UTM tagged |
| Community forum | post-mortem as a member | "How we designed retry backoff and what we got wrong first" | none | the guide, no sales pitch |
| Short video | result first | 0:00 failed event, 0:04 it retries, 0:10 delivered | screen recording | pinned link |

## The response plan

The campaign brief names the client's support lead as the person who answers technical replies within one working day. "This lost me data" replies escalate to the lead the same day. No post is deleted except for abuse.

## The measurement

Primary metric: guide visits from the campaign UTM. Guardrail: the share of negative replies.

```text
utm_source=<platform> utm_medium=social utm_campaign=webhook-retries utm_content=<post-id>
```
