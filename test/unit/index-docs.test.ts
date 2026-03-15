import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Embedder } from "../../src/embedder/embedder.js";
import { indexDocs } from "../../src/ingest/index-docs.js";
import {
  closeDb,
  getAllChunks,
  getAllDocumentHashes,
  getChunkCount,
  openDb,
} from "../../src/store/db.js";

const TEST_DIR = join(tmpdir(), `inkdex-test-index-${process.pid}`);
const DOCS_DIR = join(TEST_DIR, "docs");
const TEST_DB_PATH = join(TEST_DIR, "test.db");

// vec0 requires exactly 384 floats; use a unit vector
const MOCK_EMBEDDING = Object.freeze([1.0, ...new Array(383).fill(0)]);

function createMockEmbedder(): Embedder {
  return {
    maxTokens: 256,
    tokenize: (text: string) => text.split(/\s+/).map((_, i) => i),
    embed: async (_text: string) => [...MOCK_EMBEDDING],
    embedBatch: async (texts: string[]) => texts.map(() => [...MOCK_EMBEDDING]),
  } as unknown as Embedder;
}

describe("indexDocs", () => {
  beforeEach(() => {
    mkdirSync(DOCS_DIR, { recursive: true });
    openDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("should index markdown files", async () => {
    writeFileSync(join(DOCS_DIR, "test.md"), "# Title\n\n## Section\n\nHello");
    await indexDocs(createMockEmbedder(), DOCS_DIR);
    assert.ok(getChunkCount() > 0);
  });

  it("should handle empty directory", async () => {
    await indexDocs(createMockEmbedder(), DOCS_DIR);
    assert.strictEqual(getChunkCount(), 0);
  });

  it("should skip unchanged files on second run", async () => {
    writeFileSync(join(DOCS_DIR, "test.md"), "# Title\n\n## Section\n\nHello");
    const embedder = createMockEmbedder();

    await indexDocs(embedder, DOCS_DIR);
    const countAfterFirst = getChunkCount();

    await indexDocs(embedder, DOCS_DIR);
    assert.strictEqual(getChunkCount(), countAfterFirst);
  });

  it("should re-index changed files", async () => {
    const embedder = createMockEmbedder();
    writeFileSync(join(DOCS_DIR, "test.md"), "# Title\n\n## Section\n\nOld");
    await indexDocs(embedder, DOCS_DIR);

    writeFileSync(
      join(DOCS_DIR, "test.md"),
      "# Title\n\n## Section\n\nUpdated content",
    );
    await indexDocs(embedder, DOCS_DIR);

    const chunks = getAllChunks();
    const texts = chunks.map((c) => c.text).join(" ");
    assert.ok(texts.includes("Updated content"));
    assert.ok(!texts.includes("Old"));
  });

  it("should remove deleted files from index", async () => {
    const embedder = createMockEmbedder();
    writeFileSync(join(DOCS_DIR, "a.md"), "# A\n\n## Section\n\nFile A");
    writeFileSync(join(DOCS_DIR, "b.md"), "# B\n\n## Section\n\nFile B");
    await indexDocs(embedder, DOCS_DIR);
    assert.strictEqual(Object.keys(getAllDocumentHashes()).length, 2);

    rmSync(join(DOCS_DIR, "b.md"));
    await indexDocs(embedder, DOCS_DIR);

    const hashes = getAllDocumentHashes();
    assert.strictEqual(Object.keys(hashes).length, 1);
    assert.ok(hashes[join(DOCS_DIR, "a.md")]);
  });

  it("should index files in subdirectories", async () => {
    mkdirSync(join(DOCS_DIR, "sub"), { recursive: true });
    writeFileSync(
      join(DOCS_DIR, "sub", "nested.md"),
      "# Nested\n\n## Section\n\nNested content",
    );
    await indexDocs(createMockEmbedder(), DOCS_DIR);
    assert.ok(getChunkCount() > 0);
  });

  it("should store document hashes", async () => {
    writeFileSync(join(DOCS_DIR, "test.md"), "# Title\n\n## Section\n\nHello");
    await indexDocs(createMockEmbedder(), DOCS_DIR);

    const hashes = getAllDocumentHashes();
    const key = join(DOCS_DIR, "test.md");
    assert.ok(hashes[key]);
    assert.strictEqual(typeof hashes[key], "string");
    assert.strictEqual(hashes[key].length, 64); // SHA-256 hex
  });
});
