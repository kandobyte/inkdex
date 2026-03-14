import assert from "node:assert";
import { describe, it } from "node:test";
import { rankChunksHybrid } from "../../src/search/search.js";
import type { FtsResult } from "../../src/store/db.js";
import type { ChunkRow } from "../../src/types.js";

function makeChunk(
  id: number,
  embedding: number[],
  overrides?: Partial<ChunkRow>,
): ChunkRow {
  return {
    id,
    path: `doc${id}.md`,
    text: `text ${id}`,
    embedding,
    ...overrides,
  };
}

function makeFts(id: number, score: number): FtsResult {
  return { id, score };
}

describe("rankChunksHybrid", () => {
  const queryEmbedding = [1, 0, 0];
  const chunks: ChunkRow[] = [
    makeChunk(1, [1, 0, 0]), // best vector match
    makeChunk(2, [0, 1, 0]), // orthogonal
    makeChunk(3, [0.5, 0.5, 0]), // moderate vector match
  ];

  it("should boost results that appear in both rankings", () => {
    const fts = [makeFts(1, 5.0), makeFts(3, 3.0), makeFts(2, 1.0)];
    const results = rankChunksHybrid(chunks, queryEmbedding, fts, 3);
    assert.strictEqual(results[0].path, "doc1.md");
  });

  it("should include results from only one signal", () => {
    const results = rankChunksHybrid(chunks, queryEmbedding, [], 3);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].path, "doc1.md");
  });

  it("should ignore FTS-only chunks not in the chunk list", () => {
    const fts = [makeFts(4, 5.0), makeFts(2, 3.0)];
    const results = rankChunksHybrid(chunks, queryEmbedding, fts, 3);
    assert.strictEqual(results.length, 3);
  });

  it("should respect limit", () => {
    const fts = [makeFts(1, 5.0), makeFts(2, 3.0), makeFts(3, 1.0)];
    const results = rankChunksHybrid(chunks, queryEmbedding, fts, 1);
    assert.strictEqual(results.length, 1);
  });

  it("should produce differentiated scores based on cosine similarity", () => {
    const results = rankChunksHybrid(chunks, queryEmbedding, [], 3);
    assert.ok(
      results[0].score > results[2].score + 0.1,
      "best vector match should score significantly higher than worst",
    );
  });

  it("should boost results that match both signals", () => {
    const fts = [makeFts(3, 5.0), makeFts(2, 1.0)];
    const results = rankChunksHybrid(chunks, queryEmbedding, fts, 3);
    assert.strictEqual(results[0].path, "doc3.md");
  });
});
