---
name: viral-referral-loops
description: Production-grade Viral Referral Loops playbook for double-sided
  incentive architectures, K-factor viral loop equations, in-app share
  mechanics, and fraud-resistant referral engines.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🔄
disable-slash-command: true
---

# Viral Referral Loops & Product-Led Organic Expansion Architecture

## Overview & Purpose
The Viral Referral Loops skill provides a comprehensive mathematical and product engineering framework for designing, implementing, and scaling high-velocity referral loops in product-led growth (PLG) SaaS platforms.

Following this skill designs double-sided reward incentives, contextual trigger timing (leveraging the peak-end rule and satisfaction milestones), seamless modal and clipboard share interactions, server-side fraud prevention mechanisms, and mathematical tracking of viral coefficient ($K$-factor) and cycle time ($c_t$).

## Execution Triggers & Prerequisites
### Execution Triggers
- Designing customer referral programs to lower blended Customer Acquisition Cost (CAC).
- Engineering viral product loops (collaboration invites, public share links, powered-by badges).
- Optimizing referral conversion rates from invitation sent to referee account activation.
- Implementing fraud detection rules for self-referrals and reward gaming.

### Prerequisites
- Product analytics tracking user engagement events and milestone completions.
- Relational database schema supporting referral links, attribution tokens, and ledger credits.
- Transactional email / notification service for sending referee invitation alerts.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `incentive_type` | String | Yes | `double_sided_credit`, `extended_trial`, `feature_unlock`, `revenue_share` |
| `referrer_reward` | Number | Yes | Value granted to existing user upon successful referee activation |
| `referee_reward` | Number | Yes | Value granted to invited user upon signup |
| `target_k_factor` | Number | Optional | Target viral coefficient (e.g. 0.35) |
| `qualification_criteria`| String | Yes | Milestone referee must hit before reward is unlocked (e.g. `first_project_run`) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Viral Loop Spec Spec | `docs/viral-referral-loops/referral-spec.md` | Formulas, user journey diagrams, reward tiers |
| Referral Modal Component | `src/components/referral/ReferralModal.tsx` | Share links, social intents, reward tracker |
| Referral Engine Service | `src/services/growth/referral-engine.ts` | Token generation, attribution, fraud validation |
| Viral Analytics Report | `reports/viral-referral-loops/k-factor-summary.json`| $K$-factor, cycle time, and invite conversion stats |

## Step-by-Step Execution Runbook

### Phase 1: Mathematical Modeling & Double-Sided Incentive Structuring
1. Formulate the Viral Coefficient equation:
   $$K = i \times c$$
   where $i$ is the average number of invitations sent per user, and $c$ is the conversion rate of each invitation into an active user.
2. Formulate the Viral Cycle Time ($c_t$) minimization target: reducing the time from user signup to sending invitations directly multiplies organic user growth rate.
3. Structure double-sided reward mechanics: align incentives so both parties win (e.g. "$25 in API credits for you, $25 for your friend upon their first build").
4. Establish reward qualification thresholds: require referees to achieve a meaningful product action before distributing credits to eliminate bot abuse.

### Phase 2: Contextual In-App Trigger Identification
1. Identify high-satisfaction moments in the product journey to present referral prompts:
   - Immediately after completing a successful build or workflow run.
   - Upon receiving a positive NPS/CSAT score (rating 9 or 10).
   - After saving significant compute hours or achieving milestone productivity goals.
2. Avoid presenting referral modals during onboarding setup, high-friction configuration tasks, or error states.

### Phase 3: Frictionless Share Modal & One-Click Social Intent Implementation
1. Generate unique, short, human-readable referral codes and URLs (e.g. `https://agents-united.dev/join?ref=alex2026`).
2. Build responsive referral modal offering:
   - 1-Click "Copy Link" button with instant visual tooltip confirmation.
   - Pre-populated social share intents for Twitter/X, LinkedIn, and WhatsApp.
   - Direct email invitation input box supporting comma-separated teammate invites.
3. Include real-time reward ledger showing "Pending", "Earned", and "Redeemed" reward statuses.

### Phase 4: Fraud Prevention, Attribution Cookies & Ledger Security
1. Set 30-day first-party referral tracking cookie on landing page visits from referral links.
2. Implement strict fraud defense guardrails:
   - IP rate-limiting and device fingerprint hashing to detect self-referrals.
   - Domain matching checks: disallow referring users within the same enterprise workspace domain if rewards are personal credits.
   - Hold period: place rewards in pending state for 48 hours to prevent payment chargeback abuse.
3. Record all credit accruals and redemptions in an immutable ledger database table.

### Phase 5: K-Factor Analytics & Viral Funnel Optimization
1. Instrument telemetry events: `referral_modal_viewed`, `referral_link_copied`, `invite_sent`, `referee_landed`, `referee_activated`, `reward_unlocked`.
2. Calculate weekly cohort $K$-factor and channel conversion metrics.
3. Run A/B tests on share modal headlines, reward descriptions, and trigger placement timing.
4. Compile performance summary at `reports/viral-referral-loops/k-factor-summary.json`.
5. Commit referral loop components to repository.
   ```bash
   git add src/components/referral/ src/services/growth/ docs/viral-referral-loops/
   git commit -m "feat(viral-referral-loops): implement double-sided referral engine and fraud guardrails"
   ```

## Code & Configuration Exemplars

### Exemplar 1: TypeScript Referral Token Generation & Attribution Service
```typescript
import crypto from 'node:crypto';

export interface ReferralAttribution {
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: 'pending' | 'qualified' | 'rewarded' | 'flagged';
  createdAt: string;
}

export function generateReferralCode(userId: string): string {
  const hash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 8);
  return `AU-${hash.toUpperCase()}`;
}

export function validateReferralLegitimacy(referrerIp: string, refereeIp: string, referrerDomain: string, refereeEmail: string): boolean {
  // Reject identical IP address self-referral attempts
  if (referrerIp === refereeIp && process.env.NODE_ENV === 'production') {
    return false;
  }
  // Reject internal domain match if corporate domain
  const refereeDomain = refereeEmail.split('@')[1]?.toLowerCase();
  const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];
  if (refereeDomain && !genericDomains.includes(refereeDomain) && refereeDomain === referrerDomain.toLowerCase()) {
    return false;
  }
  return true;
}
```

### Exemplar 2: TypeScript React Referral Share Modal Component
```typescript
import React, { useState } from 'react';

export interface ReferralModalProps {
  referralCode: string;
  earnedCreditsUsd: number;
  pendingCount: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ReferralModal({ referralCode, earnedCreditsUsd, pendingCount, isOpen, onClose }: ReferralModalProps): React.JSX.Element | null {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const shareUrl = `https://agents-united.dev/join?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Give $25, Get $25</h2>
        <p className="text-sm text-gray-600 mb-6">
          Invite teammates or friends. When they execute their first workflow, you both get $25 in compute credits.
        </p>
        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg mb-6">
          <input type="text" readOnly value={shareUrl} className="bg-transparent text-sm w-full outline-none px-2 text-gray-700 font-mono" />
          <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl mb-6">
          <div>
            <div className="text-xs text-blue-700 font-medium">Earned Credits</div>
            <div className="text-xl font-bold text-blue-900">${earnedCreditsUsd}</div>
          </div>
          <div>
            <div className="text-xs text-blue-700 font-medium">Pending Invites</div>
            <div className="text-xl font-bold text-blue-900">{pendingCount}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700 py-2">
          Close
        </button>
      </div>
    </div>
  );
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Referral Link Clicked by Existing Active User
1. **Diagnosis**: An existing user clicks an invitation link expecting a bonus credit.
2. **Recovery Protocol**:
   - Step 1: Detect that the user already has an active account upon landing on the auth page.
   - Step 2: Display polite message explaining that referral credits apply exclusively to new accounts.
   - Step 3: Redirect user to their own referral dashboard to invite others instead.

### Scenario B: Referral Attribution Cookie Blocked by Safari ITP or Brave
1. **Diagnosis**: Browser privacy features wipe 30-day tracking cookie before user finishes signup.
2. **Recovery Protocol**:
   - Step 1: Provide fallback manual promo code entry box on final signup step.
   - Step 2: Store referral attribution token in server-side session state alongside anonymous visitor ID.
   - Step 3: Re-associate attribution upon signup completion via server-side session matching.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Viral coefficient $K$-factor and cycle time equations documented.
- [ ] Fraud defense rules (IP checks, domain validation, hold period) detailed.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
