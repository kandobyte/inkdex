# Python SDK Reference

## Installation

```bash
pip install mira-client
```

Requires Python 3.9 or later. The SDK has no compiled extensions and installs on all platforms. For async support, install with the optional `asyncio` extra:

```bash
pip install "mira-client[asyncio]"
```

## MiraClient

### Initialization

```python
from mira_client import MiraClient

client = MiraClient(
    api_key=os.environ["MIRA_API_KEY"],
)
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `api_key` | `str` | — | Required. Your Mira API key. Can also be set via the `MIRA_API_KEY` environment variable. |
| `base_url` | `str` | `https://api.mira-db.com` | Override for self-hosted deployments. |
| `timeout` | `float` | `10.0` | Request timeout in seconds. |
| `max_retries` | `int` | `3` | Retries on transient failures. |

Unlike the JavaScript SDK, `MiraClient` reads `MIRA_API_KEY` from the environment automatically if `api_key` is not passed. This means you can initialize with `MiraClient()` in environments where the variable is set.

### create_collection()

```python
client.create_collection(
    name: str,
    dimensions: int,
    metric: str = "cosine",
    index_type: str = "hnsw",
    **index_options,
) -> Collection
```

Creates a new collection. Raises `CollectionAlreadyExistsError` if the name is taken.

```python
collection = client.create_collection(
    "documents",
    dimensions=384,
    metric="cosine",
    index_type="hnsw",
    m=16,
    ef_construction=200,
)
```

HNSW options are passed as keyword arguments with snake_case names (`ef_construction`, not `efConstruction`).

### get_or_create_collection()

```python
client.get_or_create_collection(
    name: str,
    dimensions: int,
    metric: str = "cosine",
    **options,
) -> Collection
```

Returns an existing collection or creates it. Safe to call in initialization code that may run multiple times. If the collection exists, `dimensions`, `metric`, and index options are ignored.

### collection()

```python
client.collection(name: str) -> Collection
```

Returns a `Collection` handle. Does not validate existence; the first API call will raise `CollectionNotFoundError` if the collection does not exist.

### delete_collection()

```python
client.delete_collection(name: str) -> None
```

Permanently deletes a collection and all its vectors. Raises `CollectionNotFoundError` if not found.

### list_collections()

```python
client.list_collections() -> list[CollectionInfo]
```

Returns all collections in your account. Each `CollectionInfo` has `name`, `dimensions`, `metric`, `vector_count`, and `created_at` attributes.

## Collection

### insert()

```python
collection.insert(records: list[dict]) -> UpsertResult
```

Inserts or replaces vectors. Each record is a dict with `id`, `values`, and optionally `metadata` and `namespace`.

```python
result = collection.insert([
    {
        "id": "doc-1",
        "values": embedding,  # list[float]
        "metadata": {"source": "readme", "language": "en"},
    },
    {
        "id": "doc-2",
        "values": embedding2,
        "namespace": "staging",
    },
])
print(result.inserted, result.updated)
```

Maximum 1,000 records per call. Returns an `UpsertResult` with `inserted` and `updated` counts.

### search()

```python
collection.search(
    values: list[float],
    limit: int = 10,
    filter: dict | None = None,
    namespace: str | None = None,
    include_values: bool = False,
    include_metadata: bool = True,
) -> list[SearchResult]
```

Performs ANN search against the collection.

```python
results = collection.search(
    values=query_embedding,
    limit=5,
    filter={"language": "en", "status": "published"},
)

for result in results:
    print(result.id, result.score, result.metadata)
```

Each `SearchResult` has `id`, `score`, and optionally `values` and `metadata` depending on the `include_values` and `include_metadata` flags.

### delete()

```python
collection.delete(
    ids: list[str] | None = None,
    filter: dict | None = None,
    namespace: str | None = None,
    delete_all: bool = False,
) -> DeleteResult
```

Deletes vectors by ID, by filter, or all vectors in a namespace. At least one of `ids`, `filter`, or `delete_all` must be set.

```python
# Delete by ID
collection.delete(ids=["doc-1", "doc-2"])

# Delete by filter
collection.delete(filter={"status": "archived"})

# Delete entire namespace
collection.delete(namespace="staging", delete_all=True)
```

### update()

```python
collection.update(
    id: str,
    metadata: dict,
    namespace: str | None = None,
) -> None
```

Updates the metadata of an existing vector without changing its embedding. Replaces the metadata entirely. Raises `VectorNotFoundError` if the ID does not exist.

### count()

```python
collection.count(
    filter: dict | None = None,
    namespace: str | None = None,
) -> int
```

Returns the number of vectors in the collection, optionally filtered.

## Async Client

For applications using `asyncio`, import the async variant:

```python
from mira_client.asyncio import AsyncMiraClient

async def main():
    client = AsyncMiraClient(api_key=os.environ["MIRA_API_KEY"])
    collection = client.collection("documents")

    results = await collection.search(values=query_embedding, limit=5)
    for result in results:
        print(result.id, result.score)
```

`AsyncMiraClient` has the same API as `MiraClient`, with all methods returning coroutines. Use it with `await` inside `async` functions. It uses `httpx` internally with an async transport; the synchronous client uses `httpx` with a synchronous transport. Both share the same retry and timeout behavior.

## Error Handling

All Mira errors inherit from `MiraError`. Import specific error classes to handle them:

```python
from mira_client.errors import (
    MiraConnectionError,
    MiraAuthenticationError,
    CollectionNotFoundError,
    CollectionAlreadyExistsError,
    VectorNotFoundError,
    DimensionMismatchError,
    ValidationError,
)

try:
    results = collection.search(values=query_embedding, limit=5)
except MiraAuthenticationError:
    print("Invalid or expired API key")
except CollectionNotFoundError:
    print("Collection does not exist")
except MiraConnectionError as e:
    print(f"Network error: {e}")
```

`MiraAuthenticationError` is raised on HTTP 401. It is not retried regardless of `max_retries`. `MiraConnectionError` wraps network-level failures (timeouts, DNS failures, connection refused) and is retried according to `max_retries`.

## Authentication

The Python SDK authenticates the same way as the JavaScript SDK: via a Bearer token in the `Authorization` header. Pass your API key via the `api_key` parameter or the `MIRA_API_KEY` environment variable.

For short-lived token exchange, use the management endpoint directly and pass the token as `api_key`:

```python
import httpx

def get_short_lived_token(api_key: str, expires_in: int = 3600) -> str:
    response = httpx.post(
        "https://api.mira-db.com/v1/auth/token",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"expiresIn": expires_in},
    )
    response.raise_for_status()
    return response.json()["token"]

client = MiraClient(api_key=get_short_lived_token(os.environ["MIRA_API_KEY"]))
```

The Python SDK does not automatically refresh tokens. Implement refresh logic in your application and create a new `MiraClient` instance with the refreshed token when needed.
