import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../../src/vault/frontmatter.js";

describe("parseFrontmatter", () => {
  it("returns frontmatter object and body for a well-formed note", () => {
    const input = `---\ntype: project\nstatus: active\ntags: [a, b]\n---\n\n# Body`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({ type: "project", status: "active", tags: ["a", "b"] });
    expect(result.body.trim()).toBe("# Body");
  });

  it("returns empty data and full body when frontmatter is missing", () => {
    const input = `# No frontmatter\n\nJust content.`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.body).toBe(input);
  });

  it("does not throw on malformed YAML; returns empty data", () => {
    const input = `---\nthis: is: not: valid\n---\n\nbody`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.body.trim()).toBe("body");
  });

  it("returns an `error` field describing malformed YAML", () => {
    const input = `---\n[unclosed\n---\n\nbody`;
    const result = parseFrontmatter(input);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/./);
  });

  it("exposes the raw YAML block between delimiters as rawFrontmatter", () => {
    const input = `---\ntype: project\nupdated: 2026-05-01T16:00:00-08:00\n---\n\nBody`;
    const result = parseFrontmatter(input);
    expect(result.rawFrontmatter).toContain("type: project");
    expect(result.rawFrontmatter).toContain("updated: 2026-05-01T16:00:00-08:00");
  });

  it("returns empty rawFrontmatter when no frontmatter is present", () => {
    const result = parseFrontmatter("# Just a body");
    expect(result.rawFrontmatter).toBe("");
  });

  it("rawFrontmatter is the delimited YAML slice, not gray-matter's own `matter` property", () => {
    // Regression guard for a real @11ty/gray-matter defect, independent of
    // parseFrontmatter's cache opt-out: gray-matter's own `file.matter`
    // property carries a leading newline that the delimited block itself does
    // not ("\nupdated: 2026-05-01" vs "updated: 2026-05-01"). If
    // parseFrontmatter ever regressed to reading `parsed.matter` directly
    // instead of slicing the raw input, this exact-value assertion would catch
    // the stray leading newline — regardless of whether gray-matter's cache is
    // in play, so it stays meaningful even after the cache opt-out.
    const input = `---\nupdated: 2026-05-01\n---\n\nBody`;
    const result = parseFrontmatter(input);
    expect(result.rawFrontmatter).toBe("updated: 2026-05-01");
  });

  it("reports the error on every parse of the same invalid YAML, not just the first", () => {
    // @11ty/gray-matter caches its pre-parse `file` object by content string
    // *before* parsing runs. When parsing throws, that empty, error-free object
    // is left in the cache, so a second parse of byte-identical invalid content
    // would silently return `{ data: {} }` with no error instead of re-throwing.
    // In a long-lived process this would report a corrupt file's parse failure
    // once and then hide it forever after.
    const input = `---\n[unclosed\n---\n\nbody`;
    for (let i = 0; i < 3; i++) {
      const result = parseFrontmatter(input);
      expect(result.error).toBeDefined();
    }
  });
});
