---
name: agency-brief-and-premises
description: "Use when a new client engagement starts, a request is ambiguous or high-stakes, or scope grows mid-run; trigger phrases: we need more signups, here is the client brief, new engagement from this client, the scope just changed. Produces the classification said aloud, the restated brief in three lists, the premises with the client's agree or disagree, two or three approaches with a recommendation, the accepted brief and the client's next action, before any delegation map. Skip it for a follow-up task inside an accepted map and for a trivial one-line request (answer it)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🧭
---

# Agency Brief and Premises

Most agency work that goes wrong went wrong in the first conversation: the request was taken at face value and the team spent a week on the wrong thing. This turns a request into a **brief the client has recognised and corrected** before any specialist plans or any deliverable starts. The method is this agency's own, from the ideas of two public planning practices (classify and gate; challenge premises and compare alternatives).

**The hard gate.** No deliverable file is created or changed, and no specialist is briefed to produce one, until the client has accepted the brief and then the Delegation map. Read-only exploration and read-only consultations are allowed.

## Overview & Purpose
Chris runs it first on every engagement. It produces a brief, never a deliverable.

## Execution Triggers
Load it at the start of a new engagement, when a request is ambiguous or high-stakes, and when scope grows mid-run (re-classify). Do not use it for a follow-up task inside an accepted map, or for a trivial one-line request (answer it).

## Input/Output Requirements
Inputs: the client's words as given; documents (via `markitdown` when connected); what the workspace holds; callable integrations; stated constraints (date, budget, channels, approval path).

Output, in order, in the conversation and as one short file only after acceptance: the classification and its reason; the restated brief (three lists); the premises with agree or disagree; two or three approaches with a recommendation; the brief (objective, audience, success metric with a number and a date, scope, out of scope, constraints); the client's next action. Shapes: [examples/brief-template.md](examples/brief-template.md). **Evidence to attach**: where each fact in the brief came from.

## Step-by-Step Runbook
1. **Classify, and say it aloud** in the first message, with the reason, so the client can overrule it: Quick, Standard or Programme ([references/tracks.md](references/tracks.md)). In doubt take the heavier track; never downgrade mid-run.
2. **Read before you ask**: documents, the workspace, the integration state; never ask what a document answers.
3. **Restate in three lists**: what the client said (near verbatim), what you assume, what is unknown. An uncorrected assumption is still an assumption: keep it labelled.
4. **Ask one question at a time**, only those that would change the plan (purpose, audience, the success metric, date or budget, what was tried), as two to four plain options (`AskUserQuestion`).
5. **Challenge the premises**: three to five statements the request depends on, each put to the client as agree or disagree; for each shaky one, the cheapest check and who runs it. Ask too: is this the right problem?
6. **Offer two or three approaches**: a **minimal** one (the smallest thing that tests the idea), an **ideal** one and, if another framing exists, a **lateral** one; each with what the client gets, which specialists, effort (S, M, L) and the main risk. **Recommend** one in a sentence tied to the client's goal, then wait.
7. **Write the brief and reread it**: no placeholder, contradiction, ambiguous word ("soon", "premium"), metric without a number and a date, or scope big enough to split.
8. **Close with the client's next action**, the one thing to provide or decide this week. Then the lead's own steps: consult a specialist read-only (unless waived), and only then issue the Delegation map.
9. **Hand off.** The accepted brief is the fixed objective in every specialist's brief; open questions go to a named owner; Defne sees any brief with personal data, consent or claims first.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a Standard engagement from the client's message to the accepted brief: classification, three lists, premises, approaches, recommendation.

Anti-patterns, each with its reason:
- The request mapped straight to specialists: the real problem is never named.
- Five questions in one message: none is answered well.
- A nod at an idea taken as acceptance: the gate is the yes to the brief, then to the map.
- A recommendation with no reason tied to the goal: it is a preference.

## Edge Cases & Error Recovery
- **The client cannot be reached or says "just do it"**: write the brief with every default marked an assumption and stop at the gate; a clear low-risk request becomes a Quick confirmation, never a skipped gate.
- **Two stakeholders disagree, or a premise proves false**: record it as an open question with both names; if a premise is false, change the recommendation and re-confirm.
- **The request grows, or you were spawned as a subagent**: re-classify and redo steps 5 to 7; as a subagent, ask in plain prose with numbered options.

## Verification Checklist
- [ ] The classification and its reason were stated to the client in the first message.
- [ ] The brief separates what the client said, what you assume and what is unknown.
- [ ] Every premise has an agree or disagree and, if shaky, a cheap check with an owner.
- [ ] The approaches include a minimal and an ideal one; the recommendation is tied to the client's goal.
- [ ] Every metric has a number and a date; no deliverable was created before acceptance; the client's next action is named.
