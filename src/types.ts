export interface BaseChunk {
  path: string;
  source: string;
  text: string;
}

export interface ChunkRow extends BaseChunk {
  id: number;
  embedding: number[];
}

export interface SearchResult extends Omit<ChunkRow, "id" | "embedding"> {
  score: number;
}
