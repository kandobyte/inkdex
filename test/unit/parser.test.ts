import assert from "node:assert";
import { describe, it } from "node:test";
import { parseMarkdown } from "../../src/ingest/mdparser.js";

describe("parseMarkdown", () => {
  it("should extract fileHeading from H1", () => {
    const doc = parseMarkdown("# My Guide\n\n## Section\n\nContent", "test.md");
    assert.strictEqual(doc.fileHeading, "My Guide");
  });

  it("should fall back to filename when no H1", () => {
    const doc = parseMarkdown("## Section\n\nContent", "guide.md");
    assert.strictEqual(doc.fileHeading, "guide");
  });

  it("should parse H2 sections", () => {
    const md = `# Doc

## First

First content.

## Second

Second content.
`;
    const doc = parseMarkdown(md, "test.md");
    assert.strictEqual(doc.sections.length, 2);
    assert.strictEqual(doc.sections[0].headingPath, "Doc > First");
    assert.strictEqual(doc.sections[1].headingPath, "Doc > Second");
  });

  it("should parse H3 subsections", () => {
    const md = `# Doc

## Parent

Preamble.

### Child A

Child A content.

### Child B

Child B content.
`;
    const doc = parseMarkdown(md, "test.md");
    assert.strictEqual(doc.sections.length, 3);
    assert.strictEqual(doc.sections[0].headingPath, "Doc > Parent");
    assert.strictEqual(doc.sections[1].headingPath, "Doc > Parent > Child A");
    assert.strictEqual(doc.sections[2].headingPath, "Doc > Parent > Child B");
  });

  it("should include preamble before first H2", () => {
    const md = `# Doc

Intro content here.

## Section

Section content.
`;
    const doc = parseMarkdown(md, "test.md");
    assert.strictEqual(doc.sections.length, 2);
    assert.strictEqual(doc.sections[0].headingPath, "Doc");
    assert.ok(doc.sections[0].text.includes("Intro content"));
  });

  it("should skip empty sections", () => {
    const md = `# Doc

## Empty

## Has Content

Actual content.
`;
    const doc = parseMarkdown(md, "test.md");
    assert.strictEqual(doc.sections.length, 1);
    assert.strictEqual(doc.sections[0].headingPath, "Doc > Has Content");
  });

  it("should strip HTML comments", () => {
    const md = `# Doc

## Section

<!-- hidden -->
Visible content.
`;
    const doc = parseMarkdown(md, "test.md");
    assert.ok(!doc.sections[0].text.includes("<!--"));
    assert.ok(doc.sections[0].text.includes("Visible content"));
  });

  it("should return empty sections for empty document", () => {
    const doc = parseMarkdown("# Title", "test.md");
    assert.strictEqual(doc.sections.length, 0);
    assert.strictEqual(doc.fileHeading, "Title");
  });
});
