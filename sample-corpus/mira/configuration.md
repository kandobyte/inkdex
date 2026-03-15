# Configuration

## Overview

Mira client behavior is controlled through options passed to the `MiraClient` constructor and through environment variables. Constructor options take precedence over environment variables. Most applications only need to set `apiKey` and leave everything else at defaults.

This page documents all available configuration knobs. For index-level tuning (HNSW parameters, IVF parameters), see the [Index Parameters](#index-parameters) section below. For authentication-specific configuration, see [Authentication](./authentication.md).

## Connection Settings

### baseUrl

The base URL for all API requests. Defaults to `https://api.mira-db.com`. Override this to connect to a self-hosted Mira instance or a regional endpoint.

```typescript
const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
  baseUrl: 'https://eu-west.mira-db.com',
});
```

Available regional endpoints:

| Region | Endpoint |
|--------|----------|
| US East | `https://us-east.mira-db.com` |
| US West | `https://us-west.mira-db.com` |
| EU West | `https://eu-west.mira-db.com` |
| AP Southeast | `https://ap-southeast.mira-db.com` |

Connect to the region closest to your application servers to minimize round-trip latency. This is especially important for workloads that issue many small search queries.

### timeout

Request timeout in milliseconds. Applies to each individual HTTP request, not to the overall operation (retries each get their own timeout). Defaults to `10000` (10 seconds).

```typescript
const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
  timeout: 3000, // fail fast for latency-sensitive paths
});
```

If you are inserting large batches (close to the 1000-record limit), consider increasing the timeout to 30–60 seconds. Large inserts may take several seconds to index.

### maxRetries

Number of times to retry on transient errors. Defaults to `3`. Retried errors include HTTP 429 (rate limit), HTTP 503 (service unavailable), and network-level failures (ECONNRESET, ETIMEDOUT). HTTP 4xx errors other than 429 are not retried.

Retries use exponential backoff with jitter. The delay between attempts is `min(2^attempt * 100ms + random(0, 100ms), 10s)`.

Set to `0` to disable retries entirely, which is useful in test environments where you want failures to surface immediately.

## Index Parameters

Index parameters are set when creating a collection and cannot be changed afterward. Choose them based on your expected corpus size and the latency/recall trade-off you need.

### HNSW Settings

HNSW (Hierarchical Navigable Small World) is the default index type. It offers the best balance of search speed and recall for most use cases.

```typescript
await mira.createCollection('documents', {
  dimensions: 384,
  metric: 'cosine',
  indexType: 'hnsw',
  hnswOptions: {
    m: 16,           // number of bi-directional links per node
    efConstruction: 200, // search depth during index construction
  },
});
```

**`m`** (default: 16): Controls the number of connections each node has in the graph. Higher values increase recall and memory usage but slow down inserts. Values between 8 and 64 are typical. Use 16 for a balanced default, 32–64 for high-recall requirements.

**`efConstruction`** (default: 200): Controls the search depth used when building the index. Higher values produce a better index at the cost of slower inserts. Increase to 400–800 if insert throughput is not a bottleneck and you want maximum recall.

**`efSearch`** (default: 50): Controls search depth at query time. Higher values improve recall at the cost of higher query latency. Can be overridden per search query via the `efSearch` option in `collection.search()`.

### IVF Settings

IVF (Inverted File Index) is an alternative for very large collections (>10M vectors) where memory usage is a concern. It is less accurate than HNSW at the same latency budget.

```typescript
await mira.createCollection('large-corpus', {
  dimensions: 1536,
  metric: 'cosine',
  indexType: 'ivf',
  ivfOptions: {
    nlist: 1024,  // number of Voronoi cells
    nprobe: 32,   // cells to search at query time
  },
});
```

**`nlist`**: Number of clusters. A common heuristic is `sqrt(vectorCount)`. Too few clusters reduce recall; too many increase memory and slow inserts.

**`nprobe`**: Number of cells to search per query. Higher values improve recall at the cost of higher latency. Start with `nprobe = nlist / 32` and increase until you reach your recall target.

## Retry and Timeout

See [Connection Settings](#connection-settings) for the `timeout` and `maxRetries` options. For per-operation timeouts (overriding the client-level default), pass a `timeout` option to the operation:

```typescript
await collection.insert(records, { timeout: 30000 });
const results = await collection.search({ values: queryVec, limit: 5 }, { timeout: 2000 });
```

Per-operation timeouts override the client-level `timeout` only for that call.

## Logging

The client emits structured log events that you can intercept by providing a `logger` option. The logger must implement `debug`, `info`, `warn`, and `error` methods.

```typescript
import pino from 'pino';

const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
  logger: pino({ level: 'debug' }),
});
```

At the `debug` level, the client logs every request URL, method, response status, and duration. At the `info` level, only retries and errors are logged. Production deployments should use `info` or `warn` to avoid excessive log volume.

## Environment Variables

The client reads the following environment variables as defaults. Constructor options always override environment variables.

| Variable | Equivalent option | Description |
|----------|-------------------|-------------|
| `MIRA_API_KEY` | `apiKey` | API key used for authentication. |
| `MIRA_BASE_URL` | `baseUrl` | Override the API base URL. |
| `MIRA_TIMEOUT` | `timeout` | Request timeout in milliseconds. |
| `MIRA_MAX_RETRIES` | `maxRetries` | Maximum number of retries. |
| `MIRA_LOG_LEVEL` | — | Log level: `debug`, `info`, `warn`, `error`, or `silent`. |

Using environment variables is recommended over hardcoding options in your application code, as it allows configuration to vary between environments (development, staging, production) without code changes.
