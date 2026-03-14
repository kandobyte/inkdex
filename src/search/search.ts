import type { Embedder } from "../embedder/embedder.js";
import {
  type FtsResult,
  getChunksByIds,
  searchFts,
  searchVec,
  type VecResult,
} from "../store/db.js";
import type { SearchResult } from "../types.js";

const RRF_K = 60;
const FETCH_LIMIT = 100;

type RankedResult = { id: number; score: number };

export function rankByRRF(
  vecResults: VecResult[],
  ftsResults: FtsResult[],
): RankedResult[] {
  const scores = new Map<number, number>();
  const addRRFScores = (results: Array<{ id: number }>) => {
    for (let i = 0; i < results.length; i++) {
      const id = results[i].id;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + i + 1));
    }
  };
  addRRFScores(vecResults);
  addRRFScores(ftsResults);
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

export async function search(
  embedder: Embedder,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const queryEmbedding = await embedder.embed(query);
  const [vecResults, ftsResults] = [
    searchVec(queryEmbedding, FETCH_LIMIT),
    searchFts(query, FETCH_LIMIT),
  ];
  const topRanked = rankByRRF(vecResults, ftsResults).slice(0, limit);
  const chunks = getChunksByIds(topRanked.map((r) => r.id));
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  return topRanked.flatMap(({ id, score }) => {
    const chunk = chunkById.get(id);
    if (!chunk) return [];
    return [{ path: chunk.path, text: chunk.text, score }];
  });
}
