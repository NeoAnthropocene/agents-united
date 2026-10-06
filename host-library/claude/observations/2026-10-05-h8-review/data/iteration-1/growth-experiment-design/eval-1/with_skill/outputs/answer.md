**Test an editor-first onboarding first.** That means new users land straight in a pre-filled invoice editor instead of the dashboard. The biggest leak is between signup and first invoice, and this test fits two dev days a week. Before you build it, spend about half a day on tracking and watching recordings.

I re-read the first 40 lines of the saved file and the funnel table and ICE rows matched. I did not re-read the rest. The figures below are hand-computed from your numbers, not from a calculator.

### Where the funnel leaks
| Stage | Count | Step conversion |
|---|---|---|
| Visits → signups | 41,000 → 6,200 | 15.1% |
| Signups → first invoice created | 1,550 | **25.0%** |
| Created → sent | 930 | 60.0% |
| Sent → active at day 30 | 410 | 44.1% |

- **Main leak:** Three in four signups never make an invoice, about 4,650 people a month. It is the earliest stage with a gap, so I'd fix it before looking at anything later.
- **Visit-to-signup:** 15.1% is unusually high, so check what "visits" counts. I treated it as not the problem.
- **Smaller leaks:** 620 people a month create an invoice and never send it. 520 senders lapse by day 30. Both are too small to test in 14 days at your volume.
- **Paid traffic:** I'd hold off. I can't compute LTV:CAC without your price and churn.
- **Benchmark:** I didn't fetch an external one. The 25–40% bar for a self-serve leak comes from the experiment-design skill I loaded, so treat it as an estimate.

### What to test, in order
| # | Test | ICE |
|---|---|---|
| 0 | Fix tracking, then watch 10 recordings and call 5 people who never made an invoice (about 0.5 dev day). | do first |
| 1 | Land new users in a pre-filled invoice editor. Primary metric: signup → first real invoice within 7 days, 25% → 29% or better. | 7.0 |
| 2 | Nudge emails at 24h and 72h to people with no invoice. | 6.3 |
| 3 | Ask only for client and amount to create an invoice, and collect business details at send. | 6.0 |
| 4 | "Preview what your client sees" plus a reminder for unsent drafts. | 6.0 |

- **Confidence:** I scored every test 5–6 for confidence. Your numbers show where people drop off, not why, and the recordings in step 0 should raise that.
- **One test at a time:** Tests 1–3 hit the same users and the same metric, so they would interfere if run together.
- **Sample size:** About 1,445 signups a week gives roughly 1,445 per arm in 14 days. That detects about +4.6 points (18% relative), so a +5-point target is sized correctly. Results read out around day 21, because of the 7-day window.
- **Guardrails:**
  - **Fake first invoices:** Sample data must not count as a first invoice. The event should fire only once a real client or amount is entered.
  - **Send rate:** The invoice send rate must not drop by more than 3 points.
- **Test 2 may show nothing:** A realistic email lift of 2–3 points is below what the test can detect, so "no detectable effect" is likely. Run it only if it costs under a day.
- **Dev time:** Week 1 is half a day on tracking plus about 1.5 days building test 1. It runs weeks 2–3 while you build test 2. If test 1 takes 3 dev days, launch slips about a week.

I left day-30 retention out of the backlog. At about 215 senders a week, a test can't detect a realistic change in 14 days. Read the tickets from lapsed senders instead. Also check what "active" means, because invoicing is episodic and someone with nothing to bill in month two isn't necessarily gone.

### Questions for you
- What does "visits" count, and what does "active" mean?
- What are your price and churn?
- Do you send any onboarding emails today, and do you have session recordings?
- What were the exact dates of last month's window?

I chose to put the full playbook in the session scratchpad rather than in this repo, which isn't your app. It has the three briefs, the sequencing table and a Chart.js funnel spec.

Peer messages received: none.

Open items:
- I had no task tools, so I left task status to you.
- The briefs name Kaan (copy), Deniz (build), Emre (verify events and sample-ratio checks) and Defne (email consent). Map them to whoever does that work on your team.
- The 1% unsubscribe and 0.1% complaint thresholds in test 2 are my own picks, so adjust them to your norms.

Files are in `C:\Users\ozy\AppData\Local\Temp\claude\C--github-scratch-pilot-h8-skills\95d19e30-be2b-4d40-94c6-eb32fcb605fc\scratchpad`:
- growth-playbook-invoicing-app.md