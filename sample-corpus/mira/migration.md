# Migration Guide

## Upgrading from v1 to v2

Mira v2 introduces breaking changes to the client API, collection schema options, and authentication. This guide covers every breaking change and provides before/after examples for each one.

The v1 client (`@mira-db/client@1.x`) will receive security patches until December 2025, but no new features. Plan your migration within that window.

## Client Instantiation

### Constructor Options Renamed

The `endpoint` option has been renamed to `baseUrl`. The `key` option has been renamed to `apiKey`.

**Before (v1):**
```typescript
const mira = new MiraClient({
  key: process.env.MIRA_KEY,
  endpoint: 'https://api.mira-db.com',
});
```

**After (v2):**
```typescript
const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
  baseUrl: 'https://api.mira-db.com',
});
```

If you use environment variables exclusively, rename `MIRA_KEY` to `MIRA_API_KEY` in your secrets manager and deployment configuration.

### connect() Removed

In v1, the client required an explicit `await mira.connect()` call before use. In v2, connections are opened lazily on the first request. Remove all `connect()` and `disconnect()` calls from your code.

**Before (v1):**
```typescript
const mira = new MiraClient({ key: process.env.MIRA_KEY });
await mira.connect();
// ... use client
await mira.disconnect();
```

**After (v2):**
```typescript
const mira = new MiraClient({ apiKey: process.env.MIRA_API_KEY });
// use client directly — no connect/disconnect needed
```

## Collection API

### getCollection() Renamed to collection()

The `mira.getCollection(name)` method has been renamed to `mira.collection(name)`. This reflects that the method returns a handle synchronously without making a network call.

**Before (v1):**
```typescript
const col = await mira.getCollection('documents');
```

**After (v2):**
```typescript
const col = mira.collection('documents'); // synchronous, no await
```

### createIndex() Merged into createCollection()

In v1, creating a collection and building its index were two separate steps. In v2, `createCollection()` accepts index options directly and the separate `createIndex()` method has been removed.

**Before (v1):**
```typescript
await mira.createCollection('documents', { dimensions: 384 });
await mira.createIndex('documents', {
  type: 'hnsw',
  m: 16,
  efConstruction: 200,
});
```

**After (v2):**
```typescript
await mira.createCollection('documents', {
  dimensions: 384,
  metric: 'cosine',
  indexType: 'hnsw',
  hnswOptions: { m: 16, efConstruction: 200 },
});
```

### metric is Now Required at Collection Creation

In v1, the similarity metric defaulted to `'cosine'` and could be changed after collection creation. In v2, `metric` must be explicitly specified at creation time and is immutable afterward.

If you have existing v1 collections that relied on the default, they used cosine similarity. When recreating them in v2, pass `metric: 'cosine'` explicitly.

## Vector Operations

### upsert() Renamed to insert()

The `collection.upsert()` method has been renamed to `collection.insert()`. The behavior is unchanged: inserts are always upserts.

**Before (v1):**
```typescript
await collection.upsert([
  { id: 'doc-1', vector: embedding, metadata: { source: 'readme' } },
]);
```

**After (v2):**
```typescript
await collection.insert([
  { id: 'doc-1', values: embedding, metadata: { source: 'readme' } },
]);
```

Note also that the field name for the embedding changed from `vector` to `values`.

### query() Renamed to search()

The `collection.query()` method has been renamed to `collection.search()`. The options object has also changed.

**Before (v1):**
```typescript
const results = await collection.query({
  vector: queryEmbedding,
  topK: 5,
  filter: { language: 'en' },
  includeMetadata: true,
});
```

**After (v2):**
```typescript
const results = await collection.search({
  values: queryEmbedding,
  limit: 5,
  filter: { language: 'en' },
  includeMetadata: true,
});
```

The option name `topK` has been renamed to `limit`.

### fetch() Return Type Changed

In v1, `collection.fetch(ids)` returned a plain object keyed by ID. In v2, it returns an array of `VectorRecord` objects in the same order as the input IDs. Missing IDs produce `null` entries in the result array.

**Before (v1):**
```typescript
const records = await collection.fetch(['doc-1', 'doc-2']);
// records: { 'doc-1': { vector, metadata }, 'doc-2': { vector, metadata } }
```

**After (v2):**
```typescript
const records = await collection.fetch(['doc-1', 'doc-2']);
// records: [{ id: 'doc-1', values, metadata }, { id: 'doc-2', values, metadata }]
```

## Error Types

All error class names have changed in v2 to follow a consistent `Mira*Error` naming convention.

| v1 error | v2 error |
|----------|----------|
| `ConnectionError` | `MiraConnectionError` |
| `AuthError` | `MiraAuthenticationError` |
| `NotFoundError` | `CollectionNotFoundError` or `VectorNotFoundError` |
| `DuplicateError` | `CollectionAlreadyExistsError` |
| `ValidationError` | `DimensionMismatchError` or `ValidationError` |

Update any `instanceof` checks or `catch` blocks that reference the old error class names.

## Namespace Support

Namespaces are new in v2. In v1, all vectors were stored in a single flat space. In v2, the default behavior (no namespace specified) places vectors in the default namespace, which is equivalent to v1 behavior. Existing data migrated from v1 will be in the default namespace.

No code changes are required to maintain v1 behavior in v2. Namespaces are opt-in.
