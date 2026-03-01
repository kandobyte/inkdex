import type { BaseChunk } from "../types.js";
import type { MarkdownDocument } from "./mdparser.js";

export const CHUNK_SIZE = 200;
const TEXT_SEPARATORS = [/\n\n/, /\. (?=[A-Z])/];

export interface ChunkOptions {
  readonly maxTokens: number;
  readonly countTokens: (text: string) => number;
}

function splitOnSeparators(
  text: string,
  separators: RegExp[],
  maxTokens: number,
  countTokens: (text: string) => number,
): string[] {
  if (countTokens(text) <= maxTokens) return [text];

  const [separator, ...remaining] = separators;

  const parts = text.split(separator).filter((p) => p.trim());
  if (parts.length <= 1) {
    if (remaining.length > 0) {
      return splitOnSeparators(text, remaining, maxTokens, countTokens);
    }
    return hardSplit(text, maxTokens, countTokens);
  }

  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const combined = current ? `${current}\n\n${part}` : part;
    if (current && countTokens(combined) > maxTokens) {
      chunks.push(current.trim());
      current = part;
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.flatMap((chunk) => {
    if (countTokens(chunk) <= maxTokens) return [chunk];
    if (remaining.length > 0) {
      return splitOnSeparators(chunk, remaining, maxTokens, countTokens);
    }
    return hardSplit(chunk, maxTokens, countTokens);
  });
}

function hardSplit(
  text: string,
  maxTokens: number,
  countTokens: (text: string) => number,
): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (countTokens(next) > maxTokens && current) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

/** @package */
export function chunkDocument(
  doc: MarkdownDocument,
  path: string,
  options: ChunkOptions,
): BaseChunk[] {
  const { maxTokens, countTokens } = options;
  const chunks: BaseChunk[] = [];

  for (const section of doc.sections) {
    const textChunks = splitOnSeparators(
      section.text,
      TEXT_SEPARATORS,
      maxTokens,
      countTokens,
    );

    for (const text of textChunks) {
      chunks.push({
        path,
        fileHeading: doc.fileHeading,
        heading: section.heading,
        text: `${section.heading}: ${text}`,
        metadata: doc.metadata,
      });
    }
  }

  return chunks;
}
