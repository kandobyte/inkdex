import assert from "node:assert";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  closeDb,
  dbPath,
  getAllChunks,
  getAllDocumentHashes,
  getChunkCount,
  getChunksByIds,
  insertChunk,
  openDb,
  removeDocument,
  runInTransaction,
  searchFts,
  searchVec,
  setDocumentHash,
} from "../../src/store/db.js";

const TEST_DOCS_PATH = join(tmpdir(), `inkdex-test-db-${process.pid}`);

// vec0 requires exactly 384 floats. Returns a unit vector with 1.0 at position (i % 384).
function makeEmbedding(i: number): number[] {
  const arr = new Array(384).fill(0);
  arr[i % 384] = 1.0;
  return arr;
}

describe("dbPath", () => {
  it("should return the same path for the same docs directory", () => {
    assert.strictEqual(dbPath("/home/user/docs"), dbPath("/home/user/docs"));
  });

  it("should return different paths for different docs directories", () => {
    assert.notStrictEqual(
      dbPath("/home/user/docs-a"),
      dbPath("/home/user/docs-b"),
    );
  });

  it("should end with .db", () => {
    assert.ok(dbPath("/any/path").endsWith(".db"));
  });
});

describe("db operations", () => {
  beforeEach(() => {
    openDb(TEST_DOCS_PATH);
  });

  afterEach(() => {
    closeDb();
    try {
      rmSync(dbPath(TEST_DOCS_PATH), { force: true });
      rmSync(`${dbPath(TEST_DOCS_PATH)}-wal`, { force: true });
      rmSync(`${dbPath(TEST_DOCS_PATH)}-shm`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("should start with zero chunks", () => {
    assert.strictEqual(getChunkCount(), 0);
  });

  it("should start with no document hashes", () => {
    const hashes = getAllDocumentHashes();
    assert.deepStrictEqual(hashes, {});
  });

  it("should store and retrieve document hashes", () => {
    setDocumentHash("readme.md", "abc123");
    const hashes = getAllDocumentHashes();
    assert.strictEqual(hashes["readme.md"], "abc123");
  });

  it("should upsert document hashes", () => {
    setDocumentHash("readme.md", "abc123");
    setDocumentHash("readme.md", "def456");
    const hashes = getAllDocumentHashes();
    assert.strictEqual(hashes["readme.md"], "def456");
  });

  it("should insert and retrieve chunks", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "Some text", makeEmbedding(0));

    const chunks = getAllChunks();
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].path, "doc.md");
    assert.strictEqual(chunks[0].text, "Some text");
  });

  it("should round-trip embeddings through blob conversion", () => {
    setDocumentHash("doc.md", "hash1");
    const embedding = makeEmbedding(0);
    insertChunk("doc.md", "text", embedding);

    const chunks = getAllChunks();
    assert.strictEqual(chunks[0].embedding.length, embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      assert.ok(
        Math.abs(chunks[0].embedding[i] - embedding[i]) < 1e-6,
        `embedding[${i}] mismatch`,
      );
    }
  });

  it("should count chunks correctly", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "text1", makeEmbedding(0));
    insertChunk("doc.md", "text2", makeEmbedding(1));
    assert.strictEqual(getChunkCount(), 2);
  });

  it("should remove document and its chunks", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "text", makeEmbedding(0));

    removeDocument("doc.md");
    assert.strictEqual(getChunkCount(), 0);
    assert.deepStrictEqual(getAllDocumentHashes(), {});
  });

  it("should only remove chunks for the specified document", () => {
    setDocumentHash("a.md", "hash1");
    setDocumentHash("b.md", "hash2");
    insertChunk("a.md", "text-a", makeEmbedding(0));
    insertChunk("b.md", "text-b", makeEmbedding(1));

    removeDocument("a.md");
    assert.strictEqual(getChunkCount(), 1);
    assert.strictEqual(getAllChunks()[0].text, "text-b");
  });

  it("should search via FTS", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "the quick brown fox", makeEmbedding(0));
    insertChunk("doc.md", "lazy sleeping dog", makeEmbedding(1));

    const results = searchFts("quick fox", 10);
    assert.ok(results.length > 0);
    assert.ok(typeof results[0].id === "number");
    assert.ok(typeof results[0].score === "number");
    assert.ok(results[0].score > 0);
  });

  it("should return empty for FTS with no matches", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "hello world", makeEmbedding(0));

    const results = searchFts("zzzznotfound", 10);
    assert.strictEqual(results.length, 0);
  });

  it("should return empty for empty FTS query", () => {
    const results = searchFts("", 10);
    assert.strictEqual(results.length, 0);
  });

  it("should handle FTS queries with special characters", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "some text", makeEmbedding(0));

    const results = searchFts('AND OR NOT "quotes"', 10);
    assert.ok(Array.isArray(results));
  });

  it("should commit transaction on success", () => {
    setDocumentHash("doc.md", "hash1");
    runInTransaction(() => {
      insertChunk("doc.md", "text", makeEmbedding(0));
    });
    assert.strictEqual(getChunkCount(), 1);
  });

  it("should rollback transaction on error", () => {
    setDocumentHash("doc.md", "hash1");
    assert.throws(() => {
      runInTransaction(() => {
        insertChunk("doc.md", "text", makeEmbedding(0));
        throw new Error("deliberate failure");
      });
    });
    assert.strictEqual(getChunkCount(), 0);
  });

  it("should find exact match via vector search with distance ~0", () => {
    setDocumentHash("doc.md", "hash1");
    const embedding = makeEmbedding(0);
    insertChunk("doc.md", "text", embedding);

    const results = searchVec(embedding, 1);
    assert.strictEqual(results.length, 1);
    assert.ok(typeof results[0].id === "number");
    assert.ok(
      results[0].distance < 1e-4,
      "exact match should have near-zero distance",
    );
  });

  it("should rank closer vectors first in vector search", () => {
    setDocumentHash("doc.md", "hash1");
    // Two orthogonal unit vectors; query matches chunk 0 exactly
    insertChunk("doc.md", "text-a", makeEmbedding(0));
    insertChunk("doc.md", "text-b", makeEmbedding(1));

    const results = searchVec(makeEmbedding(0), 2);
    assert.strictEqual(results.length, 2);
    assert.ok(
      results[0].distance < results[1].distance,
      "closer vector should rank first",
    );
  });

  it("should return empty vector search results when no chunks exist", () => {
    const results = searchVec(makeEmbedding(0), 10);
    assert.strictEqual(results.length, 0);
  });

  it("should fetch chunks by ids", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "alpha", makeEmbedding(0));
    insertChunk("doc.md", "beta", makeEmbedding(1));
    insertChunk("doc.md", "gamma", makeEmbedding(2));

    const all = getAllChunks();
    const ids = [all[0].id, all[2].id];
    const results = getChunksByIds(ids);

    assert.strictEqual(results.length, 2);
    const texts = results.map((r) => r.text).sort();
    assert.deepStrictEqual(texts, ["alpha", "gamma"]);
  });

  it("should return empty array for getChunksByIds with empty ids", () => {
    const results = getChunksByIds([]);
    assert.deepStrictEqual(results, []);
  });
});
