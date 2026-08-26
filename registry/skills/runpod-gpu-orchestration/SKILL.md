---
name: runpod-gpu-orchestration
description: On-demand GPU instance provisioning, serverless worker handler
  creation, network volume configuration, and spot pricing optimization on
  RunPod.io.
metadata:
  author: RunPod / agents-united
  version: 2.0.0
  license: MIT
  icon: 🖥️
disable-slash-command: true
---

# RunPod GPU Orchestration Playbook

## Overview & Purpose
`runpod-gpu-orchestration` standardizes building, deploying, and managing custom AI containers on RunPod Serverless and GPU Pod instances with cost-effective spot pricing.

## When to Trigger
Trigger this skill whenever:
- Creating custom CUDA Docker containers for high-performance model serving.
- Implementing RunPod Serverless asynchronous and streaming worker handlers.
- Configuring network storage volumes for shared model weight caching across pods.
- Setting up automated scaling policies and spot GPU instance recovery.

## Input & Output Requirements
- **Inputs**: Base Dockerfile, Python worker script, RunPod API Key, GPU type requirements (RTX 4090, A100, H100), and network volume IDs.
- **Outputs**: Docker container registry images, RunPod endpoint configurations, and health monitoring alerts.

## Step-by-Step Execution Runbook

### Phase 1 — Worker Implementation & Containerization
- Author the Python worker handler conforming to `runpod.serverless.start()`.
- Package dependencies with CUDA runtime base layers in Dockerfile.

### Phase 2 — Network Volume Caching & Endpoint Deployment
- Mount `/runpod-volume` to share checkpoints and avoid downloading model weights on worker initialization.
- Deploy the serverless endpoint with concurrency limits and idle timeout thresholds.

### Phase 3 — Verification & Load Testing
- Trigger test jobs via RunPod `/run` and `/runsync` REST endpoints.
- Validate worker auto-scaling under load and clean scale-down on idle.

## Edge Cases & Boundary Conditions
- **Spot Pod Interruption**: Implement checkpoint saves every N training steps to recover from spot instance preemptions.
- **CUDA OOM on High Concurrency**: Enforce max concurrent jobs per worker container (`concurrency_modifier`).
- **Disk Space Exhaustion**: Clean `/tmp` and PyTorch cache files between batch jobs.

## Error Recovery & Fallbacks
- If serverless job fails with worker error, inspect container stderr logs via RunPod API.
- Fall back from spot instances to on-demand secure cloud pods when guaranteed uptime is required.

## Code Exemplars & Patterns

```python
import runpod
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model = None
tokenizer = None

def load_model():
    global model, tokenizer
    model_name = "mistralai/Mistral-7B-Instruct-v0.3"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16,
        device_map="auto"
    )

def handler(job):
    job_input = job["input"]
    prompt = job_input.get("prompt", "")
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=256)
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return {"output": result}

if __name__ == "__main__":
    load_model()
    runpod.serverless.start({"handler": handler})
```
