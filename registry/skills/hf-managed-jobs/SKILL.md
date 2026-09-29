---
name: hf-managed-jobs
description: Runs arbitrary workloads (training, batch inference, data
  processing) on Hugging Face Jobs managed compute using the real `hf jobs`
  CLI surface — flavors, UV/Docker-based jobs, secrets, scheduling, and result
  persistence to the Hub. Use when a workload needs a cloud CPU/GPU/TPU
  without local setup, or when submitting, monitoring, or debugging an `hf
  jobs` run.
metadata:
  author: Hugging Face / agents-united
  version: 1.0.0
  source: https://github.com/huggingface/skills
  commit: 80f9fa530e46f4ae642fcb9e1725bad0e1979395
  license: Apache-2.0
  icon: ☁️
disable-slash-command: true
---

# Hugging Face Managed Jobs (hf CLI Jobs)

## Overview & Purpose
`hf-managed-jobs` covers the Hugging Face `hf` CLI's `jobs` subcommands: how
to run a workload on fully managed cloud compute (CPU, GPU, or TPU) without
any local infrastructure, monitor it, and persist its results. It is
distinct from `hf-model-training` (the fine-tuning *recipe* — what trainer,
what hyperparameters): this skill is the *execution substrate* — how the
workload actually gets scheduled, run, and its output retrieved, whether the
workload is a training script, a batch inference job, or a data-processing
pipeline.

## Execution Triggers & Prerequisites
### Execution Triggers
- A workload needs a GPU/TPU and none is available locally.
- Running a one-off or scheduled batch job (data processing, evaluation,
  inference) without provisioning infrastructure.
- Debugging a failed or hung `hf jobs` run.
- Choosing the right hardware `flavor` for a workload's memory/compute needs.

### Prerequisites
- `hf` CLI installed and authenticated (`hf auth login`), with a token that
  has Jobs permissions.
- The script to run is either a `uv`-compatible Python script with PEP 723
  inline dependencies, or a Docker image reference.
- Any credentials the job itself needs (a dataset/model token, an external
  API key) are passed as job secrets, never inlined into the script.
- A cost-aware hardware choice: jobs bill per second of the chosen flavor —
  confirm the flavor before submitting, especially for multi-hour runs.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `script_or_image` | Path / String | Yes | A `uv` script (`hf jobs uv run`) or Docker image (`hf jobs run`) |
| `flavor` | String | Yes | Hardware tier, e.g. `cpu-basic`, `t4-small`, `a10g-large`, `a100-large` |
| `secrets` | List | Optional | Names of secrets to inject as env vars (values never appear in logs) |
| `timeout` | Duration | Optional | Job wall-clock limit, to bound cost on a runaway job |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Job ID | string | Returned on submission; used for `ps`/`logs`/`inspect`/`cancel` |
| Job logs | stdout/stderr, via `hf jobs logs <id>` | Streamed or fetched after the fact |
| Persisted results | Hub repo (model/dataset) | Written by the job itself via `huggingface_hub.HfApi`, not by the CLI |

## Step-by-Step Execution Runbook

### Phase 1 — Hardware & Job Type Selection
1. Estimate the workload's memory footprint (model size × precision, or
   dataset shard size for batch processing) before picking a flavor —
   under-provisioning fails mid-run; over-provisioning wastes budget.
2. Use a `uv` script (PEP 723 inline dependencies, e.g.
   `# /// script` / `# dependencies = [...]` header) for self-contained
   Python workloads — this is the primary pattern for Jobs and needs no
   separate image build.
3. Use `hf jobs run <docker-image>` instead when the workload needs system
   dependencies a `uv` script cannot express (compiled binaries, non-Python
   tooling).
4. Pick the smallest flavor that fits the estimated memory (`cpu-basic` for
   data prep with no GPU need; `t4-small`/`a10g-large` for small-to-mid model
   inference or fine-tuning; `a100-large` only when the workload's memory or
   throughput genuinely needs it).

### Phase 2 — Submission
1. Pass secrets by name (`--secrets HF_TOKEN,OPENAI_API_KEY`), sourced from
   the environment or the Hub's secret store — never hardcode a credential
   into the script that gets uploaded with the job.
2. Set an explicit `--timeout` for any job that isn't known-short, so a stuck
   job doesn't run (and bill) indefinitely.
3. Submit with `hf jobs uv run <script.py> --flavor <flavor> [--secrets ...]
   [--with <extra-dependency>]` for a Python workload, or `hf jobs run
   <image> --flavor <flavor> -- <command>` for a container.
4. Record the returned job ID immediately — it is required for every
   subsequent monitoring/cancel command.

### Phase 3 — Monitoring
1. Poll status with `hf jobs ps` (lists running/recent jobs) or
   `hf jobs inspect <id>` (full detail on one job).
2. Stream or fetch logs with `hf jobs logs <id>` to check progress or debug a
   failure — do this before assuming a long-running job is stuck.
3. If a job is misbehaving (unexpected cost trajectory, hung with no log
   output), cancel it with `hf jobs cancel <id>` rather than letting it run
   to the timeout.

### Phase 4 — Result Persistence & Verification
1. The job itself must push results to the Hub (a model, dataset, or Space)
   via `huggingface_hub.HfApi().upload_file(...)`/`upload_folder(...)` from
   inside the script — Jobs compute is ephemeral; nothing survives after the
   job ends unless it was explicitly uploaded.
2. Verify the pushed artifact exists and is complete (right file count, no
   partial upload from a timeout) before considering the job done.
3. For a recurring workload, use `hf jobs scheduled run` (or the equivalent
   scheduling subcommand) instead of manually re-submitting the same job.

## Code & Configuration Exemplars

### Exemplar 1: Self-Contained UV Script Submission
```python
# /// script
# dependencies = ["transformers", "torch", "huggingface_hub"]
# ///
from huggingface_hub import HfApi

# ... run inference / processing ...

HfApi().upload_file(
    path_or_fileobj="results.json",
    path_in_repo="results.json",
    repo_id="my-org/job-outputs",
    repo_type="dataset",
)
```
```bash
hf jobs uv run process.py \
  --flavor a10g-large \
  --secrets HF_TOKEN \
  --timeout 2h
```

### Exemplar 2: Monitoring a Running Job
```bash
JOB_ID=$(hf jobs uv run process.py --flavor t4-small --secrets HF_TOKEN)
hf jobs ps
hf jobs logs "$JOB_ID"
hf jobs inspect "$JOB_ID"
```

### Exemplar 3: Docker-Based Job
```bash
hf jobs run my-registry/custom-pipeline:latest \
  --flavor cpu-basic \
  --secrets DATA_API_KEY \
  -- python run_pipeline.py --input /data/in --output /data/out
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Job Fails Immediately with No Output
1. **Diagnosis**: A `uv` script's dependency header is malformed, or the
   chosen flavor lacks a driver/runtime the script assumes (e.g. CUDA on a
   CPU flavor).
2. **Recovery Protocol**:
   - Step 1: `hf jobs logs <id>` for the exact startup error before
     resubmitting blindly.
   - Step 2: Validate the PEP 723 header locally with `uv run --dry-run` (or
     equivalent) before resubmitting to paid compute.
   - Step 3: Confirm the flavor matches the script's hardware assumptions
     (GPU flavor for any `torch.cuda`/`device_map="auto"` usage).

### Scenario B: Job Runs to Timeout Without Finishing
1. **Diagnosis**: The workload is larger than the chosen flavor/timeout can
   handle, or it is stuck in a loop.
2. **Recovery Protocol**:
   - Step 1: Check logs for the last progress marker before the timeout to
     see how far it got.
   - Step 2: Either raise `--timeout` and/or upgrade the flavor, or shard the
     workload into smaller jobs that each finish within budget.

### Scenario C: Results Are Missing After a Job Reports Success
1. **Diagnosis**: The script finished but the upload step failed silently or
   was never reached due to an unhandled exception after the main work.
2. **Recovery Protocol**:
   - Step 1: Check `hf jobs logs <id>` for an upload error near the end of
     the run.
   - Step 2: Wrap the upload in the script so failures are loud
     (raise/exit non-zero) rather than swallowed, then re-run.

## Verification & Validation Checklist
- [ ] The chosen flavor matches the workload's actual memory/compute needs
      (estimated up front, not discovered via OOM).
- [ ] All credentials the job needs are passed as named secrets, never
      hardcoded into the submitted script/image.
- [ ] An explicit `--timeout` bounds every non-trivial job.
- [ ] The job explicitly persists its results to the Hub before exiting;
      nothing was assumed to survive on ephemeral compute.
- [ ] `hf jobs logs`/`inspect` were checked before assuming a job succeeded
      or is stuck.
- [ ] A recurring workload uses scheduled jobs rather than manual
      re-submission.
