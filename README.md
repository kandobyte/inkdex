# Inkdex

[![npm](https://img.shields.io/npm/v/inkdex)](https://www.npmjs.com/package/inkdex)

RAG for your markdown docs, exposed over MCP.

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
        "DOCS_PATH": "/path/to/docs1,/path/to/docs2"
      }
    }
  }
}
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DOCS_PATH` | Yes | Comma-separated path(s) to directories containing markdown files to index |

Runs over stdio. For remote access, use an MCP gateway ([MCPBox](https://github.com/anton-lunden/mcpbox)).

## How it works

Markdown files are parsed by heading structure into ~200-token chunks, each prefixed with its heading path (e.g. `API Reference > Authentication`). Chunks are embedded locally using `all-MiniLM-L6-v2` and stored in SQLite.

Search combines vector similarity and BM25 full-text matching, fused with [Reciprocal Rank Fusion](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf).
