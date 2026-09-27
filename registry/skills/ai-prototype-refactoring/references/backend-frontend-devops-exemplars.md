# AI Prototype Refactoring — Backend, Frontend & DevOps Exemplars

> Extracted verbatim from `registry/agents/subagent-backend-architect.md`,
> `subagent-frontend-architect.md` and `subagent-devops-engineer.md` per Plan 025 Objective 4
> (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-backend-architect`, `subagent-frontend-architect` and `subagent-devops-engineer`
> via their Skill Consultation Map.

## 1. Lovable / v0 Backend Migration — Mock Data → Real Repository

```typescript
// BEFORE: Lovable-generated file with hardcoded mock array
// const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];

// AFTER: Typed repository pattern backed by Supabase
// src/repositories/user.repository.ts
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UserRow = Database['public']['Tables']['profiles']['Row'];

export async function getUserById(userId: string): Promise<UserRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new Error(`getUserById failed: ${error.message}`);
  return data;
}
```

## 2. Atomic Refactoring of AI Prototype Monolith

```typescript
// BEFORE: 600-line monolithic v0 file with hardcoded styling
// AFTER: Decomposed into atomic primitives and container
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MetricBadge } from '@/components/ui/metric-badge';

interface AnalyticsCardProps {
  title: string;
  metric: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
}

export function AnalyticsCard({ title, metric, trend, trendValue }: AnalyticsCardProps) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <MetricBadge trend={trend} value={trendValue} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{metric}</div>
      </CardContent>
    </Card>
  );
}
```

## 3. Lovable / v0 — Environment Promotion Pipeline (CI)

```yaml
# .github/workflows/promote-prototype.yml
# Promotes a Lovable/v0 prototype export to staging with real env vars
name: Promote AI Prototype to Staging

on:
  workflow_dispatch:
    inputs:
      prototype_branch:
        description: 'Branch containing exported prototype files'
        required: true

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.prototype_branch }}

      - name: Install dependencies
        run: npm ci

      - name: Inject real environment variables
        run: |
          # Replace Lovable mock env stubs with real staging values
          npx vercel env pull .env.staging \
            --environment preview \
            --token ${{ secrets.VERCEL_TOKEN }}

      - name: Build & deploy to Vercel staging
        run: |
          npx vercel build --token ${{ secrets.VERCEL_TOKEN }}
          DEPLOY_URL=$(npx vercel deploy --prebuilt \
            --token ${{ secrets.VERCEL_TOKEN }})
          echo "Staging URL: $DEPLOY_URL"
```
