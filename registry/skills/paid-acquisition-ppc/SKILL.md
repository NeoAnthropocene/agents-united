---
name: paid-acquisition-ppc
description: Production-grade Paid Acquisition PPC playbook for multi-channel ad campaign structure, bidding algorithms, audience segmentation, UTM taxonomy, and ad copy matrix.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Multi-Channel Paid Acquisition & PPC Campaign Management

## Overview & Purpose
The Paid Acquisition PPC skill provides an end-to-end framework for architecting, launching, and managing pay-per-click (PPC) campaigns across Google Ads (Search, Performance Max, Display), Meta Ads (Facebook & Instagram Feed, Reels, Stories), and LinkedIn Ads (Sponsored Content, Text, Message).

Following this skill enforces strict campaign naming taxonomy, negative keyword management, audience segment exclusions, smart bidding optimization (tCPA, tROAS, Maximize Conversions), and multi-variant ad copy testing.

## Execution Triggers & Prerequisites
### Execution Triggers
- Launching new paid customer acquisition campaigns across search and social channels.
- Restructuring underperforming ad accounts to improve Quality Score and reduce CPA.
- Implementing standardized UTM tracking and conversion event tags.
- Scaling budget while maintaining target ROAS and CAC efficiency thresholds.

### Prerequisites
- Active ad accounts (Google Ads, Meta Business Manager, LinkedIn Campaign Manager).
- Configured conversion tracking tags (Google Tag Manager, Meta Pixel, LinkedIn Insight Tag).
- Target customer personas, keyword research data, and approved ad copy/creative assets.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `channels` | Array<String> | Yes | Target channels: `['google', 'meta', 'linkedin']` |
| `monthly_budget` | Number | Yes | Total monthly budget in USD |
| `target_cpa` | Number | Yes | Target Cost Per Acquisition ceiling |
| `target_roas` | Number | Optional | Target Return on Ad Spend multiplier (e.g. 3.5) |
| `bidding_strategy` | String | Optional | Strategy: `tCPA`, `tROAS`, `MaximizeConversions`, `ManualCPC` |
| `utm_campaign_name` | String | Yes | Canonical UTM campaign parameter string |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Campaign Architecture Spec | `docs/paid-acquisition-ppc/campaign-spec.md` | Full account hierarchy, match types, ad copy matrix |
| Campaign Config JSON | `configs/ppc/campaign-matrix.json` | Programmatic campaign structure and budget splits |
| Negative Keyword Lists | `configs/ppc/negative-keywords.txt` | Universal and campaign-level negative keyword filters |
| Tracking URL Engine | `src/marketing/utm-builder.ts` | Programmatic UTM generator and URL validator |

## Step-by-Step Execution Runbook

### Phase 1: Account Hierarchy Design & Funnel Intent Mapping
1. Structure account hierarchy into Top-of-Funnel (TOF - Awareness/Problem Aware), Middle-of-Funnel (MOF - Solution Aware/Category Search), and Bottom-of-Funnel (BOF - Brand & High-Intent Purchase).
2. Establish standardized campaign naming convention:
   `[Dept]_[Channel]_[Objective]_[FunnelStage]_[Audience/KeywordTheme]_[Geo]_[Language]`
3. Allocate budget across channels based on historical CAC and channel intent (e.g. 50% Google Search, 35% Meta Feed, 15% LinkedIn B2B).
4. Establish budget pacing rules and daily spend caps to prevent front-loaded overspend.

### Phase 2: Audience Segmentation, Keyword Sculpting & Negative Matching
1. Segment audiences by intent: Custom Intent / In-Market, Lookalike / Retargeting, Customer CRM Match.
2. Structure Google Ads Search Ad Groups using Single-Theme Ad Groups (STAGs) combining Exact Match (`[keyword]`) and Phrase Match (`"keyword"`).
3. Build comprehensive universal negative keyword list (excluding terms like "free", "crack", "jobs", "internship", "salary", "login").
4. Configure Meta Ads custom audience exclusions (exclude past 30-day converters, active paying subscribers, internal employees).

### Phase 3: Ad Copy & Responsive Creative Matrix Generation
1. Author Responsive Search Ads (RSAs) for Google Ads with 15 headlines and 4 descriptions:
   - 3 Headlines with exact keyword insertion.
   - 3 Value proposition and differentiation hooks.
   - 3 Call-to-action hooks with urgency/proof.
2. Author Meta & LinkedIn ad copy variations testing 3 primary text hooks against 2 creative angles.
3. Configure sitelink extensions, callout extensions, structured snippets, and lead form assets.
4. Verify compliance with advertising policies (no sensationalist claims, valid landing page URLs).

### Phase 4: Bidding Algorithm Calibration & Conversion Tracking Setup
1. Configure conversion goals in ad platforms with primary conversion actions (Purchase, Sign Up, Demo Request).
2. Set up initial bidding strategy: Maximize Conversions with soft tCPA during 2-week learning phase (minimum 30 conversions).
3. Transition to tROAS or strict tCPA once conversion volume exceeds 50 events per month per ad group.
4. Validate conversion pixel fires and server-side tracking verification.

### Phase 5: Campaign Launch, Budget Pacing & Dayparting Governance
1. Upload campaign configurations via platform bulk sheets or API dispatchers.
2. Enable dayparting / ad scheduling to concentrate spend during high-conversion business hours.
3. Monitor real-time search terms report on days 1, 3, and 7 to immediately add newly discovered irrelevant queries to negative lists.
4. Compile campaign setup summary at `docs/paid-acquisition-ppc/campaign-spec.md`.
5. Commit campaign configuration files to git repository.
   ```bash
   git add configs/ppc/ docs/paid-acquisition-ppc/
   git commit -m "feat(paid-acquisition-ppc): configure multi-channel PPC campaign architecture"
   ```

## Code & Configuration Exemplars

### Exemplar 1: Multi-Channel PPC Campaign Matrix Specification
```json
{
  "version": "2.0.0",
  "campaigns": [
    {
      "id": "MKT_GGL_SEARCH_BOF_HIGHINTENT_US_EN",
      "channel": "google-ads",
      "network": "search",
      "biddingStrategy": "tCPA",
      "targetCpaUsd": 45.0,
      "dailyBudgetUsd": 150.0,
      "adGroups": [
        {
          "name": "Multi-Agent Frameworks",
          "matchTypes": {
            "exact": ["[multi agent framework]", "[ai agent registry]"],
            "phrase": ["\"multi agent orchestration\"", "\"ai agent tools\""]
          },
          "rsaHeadlines": [
            "Autonomous AI Agent Suite",
            "Agents United - Dev Tools",
            "Deploy AI Teams in Minutes"
          ]
        }
      ]
    }
  ]
}
```

### Exemplar 2: TypeScript UTM Tracking Parameter Engine
```typescript
export interface UtmParameters {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export function buildCampaignUrl(baseUrl: string, utm: UtmParameters): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', utm.source.toLowerCase().trim());
  url.searchParams.set('utm_medium', utm.medium.toLowerCase().trim());
  url.searchParams.set('utm_campaign', utm.campaign.toLowerCase().trim());
  if (utm.content) url.searchParams.set('utm_content', utm.content.toLowerCase().trim());
  if (utm.term) url.searchParams.set('utm_term', utm.term.toLowerCase().trim());
  return url.toString();
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Search Query Budget Bleed via Loose Broad Match Queries
1. **Diagnosis**: High ad spend with low conversion rate caused by irrelevant broad search matches.
2. **Recovery Protocol**:
   - Step 1: Export Search Terms Report for the past 7 days.
   - Step 2: Filter for queries with > 10 clicks and 0 conversions.
   - Step 3: Add offending keywords as exact negative keywords in `configs/ppc/negative-keywords.txt` and sync to ad platform.

### Scenario B: Ad Creative Policy Disapproval or Trademark Flag
1. **Diagnosis**: Ad creative rejected by Google Ads or Meta for restricted keywords or trademarked brand names.
2. **Recovery Protocol**:
   - Step 1: Inspect platform rejection reason code in ad manager.
   - Step 2: Update copy variations to replace flagged terms with approved descriptive synonyms.
   - Step 3: Resubmit ad group for automated re-review.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Multi-channel campaign structures (Google, Meta, LinkedIn) detailed.
- [ ] Negative keyword governance and UTM generation scripts included.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
