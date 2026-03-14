import assert from "node:assert";
import { describe, it } from "node:test";
import type { ChunkOptions } from "../../src/ingest/chunker.js";
import { chunkDocument } from "../../src/ingest/chunker.js";
import { parseMarkdown } from "../../src/ingest/mdparser.js";

// Use character length as a stand-in for token counting in unit tests
const defaultOptions: ChunkOptions = {
  maxTokens: 2000,
  countTokens: (text: string) => text.length,
};

function chunk(md: string, path = "test.md", options = defaultOptions) {
  return chunkDocument(parseMarkdown(md, path), path, options);
}

function contextPrefix(headingPath: string): string {
  return `<context>\n${headingPath}\n</context>\n`;
}

describe("chunker", () => {
  it("should split on H2 headings", () => {
    const md = `# My Doc

## First Section

This is the first section with enough content to pass the minimum length filter for chunks.

## Second Section

This is the second section with enough content to pass the minimum length filter for chunks.
`;
    const chunks = chunk(md);
    assert.strictEqual(chunks.length, 2);
    assert.ok(
      chunks[0].text.startsWith(contextPrefix("My Doc > First Section")),
    );
    assert.ok(
      chunks[1].text.startsWith(contextPrefix("My Doc > Second Section")),
    );
  });

  it("should skip empty sections", () => {
    const md = `# Doc

## Empty

## Has Content

This section has actual content that should be included in the output.
`;
    const chunks = chunk(md);
    assert.strictEqual(chunks.length, 1);
    assert.ok(chunks[0].text.startsWith(contextPrefix("Doc > Has Content")));
  });

  it("should strip HTML comments", () => {
    const md = `# Doc

## Section

<!-- This is a comment that should be removed -->
The actual content remains here and has enough length to pass the minimum filter requirement.
`;
    const chunks = chunk(md);
    assert.ok(!chunks[0].text.includes("<!--"));
    assert.ok(chunks[0].text.includes("actual content"));
  });

  it("should prepend context preamble to chunk text", () => {
    const md = `# API Reference

## Methods

Here are the available methods with detailed descriptions and usage examples for each one.
`;
    const chunks = chunk(md, "api.md");
    assert.ok(
      chunks[0].text.startsWith(contextPrefix("API Reference > Methods")),
    );
  });

  it("should parse H3 subsections structurally", () => {
    const md = `# Doc

## Big Section

Preamble content here.

### Sub Heading A

Content for sub heading A with enough text.

### Sub Heading B

Content for sub heading B with enough text.
`;
    const chunks = chunk(md);
    assert.strictEqual(chunks.length, 3);
    assert.ok(chunks[0].text.startsWith(contextPrefix("Doc > Big Section")));
    assert.ok(
      chunks[1].text.startsWith(
        contextPrefix("Doc > Big Section > Sub Heading A"),
      ),
    );
    assert.ok(
      chunks[2].text.startsWith(
        contextPrefix("Doc > Big Section > Sub Heading B"),
      ),
    );
  });

  it("should keep small sections as single chunks", () => {
    const md = `# Doc

## Small Section

This section is well under the limit and should remain as a single chunk without splitting.
`;
    const chunks = chunk(md);
    assert.strictEqual(chunks.length, 1);
  });

  it("should preserve context for all sub-chunks", () => {
    const longText = "Sentence one with content. ".repeat(200);
    const md = `# Doc

## API Reference

${longText}
`;
    const chunks = chunk(md);
    assert.ok(chunks.length > 1);
    for (const c of chunks) {
      assert.ok(c.text.startsWith(contextPrefix("Doc > API Reference")));
    }
  });

  it("should respect custom measure function for splitting", () => {
    const md = `# Doc

## Section

${"word ".repeat(100)}
`;
    // Count by words, max 20 words per chunk
    const wordOptions: ChunkOptions = {
      maxTokens: 20,
      countTokens: (text: string) => text.split(/\s+/).filter(Boolean).length,
    };
    const chunks = chunk(md, "test.md", wordOptions);
    assert.ok(
      chunks.length > 1,
      `Expected multiple chunks, got ${chunks.length}`,
    );
    for (const c of chunks) {
      const wordCount = c.text.split(/\s+/).filter(Boolean).length;
      // 20 word max + context preamble words
      assert.ok(
        wordCount <= 25,
        `Chunk has ${wordCount} words, expected <= 25`,
      );
    }
  });

  it("should include pre-H2 content", () => {
    const md = `# My Doc

This is intro content before any H2 heading.

## First Section

Section content here.
`;
    const chunks = chunk(md);
    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].text.startsWith(contextPrefix("My Doc")));
    assert.ok(chunks[0].text.includes("intro content"));
    assert.ok(
      chunks[1].text.startsWith(contextPrefix("My Doc > First Section")),
    );
  });
});
