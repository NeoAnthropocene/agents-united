---
name: rag-vector-pipeline
description: Advanced Retrieval-Augmented Generation (RAG) pipelines with
  LangChain, LlamaIndex, hybrid search (dense + sparse), and cross-encoder
  re-ranking.
metadata:
  author: LangChain & LlamaIndex / agents-united
  version: 2.0.0
  license: MIT
  icon: 🧠
disable-slash-command: true
---

# RAG Vector Pipeline Playbook

## Overview & Purpose
`rag-vector-pipeline` establishes architectural standards for building high-accuracy, hallucination-resistant Retrieval-Augmented Generation systems using LangChain and LlamaIndex.

## When to Trigger
Trigger this skill whenever:
- Designing end-to-end RAG question-answering systems over unstructured documents.
- Implementing semantic chunking, metadata enrichment, and vector embedding pipelines.
- Building hybrid search combining sparse BM25 keyword matching and dense vector embeddings.
- Integrating cross-encoder re-ranking models (Cohere, BGE) to improve context precision.

## Input & Output Requirements
- **Inputs**: Raw documents (Markdown, PDF, HTML), embedding model configuration, vector database credentials, and top-K query parameters.
- **Outputs**: Indexed vector collections, query retrieval engines, grounded context passages with line citations, and answer synthesis pipelines.

## Step-by-Step Execution Runbook

### Phase 1 — Document Ingestion & Chunking Optimization
- Partition raw documents using recursive character splitting (500-1000 tokens, 15% overlap).
- Attach rich metadata tags (document ID, header hierarchy, URL, timestamp).

### Phase 2 — Embedding Generation & Hybrid Indexing
- Generate vector embeddings using dense models (OpenAI, BGE, Voyage).
- Store vectors in vector collections alongside sparse inverted token indexes.

### Phase 3 — Retrieval & Re-Ranking Execution
- Retrieve top-20 candidate passages via Reciprocal Rank Fusion (RRF).
- Re-rank candidates through cross-encoder models to yield top-5 high-relevance chunks.

### Phase 4 — Answer Synthesis & Grounding Verification
- Synthesize response with strict system prompts requiring source citations.
- Verify context grounding score to block hallucinations before delivery.

## Edge Cases & Boundary Conditions
- **Missing Knowledge / Out-of-Domain Queries**: If retrieved context similarity score falls below threshold (< 0.70), return an explicit "information not found" answer rather than improvising.
- **Contradictory Context Passages**: Use document recency timestamps and source priority weights to resolve conflicting claims.
- **Large Context Exceeding LLM Window**: Implement summarization or hierarchical map-reduce retrieval chains.

## Error Recovery & Fallbacks
- When vector database connection drops, fall back to cached local vector index or keyword search.
- If primary embedding API experiences rate limiting, switch to local embedding model (e.g. BAAI/bge-small-en-v1.5).

## Code Exemplars & Patterns

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.postprocessor import SentenceTransformerRerank

# 1. Load and partition documents
documents = SimpleDirectoryReader("./docs").load_data()
node_parser = SentenceSplitter(chunk_size=512, chunk_overlap=64)
nodes = node_parser.get_nodes_from_documents(documents)

# 2. Build index
index = VectorStoreIndex(nodes)

# 3. Configure query engine with cross-encoder re-ranking
reranker = SentenceTransformerRerank(
    model="BAAI/bge-reranker-large",
    top_n=5
)
query_engine = index.as_query_engine(
    similarity_top_k=20,
    node_postprocessors=[reranker]
)

response = query_engine.query("What are the architectural guardrails for deployment?")
print(str(response))
```
