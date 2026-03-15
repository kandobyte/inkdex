# Quickstart

## Prerequisites

Before you begin, you need:

- Node.js 18 or later, or Python 3.9 or later
- A Mira account and an API key (see [Authentication](./authentication.md))
- An embedding model to generate vectors. This guide uses `all-MiniLM-L6-v2` via the `@xenova/transformers` package, which runs locally without an API key.

If you do not have an API key, sign in to the Mira dashboard, navigate to **Settings → API Keys**, and click **Create key**. Copy the key immediately; it will not be shown again.

## Installation

Install the Mira client using your package manager:

```bash
npm install @mira-db/client
```

Or for Python:

```bash
pip install mira-client
```

The client has no native dependencies and works in Node.js, browsers (via bundlers), and edge runtimes. For browser usage, set `dangerouslyAllowBrowser: true` in the client options and ensure your API key is not exposed in client-side code.

## Creating a Client

Instantiate the client with your API key. The recommended approach is to read the key from an environment variable:

```typescript
import { MiraClient } from '@mira-db/client';

const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
});
```

By default the client connects to `https://api.mira-db.com`. To connect to a self-hosted instance or a regional endpoint, set the `baseUrl` option:

```typescript
const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
  baseUrl: 'https://eu-west.mira-db.com',
});
```

The client is stateless and thread-safe. Create one instance per process and reuse it throughout your application. Creating a new client per request adds unnecessary TLS handshake overhead.

## Creating a Collection

A collection is a named container for vectors of a fixed dimension. Create a collection before inserting any vectors:

```typescript
await mira.createCollection('documents', {
  dimensions: 384,
  metric: 'cosine',
});
```

The `dimensions` value must match the output size of your embedding model exactly. The `metric` controls how similarity is computed during search. Valid values are `'cosine'`, `'euclidean'`, and `'dot'`. This setting cannot be changed after the collection is created.

If you call `createCollection` on a name that already exists, Mira returns a `CollectionAlreadyExistsError`. Use `mira.getOrCreateCollection()` if you want upsert semantics.

## Inserting Vectors

To insert vectors, call `collection.insert()` with an array of records. Each record must include an `id`, a `values` array (the embedding), and optionally a `metadata` object:

```typescript
const collection = mira.collection('documents');

await collection.insert([
  {
    id: 'doc-1',
    values: await embed('Mira is a vector database client library.'),
    metadata: { source: 'readme', language: 'en' },
  },
  {
    id: 'doc-2',
    values: await embed('Vector search finds semantically similar content.'),
    metadata: { source: 'concepts', language: 'en' },
  },
]);
```

Inserts are upserts by default: if a record with the given `id` already exists, it is replaced entirely. To update only metadata without changing the vector, use `collection.update()` instead.

Batch size is limited to 1000 records per call. For large datasets, chunk your records and insert in batches. The client does not automatically paginate inserts.

## Running Your First Search

Call `collection.search()` with a query vector and a result limit:

```typescript
const queryVector = await embed('how does approximate nearest neighbor work?');

const results = await collection.search({
  values: queryVector,
  limit: 5,
});

for (const result of results) {
  console.log(result.id, result.score, result.metadata);
}
```

Results are returned in descending order of similarity score. For cosine similarity, scores range from -1.0 to 1.0. A score above 0.8 generally indicates a strong semantic match, though the appropriate threshold depends on your embedding model and content type.

## Filtering Results

To restrict search results to a subset of vectors, pass a `filter` object:

```typescript
const results = await collection.search({
  values: queryVector,
  limit: 5,
  filter: { language: 'en', source: 'concepts' },
});
```

Filters use exact equality by default. For range comparisons on numeric metadata fields, use filter operators:

```typescript
filter: {
  published_year: { $gte: 2023 },
  status: 'published',
}
```

Supported operators are `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, and `$nin`. Logical operators `$and` and `$or` can be used to combine multiple conditions.

## Next Steps

- Read the [API Reference](./api-reference.md) for the full method signatures and options.
- See [Configuration](./configuration.md) to tune connection pooling, retries, and index parameters.
- See [Authentication](./authentication.md) for API key rotation and role-based access control.
- If search results are not what you expect, see [Troubleshooting](./troubleshooting.md).
