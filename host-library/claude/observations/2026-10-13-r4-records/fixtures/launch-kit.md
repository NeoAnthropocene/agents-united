# PetPal Launch Kit (DRAFT, scratch exercise, no real client)
Goal event: the reader starts a sitter search. Segment (assumed): launch-list subscribers who opted in and have not searched. No statistics, quotes or customers are used. Domain `petpal.example` is a placeholder.
CTA on every email: "Find a sitter near you" (hero.ts, testId `hero-primary-cta`, href `/search`).
Exit rule (all emails): stop on search start, unsubscribe, reply with a question, or bounce/complaint. Check the goal event at send time.

## Email 1: welcome (day 0)
- Subject: Find a sitter near you before you travel
- Preview: Compare local profiles and message sitters first.
- Body: Hi there, you joined the PetPal launch list, so here is the first step. Compare local pet sitters, read their profiles and message them before you book. No card needed to search.
- CTA: https://petpal.example/search?utm_source=petpal_list&utm_medium=email&utm_campaign=launch_drip&utm_content=email1_welcome

## Email 2: how to compare (day 3)
- Subject: Three things to look for in a sitter profile
- Preview: A quick checklist before you send a message.
- Body: Look at what a sitter says about your kind of pet, how they describe a typical day, and how they answer your first message. Read reviews from other pet owners too.
- CTA: https://petpal.example/search?utm_source=petpal_list&utm_medium=email&utm_campaign=launch_drip&utm_content=email2_compare

## Email 3: offer help (day 7)
- Subject: Not sure where to start? Reply and ask us
- Preview: Reply with your question, or start searching.
- Body: If choosing a sitter feels like a big step, reply with your question. When you are ready, search is free to browse. This is the last email in this series.
- CTA: https://petpal.example/search?utm_source=petpal_list&utm_medium=email&utm_campaign=launch_drip&utm_content=email3_help

## Compliance footer (all emails)
- From: PetPal <hello@petpal.example>, replies monitored (sender identity matches the company).
- Reason: You get this because you joined the PetPal launch list.
- Address: [PLACEHOLDER: PetPal Ltd, 100 Example Street, Sample City, 00000, Country. Replace with the real registered postal address.]
- Unsubscribe: one click, `https://petpal.example/unsubscribe?t={token}`, plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers.
- Rules: no deceptive subjects, no false "Re:", no fake urgency or deadlines. Defne to review.

## Press release (DRAFT, not for release)
- Headline: PetPal Launches a Way to Find and Message Local Pet Sitters Before You Book
- Dateline: [PLACEHOLDER CITY], [PLACEHOLDER DATE] -
