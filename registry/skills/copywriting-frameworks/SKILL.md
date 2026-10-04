---
name: copywriting-frameworks
description: "Write copy that is specific, supportable and in one voice: start from source material, choose a framework by the reader's state, make one claim per piece, and pass a claim audit and a five-second test before hand-off."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ✍️
disable-slash-command: true
---

# Copywriting Frameworks

## Overview & Purpose
Frameworks (problem-agitate-solve, before-after-bridge, the four-part page story) are scaffolds, not content. Copy fails when the scaffold is filled with adjectives instead of facts from the product, the customer and the numbers. This skill gives Kaan and Yavuz a fixed order of work: source material, voice, one claim, framework, audit.

It writes words. Layout belongs to Jamileh, typed section props to Deniz, tracking to Jale, and what the law allows a claim to say to Defne.

## Execution Triggers
Load it before writing any headline, page section, ad, email or post, and when reviewing copy someone else wrote. Do not use it for UI microcopy inside a product (use `ux-writing`) or for long editorial articles (Yavuz works from a content brief, and uses this for the title, the intro and the call to action).

## Input/Output Requirements
Inputs, asked for rather than invented: the audience and what state they are in (unaware, problem-aware, solution-aware, ready to buy), the offer, three to five true, specific facts about it (numbers, outcomes, constraints, who uses it), real customer language (support tickets, reviews, interview quotes), existing brand or product copy for voice, and the one action the piece should cause.

Outputs: the copy; a one-line statement of the single claim; the framework and why it fits; the voice profile used; a claim audit table; and the **evidence** list: where each fact came from. Typed section props are produced only when the lead asks and Deniz is the consumer.

## Step-by-Step Runbook
1. **Read the source material before you write a word**: product documents, changelog, reviews, the existing page. Collect the exact phrases customers use for their problem. If you have none, say so and mark every audience statement an assumption.
2. **Build a short voice profile from real samples** (five to twenty if they exist): sentence length, how direct claims are, use of numbers, what the brand never says. Reuse it across every piece of the same campaign so the pieces read as one author. With no samples, write plainly and flag that the voice is unconfirmed.
3. **Choose one claim per piece.** A piece that says three things persuades of none. Write it as a sentence a sceptic could check: "Invoices go out in under a minute", not "the fastest invoicing".
4. **Pick the framework by reader state.** Unaware: lead with the situation they recognise, not the product. Problem-aware: problem, cost of the problem, solution (PAS). Solution-aware: contrast with the alternatives and the proof. Ready to buy: remove doubt (price, guarantee, steps, what happens next). Before-after-bridge suits case studies and launches.
5. **Write specific.** Replace every adjective with a number, a name or a mechanism. One call to action, a verb plus the outcome ("Send your first invoice"), never "Learn more" when the next step is a signup.
6. **Cut the banned phrases.** Never write: "game-changer", "revolutionary", "cutting-edge", "seamless", "unlock the power of", "in today's fast-paced world", a closing question that only farms replies, or forced casual tone on a serious channel. Delete them and restate the fact beneath.
7. **Audit before you hand off.** Claim audit: each factual statement has a source or becomes an opinion or is removed. Five-second test on the headline and first screen: who is it for, what does it do, why act now? Cross-channel check: the ad promise matches the page, the subject line matches the body.
8. **Hand off.** Final copy to the requester (Jale for campaign pieces, Jamileh for layout with the hierarchy noted, Deniz as typed props if asked); numerical, comparative or health, finance or earnings claims to Defne before anything is published.

## Code & Config Exemplars
### Worked example
Brief: an invoicing tool for freelancers; audience problem-aware; facts: invoices created in 45 seconds on average (product telemetry, last 30 days), reminders sent automatically, 3.1 percent of invoices are paid late among users with reminders against 11 percent without (internal analysis, sample of 2,300; invented here), no card needed for the free plan.

Weak: "The all-in-one invoicing solution that streamlines your workflow and helps you get paid faster."

Claim: "Freelancers who turn on reminders are paid late far less often." Framework: PAS.

Strong:
```text
Headline:   Chasing late invoices costs you the work you were paid for.
Problem:    Eleven in a hundred invoices arrive late when nobody reminds the client.
Agitate:    Each awkward email is an hour you did not bill.
Solve:      Turn on reminders once. Late invoices fell to three in a hundred for the people who did.
Proof:      Based on 2,300 invoices from users on the free plan, last quarter.
CTA:        Send your first invoice, free (no card).
```
Claim audit: "eleven in a hundred" and "three in a hundred" tie to the internal analysis (needs the source file path in the evidence list); "free (no card)" ties to the pricing page. Hand-off: Jamileh for layout (headline above the fold), Defne to confirm the comparison is substantiated, Jale if it becomes an email.

### Anti-patterns
- Filling a framework with adjectives.
- Three claims in one hero section.
- Inventing a statistic or a testimonial to complete the scaffold.
- Writing before you have read the product or a customer's own words.
- Different voices in the ad, the page and the email.
- A closing question used only to provoke replies.

## Edge Cases & Error Recovery
- **No facts to use**: do not write persuasive copy; return a list of the five facts you need and write only a plain description.
- **A fact you cannot source**: remove it, or print it as the client's belief ("the team believes...") and flag it under Open items.
- **Two audiences in one piece**: split the piece; one audience, one claim.
- **A request for urgency or scarcity that is not real**: refuse the false version, offer the true one (a real date, a real limit) and say why.
- **Voice conflicts with the claim** (a playful brand, a serious number): lead with the number, keep the voice in the rest.

## Verification Checklist
- [ ] One claim per piece, stated in one checkable sentence.
- [ ] Every number, comparison and testimonial has a source in the evidence list, or is flagged as an assumption or removed.
- [ ] The five-second test is answered for the headline and first screen, in writing.
- [ ] No banned phrase remains; one specific call to action.
- [ ] The voice profile used is named; if samples were missing, that is stated.
- [ ] Hand-offs are named (Jale, Jamileh, Deniz, Defne) with what each receives.
