---
name: churn-prevention-playbook
description: Production-grade Churn Prevention Playbook for customer health scoring, early warning detection, automated retention workflows, and exit survey salvage offers.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Customer Churn Prevention Playbook & Retention Automation

## Overview & Purpose
The Churn Prevention Playbook provides an enterprise framework for detecting at-risk customer accounts, executing automated retention interventions, and mitigating voluntary and involuntary subscription churn in SaaS businesses.

Following this skill models multi-factor customer health scores (login frequency, feature depth, support ticket sentiment, billing status), orchestrates proactive automated interventions, structures cancellation exit flows with tailored salvage offers, and automates smart dunning for failed recurring payments.

## Execution Triggers & Prerequisites
### Execution Triggers
- Monthly customer or revenue churn rate exceeding target threshold (> 2.0% monthly MRR churn).
- Customer health score declining into the "At Risk" tier (< 50/100).
- User initiating subscription cancellation flow in billing settings.
- Payment gateway returning invoice charge failures (`invoice.payment_failed`).

### Prerequisites
- Billing gateway integration (Stripe, Chargebee, Paddle).
- User product analytics tracking login timestamps and key feature usage events.
- In-app notification and email outreach communication channels.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `health_score_weights` | Object | Yes | Weights for usage, logins, tickets, seat utilization |
| `at_risk_threshold` | Number | Optional | Score cutoff for at-risk classification (default: 50) |
| `salvage_discount_rules`| Array<Object> | Yes | Exit flow offer policies (e.g. 50% off 2 months, pause plan) |
| `dunning_retry_schedule`| Array<Number> | Optional | Retry delays in days: `[1, 3, 5, 7]` |
| `cancellation_reasons` | Array<String> | Yes | Categorized exit survey reasons |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Retention Strategy Spec | `docs/churn-prevention-playbook/retention-spec.md` | Health scoring models, salvage offers, dunning rules |
| Health Score Engine | `src/services/retention/HealthScoreCalculator.ts` | Multi-factor health score calculation algorithm |
| Stripe Webhook Handler | `src/api/webhooks/stripe-retention-handler.ts` | Dunning and cancellation event processor |
| Cohort Churn Report | `reports/churn-prevention-playbook/churn-analysis.json` | Gross vs Net MRR churn and salvage conversion rate |

## Step-by-Step Execution Runbook

### Phase 1: Customer Health Score Algorithm & Early Warning Telemetry
1. Formulate composite Customer Health Score formula ($0 - 100$):
   $$\text{Health Score} = 0.35 \times \text{Usage Velocity} + 0.25 \times \text{Login Frequency} + 0.20 \times \text{Seat Utilization} + 0.20 \times \text{Support Sentiment}$$
2. Classify customer accounts into 3 tiers:
   - Green (Healthy): Score 75 - 100 (prime candidates for expansion/upsell).
   - Yellow (Neutral / Stagnant): Score 50 - 74 (needs proactive engagement).
   - Red (At-Risk): Score < 50 (immediate retention trigger).
3. Schedule daily cron job calculating health score across all active accounts.

### Phase 2: Proactive Automated Intervention & Re-Engagement Triggers
1. Trigger automated re-engagement playbook when an account drops into Red (< 50):
   - Trigger 1: Send personalized "How can we help?" email from Customer Success Lead.
   - Trigger 2: Display in-app banner offering 1-on-1 workflow optimization call.
   - Trigger 3: Alert dedicated account executive in Slack/CRM if account ARR > $5,000.
2. Provide curated feature recommendation guides matching the account's unutilized modules.

### Phase 3: Cancellation Exit Flow & Salvage Offer Deflection Architecture
1. Design multi-step cancellation flow in account billing settings:
   - Step 1: Categorized exit survey (Cost, Missing Feature, Buggy/Hard to Use, Not Using Enough, Switching).
   - Step 2: Dynamic salvage deflection offer matched to selected reason:
     - Reason "Too Expensive" -> Offer 50% discount for next 3 billing cycles.
     - Reason "Not using enough right now" -> Offer 1-click 60-day Subscription Pause.
     - Reason "Missing Feature" -> Connect directly to Product Roadmap & Beta access.
   - Step 3: Final confirmation with loss aversion reminder (e.g. "You will lose access to 14 active agent workflows").

### Phase 4: Involuntary Churn & Smart Dunning Payment Retry Engine
1. Listen for Stripe `invoice.payment_failed` webhook events.
2. Trigger automated dunning sequence:
   - Day 0: Soft decline email prompting credit card update + in-app billing grace period banner.
   - Day 3: Smart retry attempt 1 via payment gateway.
   - Day 5: Urgent payment failed notice + SMS / push notification.
   - Day 7: Final retry attempt before account downgrade to free tier.
3. Keep user workspace read-only during 14-day grace period to prevent data loss and encourage reactivation.

### Phase 5: Post-Churn Exit Survey Analysis & Win-Back Cadence
1. Log all completed cancellations with full survey metadata into analytics warehouse.
2. Enroll cancelled accounts into automated 60-day win-back nurture sequence:
   - Day 30: Product update newsletter featuring major newly shipped features.
   - Day 60: Exclusive reactivation incentive offer ($100 credit on restart).
3. Generate monthly churn cohort report at `reports/churn-prevention-playbook/churn-analysis.json`.
4. Commit churn prevention engine to repository.
   ```bash
   git add src/services/retention/ docs/churn-prevention-playbook/
   git commit -m "feat(churn-prevention-playbook): implement customer health score and retention automation"
   ```

## Code & Configuration Exemplars

### Exemplar 1: TypeScript Customer Health Score & Risk Classifier
```typescript
export interface AccountTelemetry {
  accountId: string;
  daysSinceLastLogin: number;
  monthlyWorkflowRuns: number;
  seatsUsed: number;
  seatsPurchased: number;
  openNegativeTickets: number;
}

export function calculateCustomerHealthScore(telemetry: AccountTelemetry): { score: number; tier: 'green' | 'yellow' | 'red' } {
  // Login factor (0-100)
  const loginScore = Math.max(0, 100 - (telemetry.daysSinceLastLogin * 10));
  // Usage factor (0-100)
  const usageScore = Math.min(100, telemetry.monthlyWorkflowRuns * 5);
  // Seat utilization factor (0-100)
  const seatScore = telemetry.seatsPurchased > 0 ? (telemetry.seatsUsed / telemetry.seatsPurchased) * 100 : 50;
  // Support sentiment penalty
  const supportPenalty = telemetry.openNegativeTickets * 20;

  const rawScore = (0.35 * usageScore) + (0.25 * loginScore) + (0.20 * seatScore) + 20 - supportPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let tier: 'green' | 'yellow' | 'red' = 'green';
  if (score < 50) tier = 'red';
  else if (score < 75) tier = 'yellow';

  return { score, tier };
}
```

### Exemplar 2: Stripe Billing Webhook & Dunning Handler
```typescript
export interface StripeInvoiceEvent {
  id: string;
  customer: string;
  attempt_count: number;
  amount_due: number;
}

export async function handleInvoicePaymentFailed(event: StripeInvoiceEvent): Promise<string> {
  const { customer, attempt_count, amount_due } = event;
  console.log(`[Dunning] Payment failed for customer ${customer}, attempt #${attempt_count}, amount: $${amount_due / 100}`);

  if (attempt_count === 1) {
    // Dispatch immediate soft dunning notification
    return 'dunning_soft_notification_sent';
  } else if (attempt_count >= 4) {
    // Final failure: transition account to grace period / read-only
    return 'account_restricted_grace_period';
  }
  return 'retry_scheduled';
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Repeated Dunning Retries Triggering Customer Bank Card Blocks
1. **Diagnosis**: Firing payment retries too rapidly (e.g. multiple times in 24 hours) triggers bank fraud flags.
2. **Recovery Protocol**:
   - Step 1: Enforce exponential backoff retry schedule (Days 1, 3, 5, 8).
   - Step 2: Check card decline codes (`insufficient_funds` vs `stolen_card` vs `expired_card`); do not retry stolen cards.
   - Step 3: Prompt user for alternative payment method (PayPal, secondary card, ACH).

### Scenario B: Cancellation Deflection Discount Exploited by Active Customers
1. **Diagnosis**: Paying customers discover that visiting cancellation page awards automatic 50% discount.
2. **Recovery Protocol**:
   - Step 1: Limit discount salvage offers to accounts that have never received a discount in the prior 12 months.
   - Step 2: Require a minimum 3-month account age before discount offers are unlocked in the cancellation modal.
   - Step 3: Implement admin logging and threshold alerts if salvage claim rate exceeds 15% of cancellation attempts.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Customer Health Score formula and Red/Yellow/Green tier cutoffs defined.
- [ ] Exit flow salvage deflection logic and smart dunning retry engine detailed.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
