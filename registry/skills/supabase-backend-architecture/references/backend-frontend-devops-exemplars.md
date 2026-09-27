# Supabase — Backend, Frontend & CI Exemplars

> Extracted verbatim from `registry/agents/subagent-backend-architect.md`,
> `subagent-frontend-architect.md` and `subagent-devops-engineer.md` per Plan 025 Objective 4
> (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-backend-architect`, `subagent-frontend-architect` and `subagent-devops-engineer`
> via their Skill Consultation Map.

## 1. Supabase CLI & Row Level Security (RLS) Policies

```bash
# Initialize Supabase configuration and start local development stack
npx supabase init
npx supabase start

# Generate migration diff from schema changes
npx supabase db diff -f add_user_profiles_and_rls

# Create new Edge Function
npx supabase functions new stripe-webhook-handler
```

```sql
-- supabase/migrations/20260814000000_add_user_profiles_and_rls.sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'billing_manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Select policy: Users can only read their own profile, or admins can read all
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Update policy: Users can update their own non-role fields
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Performance index on auth ID
CREATE INDEX idx_profiles_user_id ON public.profiles(id);
```

## 2. Type-Safe Supabase Service Client & Edge Function Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function getSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
```

## 3. Supabase Auth Client Integration (Next.js App Router)

```bash
# Install Supabase SSR helpers for Next.js
npm install @supabase/supabase-js @supabase/ssr
```

```typescript
// src/lib/supabase/client.ts — Browser client for client components
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// src/lib/supabase/server.ts — Server client for RSC and Server Actions
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(),
                 setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}
```

## 4. Supabase CI/CD — Database Branch per Pull Request

```yaml
# .github/workflows/supabase-preview.yml
name: Supabase Preview Branch

on:
  pull_request:
    branches: [main]

jobs:
  preview-db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Create Supabase Preview Branch
        id: branch
        run: |
          BRANCH_NAME="pr-${{ github.event.pull_request.number }}"
          supabase branches create "$BRANCH_NAME" \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          DB_URL=$(supabase branches get "$BRANCH_NAME" \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} \
            --output json | jq -r '.db_url')
          echo "db_url=$DB_URL" >> $GITHUB_OUTPUT

      - name: Run Migrations on Preview Branch
        run: |
          supabase db push \
            --db-url "${{ steps.branch.outputs.db_url }}"
```
