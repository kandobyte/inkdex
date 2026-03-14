import { cos_sim } from "@huggingface/transformers";
import type { Embedder } from "../embedder/embedder.js";
import { getAllChunks, searchFts, type FtsResult } from "../store/db.js";
import type { ChunkRow, SearchResult } from "../types.js";

// Weight for vector vs keyword signal (0 = keyword only, 1 = vector only)
const ALPHA = 0.7;

/** Min-max normalize a map of scores to 0-1 range. */
function normalize(scores: Map<number, number>): Map<number, number> {
  if (scores.size === 0) return scores;

  const values = scores.values();
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;

  const result = new Map<number, number>();
  for (const [id, v] of scores) {
    result.set(id, (v - min) / range);
  }
  return result;
}

/** @package Hybrid ranking using RelativeScoreFusion (min-max + weighted combination). */
export function rankChunksHybrid(
  chunks: ChunkRow[],
  queryEmbedding: number[],
  ftsResults: FtsResult[],
  limit: number,
): SearchResult[] {
  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  const vectorScores = normalize(
    new Map(
      chunks.map((c) => [c.id, Number(cos_sim(queryEmbedding, c.embedding))]),
    ),
  );
  const keywordScores = normalize(
    new Map(ftsResults.map((r) => [r.id, r.score])),
  );

  const allIds = new Set([...vectorScores.keys(), ...keywordScores.keys()]);

  return [...allIds]
    .filter((id) => chunkById.has(id))
    .map((id) => ({
      id,
      score:
        ALPHA * (vectorScores.get(id) ?? 0) +
        (1 - ALPHA) * (keywordScores.get(id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ id, score }) => {
      const { path, text } = chunkById.get(id)!;
      return { path, text, score };
    });
}

export async function search(
  embedder: Embedder,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const queryEmbedding = await embedder.embed(query);
  const chunks = getAllChunks();
  const ftsResults = searchFts(query, chunks.length);
  return rankChunksHybrid(chunks, queryEmbedding, ftsResults, limit);
}
