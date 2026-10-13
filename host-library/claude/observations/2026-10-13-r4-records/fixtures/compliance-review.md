# PetPal Launch Compliance Review (scratch exercise, no real client)
Readiness assessment, not legal advice. Items needing counsel are marked [counsel]. Reviewer: Defne.
Inputs read: launch-kit.md, hero.ts, seo-audit.md. Readiness: **major gaps** (2 blockers before any send or publish).

## Findings
| # | Sev | Evidence | Rule at issue | Fix |
|---|---|---|---|---|
| 1 | Blocker | launch-kit.md:27 `Address: [PLACEHOLDER: PetPal Ltd, 100 Example Street...]` | CAN-SPAM: valid physical postal address in every commercial email; CASL requires a mailing address too | Insert the real registered address (or PO box / registered agent) before send; add a send-time check that fails on `PLACEHOLDER` |
| 2 | Blocker | hero.ts:19 `Every sitter is vetted before they can take bookings.`; hero.ts:2 and seo-audit.md:33 admit vetting is unconfirmed | FTC Act s5: objective claims need substantiation before publication | Ops lists the checks actually run; reword to match them (e.g. name the checks) or remove the line. Keep the FAQ "How are sitters vetted?" unpublished until then [counsel] |
| 3 | High | hero.ts:19 and launch-kit.md:13 `Read reviews from other pet owners` | FTC Act s5 / 16 CFR 255: implies reviews exist and are genuine; false if none exist at launch, or if reviews are incentivised or edited | Confirm reviews exist and are genuine at launch; otherwise drop the sentence until they do |
| 4 | High | launch-kit.md:2 segment is "(assumed)... opted in"; no consent record described | CASL express consent and GDPR/ePrivacy consent must be provable; CAN-SPAM needs none but bans harvested lists | Log consent per subscriber (timestamp, source, wording shown); suppress anyone without a record; confirm which regions the list covers [counsel] |
| 5 | Medium | launch-kit.md:28 one-click link and headers specified; no suppression or timing stated | CAN-SPAM: honour opt-out within 10 business days, no fee, no login; CASL also 10 business days | State in the footer spec that opt-out is applied at once to all PetPal marketing sends, and that suppression is permanent; test the link on all 3 emails |
| 6 | Medium | launch-kit.md:25-28 footer: no privacy notice link or controller identity | GDPR Arts 13-14 information duties | Add a privacy policy link and the controller name to the footer; draft policy under docs/compliance/ once facts exist |
| 7 | Low | hero.ts:26 `No card needed to search. Free to browse sitters.`; launch-kit.md:9,21 | FTC Act s5: true only if no fee applies to search | Ops confirms; if booking fees exist, disclose them where booking starts |
| 8 | Low | launch-kit.md:31-33 press release is headline and dateline only | FTC Act s5 on any later claims | Re-review the full release before it ships; no vetting or review claims unless findings 2 and 3 clear |

## What passes (evidence read)
- Subjects (launch-kit.md:7,13,19) match their bodies; no false "Re:", no urgency (rule line 29).
- From identity `PetPal <hello@petpal.example>` with monitored replies (line 25); reason-for-receipt line present (line 26).
- All CTAs are commercial and clearly so; Email 3 says it is the last in the series (line 21).
- No testimonials, statistics or named customers are used (line 2), so 16 CFR 255 endorsement disclosure is not triggered by the copy read.
- seo-audit.md:13,33 correctly withholds the vetting answer until confirmed.

## Not checked
Rendered emails and real headers (`List-Unsubscribe`, SPF/DKIM/DMARC), the unsubscribe endpoint, consent records, the list's regions, the vetting process, the review system, the press release body, any privacy policy, and sender-platform settings. Placeholders and assumptions in the inputs were taken as stated.
