# Turso / LibSQL — Backend, Frontend & CI Exemplars

> Extracted verbatim from `registry/agents/subagent-backend-architect.md`,
> `subagent-frontend-architect.md` and `subagent-devops-engineer.md` per Plan 025 Objective 4
> (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-backend-architect`, `subagent-frontend-architect` and `subagent-devops-engineer`
> via their Skill Consultation Map.

## 1. Turso CLI & LibSQL Embedded Replicas

```bash
# Authenticate and provision distributed database
turso auth login
turso db create production-db --location iad

# Create isolated database branch for staging / testing
turso db branch production-db staging-feature-branch

# Inspect database endpoints
turso db show production-db
```

```typescript
// src/db/turso-client.ts
import { createClient } from '@libsql/client';

export const turso = createClient({
  url: process.env.NODE_ENV === 'production' 
    ? 'file:local-replica.db' 
    : (process.env.TURSO_DATABASE_URL || 'file:dev.db'),
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: 60, // Background sync with remote primary every 60s
});

export async function queryTenantData(tenantId: string) {
  // Sync before critical read or rely on periodic sync
  await turso.sync();
  
  const result = await turso.execute({
    sql: 'SELECT id, tenant_id, payload, created_at FROM tenant_records WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50',
    args: [tenantId],
  });
  
  return result.rows;
}
```

## 2. Turso LibSQL — Edge Replica Read in Next.js Route Handler

```bash
# Install LibSQL client
npm install @libsql/client
```

```typescript
// src/app/api/catalog/route.ts — Edge-optimized read from Turso replica
import { createClient } from '@libsql/client';
import { NextResponse } from 'next/server';

export const runtime = 'edge'; // Deploy to Vercel Edge Network

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export async function GET() {
  const result = await db.execute(
    'SELECT id, title, price FROM catalog WHERE active = 1 ORDER BY created_at DESC LIMIT 50'
  );
  return NextResponse.json(result.rows);
}
```

## 3. Turso — Database Branch per Feature Branch (CI)

```bash
# Create isolated Turso database branch for each feature PR
turso db branch production-db feature/new-schema --wait

# Get branch connection details for CI environment injection
DB_URL=$(turso db show feature/new-schema --url)
DB_TOKEN=$(turso db tokens create feature/new-schema)

# Set as GitHub Actions environment secrets for PR preview
gh secret set TURSO_DATABASE_URL --body "$DB_URL" --env preview
gh secret set TURSO_AUTH_TOKEN --body "$DB_TOKEN" --env preview

# Clean up after PR merge
turso db destroy feature/new-schema --yes
```
