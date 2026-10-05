# Authentication, deliverability and footer checklists

The detail behind runbook steps 1 and 6. If you cannot see a record or a header, say so and make verifying it the first task, with an owner (Deniz, or the client's IT).

## Authentication checklist

- [ ] SPF is published for the sending domain and covers the email service in use.
- [ ] DKIM signs the mail and aligns with the visible From domain.
- [ ] A DMARC policy is published. Start at monitoring (`p=none`), read the reports (for example for two weeks), and move to enforcement (`p=quarantine`, then stricter) once the reports are clean.
- [ ] Bulk mail carries the one-click unsubscribe header (RFC 8058) as well as a visible unsubscribe link.

## Thresholds

| Signal | Reading |
|---|---|
| Spam-complaint rate above 0.1 percent | a warning: tighten the audience before the copy |
| Spam-complaint rate above 0.3 percent | an emergency: recommend pausing promotional flows (the lead decides), keep transactional mail |
| Hard bounces above about 2 percent | remove hard bounces, check the list source, never re-send to old addresses |

Large mailbox providers require authentication, one-click unsubscribe and a low complaint rate from bulk senders.

## Compliance footer checklist (per message)

- [ ] The sender's postal address.
- [ ] A visible unsubscribe link, and the one-click header.
- [ ] The sender's identity, a name a person recognises, with a reply-to that is monitored.
- [ ] Four UTM fields on every link: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`.

What the law requires for a given region is not in this list: consent and regional questions go to Defne.
