# API Reference

## MiraClient

### constructor

```typescript
new MiraClient(options: MiraClientOptions): MiraClient
```

Creates a new Mira client instance. Does not open a network connection; connections are opened lazily on the first request.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Required. Your Mira API key. |
| `baseUrl` | `string` | `https://api.mira-db.com` | Base URL for the Mira API. Override for self-hosted instances. |
| `timeout` | `number` | `10000` | Request timeout in milliseconds. |
| `maxRetries` | `number` | `3` | Number of times to retry on transient errors (5xx, network failures). |
| `dangerouslyAllowBrowser` | `boolean` | `false` | Allow usage in browser environments. Not recommended for production because it exposes your API key in client-side code. |

**Example:**

```typescript
const mira = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
  timeout: 5000,
  maxRetries: 2,
});
```

### createCollection()

```typescript
mira.createCollection(name: string, options: CreateCollectionOptions): Promise<Collection>
```

Creates a new collection and returns a `Collection` handle. Throws `CollectionAlreadyExistsError` if a collection with this name already exists.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dimensions` | `number` | — | Required. Number of dimensions in each vector. Must match your embedding model output. |
| `metric` | `'cosine' \| 'euclidean' \| 'dot'` | `'cosine'` | Similarity metric used during search. Cannot be changed after creation. |
| `indexType` | `'hnsw' \| 'ivf' \| 'flat'` | `'hnsw'` | Index algorithm. `flat` performs exact search (slow at scale, accurate). `hnsw` is the recommended default. |

### getOrCreateCollection()

```typescript
mira.getOrCreateCollection(name: string, options: CreateCollectionOptions): Promise<Collection>
```

Returns the existing collection if it exists, or creates it with the given options. Useful in initialization code that may run multiple times. If the collection already exists, `options` are ignored and the existing collection's settings are used.

### collection()

```typescript
mira.collection(name: string): Collection
```

Returns a `Collection` handle for an existing collection. Does not validate that the collection exists; the first network call will fail with `CollectionNotFoundError` if it does not.

### deleteCollection()

```typescript
mira.deleteCollection(name: string): Promise<void>
```

Permanently deletes a collection and all its vectors. This operation is irreversible. Throws `CollectionNotFoundError` if the collection does not exist.

### listCollections()

```typescript
mira.listCollections(): Promise<CollectionInfo[]>
```

Returns metadata for all collections in your account. Each `CollectionInfo` object includes `name`, `dimensions`, `metric`, `vectorCount`, and `createdAt`.

## Collection

### insert()

```typescript
collection.insert(records: VectorRecord[]): Promise<UpsertResult>
```

Inserts or replaces vectors in the collection. If a record with the given `id` already exists, it is replaced entirely (including metadata). Maximum 1000 records per call.

**VectorRecord fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for this vector. Max 512 characters. |
| `values` | `number[]` | Yes | The vector embedding. Length must equal the collection's `dimensions`. |
| `metadata` | `Record<string, string \| number \| boolean>` | No | Flat key-value metadata. Nested objects are not supported. |
| `namespace` | `string` | No | Namespace to insert into. Defaults to the default namespace. |

Returns an `UpsertResult` with `{ inserted: number, updated: number }` counts.

### search()

```typescript
collection.search(options: SearchOptions): Promise<SearchResult[]>
```

Performs ANN search and returns the most similar vectors to the query.

**SearchOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `values` | `number[]` | — | Required. Query vector. Must have the same dimensions as the collection. |
| `limit` | `number` | `10` | Number of results to return. Max 1000. |
| `filter` | `MetadataFilter` | — | Metadata filter to apply before search. |
| `namespace` | `string` | default namespace | Namespace to search within. |
| `includeValues` | `boolean` | `false` | Whether to include the vector values in results. |
| `includeMetadata` | `boolean` | `true` | Whether to include metadata in results. |

Returns an array of `SearchResult` objects sorted by descending similarity score. Each result includes `id`, `score`, and optionally `values` and `metadata`.

### delete()

```typescript
collection.delete(options: DeleteOptions): Promise<DeleteResult>
```

Deletes vectors by ID or by metadata filter. At least one of `ids` or `filter` must be provided.

**DeleteOptions:**

| Option | Type | Description |
|--------|------|-------------|
| `ids` | `string[]` | List of vector IDs to delete. |
| `filter` | `MetadataFilter` | Delete all vectors matching this filter. |
| `namespace` | `string` | Namespace to delete from. Defaults to the default namespace. |
| `deleteAll` | `boolean` | If `true`, deletes all vectors in the namespace. Cannot be combined with `ids` or `filter`. |

Returns a `DeleteResult` with `{ deleted: number }`.

### update()

```typescript
collection.update(id: string, options: UpdateOptions): Promise<void>
```

Updates the metadata of an existing vector without changing its embedding. Throws `VectorNotFoundError` if the ID does not exist. To change the embedding, use `insert()` instead (which upserts).

**UpdateOptions:**

| Option | Type | Description |
|--------|------|-------------|
| `metadata` | `Record<string, string \| number \| boolean>` | New metadata. Replaces the existing metadata entirely. |
| `namespace` | `string` | Namespace containing the vector. |

### count()

```typescript
collection.count(options?: CountOptions): Promise<number>
```

Returns the number of vectors in the collection. Pass a `filter` or `namespace` to count a subset.

## Authentication

The `MiraClient` constructor accepts an `apiKey` option. API keys are long-lived credentials scoped to your account. For machine-to-machine authentication in production, prefer short-lived tokens issued via the token exchange endpoint (see [Authentication](./authentication.md)).

To use a token instead of an API key:

```typescript
const mira = new MiraClient({
  apiKey: await getShortLivedToken(), // your token refresh logic
});
```

Tokens and API keys use the same `apiKey` option field. The client does not distinguish between them; it passes the value as a Bearer token in the `Authorization` header on every request.

If authentication fails, the API returns HTTP 401 and the client throws `MiraAuthenticationError`. This error is not retried, regardless of the `maxRetries` setting.

## QueryBuilder

The `QueryBuilder` class provides a fluent interface for constructing complex search queries. Obtain an instance via `collection.query()`.

### filter()

```typescript
query.filter(conditions: MetadataFilter): QueryBuilder
```

Adds a metadata filter to the query. Multiple calls to `filter()` are combined with `$and`. A filter narrows the set of candidate vectors before ANN search runs.

### limit()

```typescript
query.limit(n: number): QueryBuilder
```

Sets the maximum number of results. Equivalent to the `limit` option in `collection.search()`. Defaults to 10. Maximum value is 1000.

### includeMetadata()

```typescript
query.includeMetadata(include: boolean): QueryBuilder
```

Controls whether metadata is included in search results. Defaults to `true`. Set to `false` to reduce response payload when metadata is not needed.

### execute()

```typescript
query.execute(values: number[]): Promise<SearchResult[]>
```

Runs the query with the given vector and returns results. This is the terminal method that sends a network request.
