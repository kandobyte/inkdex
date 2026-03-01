import { basename } from "node:path";
import matter from "gray-matter";

const HEADING_LEVELS = [/^## /m, /^### /m];

export interface MarkdownDocument {
  readonly fileHeading: string;
  readonly metadata: Record<string, unknown>;
  readonly sections: Section[];
}

export interface Section {
  readonly heading: string;
  readonly text: string;
}

function extractH1(body: string): string | null {
  const match = body.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

function clean(text: string): string {
  return text
    .replace(/<!--.*?-->/gs, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSections(
  text: string,
  parentHeading: string,
  headingLevels: RegExp[],
): Section[] {
  if (headingLevels.length === 0) return [{ heading: parentHeading, text }];

  const [separator, ...remaining] = headingLevels;
  const parts = text.split(separator);

  if (parts.length <= 1) return [{ heading: parentHeading, text }];

  const sections: Section[] = [];
  const preamble = parts[0].trim();
  if (preamble) {
    sections.push(...parseSections(preamble, parentHeading, remaining));
  }

  for (let i = 1; i < parts.length; i++) {
    const [headingLine, ...rest] = parts[i].split("\n");
    const body = rest.join("\n").trim();
    if (!body) continue;
    const heading = `${parentHeading} > ${headingLine.trim()}`;
    sections.push(...parseSections(body, heading, remaining));
  }

  return sections;
}

/** @package */
export function parseMarkdown(content: string, path: string): MarkdownDocument {
  const { data: metadata, content: body } = matter(content);
  const fileHeading = extractH1(body) || basename(path, ".md");
  const cleaned = clean(body.replace(/^# .+$/m, ""));

  if (!cleaned) return { fileHeading, metadata, sections: [] };

  const sections = parseSections(cleaned, fileHeading, HEADING_LEVELS);
  return { fileHeading, metadata, sections };
}
