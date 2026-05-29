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
});
