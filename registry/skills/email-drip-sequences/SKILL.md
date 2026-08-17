---
name: email-drip-sequences
description: Production-grade Email Drip Sequences playbook for automated lifecycle nurturing, behavioral trigger branching, deliverability optimization (DKIM/DMARC), and trial-to-paid conversion.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Automated Lifecycle Email Drip Sequences & Behavioral Nurturing

## Overview & Purpose
The Email Drip Sequences skill provides an automated framework for designing, authoring, and deploying multi-stage lifecycle email campaigns.

Following this skill structures behavioral trigger sequences (Welcome Onboarding, Feature Adoption Boost, Trial-to-Paid Upgrade, Inactivity Nurture, Abandoned Checkout), dynamic personalization merge tokens, spam filter avoidance, and technical deliverability compliance (SPF, DKIM, DMARC, BIMI, one-click List-Unsubscribe headers).

## Execution Triggers & Prerequisites
### Execution Triggers
- Designing automated onboarding or product education email drip series for new signups.
- Nurturing free trial users through automated milestones to maximize paid conversion.
- Re-engaging dormant user accounts prior to churn.
- Auditing email deliverability to resolve inboxing issues and spam complaints.

### Prerequisites
- Email Service Provider (ESP) API configured (Resend, SendGrid, Postmark, Customer.io).
- Verified sending domain with configured SPF, DKIM, and DMARC DNS records.
- Responsive HTML / React Email template components.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `sequence_type` | String | Yes | `welcome_onboarding`, `trial_conversion`, `feature_boost`, `winback` |
| `sending_domain` | String | Yes | Authenticated sending domain (e.g. `mail.example.com`) |
| `cadence_schedule` | Array<Object> | Yes | Step delay intervals (e.g. Day 0, Day 2, Day 5, Day 10) |
| `behavioral_triggers`| Array<Object> | Optional | Conditional branches based on user product activity |
| `template_engine` | String | Optional | `react-email`, `handlebars`, `mjml` |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Sequence Flowchart Spec | `docs/email-drip-sequences/sequence-spec.md` | Cadence timing, branching tree, and copy brief |
| Email Templates | `src/emails/templates/*.tsx` | Responsive React Email components |
| Deliverability Report | `reports/email-drip-sequences/deliverability.json` | DKIM, SPF, DMARC, and spam score audit results |

## Step-by-Step Execution Runbook

### Phase 1: Lifecycle Stage Mapping & Behavioral Trigger Logic Design
1. Map customer lifecycle journey into discrete communication stages (Welcome, Activation, Upgrade, Retention).
2. Define event triggers (e.g. `user_signed_up`, `first_project_created`, `trial_day_10_no_payment`).
3. Formulate branching rules: if user activates in product on Day 1, bypass generic setup emails and send advanced power-user tips.
4. Establish sequence exit conditions: instantly cancel onboarding drips upon subscription purchase or account deactivation.

### Phase 2: Copywriting, Dynamic Tokenization & React Email Templating
1. Author high-converting email copy for each cadence touchpoint:
   - Email 1 (Day 0, Immediate): Welcome + single clear activation CTA.
   - Email 2 (Day 2): Case study / customer spotlight demonstrating tangible ROI.
   - Email 3 (Day 5): Overcoming common setup objections + invitation to live Q&A/office hours.
   - Email 4 (Day 10): Urgent trial expiration notice + personalized upgrade discount.
2. Build responsive templates using React Email / MJML ensuring 100% rendering parity across Apple Mail, Gmail, and Outlook.
3. Inject dynamic personalization tokens (`{{firstName}}`, `{{workspaceName}}`, `{{daysRemaining}}`) with fallback defaults.

### Phase 3: Delivery Delay & Smart Branching Workflow Automation
1. Implement step delay scheduler handling timezone-aware delivery (send at 09:30 AM in recipient's local timezone).
2. Configure webhook ingestion pipeline updating user state and triggering real-time branch decisions.
3. Add frequency capping: ensure a user never receives more than 1 marketing email in a 24-hour window.
4. Integrate unsubscribe event handler to guarantee immediate global suppression list synchronization.

### Phase 4: Technical Deliverability Auditing (DKIM/DMARC/BIMI) & Spam Testing
1. Verify DNS records: SPF (`v=spf1 include:... ~all`), DKIM (2048-bit key), and DMARC (`v=DMARC1; p=reject; rua=mailto:...`).
2. Include RFC-8058 compliant `List-Unsubscribe: <https://example.com/unsub>, <mailto:unsub@example.com>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
3. Run spam filter scanner (Mail-Tester / Litmus) ensuring score >= 9.5/10 with zero spam trigger words.
4. Verify all transactional and promotional emails include valid physical mailing address and copyright notice.

### Phase 5: A/B Subject Line Testing & Cohort Engagement Metrics
1. Configure automated A/B test on subject lines across initial 20% of cohort before sending winner to remaining 80%.
2. Track deliverability metrics: Delivery Rate (>99%), Open Rate (>40%), Click-to-Open Rate (>15%), Unsubscribe Rate (<0.3%).
3. Compile sequence performance audit at `reports/email-drip-sequences/deliverability.json`.
4. Commit email drip sequence components to repository.
   ```bash
   git add src/emails/ docs/email-drip-sequences/
   git commit -m "feat(email-drip-sequences): implement automated lifecycle email drip engine"
   ```

## Code & Configuration Exemplars

### Exemplar 1: Automated Email Drip Sequence State Machine Specification
```json
{
  "version": "2.0.0",
  "sequenceId": "trial-to-paid-nurture-v1",
  "triggerEvent": "user.trial_started",
  "exitEvents": ["subscription.created", "account.cancelled"],
  "steps": [
    {
      "stepNumber": 1,
      "delayHours": 0,
      "templateId": "welcome-activation",
      "subjectA": "Welcome to Agents United - Let's build your first team",
      "subjectB": "Quick start: Deploy your AI team in 2 minutes"
    },
    {
      "stepNumber": 2,
      "delayHours": 48,
      "templateId": "case-study-showcase",
      "branchCondition": { "userHasCreatedProject": false },
      "subjectA": "How Acme Corp scaled engineering velocity with Agents United"
    },
    {
      "stepNumber": 3,
      "delayHours": 240,
      "templateId": "trial-ending-urgency",
      "subjectA": "Your free trial ends in 48 hours - keep your workflows active"
    }
  ]
}
```

### Exemplar 2: TypeScript React Email Responsive Component
```typescript
import React from 'react';

export interface TrialEmailProps {
  firstName: string;
  daysRemaining: number;
  upgradeUrl: string;
}

export function TrialEndingEmail({ firstName, daysRemaining, upgradeUrl }: TrialEmailProps): React.JSX.Element {
  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', maxWidth: '600px', margin: '0 auto', color: '#1E293B' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Hey {firstName || 'there'}, your trial expires in {daysRemaining} days</h2>
      <p style={{ fontSize: '15px', lineHeight: '1.6' }}>
        We hope you’ve enjoyed orchestrating autonomous multi-agent teams. Upgrade today to preserve your active workflows and avoid disruption.
      </p>
      <div style={{ margin: '24px 0' }}>
        <a
          href={upgradeUrl}
          style={{ backgroundColor: '#2563EB', color: '#FFFFFF', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
        >
          Upgrade Your Plan Now
        </a>
      </div>
      <p style={{ fontSize: '12px', color: '#64748B' }}>
        Agents United Inc. • 100 Innovation Way, Suite 400 • San Francisco, CA 94105<br />
        <a href="https://example.com/unsubscribe" style={{ color: '#64748B' }}>Unsubscribe instantly</a>
      </p>
    </div>
  );
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Drip Emails Landing in Gmail Spam / Promotions Folders
1. **Diagnosis**: Domain reputation dip or spam filter trigger caused by high link density or unverified DMARC record.
2. **Recovery Protocol**:
   - Step 1: Run SPF/DKIM/DMARC diagnostic checker to verify 100% authentication alignment.
   - Step 2: Reduce image-to-text ratio and remove URL redirect shorteners from email body.
   - Step 3: Implement domain warm-up schedule throttling daily send volume (50 -> 100 -> 250 -> 500 -> 1000).

### Scenario B: User Receives Conflicting Emails Due to Overlapping Trigger Events
1. **Diagnosis**: User triggers both "Trial Ending" and "Feature Adoption" drips simultaneously, causing inbox spam.
2. **Recovery Protocol**:
   - Step 1: Implement global priority queue suppressing lower-priority educational drips when high-priority transactional/billing drips are active.
   - Step 2: Enforce strict minimum 24-hour spacing window between automated marketing messages.
   - Step 3: Re-evaluate sequence enrollment state before each dispatch worker execution.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Deliverability standards (SPF, DKIM, DMARC, List-Unsubscribe) documented.
- [ ] React Email / responsive template component exemplar provided.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
