import { describe, it, expect } from "vitest";
import { findProjects } from "../../src/vault/projects.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../fixtures/vault");

describe("findProjects", () => {
  it("returns every directory under 1-Projects/ as a project", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const names = projects.map((p) => p.name).sort();
    expect(names).toEqual(["Bare Project", "Sample Active", "Sample Waiting"]);
  });

  it("populates metadata when _project.md is present", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const active = projects.find((p) => p.name === "Sample Active");
    expect(active).toBeDefined();
    expect(active?.status).toBe("active");
    expect(active?.nextAction).toBe("Write the failing test");
    expect(active?.tags).toEqual(["sample", "active"]);
    expect(active?.hasProjectFile).toBe(true);
  });

  it("returns hasProjectFile=false when _project.md is absent", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const bare = projects.find((p) => p.name === "Bare Project");
    expect(bare?.hasProjectFile).toBe(false);
    expect(bare?.status).toBeUndefined();
  });

  it("filters by case-insensitive name fragment when query is provided", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG, { query: "active" });
    expect(projects.map((p) => p.name)).toEqual(["Sample Active"]);
  });

  it("filters by tag when query starts with #", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG, { query: "#waiting" });
    expect(projects.map((p) => p.name)).toEqual(["Sample Waiting"]);
  });
});
