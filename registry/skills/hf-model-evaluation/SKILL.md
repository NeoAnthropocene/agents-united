---
name: hf-model-evaluation
description: Automated evaluation, benchmarking, dataset curation, and leaderboard metric verification using the Hugging Face ecosystem (Evaluate, Datasets, Transformers).
metadata:
  author: "Hugging Face / agents-united"
  version: "2.0.0"
  license: "MIT"
---

# Hugging Face Model Evaluation Playbook

## Overview & Purpose
`hf-model-evaluation` provides standardized benchmarking workflows for assessing LLM and embedding model performance on standardized evaluation benchmarks using Hugging Face datasets and evaluation harnesses.

## When to Trigger
Trigger this skill whenever:
- Running deterministic evaluation benchmarks (MMLU, GSM8k, HumanEval, ARC, Hellaswag).
- Measuring LLM answer faithfulness, context recall, and toxicity scoring with automated harnesses.
- Curating golden evaluation splits and synthetic test datasets with Hugging Face Datasets.
- Generating comprehensive model cards and leaderboard performance summaries.

## Input & Output Requirements
- **Inputs**: Target model weights/repo ID, evaluation dataset split names, benchmark task configuration YAML, and random seeds.
- **Outputs**: Automated metric reports (accuracy, exact match, F1, ROUGE, BERTScore), latency benchmarks, and Hugging Face model cards.

## Step-by-Step Execution Runbook

### Phase 1 — Benchmark Task & Dataset Configuration
- Load standardized benchmark datasets via `datasets.load_dataset()`.
- Define few-shot prompt formatting templates and deterministic parameters (temperature=0, top_p=1.0).

### Phase 2 — Evaluation Harness Execution
- Run batch evaluation using `lm-evaluation-harness` or `ragas` library.
- Log token generation latency, GPU memory footprint, and exact match outputs.

### Phase 3 — Metric Aggregation & Error Analysis
- Aggregate scores across dataset domains and identify failure clusters.
- Compute confidence intervals and statistical significance deltas against baseline models.

### Phase 4 — Model Card Publishing
- Document evaluation methodology, carbon footprint, model limitations, and benchmark results in a README model card.

## Edge Cases & Boundary Conditions
- **Data Contamination**: Audit evaluation test splits against training datasets to ensure no memorization or test set leakage.
- **Non-Deterministic Outputs**: Fix random seeds in PyTorch, CUDA, and Hugging Face pipelines (`transformers.set_seed(42)`).
- **Prompt Sensitivity Variations**: Evaluate across 3 distinct prompt variations to measure prompt robustness.

## Error Recovery & Fallbacks
- If GPU VRAM is exceeded during evaluation, reduce batch size or enable 8-bit model loading (`load_in_8bit=True`).
- If dataset download fails from Hugging Face Hub, use cached local disk splits.

## Code Exemplars & Patterns

```python
import evaluate
from datasets import load_dataset
from transformers import pipeline, set_seed

set_seed(42)

# 1. Load evaluation metric and dataset
exact_match_metric = evaluate.load("exact_match")
eval_dataset = load_dataset("trivia_qa", "rc.nocontext", split="validation[:100]")

# 2. Initialize generation pipeline
generator = pipeline("text-generation", model="meta-llama/Llama-3.1-8B-Instruct", device_map="auto")

predictions = []
references = []

for item in eval_dataset:
    prompt = f"Answer concisely: {item['question']}\nAnswer:"
    res = generator(prompt, max_new_tokens=32, temperature=0.0)
    pred_text = res[0]['generated_text'].replace(prompt, '').strip()
    predictions.append(pred_text)
    references.append(item['answer']['value'])

results = exact_match_metric.compute(predictions=predictions, references=references)
print(f"Exact Match Accuracy: {results['exact_match']:.2%}")
```
