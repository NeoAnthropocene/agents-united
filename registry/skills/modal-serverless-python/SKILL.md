---
name: modal-serverless-python
description: Serverless Python applications, GPU function definitions (A10G, H100), cold-start caching, and volume mounts on Modal.com.
metadata:
  author: "Modal Labs / agents-united"
  version: "2.0.0"
  license: "MIT"
---

# Modal Serverless Python Playbook

## Overview & Purpose
`modal-serverless-python` provides production best practices for authoring, deploying, and optimizing serverless Python AI workloads on Modal.com with hardware-accelerated GPU infrastructure and cold-start mitigations.

## When to Trigger
Trigger this skill whenever:
- Designing serverless GPU inference functions (LLMs, Diffusion models, Whisper transcription).
- Building fine-tuning or embedding generation pipelines requiring on-demand GPU clusters.
- Optimizing Python container cold-start latency and GPU memory management.
- Mounting persistent storage volumes for large machine learning model checkpoints.

## Input & Output Requirements
- **Inputs**: Model identifier (Hugging Face ID or local weights path), target GPU tier (`T4`, `A10G`, `A100`, `H100`), concurrency parameters, and environment secrets.
- **Outputs**: Fully functional Modal Python scripts (`modal.App`), persistent volume definitions, deployment runbooks, and endpoint latency benchmarks.

## Step-by-Step Execution Runbook

### Phase 1 — Environment & Image Scaffolding
- Define container images with minimal base layers and pinned PyTorch/CUDA wheels.
- Pre-download model weights into container image layers using `image.run_function()`.

### Phase 2 — GPU Function & Lifecycle Declaration
- Decorate class-based functions with `@app.cls(gpu="A10G", container_idle_timeout=60)`.
- Load weights into GPU VRAM once during container startup with `@modal.enter()`.

### Phase 3 — Verification & Scale Testing
- Execute test invocations using `modal run` before deploying production web endpoints (`modal deploy`).

## Edge Cases & Boundary Conditions
- **CUDA Out of Memory (OOM)**: Handle batch sizes dynamically based on available VRAM limits; fall back to gradient checkpointing or 4-bit quantization (bitsandbytes).
- **Cold-Start Spikes**: Utilize warm pools and flash-attention container optimizations to keep cold start < 8s.
- **Network Timeouts on Large Weight Downloads**: Split weight shards across persistent Modal Volumes.

## Error Recovery & Fallbacks
- If GPU capacity is unavailable in the primary region, configure fallback GPU selections (e.g. `gpu=["A10G", "A100"]`).
- When secret loading fails, verify authentication with `modal secret list` and surface missing secret keys.

## Code Exemplars & Patterns

```python
import modal

app = modal.App("vllm-inference-service")

vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("vllm==0.6.3", "torch==2.4.0", "transformers")
)

@app.cls(
    image=vllm_image,
    gpu="A10G",
    scaledown_window=60,
    timeout=300,
)
class ModelServer:
    @modal.enter()
    def load_model(self):
        from vllm import LLM
        self.llm = LLM(model="meta-llama/Llama-3.1-8B-Instruct")

    @modal.method()
    def generate(self, prompt: str) -> str:
        from vllm import SamplingParams
        sampling_params = SamplingParams(temperature=0.7, max_tokens=512)
        outputs = self.llm.generate([prompt], sampling_params)
        return outputs[0].outputs[0].text
```
