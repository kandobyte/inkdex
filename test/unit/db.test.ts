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
  insertChunk,
  openDb,
  removeDocument,
  runInTransaction,
  searchFts,
  setDocumentHash,
} from "../../src/store/db.js";

const TEST_DOCS_PATH = join(tmpdir(), `inkdex-test-db-${process.pid}`);

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
    const embedding = [0.1, 0.2, 0.3];
    insertChunk("doc.md", "Some text", embedding);

    const chunks = getAllChunks();
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].path, "doc.md");
    assert.strictEqual(chunks[0].text, "Some text");
  });

  it("should round-trip embeddings through blob conversion", () => {
    setDocumentHash("doc.md", "hash1");
    const embedding = [0.1, 0.2, 0.3, -0.5, 1.0];
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
    insertChunk("doc.md", "text1", [0.1]);
    insertChunk("doc.md", "text2", [0.2]);
    assert.strictEqual(getChunkCount(), 2);
  });

  it("should remove document and its chunks", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "text", [0.1]);

    removeDocument("doc.md");
    assert.strictEqual(getChunkCount(), 0);
    assert.deepStrictEqual(getAllDocumentHashes(), {});
  });

  it("should only remove chunks for the specified document", () => {
    setDocumentHash("a.md", "hash1");
    setDocumentHash("b.md", "hash2");
    insertChunk("a.md", "text-a", [0.1]);
    insertChunk("b.md", "text-b", [0.2]);

    removeDocument("a.md");
    assert.strictEqual(getChunkCount(), 1);
    assert.strictEqual(getAllChunks()[0].text, "text-b");
  });

  it("should search via FTS", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "the quick brown fox", [0.1]);
    insertChunk("doc.md", "lazy sleeping dog", [0.2]);

    const results = searchFts("quick fox", 10);
    assert.ok(results.length > 0);
    assert.ok(typeof results[0].id === "number");
    assert.ok(typeof results[0].score === "number");
    assert.ok(results[0].score > 0);
  });

  it("should return empty for FTS with no matches", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "hello world", [0.1]);

    const results = searchFts("zzzznotfound", 10);
    assert.strictEqual(results.length, 0);
  });

  it("should return empty for empty FTS query", () => {
    const results = searchFts("", 10);
    assert.strictEqual(results.length, 0);
  });

  it("should handle FTS queries with special characters", () => {
    setDocumentHash("doc.md", "hash1");
    insertChunk("doc.md", "some text", [0.1]);

    const results = searchFts('AND OR NOT "quotes"', 10);
    assert.ok(Array.isArray(results));
  });

  it("should commit transaction on success", () => {
    setDocumentHash("doc.md", "hash1");
    runInTransaction(() => {
      insertChunk("doc.md", "text", [0.1]);
    });
    assert.strictEqual(getChunkCount(), 1);
  });

  it("should rollback transaction on error", () => {
    setDocumentHash("doc.md", "hash1");
    assert.throws(() => {
      runInTransaction(() => {
        insertChunk("doc.md", "text", [0.1]);
        throw new Error("deliberate failure");
      });
    });
    assert.strictEqual(getChunkCount(), 0);
  });
});
