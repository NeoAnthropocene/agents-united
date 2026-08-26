---
name: onboarding-cro
description: Production-grade Onboarding Conversion Rate Optimization (CRO)
  playbook for time-to-value (TTV) acceleration, activation milestone
  gamification, and drop-off reduction.
metadata:
  author: agents-united
  version: 2.0.0
  icon: ✨
disable-slash-command: true
---

# Product Onboarding CRO & Time-to-Value (TTV) Acceleration

## Overview & Purpose
The Onboarding CRO skill provides a production playbook for auditing, designing, and optimizing user onboarding flows in product-led growth (PLG) SaaS applications.

Following this skill minimizes Time-to-Value (TTV), guides users directly to their first "Aha! moment", eliminates signup friction, implements progressive profiling, provides interactive checklists and empty-state guidance, and maximizes new user activation rates.

## Execution Triggers & Prerequisites
### Execution Triggers
- Low user activation rate (< 25% of signups achieving core product value milestone).
- High drop-off during multi-step setup or configuration wizards.
- Launching new self-serve product tiers or redesigned onboarding experiences.
- User session recordings showing confusion during initial product workspace exploration.

### Prerequisites
- Analytics instrumentation tracking onboarding step completions (PostHog, Mixpanel, Segment).
- Clearly defined user activation metric (e.g. "created 1 project and invited 1 team member").
- UI component library supporting modal wizards, checklists, and empty state cards.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `activation_metric` | String | Yes | Exact definition of user activation milestone |
| `current_funnel_steps`| Array<String> | Yes | Sequence of current onboarding steps |
| `target_ttv_seconds` | Number | Optional | Target Time-to-Value ceiling in seconds (e.g. 180) |
| `template_options` | Array<Object> | Optional | Starter templates pre-loaded for empty states |
| `checklist_milestones`| Array<Object> | Yes | Gamified onboarding checklist items and rewards |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Onboarding CRO Spec | `docs/onboarding-cro/onboarding-spec.md` | Funnel architecture, checklist specs, TTV benchmarks |
| Checklist Component | `src/components/onboarding/OnboardingChecklist.tsx` | Interactive progress tracker UI component |
| Funnel Drop-off Report | `reports/onboarding-cro/funnel-analysis.json` | Drop-off rates and activation improvements by cohort |

## Step-by-Step Execution Runbook

### Phase 1: Activation Milestone Definition & Funnel Drop-off Mapping
1. Audit existing user signup-to-activation flow to identify the primary "Aha! moment".
2. Measure baseline drop-off across all intermediate onboarding steps (Email verification, Persona survey, Team invite, Workspace setup).
3. Identify friction points: defer non-essential profile questions to post-activation settings.
4. Calculate baseline Time-to-Value (TTV) median duration from account creation to first core action.

### Phase 2: Friction Reduction & Progressive Profiling UX Redesign
1. Eliminate mandatory upfront credit card requirements and multi-field surveys.
2. Implement 1-click social authentication (Google, GitHub, Apple) and magic link sign-in.
3. Replace blank modal forms with sensible smart defaults and pre-selected common use cases.
4. Implement progressive profiling: prompt for team size and advanced permissions only when triggering collaborative features.

### Phase 3: Interactive Checklist & Micro-Commitment Component Implementation
1. Construct persistent, collapsible onboarding checklist widget pinned to product dashboard.
2. Structure checklist with 3-5 high-impact micro-commitments:
   - Step 1: Select starter template (instant gratification, 30 seconds).
   - Step 2: Run first execution / create first asset (core value, 60 seconds).
   - Step 3: Invite team collaborator or share link (network effect hook).
3. Attach visual progress bars and celebratory micro-animations (confetti, badge unlock) on completion.

### Phase 4: Empty State & Template Pre-Population Architecture
1. Audit all product dashboards to replace empty blank slates with interactive sample data.
2. Provide 1-click "Clone Starter Project" buttons pre-populating fully functional templates.
3. Embed contextual tooltips and in-line helper microcopy guiding the user's next logical click.
4. Ensure empty states contain clear primary CTA buttons directing back to core activation path.

### Phase 5: A/B Testing, Heatmap Session Auditing & Cohort Activation Tracking
1. Deploy onboarding redesign as an A/B experiment against legacy control flow.
2. Track key funnel telemetry events: `onboarding_started`, `step_completed`, `checklist_opened`, `activated`.
3. Review session recordings of dropped-off users to isolate unhandled edge cases or confusion points.
4. Compile final optimization report at `reports/onboarding-cro/funnel-analysis.json`.
5. Commit onboarding components to repository.
   ```bash
   git add src/components/onboarding/ docs/onboarding-cro/
   git commit -m "feat(onboarding-cro): implement interactive onboarding checklist and empty states"
   ```

## Code & Configuration Exemplars

### Exemplar 1: Onboarding Flow State Machine Configuration
```json
{
  "version": "2.0.0",
  "flowId": "plg-saas-activation-v2",
  "targetTtvSeconds": 120,
  "milestones": [
    {
      "id": "step-1-template-select",
      "title": "Choose your starter workspace",
      "estimatedDurationSeconds": 15,
      "isRequired": true,
      "eventTrigger": "workspace_template_selected"
    },
    {
      "id": "step-2-first-run",
      "title": "Execute your first workflow",
      "estimatedDurationSeconds": 45,
      "isRequired": true,
      "eventTrigger": "first_workflow_executed"
    },
    {
      "id": "step-3-team-invite",
      "title": "Invite a teammate",
      "estimatedDurationSeconds": 30,
      "isRequired": false,
      "eventTrigger": "team_invitation_sent"
    }
  ]
}
```

### Exemplar 2: TypeScript React Onboarding Checklist Component
```typescript
import React, { useState } from 'react';

export interface MilestoneItem {
  id: string;
  title: string;
  completed: boolean;
  actionUrl: string;
}

export function OnboardingChecklist({ initialItems }: { initialItems: MilestoneItem[] }): React.JSX.Element {
  const [items, setItems] = useState(initialItems);
  const completedCount = items.filter(i => i.completed).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  return (
    <div className="onboarding-card border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">Getting Started ({completedCount}/{items.length})</h3>
        <span className="text-xs text-blue-600 font-bold">{progressPercent}%</span>
      </div>
      <div className="w-full bg-gray-200 h-2 rounded-full mb-4">
        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id} className="flex items-center text-sm gap-2">
            <input type="checkbox" checked={item.completed} readOnly className="rounded text-blue-600" />
            <span className={item.completed ? 'line-through text-gray-400' : 'text-gray-800'}>{item.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: User Closes Onboarding Wizard Prematurely
1. **Diagnosis**: User dismisses initial modal wizard without completing core activation steps.
2. **Recovery Protocol**:
   - Step 1: Persist incomplete checklist state to user profile database and browser localStorage.
   - Step 2: Render non-intrusive floating checklist widget in bottom-right corner of main workspace.
   - Step 3: Trigger contextual in-app reminder banner when user accesses dashboard with zero projects.

### Scenario B: Team Invitation Failure During Onboarding Step
1. **Diagnosis**: Email invite fails due to rate limits or invalid teammate email formatting, blocking wizard progression.
2. **Recovery Protocol**:
   - Step 1: Make team invitation step strictly non-blocking with an explicit "Skip for now" link.
   - Step 2: Display inline error explaining the email issue without resetting previously entered workspace data.
   - Step 3: Allow user to proceed directly into workspace and generate a shareable invite link instead.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Progressive profiling rules and Time-to-Value acceleration steps defined.
- [ ] Interactive checklist component exemplar provided.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
