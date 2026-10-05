# Worked example (an invented component, for checking your own work)

Component: `PlanCard` on a pricing page.

## Purpose and anti-purpose

Show one plan with its price and one action. Not for comparing plans: that is the comparison table.

## Anatomy

Container (`surface.default`, `radius.lg`), plan name (`text.default`, heading 3), price (`text.default`, heading 1), billing note (`text.muted`), feature list, primary action.

## Props

```ts
export interface PlanCardProps {
  name: string;                 // 1 to 24 characters
  priceMonthlyCents: number;    // integer, >= 0; 0 renders "Free"
  billingNote?: string;         // 0 to 60 characters
  features: readonly string[];  // 3 to 7 items, each up to 80 characters
  highlighted?: boolean;        // default false; adds a "Most chosen" badge, never colour alone
  ctaLabel: string;             // verb plus outcome, up to 28 characters
  onSelect: () => void;
}
```

## States

- default;
- hover: the action darkens one step;
- focus-visible: a 2 px outline, 3 to 1 against the card;
- loading: the action shows a spinner and `aria-busy`, stays focusable, and cannot double submit;
- disabled when the plan is the current plan: label "Your plan", `aria-disabled`.

No empty state: features are required.

## Keyboard, names, hooks and responsive rules

- Keyboard: Tab reaches the action; Enter and Space activate it.
- Accessible name of the action: `"{ctaLabel}, {name} plan"`.
- Test ids: `plan-card-{slug}`, `plan-card-cta-{slug}`.
- Event: `plan_selected` with `{ plan, price_cents, position }`.
- Responsive: cards stack at 375 px, the target is 44 px high, long feature text wraps and never truncates.

## Open question

For Kaan: the maximum length of the billing note in German.
