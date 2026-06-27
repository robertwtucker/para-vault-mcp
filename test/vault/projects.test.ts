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

  it("lifts updated, last_reviewed, due, and daysSinceUpdate from frontmatter", async () => {
    const now = new Date(2026, 5, 15); // 2026-06-15 local
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG, { now });
    const active = projects.find((p) => p.name === "Sample Active");
    expect(active?.updated).toBe("2026-05-01");
    expect(active?.last_reviewed).toBe("2026-04-15");
    expect(active?.due).toBe("2026-06-30");
    expect(active?.daysSinceUpdate).toBe(45);
  });

  it("leaves date-derived fields undefined when frontmatter omits them", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const bare = projects.find((p) => p.name === "Bare Project");
    expect(bare?.updated).toBeUndefined();
    expect(bare?.last_reviewed).toBeUndefined();
    expect(bare?.daysSinceUpdate).toBeUndefined();
  });

  it("preserves the user's calendar date when frontmatter carries a TZ offset", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      const dir = path.join(projectsDir, "Offset");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "_project.md"),
        `---\ndue: 2026-06-30T20:00:00-08:00\nupdated: 2026-05-01T16:00:00-08:00\n---\n`,
      );
      const projects = await findProjects(tempVault, DEFAULT_CONFIG);
      const offset = projects.find((p) => p.name === "Offset");
      expect(offset?.due).toBe("2026-06-30");
      expect(offset?.updated).toBe("2026-05-01");
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
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

  it("filters by area across every canonical Obsidian YAML shape", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      for (const [name, areaLine] of [
        ["Bare", "area: Integration"],
        ["Quoted", 'area: "Integration"'],
        ["QuotedWikilink", "area: '[[Integration]]'"],
        ["UnquotedWikilink", "area: [[Integration]]"],
        ["QuotedPath", "area: '[[Areas/Integration]]'"],
        ["UnquotedPath", "area: [[Areas/Integration]]"],
        ["QuotedAlias", "area: '[[Areas/Integration|Integration]]'"],
        ["UnquotedAlias", "area: [[Areas/Integration|Integration]]"],
        ["Other", "area: DevOps"],
      ] as const) {
        const dir = path.join(projectsDir, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "_project.md"), `---\n${areaLine}\n---\n`);
      }
      const matches = await findProjects(tempVault, DEFAULT_CONFIG, { area: "integration" });
      expect(matches.map((p) => p.name).sort()).toEqual([
        "Bare",
        "Quoted",
        "QuotedAlias",
        "QuotedPath",
        "QuotedWikilink",
        "UnquotedAlias",
        "UnquotedPath",
        "UnquotedWikilink",
      ]);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("treats wikilink alias as the canonical area name", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      const dir = path.join(projectsDir, "Aliased");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "_project.md"),
        `---\narea: "[[Areas/Health|Health]]"\n---\n`,
      );
      const matches = await findProjects(tempVault, DEFAULT_CONFIG, { area: "Health" });
      expect(matches.map((p) => p.name)).toEqual(["Aliased"]);
      const noMatch = await findProjects(tempVault, DEFAULT_CONFIG, { area: "areas/health" });
      expect(noMatch.map((p) => p.name)).toEqual(["Aliased"]);
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

  it("filters by stale_days against now (>= N days since update)", async () => {
    const now = new Date(2026, 5, 15); // 2026-06-15: Active=45d, Waiting=61d
    const stale60 = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, staleDays: 60 });
    expect(stale60.map((p) => p.name)).toEqual(["Sample Waiting"]);
    const stale30 = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, staleDays: 30 });
    expect(stale30.map((p) => p.name).sort()).toEqual(["Sample Active", "Sample Waiting"]);
  });

  it("filters by updated_since (>= given YYYY-MM-DD)", async () => {
    const now = new Date(2026, 5, 15);
    const recent = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, updatedSince: "2026-05-01" });
    expect(recent.map((p) => p.name)).toEqual(["Sample Active"]);
    const all = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, updatedSince: "2026-04-01" });
    expect(all.map((p) => p.name).sort()).toEqual(["Sample Active", "Sample Waiting"]);
  });

  it("AND-combines stale_days and updated_since when both passed", async () => {
    const now = new Date(2026, 5, 15);
    // stale_days=30 includes Active(45d) + Waiting(61d); updated_since=2026-04-20 excludes Waiting(2026-04-15)
    const matches = await findProjects(FIXTURE, DEFAULT_CONFIG, {
      now,
      staleDays: 30,
      updatedSince: "2026-04-20",
    });
    expect(matches.map((p) => p.name)).toEqual(["Sample Active"]);
  });

  it("excludes projects with no updated field when stale_days or updated_since is set", async () => {
    const now = new Date(2026, 5, 15);
    const stale = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, staleDays: 0 });
    expect(stale.find((p) => p.name === "Bare Project")).toBeUndefined();
    const since = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, updatedSince: "2020-01-01" });
    expect(since.find((p) => p.name === "Bare Project")).toBeUndefined();
  });

  it("defaults to sort by name ascending", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    expect(projects.map((p) => p.name)).toEqual(["Bare Project", "Sample Active", "Sample Waiting"]);
  });

  it("sorts by updated ascending and descending", async () => {
    const asc = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "asc" });
    const ascNames = asc.map((p) => p.name);
    expect(ascNames.indexOf("Sample Waiting")).toBeLessThan(ascNames.indexOf("Sample Active"));

    const desc = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "desc" });
    const descNames = desc.map((p) => p.name);
    expect(descNames.indexOf("Sample Active")).toBeLessThan(descNames.indexOf("Sample Waiting"));
  });

  it("sorts projects with missing sort-key values to the end regardless of order", async () => {
    const asc = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "asc" });
    expect(asc[asc.length - 1]?.name).toBe("Bare Project");
    const desc = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "desc" });
    expect(desc[desc.length - 1]?.name).toBe("Bare Project");
  });

  it("sorts by due and last_reviewed", async () => {
    const byDue = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "due" });
    expect(byDue[0]?.name).toBe("Sample Active");
    const byReviewed = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "last_reviewed" });
    expect(byReviewed[0]?.name).toBe("Sample Active");
  });

  it("limit caps result count after sort", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "name", limit: 2 });
    expect(projects.map((p) => p.name)).toEqual(["Bare Project", "Sample Active"]);
  });

  it("surfaces dateErrors when a date field is impossible (2026-13-45)", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      const dir = path.join(projectsDir, "BadDate");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "_project.md"),
        `---\nupdated: 2026-13-45\ndue: "2026-02-30"\n---\n`,
      );
      const projects = await findProjects(tempVault, DEFAULT_CONFIG);
      const bad = projects.find((p) => p.name === "BadDate");
      expect(bad?.updated).toBeUndefined();
      expect(bad?.due).toBeUndefined();
      expect(bad?.daysSinceUpdate).toBeUndefined();
      expect(bad?.dateErrors).toEqual(
        expect.arrayContaining([
          { field: "updated", value: "2026-13-45" },
          { field: "due", value: "2026-02-30" },
        ]),
      );
      expect(bad?.dateErrors).toHaveLength(2);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("omits dateErrors when every date field is valid", async () => {
    const projects = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const active = projects.find((p) => p.name === "Sample Active");
    expect(active?.dateErrors).toBeUndefined();
  });

  it("excludes projects with invalid updated values from updated_since filter", async () => {
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      for (const [name, line] of [
        ["Good", "updated: 2026-05-01"],
        ["Bad", "updated: 2026-13-45"],
      ] as const) {
        const dir = path.join(projectsDir, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "_project.md"), `---\n${line}\n---\n`);
      }
      const matches = await findProjects(tempVault, DEFAULT_CONFIG, { updatedSince: "2026-04-01" });
      expect(matches.map((p) => p.name)).toEqual(["Good"]);
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
