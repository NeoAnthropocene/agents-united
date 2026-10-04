---
name: agency-brief-and-premises
description: "The lead's first step on a client brief: classify the request and say so aloud, restate it separating what the client said from assumptions, test the premises, offer two or three approaches with a recommendation, and end with a confirmed brief and a next action before any delegation map."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧭
---

# Agency Brief and Premises

## Overview & Purpose
Most agency work that goes wrong went wrong in the first conversation: the request was taken at face value, the real problem was never named, and the team spent a week on the wrong thing. This skill is how Chris, the lead, turns a request into a **brief the client has recognised and corrected**, before any specialist is consulted for a plan or any deliverable is started.

It produces a brief, not a deliverable. The ideas behind it come from two public planning practices (classify the work and gate on approval; challenge the premises and compare alternatives); the wording and the steps are this agency's own.

**The hard gate.** No deliverable file is created or changed, and no specialist is briefed to produce one, until the client has accepted the brief and then the delegation map. Read-only exploration and read-only consultations are allowed.

## Execution Triggers
Load it at the start of a new engagement, whenever a request is ambiguous or high-stakes, and when scope grows in the middle of a run (re-classify). Do not use it for a follow-up task inside a delegation map the client already accepted, or for a trivial one-line request (answer it).

## Input/Output Requirements
Inputs: the client's words as given; any documents (ingest decks and PDFs through the `markitdown` server when connected); what the workspace already holds (earlier reports, the install record); which integrations are callable; constraints the client has stated (date, budget, channels, approval path).

Outputs, in this order, in the conversation and then as one short file only after acceptance: the classification and its reason; the restated brief with three lists (what the client said, what you assume, what is unknown); the premises with the client's agree or disagree on each; two or three approaches with effort, risk and a recommendation; the brief itself (objective, audience, success metric with a number and a date, scope, out of scope, constraints); the client's next action. **Evidence to attach**: where each fact in the brief came from (a sentence of the client's, a document page, a file).

## Step-by-Step Runbook
1. **Classify, and say it aloud.** *Quick*: one deliverable, one specialist, a clear low-risk request: confirm in one message. *Standard*: an audit, a campaign or a funnel fix across two to four specialists: run the whole skill. *Programme*: a launch, a pitch or a relaunch across many roles, a hard deadline or real money: run the whole skill and ask for written acceptance. Write the classification and the reason in the first message ("this looks Standard because it needs growth, copy and QA") so the client can overrule it. When in doubt take the heavier track. Hidden complexity found later upgrades the track and you say so; nothing is downgraded mid-run.
2. **Read before you ask.** Documents, the workspace, the integration state. Do not ask the client what a document already answers.
3. **Restate in three lists.** What the client said (their words, close to verbatim), what you assume to fill gaps, what is unknown. Ask for corrections. An assumption the client does not correct is still an assumption; keep it labelled.
4. **Ask one question at a time**, only the ones that would change the plan: the purpose behind the request, the audience, the metric that would make them call it a success, the date or budget that bounds it, what has already been tried. Prefer two to four plain-language options (`AskUserQuestion`); use the client's vocabulary, not the team's.
5. **Challenge the premises.** Write three to five statements the request depends on ("signups are low because the pricing page confuses people", "paid social is the right channel", "we can launch in three weeks"). Put each to the client as agree or disagree, and for every shaky one name the cheapest check and who would run it (a read-only consultation with Ava or Kaan, a data export). Ask two more questions of the whole request: is this the right problem, and what happens if nothing is done?
6. **Offer two or three approaches.** One **minimal** (the smallest thing that tests the idea), one **ideal** (what you would do with the time and the budget), and, if a different framing exists, one **lateral**. For each: what the client gets, which specialists, effort (S, M or L), the main risk. Then **recommend** one, in a sentence tied to the client's own stated goal. Stop and wait for the choice.
7. **Write the brief and review it with fresh eyes**: any placeholder, any contradiction, any word that two people would read differently ("soon", "more traffic", "premium"), any metric without a number and a date, any scope big enough to split. Fix it before it goes to the client.
8. **Close with the client's next action**: the one thing they must provide or decide this week (a data export, an approval, access). Then continue with the lead's own steps: consult at least one relevant specialist read-only (unless the client waived it), and only then issue the delegation map.
9. **Hand off.** The accepted brief goes to every specialist's brief as the fixed objective; open questions go to the named owner, and Defne sees any brief that involves personal data, consent or claims before work starts.

## Code & Config Exemplars
### Worked example
Client message: "We need more signups for our invoicing tool before the end of the quarter."

Classification (said aloud): **Standard**, because it needs growth analysis, copy and tracking checks, three specialists; not Programme (no launch, no fixed budget stated).

Restated: *You said*: more signups, end of quarter, an invoicing tool. *I assume*: signups means free-plan accounts; the site has analytics. *Unknown*: the current signup number, what has been tried, who can change the site.

Questions (one at a time): "What would make you call this a success: a number of signups, or paying customers?" Answer: paying customers, 40 a month by the end of the quarter, from about 12 today.

Premises put to the client: (1) "Signups are the bottleneck" (disagree, activation is 22 percent per their dashboard); (2) "Paid ads are the right channel" (agree with doubt, no data); (3) "Three people can change the site this month" (agree).

| Approach | What they get | Specialists | Effort | Risk |
|---|---|---|---|---|
| A minimal | a funnel audit and three experiments on activation | Ava, Kaan, Emre | S | low: no new traffic |
| B ideal | A plus a referral loop and an SEO cluster | A plus Selin, Yavuz | L | higher: slower, needs content |
| C lateral | pause acquisition, fix first-run experience only | Kaan, Deniz | M | the client may feel nothing is happening |

Recommendation: **A**, because the stated goal is paying customers and the data shows the leak is after signup. The client accepts A. Brief: objective 40 paying customers a month by 2026-12-31 from 12 now; success metric: paid conversions per month; out of scope: paid acquisition changes; constraint: three people on site changes. Next action for the client: export the funnel counts for the last 28 days by Friday.

### Anti-patterns
- Taking the request at face value and mapping it straight to specialists.
- Five questions in one message.
- Treating a nod to an idea as acceptance of the plan.
- A recommendation with no reason tied to the client's goal.
- Starting a deliverable while the premises are unchecked.
- Labelling a heavy request "Quick" to save a conversation.

## Edge Cases & Error Recovery
- **The client cannot be reached or says "just do it"**: write the brief with every default marked as an assumption, stop at the gate, and say what you will not do without acceptance; a clear, low-risk request becomes a Quick confirmation, never a skipped gate.
- **Two stakeholders disagree**: put the disagreement in the brief as an open question with both names; do not pick silently.
- **The premises turn out false**: say so plainly, change the recommendation, and re-confirm the brief with the client.
- **The request grows during the run**: re-classify, say so, and re-run steps 5 to 7 for the new scope.
- **You were spawned as a subagent**: say so at once and ask your questions in plain prose with numbered options.

## Verification Checklist
- [ ] The classification and its reason were stated to the client in the first message.
- [ ] The brief separates what the client said, what you assume and what is unknown, and the client had the chance to correct it.
- [ ] Every premise has an agree or disagree and, if shaky, a named cheap check and owner.
- [ ] Two or three approaches include a minimal and an ideal one, and the recommendation is tied to the client's goal.
- [ ] Every success metric has a number and a date; the brief contains no placeholder.
- [ ] No deliverable was created or specified for production before acceptance; the next action for the client is named.
