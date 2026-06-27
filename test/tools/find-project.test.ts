import { describe, it, expect } from "vitest";
import { findProjectTool } from "../../src/tools/find-project.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../fixtures/vault");

describe("findProjectTool", () => {
  it("returns all projects as a JSON-text content block when no query", async () => {
    const result = await findProjectTool.handler({}, FIXTURE, DEFAULT_CONFIG);
    expect(result.content[0]?.type).toBe("text");
    const projects = JSON.parse(result.content[0]!.text);
    expect(projects).toHaveLength(3);
  });

  it("returns filtered projects when query is provided", async () => {
    const result = await findProjectTool.handler({ query: "Sample" }, FIXTURE, DEFAULT_CONFIG);
    const projects = JSON.parse(result.content[0]!.text);
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
    const projects = JSON.parse(result.content[0]!.text);
    expect(projects.map((p: { name: string }) => p.name)).toEqual(["Sample Active"]);
  });

  it("plumbs sort, order, and limit through to the vault layer", async () => {
    const result = await findProjectTool.handler(
      { sort: "name", order: "desc", limit: 1 },
      FIXTURE,
      DEFAULT_CONFIG,
    );
    const projects = JSON.parse(result.content[0]!.text);
    expect(projects.map((p: { name: string }) => p.name)).toEqual(["Sample Waiting"]);
  });

  it("plumbs last_reviewed sort key through to the vault layer", async () => {
    const result = await findProjectTool.handler(
      { sort: "last_reviewed" },
      FIXTURE,
      DEFAULT_CONFIG,
    );
    const projects = JSON.parse(result.content[0]!.text);
    expect(projects[0].name).toBe("Sample Active");
  });
});
