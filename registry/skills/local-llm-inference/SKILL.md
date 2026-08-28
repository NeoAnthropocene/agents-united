---
name: local-llm-inference
description: Local and on-premise LLM inference with Ollama, vLLM, GGUF
  quantizations, PagedAttention, and OpenAI-compatible API servers.
metadata:
  author: Ollama & vLLM Community / agents-united
  version: 2.0.0
  license: MIT
  icon: 🦙
disable-slash-command: true
---

# Local LLM Inference Playbook

## Overview & Purpose
`local-llm-inference` provides configuration and optimization guidelines for running open-source LLMs locally (Ollama) or in high-concurrency production environments (vLLM).

## When to Trigger
Trigger this skill whenever:
- Setting up local development workflows with privacy-preserving offline LLMs.
- Configuring Ollama CLI, custom Modelfile templates, and parameters.
- Deploying high-throughput vLLM inference servers with PagedAttention and continuous batching.
- Selecting model quantizations (GGUF, AWQ, GPTQ) for hardware memory limits.

## Input & Output Requirements
- **Inputs**: Model name or GGUF file path, hardware specifications (CPU, Apple Silicon RAM, NVIDIA VRAM), and inference API port.
- **Outputs**: Running local inference daemon, OpenAI-compatible REST endpoints (`/v1/chat/completions`), and benchmark metrics.

## Step-by-Step Execution Runbook

### Phase 1 — Environment Reconnaissance & Model Selection
- Assess available RAM/VRAM to choose appropriate quantization (4-bit vs 8-bit).
- Pull model weights via Ollama CLI or download Hugging Face safetensors for vLLM.

### Phase 2 — Server Launch & Optimization
- Launch Ollama server or start vLLM daemon with tuned `--gpu-memory-utilization` and `--max-model-len`.
- Verify GPU offloading layers and memory allocation.

### Phase 3 — Verification & Client Connection
- Test local endpoint with curl or OpenAI SDK pointing to `http://localhost:11434/v1` or `http://localhost:8000/v1`.
- Measure Time-to-First-Token (TTFT) and sustained generation throughput.

## Edge Cases & Boundary Conditions
- **System Memory Pressure**: If total model weights exceed VRAM, configure Ollama partial CPU offloading or reduce context length.
- **High Concurrency Latency Spikes**: Enable continuous batching and tensor parallelism across multiple GPUs in vLLM.
- **Prompt Format Mismatches**: Ensure chat templates match exact model tokenizers (e.g. ChatML, Llama-3 headers).

## Error Recovery & Fallbacks
- If vLLM crashes with CUDA OOM, restart daemon with lower `--gpu-memory-utilization 0.80` and `--max-num-seqs 64`.
- If Ollama service fails to respond, restart daemon and verify model file integrity with `ollama list`.

## Code Exemplars & Patterns

```bash
# Start vLLM OpenAI-compatible server with PagedAttention and AWQ quantization
python3 -m vllm.entrypoints.openai.api_server \
  --model casperhansen/llama-3-8b-instruct-awq \
  --quantization awq \
  --dtype float16 \
  --gpu-memory-utilization 0.90 \
  --max-model-len 8192 \
  --port 8000
```

```python
from openai import OpenAI

# Connect standard OpenAI client to local vLLM / Ollama instance
client = OpenAI(base_url="http://localhost:8000/v1", api_key="local-token")

response = client.chat.completions.create(
    model="casperhansen/llama-3-8b-instruct-awq",
    messages=[{"role": "user", "content": "Explain vector indexing in 2 sentences."}],
    temperature=0.7,
)
print(response.choices[0].message.content)
```
