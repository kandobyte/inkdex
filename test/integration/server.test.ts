import assert from "node:assert";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DOCS_PATH = resolve("test/fixtures/docs");

function createTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: "tsx",
    args: ["src/cli.ts"],
    env: { ...process.env, DOCS_PATH, LOG_LEVEL: "silent" },
  });
}

function createClient(): Client {
  return new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );
}

describe("server integration", () => {
  it("should list search_docs tool", async () => {
    const client = createClient();
    const transport = createTransport();

    await client.connect(transport);
    const { tools } = await client.listTools();

    assert.ok(tools.length > 0);
    assert.strictEqual(tools[0].name, "search_docs");

    await client.close();
  });

  it("should search docs and return results", async () => {
    const client = createClient();
    const transport = createTransport();

    await client.connect(transport);

    const result = await client.callTool({
      name: "search_docs",
      arguments: { query: "how to authenticate" },
    });

    assert.ok(result.content);
    assert.ok(Array.isArray(result.content));
    assert.strictEqual(result.content[0].type, "text");
    assert.ok(result.content[0].text.includes("Authentication"));

    await client.close();
  });

  it("should return no results message for unrelated query", async () => {
    const client = createClient();
    const transport = createTransport();

    await client.connect(transport);

    const result = await client.callTool({
      name: "search_docs",
      arguments: { query: "xyzzy" },
    });

    assert.ok(result.content);
    assert.ok(Array.isArray(result.content));

    await client.close();
  });
});
