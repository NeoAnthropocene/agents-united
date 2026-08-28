---
name: replicate-model-inference
description: Integrating hosted open-source AI models, streaming responses,
  webhook handlers, and fine-tuning jobs on Replicate.com.
metadata:
  author: Replicate / agents-united
  version: 2.0.0
  license: MIT
  icon: 🔮
disable-slash-command: true
---

# Replicate Model Inference Playbook

## Overview & Purpose
`replicate-model-inference` provides comprehensive patterns for invoking, streaming, and managing open-source AI models deployed on the Replicate cloud infrastructure.

## When to Trigger
Trigger this skill whenever:
- Integrating hosted open-source LLMs, image generation (Flux, SDXL), or audio models via API.
- Setting up async webhook handlers for long-running prediction jobs.
- Implementing real-time text/token streaming in web applications.
- Managing model fine-tuning and custom Cog container deployments.

## Input & Output Requirements
- **Inputs**: Model version string (`owner/model:version`), prompt payload, generation parameters (temperature, max_tokens, guidance_scale), and `REPLICATE_API_TOKEN`.
- **Outputs**: Output streams, prediction JSON objects, signed image/audio URLs, and error status responses.

## Step-by-Step Execution Runbook

### Phase 1 — Client Setup & Model Version Pinning
- Authenticate API client using environment token.
- Lock exact model version hash to prevent breaking changes from upstream model updates.

### Phase 2 — Inference Execution & Streaming
- Use synchronous predictions for fast requests (<5s).
- Use streaming iterators (`replicate.stream()`) for LLMs to deliver immediate tokens.
- Use webhook callbacks for asynchronous generation tasks (>10s).

### Phase 3 — Verification & Retry Handling
- Implement exponential backoff for HTTP 429 rate limit responses.
- Verify generated output formats and validate against expected response schemas.

## Edge Cases & Boundary Conditions
- **Cold-Start Latency**: Account for 15-30s cold starts on un-cached model hardware by displaying UI progress indicators.
- **Payload Truncation**: Truncate or chunk user inputs exceeding the model's context window.
- **Hardware Failures**: Handle HTTP 500/503 responses gracefully with fallback replica endpoints.

## Error Recovery & Fallbacks
- If prediction times out, cancel the active prediction via API to prevent ongoing billing.
- Fall back to secondary models (e.g. Llama-3.1-70B -> Llama-3.1-8B) during upstream service degradations.

## Code Exemplars & Patterns

```typescript
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function* streamLlamaCompletion(prompt: string) {
  const model = "meta/meta-llama-3.1-405b-instruct";
  const stream = replicate.stream(model, {
    input: {
      prompt,
      max_tokens: 1024,
      temperature: 0.7,
    },
  });

  for await (const event of stream) {
    yield event.toString();
  }
}
```
