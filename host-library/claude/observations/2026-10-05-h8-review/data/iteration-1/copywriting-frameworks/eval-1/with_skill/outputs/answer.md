I wrote the hero copy and saved it, with the claim audit, to `docs/cro/hero-section-copy.md`. I read the first 30 lines back after writing. I haven't type-checked the props.

## Copy

| Slot | Text |
|---|---|
| Headline | Stop chasing late payments. Reminders go out on their own. |
| Subheadline | Create an invoice in about 45 seconds. We remind your client automatically until it's paid. |
| Primary CTA | Send your first invoice free |
| Secondary CTA | See how reminders work |
| Microcopy | Free plan. No card needed. |
| Proof line | In our analysis of 2,300 invoices, 3.1% with reminders were paid late, vs 11% without. |

**Why it's written this way:**
- **Audience:** your freelancers already know late payment is a problem, so there's no pain-point opener. The headline goes straight to what the tool does about it.
- **Proof line:** the 3.1% vs 11% figure is the only hard proof. I worded it as "in our analysis", not as a guarantee.
- **Lean layout:** there's no badge pill above the headline, per the project design rules.

## Typed props

```typescript
export interface HeroSectionProps {
  headline: string;
  subheadline: string;
  primaryCta: { label: string; href: string; testId: string };
  secondaryCta?: { label: string; href: string; testId: string };
  microcopy: string;
  socialProofSnippet: string;
}
```

The filled-in `heroSectionProps` object is in the file. The CTA test IDs are `hero-primary-cta` and `hero-secondary-cta`.

## Open items

- **Claims review:** the 3.1% vs 11% comparison is observational. Users who switched reminders on may differ from those who didn't. That's why I didn't write "reminders cut late payments by 72%". Defne should review the wording, the definition of "late" and the date range before this goes live.
- **The 45-second figure:** I wrote "about 45 seconds" because I don't know if it's a median or a mean, or over what period. Please confirm.
- **"Until it's paid":** please confirm this matches the real reminder cadence and when reminders stop.
- **Links:** the hrefs `/signup` and `#how-reminders-work` are placeholders. I don't know your real signup route, and the secondary link needs a matching section on the page.
- **Voice:** I had no brand copy to match, so I wrote it plainly. Send samples if you want it tuned.
- **A/B test:** I suggest testing a number-led headline against this one, but I can't size it without your baseline conversion rate and weekly traffic. I can write the full brief once I have both.
- **Peers:** Deniz (frontend) should render the props as given and keep touch targets at least 48×48 px with button contrast of at least 4.5:1. I sent no messages and received none.
- **Task list:** I had no task tools, so I haven't updated any task status.