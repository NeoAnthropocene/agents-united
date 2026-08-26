---
name: ad-attribution-modeling
description: Production-grade Ad Attribution Modeling playbook for multi-touch
  attribution (MTA), ROAS/CAC calculation, marketing mix modeling (MMM), and
  Server-to-Server Conversions API integration.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🎯
disable-slash-command: true
---

# Multi-Touch Ad Attribution Modeling & ROAS/CAC Analytics Engine

## Overview & Purpose
The Ad Attribution Modeling skill provides a mathematical and technical framework for calculating marketing ROI across multi-touch buyer journeys.

Following this skill implements Multi-Touch Attribution models (First-Touch, Last-Touch, Linear, U-Shaped, W-Shaped, Data-Driven/Algorithmic), Server-to-Server Conversions API pipelines (Meta CAPI, Google Enhanced Conversions) to bypass browser ad-blockers, and Blended vs. Paid CAC reconciliation across cohort payback windows.

## Execution Triggers & Prerequisites
### Execution Triggers
- Resolving attribution discrepancies between Google Ads, Meta Ads, and Stripe/CRM revenue.
- Deploying Server-Side Conversions API (CAPI) to combat iOS ATT tracking signal loss.
- Evaluating channel efficiency across complex multi-channel buyer touchpoints.
- Calculating cohort-level customer acquisition payback periods and LTV:CAC ratios.

### Prerequisites
- Event telemetry pipeline (Segment, RudderStack, PostHog, or custom event stream).
- Server-side ad platform credentials (Meta Pixel Access Token, Google Conversion API tokens).
- Transaction ledger or billing database access (Stripe API, PostgreSQL orders table).
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `touchpoint_events` | Array<Object> | Yes | Stream of user interaction events with UTM parameters |
| `conversion_events` | Array<Object> | Yes | Completed purchase/signup events with revenue value |
| `channel_ad_spend` | Object | Yes | Cost breakdown by channel for the observation period |
| `attribution_model` | String | Optional | Model: `first_touch`, `last_touch`, `linear`, `u_shaped`, `w_shaped` |
| `lookback_window_days`| Number | Optional | Attribution lookback window in days (default: 30) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Attribution Spec Document | `docs/ad-attribution-modeling/attribution-spec.md` | Model formulas, lookback definitions, CAPI specs |
| Attribution Engine Module | `src/analytics/attribution-engine.ts` | Multi-touch weighting and calculations |
| Server CAPI Dispatcher | `src/analytics/server-capi-dispatcher.ts` | Server-to-server conversion event sender |
| Channel ROAS Report | `reports/ad-attribution-modeling/roas-summary.json` | Attribution weights, ROAS, and CAC by channel |

## Step-by-Step Execution Runbook

### Phase 1: Touchpoint Event Telemetry & Server-Side Ingestion Setup
1. Ingest raw customer session touchpoint streams (First Visit, Organic Search, Paid Click, Newsletter Open, Trial Signup, Purchase).
2. Standardize touchpoint schemas: extract `userId`, `anonymousId`, `timestamp`, `channel`, `campaign`, `adId`, `landingPage`.
3. Filter out bot traffic, internal testing IP addresses, and invalid referrers.
4. Persist touchpoint history in structured analytical storage keyed by resolved customer identity.

### Phase 2: Attribution Model Algorithm Selection & Weight Formulation
1. Formulate mathematical weight distribution algorithms:
   - **First-Touch**: 100% weight to initial discovery channel.
   - **Last-Touch**: 100% weight to final pre-conversion interaction.
   - **Linear**: Equal distribution across all $N$ touchpoints ($1/N$).
   - **U-Shaped**: 40% First-Touch, 40% Lead Creation Touch, 20% split across intermediate touches.
   - **W-Shaped**: 30% First-Touch, 30% Lead Creation, 30% Opportunity Creation, 10% intermediate touches.
2. Apply lookback window filtering (discard touchpoints older than 30 or 90 days before conversion).

### Phase 3: Multi-Touch Conversion Path Calculation & Blended Metric Synthesis
1. Execute multi-touch weighting calculations across all cohort conversion paths.
2. Aggregate attributed revenue per channel: $\text{Attributed Revenue} = \sum (\text{Order Value} \times \text{Touchpoint Weight})$.
3. Compute channel-specific ROAS: $\text{ROAS} = \text{Attributed Revenue} / \text{Channel Ad Spend}$.
4. Compute Blended CAC vs Paid CAC:
   - $\text{Blended CAC} = \text{Total Marketing Spend} / \text{Total New Customers}$
   - $\text{Paid CAC} = \text{Paid Ad Spend} / \text{Paid Attributed Customers}$

### Phase 4: Server-to-Server Conversions API (CAPI) Pipeline Deployment
1. Implement server-side dispatch worker capturing server-verified conversions (e.g. Stripe checkout completed).
2. Hash customer PII identifiers (email, phone, name) using SHA-256 before transmission.
3. Attach shared `event_id` and browser `fbp`/`fbc` cookies to enable ad platform deduplication with client pixels.
4. Dispatch payload to Meta Conversions API and Google Ads Enhanced Conversions endpoints.

### Phase 5: Cohort LTV/CAC Payback Window Auditing & Executive Reporting
1. Calculate cohort payback period: $\text{Payback Months} = \text{CAC} / (\text{ARPU} \times \text{Gross Margin \%})$.
2. Generate executive attribution summary report at `reports/ad-attribution-modeling/roas-summary.json`.
3. Highlight underperforming channels where CAC exceeds LTV / 3 payback threshold.
4. Commit attribution analytics engine to repository.
   ```bash
   git add src/analytics/ docs/ad-attribution-modeling/
   git commit -m "feat(ad-attribution-modeling): implement multi-touch attribution and server CAPI engine"
   ```

## Code & Configuration Exemplars

### Exemplar 1: TypeScript Multi-Touch Attribution Engine
```typescript
export interface Touchpoint {
  channel: string;
  timestamp: number;
}

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'u_shaped';

export function calculateAttributedWeights(
  touchpoints: Touchpoint[],
  model: AttributionModel
): Record<string, number> {
  const result: Record<string, number> = {};
  const n = touchpoints.length;
  if (n === 0) return result;

  touchpoints.forEach(t => { result[t.channel] = (result[t.channel] || 0); });

  if (n === 1 || model === 'first_touch') {
    result[touchpoints[0].channel] += 1.0;
    return result;
  }
  if (model === 'last_touch') {
    result[touchpoints[n - 1].channel] += 1.0;
    return result;
  }
  if (model === 'linear') {
    const weight = 1.0 / n;
    touchpoints.forEach(t => { result[t.channel] += weight; });
    return result;
  }
  if (model === 'u_shaped') {
    if (n === 2) {
      result[touchpoints[0].channel] += 0.5;
      result[touchpoints[1].channel] += 0.5;
    } else {
      result[touchpoints[0].channel] += 0.4;
      result[touchpoints[n - 1].channel] += 0.4;
      const middleWeight = 0.2 / (n - 2);
      for (let i = 1; i < n - 1; i++) {
        result[touchpoints[i].channel] += middleWeight;
      }
    }
    return result;
  }
  return result;
}
```

### Exemplar 2: Server-Side Meta CAPI Conversion Dispatcher
```typescript
import crypto from 'node:crypto';

export interface CapiConversionPayload {
  eventName: string;
  eventId: string;
  eventTime: number;
  userEmail: string;
  value: number;
  currency: string;
}

export function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function formatMetaCapiPayload(payload: CapiConversionPayload, pixelId: string) {
  return {
    data: [
      {
        event_name: payload.eventName,
        event_time: payload.eventTime,
        event_id: payload.eventId,
        user_data: {
          em: [hashSha256(payload.userEmail)],
        },
        custom_data: {
          currency: payload.currency,
          value: payload.value,
        },
        action_source: 'website',
      },
    ],
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Duplicate Conversion Reporting between Browser Pixel and Server CAPI
1. **Diagnosis**: Ad platform counts purchase event twice, inflating reported ROAS by 100%.
2. **Recovery Protocol**:
   - Step 1: Verify `event_id` string parity between client-side pixel event and server-side CAPI payload.
   - Step 2: Ensure timestamps on both dispatches are within platform deduplication window (under 48 hours).
   - Step 3: Inspect Meta Events Manager deduplication diagnostics to confirm 100% deduplication rate.

### Scenario B: Orphaned Touchpoint Sessions Due to Cross-Domain Redirects
1. **Diagnosis**: UTM parameters lost when user redirects from marketing landing page to auth/checkout subdomain.
2. **Recovery Protocol**:
   - Step 1: Implement first-party cookie persistence storing original UTM touchpoint for 30 days.
   - Step 2: Append persistent anonymous session ID across cross-domain link anchors.
   - Step 3: Re-stitch orphaned checkout sessions using server-side anonymous ID lookup.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Multi-touch models (Linear, U-Shaped, W-Shaped) formulated with exact math.
- [ ] Server-Side CAPI integration with SHA-256 PII hashing detailed.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
