# Limits and Quotas

## Overview

Mira enforces limits at the account, collection, and request level. Exceeding a limit returns an HTTP 429 (rate limit) or HTTP 400 (validation error), depending on the type of limit. The client retries 429 responses automatically according to the `maxRetries` setting; 400 errors are not retried.

All limits listed here apply to the Standard plan. Enterprise plans have higher or custom limits negotiated at contract time. To request a limit increase, contact support with your account ID and the specific limit you need raised.

## Request Limits

### Batch Insert Size

Maximum records per `insert()` call: **1,000 records**.

If you attempt to insert more than 1,000 records in a single call, the request is rejected with `ValidationError: batch size exceeds maximum of 1000`. Split large datasets into chunks of 1,000 and insert sequentially or with controlled concurrency.

### Search Result Limit

Maximum `limit` per `search()` call: **1,000 results**.

Requesting more than 1,000 results in a single search is not supported. For use cases that require exhaustive retrieval (e.g., exporting all vectors), use `fetch()` with pagination instead.

### Fetch by ID Limit

Maximum IDs per `fetch()` call: **100 IDs**.

### Delete by ID Limit

Maximum IDs per `delete({ ids })` call: **1,000 IDs**.

Delete by filter (`delete({ filter })`) is not subject to an ID count limit, but deletes more than 100,000 vectors may time out on Standard plan accounts. Use `deleteAll: true` within a namespace to delete all vectors in a namespace atomically.

## Dimension Limits

Minimum vector dimensions: **2**.
Maximum vector dimensions: **4,096**.

Collections configured with more than 4,096 dimensions are not supported. If your embedding model outputs more dimensions than this limit (currently no major model does), contact support to discuss options.

## Metadata Limits

Maximum metadata keys per vector: **64**.
Maximum metadata key length: **64 characters**.
Maximum metadata value length (string): **512 characters**.
Maximum total metadata size per vector: **4 KB**.

Metadata exceeding these limits causes the insert to be rejected with a `ValidationError`. If you need to store larger text payloads per vector, split them into multiple metadata keys or store them externally and reference them by ID.

## Collection Limits

Maximum collections per account: **100** (Standard plan).

Maximum vectors per collection: **50,000,000** (50M).

Collections approaching 50M vectors may exhibit increased write latency as the HNSW index grows. If you anticipate exceeding this limit, contact support to discuss dedicated infrastructure options.

Maximum collection name length: **128 characters**. Names must match the pattern `[a-zA-Z0-9_-]+` (alphanumeric, underscores, and hyphens only).

## Rate Limits

### Write Rate Limits

Maximum insert throughput: **10,000 vectors per second** per account.

This limit is measured over a 10-second sliding window. Sustained inserts above this rate receive HTTP 429 responses. The client retries with exponential backoff, so exceeding the rate limit briefly is handled automatically; sustained overages will cause increased latency.

For bulk ingestion jobs that must complete quickly, spread inserts across multiple parallel workers with a concurrency limit of 8–16. Each worker should handle one batch of 1,000 vectors at a time, awaiting completion before starting the next.

### Read Rate Limits

Maximum search requests: **1,000 per second** per account.

Maximum fetch requests: **500 per second** per account.

Read rate limits are enforced per account, not per collection. A spike in searches against one collection reduces the available budget for other collections. If your application has multiple high-traffic collections, consider upgrading to an Enterprise plan with per-collection rate limit allocation.

### Management API Rate Limits

Collection create/delete operations: **10 per minute** per account.

`listCollections()` calls: **60 per minute** per account.

These limits exist to prevent accidental runaway collection creation (e.g., a bug that creates a new collection per request). Management API calls are not affected by the read/write rate limits above.

## Vector ID Limits

Maximum ID length: **512 characters**.

IDs may contain any printable UTF-8 characters. IDs are case-sensitive: `Doc-1` and `doc-1` are different IDs. There is no restriction on ID format beyond length, but using predictable, stable IDs (e.g., a hash of the source content) makes upserts idempotent and simplifies re-indexing pipelines.

## Namespace Limits

Maximum namespaces per collection: **10,000**.

Maximum namespace name length: **256 characters**.

Namespace names may contain any printable UTF-8 characters. Namespaces are created automatically on first insert and deleted automatically when the last vector in them is deleted. There is no explicit namespace creation or deletion operation.

## Storage Limits

Maximum storage per account: **500 GB** (Standard plan).

Storage is calculated as the total size of all vector data, HNSW graph data, FTS index data, and metadata across all collections. You can view current storage usage in the Mira dashboard under **Settings → Usage**.

When storage approaches the limit, insert requests begin returning HTTP 507 (Insufficient Storage). Deleting unused collections or vectors frees storage immediately.
