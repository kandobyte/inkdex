# Core Concepts

## What is Mira

Mira is a client library for working with vector databases. It provides a high-level API for storing, searching, and managing high-dimensional vector embeddings alongside structured metadata. Mira is designed for applications that need semantic search, recommendation systems, or any use case where similarity-based retrieval is more appropriate than exact-match lookups.

Unlike traditional databases that organize data by value or key, Mira organizes data by geometric proximity in a high-dimensional space. Two vectors are considered similar if they are close together in that space, regardless of their exact values. This property makes Mira well-suited for tasks like finding documents that express similar ideas, even when they share no words in common.

## How Vector Search Works

Vector search operates on the principle that semantic meaning can be represented as a point in high-dimensional space. When you index a piece of content, you first convert it into a vector using an embedding model. The embedding model assigns coordinates such that semantically similar content ends up geometrically close together.

When you run a query, the query text is also converted to a vector using the same embedding model. Mira then finds the stored vectors nearest to the query vector and returns the associated content. This is called approximate nearest neighbor (ANN) search.

The "approximate" qualifier matters: exact nearest neighbor search requires comparing a query against every stored vector, which is too slow at scale. Mira uses indexing structures like HNSW to return results that are very close to the true nearest neighbors without an exhaustive scan. The trade-off is a small, controllable probability of missing the single best result, in exchange for searches that complete in milliseconds.

## Embeddings

An embedding is a fixed-length list of floating-point numbers that encodes the semantic content of some input. Embeddings are produced by embedding models—neural networks trained such that similar inputs map to nearby points in the embedding space.

Mira is embedding-model agnostic: you generate embeddings outside of Mira and pass them in. This means you can use any model, from lightweight local models like `all-MiniLM-L6-v2` (384 dimensions) to large hosted models like OpenAI's `text-embedding-3-large` (3072 dimensions). The only requirement is that all vectors in a collection have the same number of dimensions, and that query vectors are produced by the same model used at index time. Mixing models within a collection produces meaningless search results.

## Similarity Metrics

### Cosine Similarity

Cosine similarity measures the angle between two vectors, ignoring their magnitude. A score of 1.0 means the vectors point in exactly the same direction; 0.0 means they are orthogonal; -1.0 means they point in opposite directions. It is defined as the dot product of two unit-normalized vectors.

Cosine similarity is the most commonly used metric for text embeddings because most embedding models encode meaning in the direction of a vector, not its length. If your embeddings are already L2-normalized, cosine similarity is equivalent to dot product and can be computed more efficiently.

### Euclidean Distance

Euclidean distance measures the straight-line distance between two points in vector space. Unlike cosine similarity, it is sensitive to vector magnitude. A smaller Euclidean distance indicates higher similarity. Euclidean distance is appropriate when the absolute position of a vector carries meaning, such as with image embeddings trained with a triplet loss that explicitly encodes distance.

For most text embedding models, cosine similarity produces better retrieval quality than Euclidean distance, because the models are not trained to produce vectors where magnitude is meaningful.

### Dot Product

Dot product similarity is the raw sum of element-wise products of two vectors. It is faster to compute than cosine similarity when vectors are not normalized. However, dot product is sensitive to vector magnitude, which can cause high-norm vectors to dominate search results in ways unrelated to semantic relevance.

Use dot product only when your embedding model documentation explicitly states that it is trained for dot product similarity, or when you have experimentally confirmed that it outperforms cosine similarity for your use case.

## Namespaces

A namespace is a logical partition within a collection. Vectors in different namespaces are completely isolated: a search in namespace `production` will never return results from namespace `staging`, even within the same collection. Namespaces are created implicitly when you first insert a vector with a given namespace value.

Namespaces are the recommended way to implement multi-tenancy. Rather than creating a separate collection per tenant, create one collection and use tenant IDs as namespace values. This reduces administrative overhead while maintaining strict data isolation between tenants.

A namespace cannot be renamed. To move vectors from one namespace to another, you must re-insert them with the new namespace value and delete the originals.

## Metadata Filtering

Every vector in Mira can have an associated metadata object: a flat key-value map of strings, numbers, and booleans. Metadata is stored alongside the vector and indexed for fast filtering.

When you provide a metadata filter in a search query, Mira narrows the candidate set to matching vectors before running ANN search. This lets you combine semantic similarity with exact structured constraints—for example, "find vectors semantically similar to this query, but only where `status = 'published'` and `language = 'en'`".

Metadata filter performance degrades if the filter is highly selective. When a filter matches fewer than roughly 5% of vectors in a collection, the ANN index cannot find enough close neighbors and may return fewer results than requested, or results of lower quality. In such cases, consider using separate collections per filter segment rather than metadata filtering.

## When to Use Vector Search vs Keyword Search

Vector search and keyword search have complementary strengths. Keyword search (BM25, TF-IDF) is exact and predictable: it finds documents containing the words in your query. Vector search is fuzzy and semantic: it finds conceptually similar documents even when they use entirely different words.

Use vector search when users phrase queries in natural language, when the content is long-form prose, or when you need to handle paraphrases and synonyms gracefully. Use keyword search when queries contain exact identifiers like error codes, function names, or product SKUs, and when exact recall is a hard requirement.

Hybrid search combines both signals, typically using reciprocal rank fusion (RRF) to merge the two ranked result lists. This is the best default for general-purpose search because it performs well across both query types without requiring tuning per query.
