#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Embedder } from "./embedder/embedder.js";
import { indexDocs } from "./ingest/index-docs.js";
import { logger } from "./logger.js";
import { startServer } from "./server.js";
import {
  closeDb,
  getAllDocumentHashes,
  openDb,
  removeDocument,
  runInTransaction,
} from "./store/db.js";

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection");
  process.exit(1);
});

async function main(): Promise<void> {
  const docsPathEnv = process.env.DOCS_PATH;
  if (!docsPathEnv) {
    logger.error("DOCS_PATH environment variable is required");
    process.exit(1);
  }

  const docsPaths = await Promise.all(
    docsPathEnv
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map(async (p) => {
        const resolved = resolve(p);
        const info = await stat(resolved).catch(() => null);
        if (!info?.isDirectory()) {
          logger.error(
            { path: resolved },
            "DOCS_PATH entry is not a directory",
          );
          process.exit(1);
        }
        return resolved;
      }),
  );

  if (docsPaths.length === 0) {
    logger.error("DOCS_PATH contains no valid entries");
    process.exit(1);
  }

  const embedder = await Embedder.load();
  openDb();

  // Remove documents from dirs no longer in DOCS_PATH
  const allHashes = getAllDocumentHashes();
  const staleKeys = Object.keys(allHashes).filter(
    (key) => !docsPaths.some((dir) => key.startsWith(`${dir}/`)),
  );
  if (staleKeys.length > 0) {
    logger.info(
      { count: staleKeys.length },
      "Removing documents from inactive directories",
    );
    runInTransaction(() => {
      for (const key of staleKeys) {
        removeDocument(key);
      }
    });
  }

  for (const dir of docsPaths) {
    await indexDocs(embedder, dir);
  }

  await startServer(embedder);
}

main().catch((error) => {
  closeDb();
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
