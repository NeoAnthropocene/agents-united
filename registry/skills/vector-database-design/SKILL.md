---
name: vector-database-design
description: Designing vector database schemas, HNSW index parameter tuning, metadata filtering, and collection partitioning on Qdrant, Pinecone, and Chroma.
metadata:
  author: "Qdrant & Pinecone Community / agents-united"
  version: "2.0.0"
  license: "MIT"
---

# Vector Database Design Playbook

## Overview & Purpose
`vector-database-design` outlines schema architectures, HNSW index parameter tuning, payload filtering optimization, and multi-tenant partitioning strategies across modern vector databases (Qdrant, Pinecone, Chroma).

## When to Trigger
Trigger this skill whenever:
- Designing new vector database collection schemas and dimensionality configurations.
- Tuning HNSW indexing parameters (`m`, `ef_construct`, `ef_search`) for speed vs. recall balance.
- Setting up payload metadata indexing for low-latency pre-filtering in multi-tenant environments.
- Partitioning collections across namespaces or tenant IDs to guarantee strict data isolation.

## Input & Output Requirements
- **Inputs**: Embedding dimension size (e.g. 1536, 768), expected vector count, distance metric (Cosine, Dot, Euclidean), and metadata filtering query requirements.
- **Outputs**: Collection creation scripts, payload index definitions, connection pool configurations, and query latency benchmarks.

## Step-by-Step Execution Runbook

### Phase 1 — Schema Architecture & Distance Metric Selection
- Align vector distance metric with the training objective of the embedding model (Cosine distance for normalized embeddings).
- Allocate vector dimensionality strictly matching embedding model output.

### Phase 2 — HNSW Parameter Tuning & Payload Indexing
- Configure HNSW graph parameters: set `m=16` (edges per node) and `ef_construct=128` for high build-time quality.
- Create payload indexes on categorical and filterable metadata fields (e.g. `tenant_id`, `created_at`, `category`).

### Phase 3 — Verification & Latency Benchmarking
- Measure vector ingestion throughput and run concurrent search queries.
- Verify that filtered searches achieve < 50ms p95 latency at 1M+ vectors scale.

## Edge Cases & Boundary Conditions
- **High-Dimensionality Memory Overhead**: Use scalar or product quantization (SQ/PQ) in Qdrant/Pinecone to reduce RAM footprint by up to 75% with < 2% recall loss.
- **Extreme Payload Imbalance**: Avoid indexing high-cardinality unique text strings in payload indexes.
- **Cross-Tenant Data Leakage**: Enforce tenant ID filters at the query level or use separate namespaces per customer.

## Error Recovery & Fallbacks
- If vector insertion fails due to timeout during large batch upserts, split payloads into smaller batches of 256-512 vectors.
- If search recall drops below 95%, increase `ef_search` from 64 to 128.

## Code Exemplars & Patterns

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, HnswConfigDiff, PayloadSchemaType

client = QdrantClient(url="http://localhost:6333")

# 1. Create collection with tuned HNSW parameters
client.create_collection(
    collection_name="enterprise_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    hnsw_config=HnswConfigDiff(
        m=16,
        ef_construct=128,
        full_scan_threshold=10000,
    )
)

# 2. Create payload indexes for fast pre-filtering
client.create_payload_index(
    collection_name="enterprise_docs",
    field_name="tenant_id",
    field_schema=PayloadSchemaType.KEYWORD
)

client.create_payload_index(
    collection_name="enterprise_docs",
    field_name="created_at",
    field_schema=PayloadSchemaType.INTEGER
)
```
