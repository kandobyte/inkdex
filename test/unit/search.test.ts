import assert from "node:assert";
import { describe, it } from "node:test";
import { rankByRRF } from "../../src/search/search.js";
import type { FtsResult, VecResult } from "../../src/store/db.js";

function makeFts(id: number, score: number): FtsResult {
  return { id, score };
}

function makeVec(id: number, distance: number): VecResult {
  return { id, distance };
}

describe("rankByRRF", () => {
  // vec ordered distance ASC (as returned by vec0), fts ordered score DESC
  const vecResults: VecResult[] = [
    makeVec(1, 0), // rank 1
    makeVec(3, 0.2), // rank 2
    makeVec(2, 2.0), // rank 3
  ];

  it("should boost results that appear in both rankings", () => {
    const fts = [makeFts(1, 5.0), makeFts(3, 3.0), makeFts(2, 1.0)];
    const results = rankByRRF(vecResults, fts);
    assert.strictEqual(results[0].id, 1);
  });

  it("should rank by vector signal when no FTS results", () => {
    const results = rankByRRF(vecResults, []);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].id, 1);
  });

  it("should include FTS-only candidates", () => {
    const fts = [makeFts(4, 5.0), makeFts(2, 3.0)];
    const results = rankByRRF(vecResults, fts);
    assert.ok(results.some((r) => r.id === 4));
  });

  it("should rank a chunk higher when it appears in both signals", () => {
    // chunk 3 is vec rank 2 + fts rank 1 → should outscore chunk 1 (vec rank 1 only)
    const fts = [makeFts(3, 5.0), makeFts(2, 1.0)];
    const results = rankByRRF(vecResults, fts);
    assert.strictEqual(results[0].id, 3);
  });

  it("should produce strictly decreasing scores for single-signal ranking", () => {
    const results = rankByRRF(vecResults, []);
    assert.ok(results[0].score > results[1].score);
    assert.ok(results[1].score > results[2].score);
  });

  it("should return empty for no results", () => {
    assert.deepStrictEqual(rankByRRF([], []), []);
  });
});
