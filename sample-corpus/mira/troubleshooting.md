# Troubleshooting

## MiraConnectionError

**Symptom:** Every request throws `MiraConnectionError: connect ECONNREFUSED` or `MiraConnectionError: getaddrinfo ENOTFOUND api.mira-db.com`.

**Cause:** The client cannot reach the Mira API. This is almost always a network or configuration issue, not a bug in your code.

**Resolution:**
1. Check that your machine or container has outbound internet access to `api.mira-db.com` on port 443. If you are behind a corporate proxy or firewall, ensure the Mira domain is allowlisted.
2. If you are using a custom `baseUrl`, verify the URL is correct and reachable. A trailing slash in the URL can cause routing issues.
3. Check your DNS configuration. Running `nslookup api.mira-db.com` should resolve to an IP address; `NXDOMAIN` means DNS resolution is failing.
4. If you are running in a Docker container, ensure the container's network mode is not `host`-isolated in a way that blocks outbound connections.

## MiraAuthenticationError

**Symptom:** Requests fail with `MiraAuthenticationError: 401 Unauthorized`.

**Cause:** The API key or token is invalid, expired, or has been revoked.

**Resolution:**
1. Verify the `MIRA_API_KEY` environment variable is set in your process. A common mistake is setting the variable in your shell but not passing it to your application runtime.
2. Check that the key has not been revoked in the Mira dashboard under **Settings → API Keys**.
3. If you are using short-lived tokens, confirm your token refresh logic is running and that the refreshed token is being passed to the client constructor. Note that `MiraClient` does not automatically refresh tokens; you must create a new client instance or implement refresh logic externally.
4. Ensure the key has the necessary permissions for the operation you are performing. Read-only keys cannot insert or delete vectors.

## Search Returns Empty Results

**Symptom:** `collection.search()` returns an empty array or fewer results than requested, even though vectors have been inserted.

**Cause:** Most often a namespace mismatch, an overly restrictive metadata filter, or vectors inserted with a different embedding model than the one used at query time.

**Resolution:**
1. Check that the `namespace` parameter in your search matches the namespace used when inserting. If vectors were inserted without a namespace, they are in the default namespace; search without specifying a namespace to query it.
2. If you are using a metadata filter, try removing it temporarily. If results appear without the filter, the filter is too selective or the metadata values do not match what you inserted.
3. Confirm that the collection is not empty: `await collection.count()` should return a non-zero number.
4. Verify that the query vector was produced by the same embedding model used to index the vectors. Mixing models—for example, indexing with `all-MiniLM-L6-v2` but querying with `text-embedding-3-small`—produces vectors in incompatible spaces, resulting in random or empty results.

## Search Returns Irrelevant Results

**Symptom:** Search returns results, but they are not semantically related to the query.

**Cause:** Mismatched embedding models between index and query time is the most common cause. Other causes include very short queries (insufficient signal) or content that is genuinely difficult for the embedding model.

**Resolution:**
1. Confirm both insert and search use the same embedding model and the same preprocessing (tokenization, normalization). Even using the same model but different tokenizer settings can cause subtle misalignment.
2. If scores are uniformly low (near 0 for cosine similarity), the model may not be well-suited to your content domain. Consider trying a domain-specific model or a larger general-purpose model.
3. Check whether your collection was created with the correct `metric`. If you created it with `metric: 'dot'` but your model outputs non-normalized vectors, results will be dominated by high-magnitude vectors regardless of semantic content.
4. For short queries (under ~5 words), results may be noisy because the embedding has less signal to work with. Consider query expansion techniques to add context.

## DimensionMismatchError

**Symptom:** `insert()` or `search()` throws `DimensionMismatchError: expected 384 dimensions, got 1536`.

**Cause:** The vector you are passing has a different number of dimensions than the collection was created with.

**Resolution:**
1. Check the output size of your embedding model. `text-embedding-3-small` outputs 1536 dimensions; `all-MiniLM-L6-v2` outputs 384. If you recently changed embedding models, you need to create a new collection with the correct `dimensions` value and re-index.
2. If you are truncating or slicing embeddings before insertion, verify the slice length matches the collection dimensions.
3. Run `await mira.listCollections()` to confirm the `dimensions` field of the target collection.

## High Search Latency

**Symptom:** Search requests take longer than expected, sometimes timing out.

**Cause:** Large `efSearch` values, very large result limits, or network latency to a distant region.

**Resolution:**
1. Check that your application is connecting to the regional endpoint closest to your servers. Connecting from a EU server to the US East endpoint adds ~100ms of network latency per request.
2. If you are requesting a high `limit` (e.g., 100–1000), reduce it. Large result sets take longer to compute and transfer.
3. For HNSW collections, the `efSearch` parameter controls the speed/recall trade-off. A high `efSearch` improves recall but increases latency. Pass a lower `efSearch` per query if you can tolerate slightly lower recall: `collection.search({ values, limit: 10, efSearch: 20 })`.
4. If latency spikes are intermittent, check the [Mira status page](https://status.mira-db.com) for active incidents.

## Insert Rejected: Metadata Value Type Error

**Symptom:** `insert()` throws `ValidationError: metadata field 'price' must be a string, number, or boolean; got object`.

**Cause:** Mira metadata values must be scalar types. Nested objects, arrays, and `null` are not supported.

**Resolution:**
1. Flatten any nested metadata before insertion. For example, instead of `{ author: { name: 'Alice' } }`, use `{ author_name: 'Alice' }`.
2. Serialize array values to strings if you need to store them: `{ tags: ['api', 'auth'].join(',') }`.
3. Replace `null` values with a sentinel string like `'__null__'` or omit the key entirely.

## Memory Usage Grows Unboundedly

**Symptom:** Your application process memory increases continuously when performing large batch inserts or repeated searches.

**Cause:** The client holds response body buffers in memory until they are fully consumed. If you are not awaiting insert/search calls, buffers accumulate.

**Resolution:**
1. Ensure every `insert()` and `search()` call is properly awaited. Fire-and-forget patterns cause buffered responses to pile up.
2. For large batch inserts, process records in chunks of 500–1000 and await each chunk before preparing the next. This bounds memory usage to roughly two batch buffers at any time.
3. If you are running many parallel searches, limit concurrency with a pool or semaphore. Unbounded `Promise.all()` over thousands of queries will hold all response bodies in memory simultaneously.
