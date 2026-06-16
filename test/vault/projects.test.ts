import { describe, it, expect } from "vitest";
import { findProjects } from "../../src/vault/projects.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

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

  it("lifts updated, lastReviewed, due, and daysSinceUpdate from frontmatter", async () => {
    const now = new Date(2026, 5, 15); // 2026-06-15 local
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG, { now });
    const active = projects.find((p) => p.name === "Sample Active");
    expect(active?.updated).toBe("2026-05-01");
    expect(active?.lastReviewed).toBe("2026-04-15");
    expect(active?.due).toBe("2026-06-30");
    expect(active?.daysSinceUpdate).toBe(45);
  });

  it("leaves date-derived fields undefined when frontmatter omits them", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const bare = projects.find((p) => p.name === "Bare Project");
    expect(bare?.updated).toBeUndefined();
    expect(bare?.lastReviewed).toBeUndefined();
    expect(bare?.daysSinceUpdate).toBeUndefined();
  });

  it("accepts both quoted-string and unquoted-Date frontmatter date forms", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      const quotedDir = path.join(projectsDir, "Quoted");
      mkdirSync(quotedDir, { recursive: true });
      writeFileSync(
        path.join(quotedDir, "_project.md"),
        `---\nstatus: active\nupdated: "2026-05-01"\ndue: "2026-06-30"\n---\n`,
      );
      const now = new Date(2026, 5, 15);
      const projects = await findProjects(tempVault, DEFAULT_CONFIG, { now });
      const quoted = projects.find((p) => p.name === "Quoted");
      expect(quoted?.updated).toBe("2026-05-01");
      expect(quoted?.due).toBe("2026-06-30");
      expect(quoted?.daysSinceUpdate).toBe(45);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("filters by status with case-insensitive equality", async () => {
    const active = await findProjects(FIXTURE, DEFAULT_CONFIG, { status: "ACTIVE" });
    expect(active.map((p) => p.name)).toEqual(["Sample Active"]);
    const waiting = await findProjects(FIXTURE, DEFAULT_CONFIG, { status: "waiting" });
    expect(waiting.map((p) => p.name)).toEqual(["Sample Waiting"]);
  });

  it("excludes projects without _project.md when status filter is active", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG, { status: "active" });
    expect(projects.find((p) => p.name === "Bare Project")).toBeUndefined();
  });

  it("filters by area, normalizing bare, quoted, and [[wikilink]] presentations", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      for (const [name, areaLine] of [
        ["Bare", "area: Integration"],
        ["Quoted", 'area: "Integration"'],
        ["Wikilink", "area: '[[Integration]]'"],
        ["Other", "area: DevOps"],
      ] as const) {
        const dir = path.join(projectsDir, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "_project.md"), `---\n${areaLine}\n---\n`);
      }
      const matches = await findProjects(tempVault, DEFAULT_CONFIG, { area: "integration" });
      expect(matches.map((p) => p.name).sort()).toEqual(["Bare", "Quoted", "Wikilink"]);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("area filter is exact after normalization (no substring matches)", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      for (const [name, area] of [
        ["Eng", "Eng"],
        ["Engineering", "Engineering"],
      ] as const) {
        const dir = path.join(projectsDir, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "_project.md"), `---\narea: ${area}\n---\n`);
      }
      const matches = await findProjects(tempVault, DEFAULT_CONFIG, { area: "Eng" });
      expect(matches.map((p) => p.name)).toEqual(["Eng"]);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("surfaces frontmatterError on projects with malformed YAML frontmatter", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      const broken = path.join(projectsDir, "Broken FM");
      mkdirSync(broken, { recursive: true });
      writeFileSync(path.join(broken, "_project.md"), `---\n[unclosed\n---\n\nBody`);
      const projects = await findProjects(tempVault, DEFAULT_CONFIG);
      const target = projects.find((p) => p.name === "Broken FM");
      expect(target).toBeDefined();
      expect(target!.frontmatterError).toBeDefined();
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });
});
