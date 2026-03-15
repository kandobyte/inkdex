import { createHash } from "node:crypto";
import { glob, readFile } from "node:fs/promises";
import type { Embedder } from "../embedder/embedder.js";
import { logger } from "../logger.js";
import {
  getAllDocumentHashes,
  insertChunk,
  removeDocument,
  runInTransaction,
  setDocumentHash,
} from "../store/db.js";
import { CHUNK_SIZE, chunkDocument } from "./chunker.js";
import { parseMarkdown } from "./mdparser.js";

async function findMarkdownFiles(docsPath: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of glob("**/*.md", { cwd: docsPath })) {
    files.push(`${docsPath}/${entry}`);
  }
  return files.sort();
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function indexDocs(
  embedder: Embedder,
  docsPath: string,
): Promise<void> {
  const files = await findMarkdownFiles(docsPath);

  if (files.length === 0) {
    logger.warn({ path: docsPath }, "No markdown files found");
    return;
  }

  const fileContents = new Map<string, string>();
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    fileContents.set(file, content);
  }

  const allHashes = getAllDocumentHashes();
  const storedHashes: Record<string, string> = {};
  for (const [k, v] of Object.entries(allHashes)) {
    if (k.startsWith(`${docsPath}/`)) {
      storedHashes[k] = v;
    }
  }

  const changedKeys: string[] = [];
  for (const [key, content] of fileContents) {
    if (storedHashes[key] !== hashContent(content)) {
      changedKeys.push(key);
    }
  }

  const removedKeys: string[] = [];
  for (const key of Object.keys(storedHashes)) {
    if (!fileContents.has(key)) {
      removedKeys.push(key);
    }
  }

  if (changedKeys.length === 0 && removedKeys.length === 0) {
    logger.info({ files: files.length }, "Index up to date");
    return;
  }

  const start = performance.now();

  logger.info(
    { changed: changedKeys.length, removed: removedKeys.length },
    "Indexing changed files",
  );

  if (removedKeys.length > 0) {
    runInTransaction(() => {
      for (const key of removedKeys) {
        removeDocument(key);
      }
    });
  }

  if (CHUNK_SIZE > embedder.maxTokens) {
    logger.warn(
      { chunkMax: CHUNK_SIZE, modelMax: embedder.maxTokens },
      "Chunk size exceeds embedding model context — embeddings will be truncated",
    );
  }

  const chunkOptions = {
    maxTokens: CHUNK_SIZE,
    countTokens: (text: string) => embedder.tokenize(text).length,
  };

  let totalChunks = 0;
  for (const key of changedKeys) {
    const content = fileContents.get(key) as string;
    const doc = parseMarkdown(content, key);
    const chunks = chunkDocument(doc, key, chunkOptions);

    logger.debug({ path: key, chunks: chunks.length }, "Embedding chunks");
    const embeddings = await embedder.embedBatch(chunks.map((c) => c.text));

    runInTransaction(() => {
      removeDocument(key);
      setDocumentHash(key, hashContent(content));
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        insertChunk(chunk.path, chunk.text, embeddings[i]);
      }
    });

    totalChunks += chunks.length;
  }

  const duration = ((performance.now() - start) / 1000).toFixed(1);
  logger.info(
    { duration: `${duration}s`, chunks: totalChunks },
    "Indexing complete",
  );
}
