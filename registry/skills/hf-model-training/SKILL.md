---
name: hf-model-training
description: Fine-tuning workflow for language and vision models using Hugging
  Face TRL (SFT, DPO, GRPO) and PEFT/LoRA, including running the job on
  Hugging Face Jobs managed compute. Use when fine-tuning a model, choosing
  between full fine-tuning and LoRA, or setting up an SFT/DPO/GRPO training
  run.
metadata:
  author: Hugging Face / agents-united
  version: 1.0.0
  source: https://github.com/huggingface/trl
  commit: 80f9fa530e46f4ae642fcb9e1725bad0e1979395
  license: Apache-2.0
  icon: 🎛️
disable-slash-command: true
---

# Hugging Face Model Training (TRL Fine-Tuning)

## Overview & Purpose
`hf-model-training` covers the fine-tuning half of the model lifecycle: using
TRL's trainers (`SFTTrainer`, `DPOTrainer`, `GRPOTrainer`) with PEFT/LoRA to
adapt a base model to a task or preference dataset, and submitting that run
to managed compute. It is distinct from the catalog's `hf-model-evaluation`
skill, which covers running benchmarks/eval harnesses on an already-trained
model — this skill is what produces the model that gets evaluated.

## Execution Triggers & Prerequisites
### Execution Triggers
- Fine-tuning a base model on a task-specific dataset (SFT).
- Aligning a model to human/AI preference data (DPO) or an RL objective
  (GRPO).
- Deciding between full fine-tuning, LoRA, or QLoRA for a given model size
  and available hardware.
- Converting/uploading a trained adapter or merged model back to the Hub.

### Prerequisites
- `trl`, `transformers`, `peft`, and `accelerate` installed (or a `uv` PEP-723
  inline-dependency script, TRL's supported pattern for Jobs runs).
- A prepared, deduplicated training dataset in the format the chosen trainer
  expects (chat-formatted for SFT, chosen/rejected pairs for DPO).
- A Hugging Face access token (`hf auth login`) if pushing checkpoints or
  running on Hugging Face Jobs.
- GPU budgeting decided up front: local GPU, or a Jobs `flavor` (see
  `hf-managed-jobs`) — do not start a multi-hour run on undersized hardware
  without first estimating memory from model size × precision × batch size.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `base_model` | String | Yes | Hub model ID to fine-tune |
| `dataset` | String / Path | Yes | Hub dataset ID or local path, in the trainer's expected schema |
| `method` | String | Yes | `sft`, `dpo`, or `grpo` |
| `peft_config` | Object | Optional | LoRA rank/alpha/target modules; omit for full fine-tuning |
| `output_repo` | String | Optional | Hub repo to push the resulting model/adapter to |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Trained model/adapter | Local dir or Hub repo | LoRA adapter or merged full-precision model |
| Training config | `SFTConfig`/`DPOConfig` (serialized) | Reproducible run configuration |
| Training logs | stdout / `hf jobs logs` | Loss curves, learning rate schedule, eval metrics if configured |

## Step-by-Step Execution Runbook

### Phase 1 — Method & Data Selection
1. Confirm the training objective first: SFT for instruction-following on
   labeled examples, DPO for preference alignment on chosen/rejected pairs,
   GRPO for RL-style optimization against a reward signal. Do not default to
   SFT if the actual data is preference pairs.
2. Validate the dataset schema matches the chosen trainer's expected columns
   before launching a run — a schema mismatch fails fast in TRL's data
   collator, but only after tokenization overhead if not checked first.
3. Deduplicate and hold out an eval split; training without any eval split
   makes overfitting invisible until the model ships.

### Phase 2 — LoRA vs Full Fine-Tuning
1. Default to LoRA/QLoRA for models above a few billion parameters unless
   the task specifically needs full-parameter updates (e.g. large domain
   shift) — LoRA trains a small adapter, drastically cutting GPU memory and
   storage.
2. Set `target_modules` to the model's attention projection layers
   (commonly `q_proj`, `k_proj`, `v_proj`, `o_proj`) as a starting point;
   widen to MLP layers only if LoRA-only attention tuning underfits.
3. Use QLoRA (4-bit quantized base weights via `bitsandbytes`) when the base
   model does not fit in available GPU memory at full/half precision.
4. Full fine-tuning requires `accelerate launch` with an appropriate
   distributed strategy (DDP/FSDP/DeepSpeed) once the model no longer fits on
   a single GPU — decide this before writing the training script, not after
   an out-of-memory failure.

### Phase 3 — Running the Trainer
1. Configure `SFTConfig`/`DPOConfig` explicitly: learning rate, batch size
   (and gradient accumulation to reach an effective batch size that fits in
   memory), number of epochs, and `eval_strategy`.
2. Use the TRL CLI for the common case (`trl sft --model_name_or_path ...
   --dataset_name ...`) instead of hand-writing a training script when no
   custom logic is needed — it stays in sync with TRL's own defaults.
3. Log training metrics (loss, learning rate, eval loss) to a tracker
   (Trackio, TensorBoard, or W&B) rather than relying on scrollback.
4. For a long or GPU-hungry run, submit as a Hugging Face Jobs run
   (`hf jobs uv run train.py --flavor a10g-large ...`) rather than blocking a
   local machine — see `hf-managed-jobs` for the Jobs CLI surface.

### Phase 4 — Verification & Publishing
1. Evaluate the trained model against the held-out eval split (and, for a
   released model, against the catalog's `hf-model-evaluation` benchmarks)
   before publishing.
2. For a LoRA adapter, verify it loads and merges cleanly
   (`PeftModel.from_pretrained(...).merge_and_unload()`) if a merged model is
   required downstream.
3. Push the model/adapter to the Hub with a model card documenting the base
   model, method, dataset, and hyperparameters — never push a checkpoint with
   no provenance.

## Code & Configuration Exemplars

### Exemplar 1: SFT via the TRL CLI
```bash
trl sft \
  --model_name_or_path Qwen/Qwen2.5-7B \
  --dataset_name trl-lib/Capybara \
  --learning_rate 2e-5 \
  --num_train_epochs 3 \
  --per_device_train_batch_size 4 \
  --gradient_accumulation_steps 4 \
  --output_dir ./sft-output \
  --push_to_hub
```

### Exemplar 2: LoRA + SFTTrainer (Python)
```python
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

peft_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)

trainer = SFTTrainer(
    model="Qwen/Qwen2.5-7B",
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    args=SFTConfig(output_dir="./sft-lora", per_device_train_batch_size=4,
                    gradient_accumulation_steps=4, eval_strategy="steps"),
    peft_config=peft_config,
)
trainer.train()
```

### Exemplar 3: Submitting a Training Script to Hugging Face Jobs
```bash
hf jobs uv run train_sft.py \
  --flavor a10g-large \
  --secrets HF_TOKEN \
  --with trl --with peft --with accelerate
```

## Edge Cases & Error Recovery Procedures

### Scenario A: CUDA Out-of-Memory Mid-Training
1. **Diagnosis**: OOM during a forward/backward pass, usually on the first
   optimizer step where activations peak.
2. **Recovery Protocol**:
   - Step 1: Reduce `per_device_train_batch_size`, raising
     `gradient_accumulation_steps` to keep the effective batch size stable.
   - Step 2: Switch from full fine-tuning to LoRA, or from LoRA to QLoRA, if
     the base model itself doesn't fit.
   - Step 3: Enable gradient checkpointing before resorting to a smaller
     model or fewer GPUs.

### Scenario B: Training Loss Drops but Eval Loss Rises (Overfitting)
1. **Diagnosis**: Classic overfitting, more visible with small fine-tuning
   datasets and too many epochs.
2. **Recovery Protocol**:
   - Step 1: Reduce epochs or add early stopping on eval loss.
   - Step 2: Increase LoRA dropout or add weight decay.
   - Step 3: Re-check the eval split isn't leaking near-duplicates from
     train.

### Scenario C: DPO/GRPO Trainer Rejects the Dataset Schema
1. **Diagnosis**: The dataset lacks the expected `chosen`/`rejected` (DPO) or
   reward-relevant columns (GRPO).
2. **Recovery Protocol**:
   - Step 1: Reshape the dataset to the trainer's documented column names
     before launching, not by patching the collator.
   - Step 2: Re-run Phase 1's schema validation on a small sample before the
     full run.

## Verification & Validation Checklist
- [ ] Training objective (SFT/DPO/GRPO) matches the actual shape of the
      training data.
- [ ] An eval split exists and is monitored during training.
- [ ] LoRA/QLoRA vs full fine-tuning was a deliberate decision based on model
      size and available hardware, not a default left unexamined.
- [ ] The trained model/adapter was evaluated on a held-out split (and, if
      publishing, against the catalog's `hf-model-evaluation` benchmarks)
      before being pushed to the Hub.
- [ ] A model card documents base model, method, dataset, and
      hyperparameters.
- [ ] Long/GPU-heavy runs were submitted to managed compute
      (`hf jobs uv run ...`) rather than blocking a local machine.
