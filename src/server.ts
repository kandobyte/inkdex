import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Embedder } from "./embedder/embedder.js";
import { logger } from "./logger.js";
import { search } from "./search/search.js";
import { getChunkCount } from "./store/db.js";
import { getVersion } from "./version.js";

async function createServer(embedder: Embedder): Promise<Server> {
  const server = new Server(
    {
      name: "inkdex",
      version: getVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_docs",
          description:
            "Search documentation for relevant information. Returns content that matches the query semantically.",
          inputSchema: {
            type: "object" as const,
            properties: {
              query: {
                type: "string",
                description:
                  "Search query - natural language question or keywords",
              },
            },
            required: ["query"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "search_docs") {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const query = String(request.params.arguments?.query || "");

    logger.debug({ query }, "Searching docs");

    const results = await search(embedder, query, 10);

    const text = results
      .map((r) => `[${r.path}]\n\n${r.text}`)
      .join("\n\n---\n\n");

    return {
      content: [{ type: "text", text: text || "No results found." }],
    };
  });

  return server;
}

export async function startServer(embedder: Embedder): Promise<void> {
  const server = await createServer(embedder);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info(
    { version: getVersion(), chunks: getChunkCount() },
    "Server started",
  );
}
