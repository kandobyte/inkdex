import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StatementSync } from "node:sqlite";
import { DatabaseSync } from "node:sqlite";
import { load as loadSqliteVec } from "sqlite-vec";
import type { ChunkRow } from "../types.js";

const STORE_DIR = join(homedir(), ".inkdex");

function dbPath(): string {
  return join(STORE_DIR, "index.db");
}
const SCHEMA_VERSION = 4;

const CHUNK_COLUMNS = "id, document_path, source, text, embedding";

let db: DatabaseSync;

let stmts: {
  getAllDocs: StatementSync;
  upsertDoc: StatementSync;
  deleteChunksByDoc: StatementSync;
  deleteDoc: StatementSync;
  insertChunk: StatementSync;
  getAllChunks: StatementSync;
  countChunks: StatementSync;
  searchFts: StatementSync;
  searchVec: StatementSync;
};

function createSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      document_path TEXT NOT NULL REFERENCES documents(path),
      source TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_path);

    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
      USING fts5(text, content=chunks, content_rowid=id);

    CREATE TRIGGER IF NOT EXISTS chunks_fts_insert AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_fts_delete AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, text)
        VALUES('delete', old.id, old.text);
    END;

    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec
      USING vec0(embedding float[384]);

    CREATE TRIGGER IF NOT EXISTS chunks_vec_insert AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_vec(rowid, embedding) VALUES (new.id, new.embedding);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_vec_delete AFTER DELETE ON chunks BEGIN
      DELETE FROM chunks_vec WHERE rowid = old.id;
    END;
  `);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

function prepareStatements(): void {
  stmts = {
    getAllDocs: db.prepare("SELECT path, hash FROM documents"),
    upsertDoc: db.prepare(
      "INSERT OR REPLACE INTO documents (path, hash) VALUES (?, ?)",
    ),
    deleteChunksByDoc: db.prepare("DELETE FROM chunks WHERE document_path = ?"),
    deleteDoc: db.prepare("DELETE FROM documents WHERE path = ?"),
    insertChunk: db.prepare(
      "INSERT INTO chunks (document_path, source, text, embedding) VALUES (?, ?, ?, ?)",
    ),
    getAllChunks: db.prepare(`SELECT ${CHUNK_COLUMNS} FROM chunks`),
    countChunks: db.prepare("SELECT COUNT(*) as count FROM chunks"),
    searchFts: db.prepare(
      "SELECT rowid, -bm25(chunks_fts) AS score FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT ?",
    ),
    searchVec: db.prepare(
      "SELECT rowid, distance FROM chunks_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
    ),
  };
}

export function openDb(overridePath?: string): void {
  mkdirSync(STORE_DIR, { recursive: true });
  db = new DatabaseSync(overridePath ?? dbPath(), { allowExtension: true });
  loadSqliteVec(db);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  const { user_version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  if (user_version !== SCHEMA_VERSION) {
    db.exec("DROP TABLE IF EXISTS chunks_vec");
    db.exec("DROP TABLE IF EXISTS chunks_fts");
    db.exec("DROP TABLE IF EXISTS chunks");
    db.exec("DROP TABLE IF EXISTS documents");
  }
  createSchema();

  prepareStatements();
}

export function closeDb(): void {
  db?.close();
}

export function getAllDocumentHashes(): Record<string, string> {
  const rows = stmts.getAllDocs.all() as {
    path: string;
    hash: string;
  }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.path] = row.hash;
  }
  return result;
}

export function setDocumentHash(path: string, hash: string): void {
  stmts.upsertDoc.run(path, hash);
}

export function removeDocument(path: string): void {
  stmts.deleteChunksByDoc.run(path);
  stmts.deleteDoc.run(path);
}

function embeddingToBlob(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

function blobToEmbedding(blob: Uint8Array): number[] {
  return Array.from(new Float32Array(new Uint8Array(blob).buffer));
}

interface RawChunkRow {
  id: number;
  document_path: string;
  source: string;
  text: string;
  embedding: Uint8Array;
}

function toChunkRow(row: RawChunkRow): ChunkRow {
  return {
    id: row.id,
    path: row.document_path,
    source: row.source,
    text: row.text,
    embedding: blobToEmbedding(row.embedding),
  };
}

export function insertChunk(
  documentPath: string,
  source: string,
  text: string,
  embedding: number[],
): void {
  stmts.insertChunk.run(documentPath, source, text, embeddingToBlob(embedding));
}

export function getAllChunks(): ChunkRow[] {
  const rows = stmts.getAllChunks.all() as unknown as RawChunkRow[];
  return rows.map(toChunkRow);
}

export function getChunkCount(): number {
  const row = stmts.countChunks.get() as {
    count: number;
  };
  return row.count;
}

export interface FtsResult {
  id: number;
  score: number;
}

export function searchFts(query: string, limit: number): FtsResult[] {
  // Sanitize: split into words, quote each to escape FTS5 operators
  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" ");
  if (terms.length === 0) return [];
  try {
    const rows = stmts.searchFts.all(terms, limit) as {
      rowid: number;
      score: number;
    }[];
    return rows.map((r) => ({ id: r.rowid, score: r.score }));
  } catch {
    // FTS5 MATCH can fail on edge-case inputs; fall back to empty
    return [];
  }
}

export interface VecResult {
  id: number;
  distance: number;
}

export function searchVec(embedding: number[], limit: number): VecResult[] {
  const blob = embeddingToBlob(embedding);
  const rows = stmts.searchVec.all(blob, limit) as {
    rowid: number;
    distance: number;
  }[];
  return rows.map((r) => ({ id: r.rowid, distance: r.distance }));
}

export function getChunksByIds(
  ids: number[],
): Array<{ id: number; path: string; source: string; text: string }> {
  if (ids.length === 0) return [];
  return db
    .prepare(
      "SELECT id, document_path AS path, source, text FROM chunks WHERE id IN (SELECT value FROM json_each(?))",
    )
    .all(JSON.stringify(ids)) as Array<{
    id: number;
    path: string;
    source: string;
    text: string;
  }>;
}

export function runInTransaction(fn: () => void): void {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
