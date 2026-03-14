# Inkdex

RAG for your markdown docs, exposed as an MCP tool.
## Tools

| Tool | Description |
|------|-------------|
| `search_docs` | Search indexed documentation. Returns matching chunks ranked by relevance. |

## Usage

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "inkdex": {
      "command": "npx",
      "args": [
        "-y",
        "inkdex"
      ],
      "env": {
        "DOCS_PATH": "/path/to/your/docs"
      }
    }
  }
}
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DOCS_PATH` | Yes | Path to the directory containing markdown files to index |

To expose docs remotely, use a MCP gateway like [MCPBox](https://github.com/kandobyte/mcpbox).

## How it works

Markdown files are parsed into sections by heading structure and split into ~200-token chunks. Each chunk is prefixed with a `<context>` preamble containing the heading path (e.g. `API Reference > Authentication`). Chunks are embedded locally using `all-MiniLM-L6-v2` and stored in SQLite.

Search combines vector similarity and BM25 keyword matching using [RelativeScoreFusion](https://weaviate.io/blog/hybrid-search-fusion-algorithms).
