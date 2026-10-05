# Worked example (an invented page, for checking your own work)

Page: pricing, frames `Pricing / Desktop` and `Pricing / Mobile`, file link in the brief.

## The Definition of Ready check

Three things are missing: the loading and error states for the "Start trial" action are not drawn; the annual toggle has no frame for keyboard focus; the copy for the guarantee line is not final. The handoff goes back to Jamileh and Kaan with the three items before the build; the rest proceeds.

## A spec excerpt

```text
SECTION   hero + plan cards
COMPONENTS  PageHero (existing), PlanCard (new, see ui-component-spec), BillingToggle (extended: add "annual" variant)
LAYOUT    desktop: 12 columns, gutter space.6, cards in a row of 3, section padding space.12 vertical
          mobile (<= 640 px): cards stack in order Starter, Team, Business, section padding space.8
STATES    BillingToggle: default, focus-visible, selected; Start trial: default, loading (max 8 s, then error banner), error
MOTION    price change on toggle: 200 ms fade of the number; reduced motion: instant swap
CONTENT   PageHero props from Kaan (headline <= 60 chars); guarantee line: OPEN QUESTION (Kaan)
TEST IDS  billing-toggle, plan-card-cta-{slug}, trial-error-banner
EVENTS    billing_toggled { period }, plan_selected { plan, position }
OPEN      focus frame for the toggle (Jamileh); guarantee wording (Kaan, then Defne)
```
