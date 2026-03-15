# Integrations

## Overview

Mira integrates with popular LLM orchestration frameworks through official and community adapters. This page covers setup and usage for LangChain (JavaScript), LlamaIndex (Python), and a custom integration pattern for frameworks not listed here.

All integrations use the same underlying Mira client and API. The framework adapters wrap `MiraClient` in framework-specific interfaces; they do not add or remove capabilities.

## LangChain (JavaScript)

### Installation

Install the Mira LangChain adapter alongside LangChain core:

```bash
npm install @mira-db/langchain langchain @langchain/core
```

### Setting Up the Vector Store

The `MiraVectorStore` class implements LangChain's `VectorStore` interface. It handles embedding, insertion, and search within the LangChain pipeline.

```typescript
import { MiraVectorStore } from '@mira-db/langchain';
import { OpenAIEmbeddings } from '@langchain/openai';

const vectorStore = await MiraVectorStore.fromExistingCollection(
  new OpenAIEmbeddings({ model: 'text-embedding-3-small' }),
  {
    apiKey: process.env.MIRA_API_KEY,
    collection: 'documents',
    namespace: 'production',
  },
);
```

If the collection does not yet exist, use `MiraVectorStore.fromDocuments()` to create it and insert documents in one step:

```typescript
const vectorStore = await MiraVectorStore.fromDocuments(
  documents, // LangChain Document[]
  new OpenAIEmbeddings({ model: 'text-embedding-3-small' }),
  {
    apiKey: process.env.MIRA_API_KEY,
    collection: 'documents',
    dimensions: 1536, // must match the embedding model output
  },
);
```

### Similarity Search

Once the vector store is set up, use `similaritySearch()` for plain retrieval or `similaritySearchWithScore()` to get relevance scores:

```typescript
const results = await vectorStore.similaritySearch('how do I rotate an API key?', 5);

const resultsWithScores = await vectorStore.similaritySearchWithScore(
  'what is the difference between cosine and dot product?',
  3,
);
// resultsWithScores: Array<[Document, number]>
```

### Using as a Retriever

To use the vector store as a retriever in a retrieval-augmented generation (RAG) chain:

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { createRetrievalChain } from 'langchain/chains/retrieval';

const retriever = vectorStore.asRetriever({ k: 5 });

const chain = await createRetrievalChain({
  retriever,
  combineDocsChain: await createStuffDocumentsChain({
    llm: new ChatOpenAI({ model: 'gpt-4o' }),
    prompt: chatPrompt,
  }),
});

const result = await chain.invoke({ input: 'how does metadata filtering work?' });
```

### Metadata Filtering in LangChain

Pass a `filter` in the search options to restrict results:

```typescript
const results = await vectorStore.similaritySearch(
  'authentication error',
  5,
  { status: 'published', language: 'en' },
);
```

The filter format is the same as the native Mira client's `MetadataFilter`. LangChain does not transform or validate filter values before passing them to Mira.

## LlamaIndex (Python)

### Installation

```bash
pip install llama-index-vector-stores-mira
```

### Setting Up the Index

```python
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.vector_stores.mira import MiraVectorStore

vector_store = MiraVectorStore(
    api_key=os.environ["MIRA_API_KEY"],
    collection_name="documents",
    dimension=384,
)

storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context,
)
```

### Querying

```python
query_engine = index.as_query_engine(similarity_top_k=5)
response = query_engine.query("what are the HNSW index parameters?")
print(response)
```

For retrieval without generation:

```python
retriever = index.as_retriever(similarity_top_k=10)
nodes = retriever.retrieve("insert vector upsert behavior")
for node in nodes:
    print(node.score, node.text[:100])
```

### Metadata Filters in LlamaIndex

LlamaIndex uses its own `MetadataFilters` object, which the adapter translates to Mira's filter format:

```python
from llama_index.core.vector_stores import MetadataFilters, ExactMatchFilter

filters = MetadataFilters(filters=[
    ExactMatchFilter(key="language", value="en"),
    ExactMatchFilter(key="status", value="published"),
])

retriever = index.as_retriever(similarity_top_k=5, filters=filters)
```

## Custom Integration

If you are using a framework without an official Mira adapter, you can integrate directly using the Mira client. The key contract to implement is: accept a query string, embed it, call `collection.search()`, and return the results in your framework's expected format.

### Minimal Retriever Pattern (TypeScript)

```typescript
import { MiraClient } from '@mira-db/client';
import type { Embedder } from './your-embedder';

export class MiraRetriever {
  private collection;

  constructor(private embedder: Embedder, apiKey: string, collectionName: string) {
    const mira = new MiraClient({ apiKey });
    this.collection = mira.collection(collectionName);
  }

  async retrieve(query: string, k = 5): Promise<RetrievedChunk[]> {
    const queryVector = await this.embedder.embed(query);
    const results = await this.collection.search({ values: queryVector, limit: k });
    return results.map(r => ({
      text: r.metadata?.text as string,
      score: r.score,
      source: r.metadata?.source as string,
    }));
  }
}
```

### Storing Text in Metadata

Mira stores vectors, not text. If you need to retrieve the original text along with search results, store it in the `metadata` field at insert time:

```typescript
await collection.insert([{
  id: chunk.id,
  values: embedding,
  metadata: {
    text: chunk.text,          // original text for retrieval
    source: chunk.filePath,
    chunkIndex: chunk.index,
  },
}]);
```

Then read it back from `result.metadata.text` in your retriever. This is the standard pattern for RAG systems using Mira. There is no built-in text storage; metadata is the conventional mechanism.
