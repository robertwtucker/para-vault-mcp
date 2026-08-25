import { describe, it, expect } from "vitest";
import { findProjectTool } from "../../src/tools/find-project.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../fixtures/vault");

describe("findProjectTool", () => {
  it("returns all projects as a JSON-text content block when no query", async () => {
    const result = await findProjectTool.handler({}, FIXTURE, DEFAULT_CONFIG);
    expect(result.content[0]?.type).toBe("text");
    const { projects } = JSON.parse(result.content[0]!.text);
    expect(projects).toHaveLength(3);
  });

  it("returns filtered projects when query is provided", async () => {
    const result = await findProjectTool.handler({ query: "Sample" }, FIXTURE, DEFAULT_CONFIG);
    const { projects } = JSON.parse(result.content[0]!.text);
    expect(projects.map((p: { name: string }) => p.name).sort()).toEqual([
      "Sample Active",
      "Sample Waiting",
    ]);
  });

  it("declares snake_case name and a useful description", () => {
    expect(findProjectTool.name).toBe("find_project");
    expect(findProjectTool.description).toMatch(/project/i);
  });

  it("plumbs status and area filters through to the vault layer", async () => {
    const result = await findProjectTool.handler(
      { status: "active", area: "Sample Area" },
      FIXTURE,
      DEFAULT_CONFIG,
    );
    const { projects } = JSON.parse(result.content[0]!.text);
    expect(projects.map((p: { name: string }) => p.name)).toEqual(["Sample Active"]);
  });

  it("plumbs sort, order, and limit through to the vault layer", async () => {
    const result = await findProjectTool.handler(
      { sort: "name", order: "desc", limit: 1 },
      FIXTURE,
      DEFAULT_CONFIG,
    );
    const { projects } = JSON.parse(result.content[0]!.text);
    expect(projects.map((p: { name: string }) => p.name)).toEqual(["Sample Waiting"]);
  });

  it("plumbs last_reviewed sort key through to the vault layer", async () => {
    const result = await findProjectTool.handler(
      { sort: "last_reviewed" },
      FIXTURE,
      DEFAULT_CONFIG,
    );
    const { projects } = JSON.parse(result.content[0]!.text);
    expect(projects[0].name).toBe("Sample Active");
  });

  it("returns an envelope with projects and a parseFailures census", async () => {
    const result = await findProjectTool.handler({}, FIXTURE, DEFAULT_CONFIG);
    const payload = JSON.parse(result.content[0]!.text);

    expect(Array.isArray(payload)).toBe(false);
    expect(Array.isArray(payload.projects)).toBe(true);
    expect(payload.parseFailures).toEqual([]);
  });

  it("still strips internal underscore-prefixed fields inside the envelope", async () => {
    const result = await findProjectTool.handler({}, FIXTURE, DEFAULT_CONFIG);
    const payload = JSON.parse(result.content[0]!.text);

    for (const p of payload.projects) {
      expect(Object.keys(p).some((k) => k.startsWith("_"))).toBe(false);
    }
  });

  it("documents the parseFailures channel in the tool description", () => {
    expect(findProjectTool.description).toMatch(/parseFailures/);
  });

  it("carries a populated parseFailures census through JSON.stringify to the wire", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-wire-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });

      // Whole-file frontmatter parse failure (bad YAML indentation).
      const corruptDir = path.join(projectsDir, "Zulu Corrupt");
      mkdirSync(corruptDir, { recursive: true });
      writeFileSync(
        path.join(corruptDir, "_project.md"),
        `---\ntype: project\nstatus: active\nnext-action: "Run the thing"\n  next-action: "Run the thing" and then some\nupdated: 2026-08-01\n---\n`,
      );

      // Frontmatter parses fine, but a date value doesn't. status is not
      // "active" so it's also excluded from the filtered result on its own.
      const badDateDir = path.join(projectsDir, "Alpha BadDate");
      mkdirSync(badDateDir, { recursive: true });
      writeFileSync(
        path.join(badDateDir, "_project.md"),
        `---\nstatus: waiting\nupdated: 2026-13-45\n---\n`,
      );

      // Healthy project — the only one that should survive the filter.
      const healthyDir = path.join(projectsDir, "Healthy Project");
      mkdirSync(healthyDir, { recursive: true });
      writeFileSync(path.join(healthyDir, "_project.md"), `---\nstatus: active\n---\n`);

      const result = await findProjectTool.handler(
        { status: "active" },
        tempVault,
        DEFAULT_CONFIG,
      );
      const payload = JSON.parse(result.content[0]!.text);

      expect(payload.projects.map((p: { name: string }) => p.name)).toEqual(["Healthy Project"]);

      expect(payload.parseFailures).toHaveLength(2);
      // Name-sorted: "Alpha BadDate" before "Zulu Corrupt".
      expect(payload.parseFailures.map((f: { name: string }) => f.name)).toEqual([
        "Alpha BadDate",
        "Zulu Corrupt",
      ]);

      const badDate = payload.parseFailures[0];
      expect(badDate.error).toBeUndefined();
      expect(badDate.dateErrors).toEqual([{ field: "updated", value: "2026-13-45" }]);

      const corrupt = payload.parseFailures[1];
      expect(corrupt.error).toMatch(/bad indentation/);
      expect(corrupt.dateErrors).toBeUndefined();
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });
});
