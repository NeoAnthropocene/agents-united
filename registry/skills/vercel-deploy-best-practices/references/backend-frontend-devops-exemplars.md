# Vercel — Backend, Frontend & CI Exemplars

> Extracted verbatim from `registry/agents/subagent-backend-architect.md`,
> `subagent-frontend-architect.md` and `subagent-devops-engineer.md` per Plan 025 Objective 4
> (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-backend-architect`, `subagent-frontend-architect` and `subagent-devops-engineer`
> via their Skill Consultation Map.

## 1. Vercel Prebuilt Deployment

```bash
# Build production assets using Vercel build engine
npx vercel build

# Deploy prebuilt bundle directly to preview or production
npx vercel deploy --prebuilt --token=$VERCEL_TOKEN
```

## 2. Vercel Edge Function — Streaming API Route

```bash
# Deploy a streaming Edge Function via Vercel CLI
npx vercel env pull .env.local       # Sync env vars from Vercel dashboard
npx vercel dev                        # Local dev with Edge runtime emulation
npx vercel deploy --prebuilt --prod   # Deploy prebuilt to production
```

> ⚠️ **Production deploy = human approval required.** Never run the `--prod` step yourself: stop at a preview deploy and hand the production command to the orchestrator, which obtains explicit user approval first.

```typescript
// src/app/api/stream-chat/route.ts — Vercel Edge streaming response
export const runtime = 'edge';

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const words = `Echo: ${prompt}`.split(' ');
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${word}\n\n`));
        await new Promise((r) => setTimeout(r, 80));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

## 3. Vercel Preview CI/CD GitHub Actions Workflow

```yaml
# .github/workflows/vercel-preview.yml
name: Vercel Preview Deployment

on:
  pull_request:
    types: [opened, synchronize, reopened]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  Deploy-Preview:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Pull Vercel Environment Information
        run: npx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts
        run: npx vercel build --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy Artifacts to Vercel Preview
        id: deploy
        run: |
          PREVIEW_URL=$(npx vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "preview_url=$PREVIEW_URL" >> $GITHUB_OUTPUT

      - name: Comment Preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 **Vercel Preview Deployment Ready!**\n\nPreview URL: ${{ steps.deploy.outputs.preview_url }}`
            });
```
