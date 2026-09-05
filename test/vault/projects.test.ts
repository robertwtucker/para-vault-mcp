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
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const names = projects.map((p) => p.name).sort();
    expect(names).toEqual(["Bare Project", "Sample Active", "Sample Waiting"]);
  });

  it("populates metadata when _project.md is present", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const active = projects.find((p) => p.name === "Sample Active");
    expect(active).toBeDefined();
    expect(active?.status).toBe("active");
    expect(active?.nextAction).toBe("Write the failing test");
    expect(active?.tags).toEqual(["sample", "active"]);
    expect(active?.hasProjectFile).toBe(true);
  });

  it("returns hasProjectFile=false when _project.md is absent", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG);
    const bare = projects.find((p) => p.name === "Bare Project");
    expect(bare?.hasProjectFile).toBe(false);
    expect(bare?.status).toBeUndefined();
  });

  it("filters by case-insensitive name fragment when query is provided", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG, { query: "active" });
    expect(projects.map((p) => p.name)).toEqual(["Sample Active"]);
  });

  it("filters by tag when query starts with #", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG, { query: "#waiting" });
    expect(projects.map((p) => p.name)).toEqual(["Sample Waiting"]);
  });

  it("lifts updated, last_reviewed, due, and daysSinceUpdate from frontmatter", async () => {
    const now = new Date(2026, 5, 15); // 2026-06-15 local
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now });
    const active = projects.find((p) => p.name === "Sample Active");
    expect(active?.updated).toBe("2026-05-01");
    expect(active?.last_reviewed).toBe("2026-04-15");
    expect(active?.due).toBe("2026-06-30");
    expect(active?.daysSinceUpdate).toBe(45);
  });

  it("leaves date-derived fields undefined when frontmatter omits them", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG);
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
      const { projects } = await findProjects(tempVault, DEFAULT_CONFIG);
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
      const { projects } = await findProjects(tempVault, DEFAULT_CONFIG, { now });
      const quoted = projects.find((p) => p.name === "Quoted");
      expect(quoted?.updated).toBe("2026-05-01");
      expect(quoted?.due).toBe("2026-06-30");
      expect(quoted?.daysSinceUpdate).toBe(45);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("filters by status with case-insensitive equality", async () => {
    const { projects: active } = await findProjects(FIXTURE, DEFAULT_CONFIG, { status: "ACTIVE" });
    expect(active.map((p) => p.name)).toEqual(["Sample Active"]);
    const { projects: waiting } = await findProjects(FIXTURE, DEFAULT_CONFIG, { status: "waiting" });
    expect(waiting.map((p) => p.name)).toEqual(["Sample Waiting"]);
  });

  it("excludes projects without _project.md when status filter is active", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG, { status: "active" });
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
      const { projects: matches } = await findProjects(tempVault, DEFAULT_CONFIG, { area: "integration" });
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
      const { projects: matches } = await findProjects(tempVault, DEFAULT_CONFIG, { area: "Health" });
      expect(matches.map((p) => p.name)).toEqual(["Aliased"]);
      const { projects: noMatch } = await findProjects(tempVault, DEFAULT_CONFIG, { area: "areas/health" });
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
      const { projects: matches } = await findProjects(tempVault, DEFAULT_CONFIG, { area: "Eng" });
      expect(matches.map((p) => p.name)).toEqual(["Eng"]);
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  it("filters by stale_days against now (>= N days since update)", async () => {
    const now = new Date(2026, 5, 15); // 2026-06-15: Active=45d, Waiting=61d
    const { projects: stale60 } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, staleDays: 60 });
    expect(stale60.map((p) => p.name)).toEqual(["Sample Waiting"]);
    const { projects: stale30 } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, staleDays: 30 });
    expect(stale30.map((p) => p.name).sort()).toEqual(["Sample Active", "Sample Waiting"]);
  });

  it("filters by updated_since (>= given YYYY-MM-DD)", async () => {
    const now = new Date(2026, 5, 15);
    const { projects: recent } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, updatedSince: "2026-05-01" });
    expect(recent.map((p) => p.name)).toEqual(["Sample Active"]);
    const { projects: all } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, updatedSince: "2026-04-01" });
    expect(all.map((p) => p.name).sort()).toEqual(["Sample Active", "Sample Waiting"]);
  });

  it("AND-combines stale_days and updated_since when both passed", async () => {
    const now = new Date(2026, 5, 15);
    // stale_days=30 includes Active(45d) + Waiting(61d); updated_since=2026-04-20 excludes Waiting(2026-04-15)
    const { projects: matches } = await findProjects(FIXTURE, DEFAULT_CONFIG, {
      now,
      staleDays: 30,
      updatedSince: "2026-04-20",
    });
    expect(matches.map((p) => p.name)).toEqual(["Sample Active"]);
  });

  it("excludes projects with no updated field when stale_days or updated_since is set", async () => {
    const now = new Date(2026, 5, 15);
    const { projects: stale } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, staleDays: 0 });
    expect(stale.find((p) => p.name === "Bare Project")).toBeUndefined();
    const { projects: since } = await findProjects(FIXTURE, DEFAULT_CONFIG, { now, updatedSince: "2020-01-01" });
    expect(since.find((p) => p.name === "Bare Project")).toBeUndefined();
  });

  it("defaults to sort by name ascending", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG);
    expect(projects.map((p) => p.name)).toEqual(["Bare Project", "Sample Active", "Sample Waiting"]);
  });

  it("sorts by updated ascending and descending", async () => {
    const { projects: asc } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "asc" });
    const ascNames = asc.map((p) => p.name);
    expect(ascNames.indexOf("Sample Waiting")).toBeLessThan(ascNames.indexOf("Sample Active"));

    const { projects: desc } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "desc" });
    const descNames = desc.map((p) => p.name);
    expect(descNames.indexOf("Sample Active")).toBeLessThan(descNames.indexOf("Sample Waiting"));
  });

  it("sorts projects with missing sort-key values to the end regardless of order", async () => {
    const { projects: asc } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "asc" });
    expect(asc[asc.length - 1]?.name).toBe("Bare Project");
    const { projects: desc } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "updated", order: "desc" });
    expect(desc[desc.length - 1]?.name).toBe("Bare Project");
  });

  it("sorts by due and last_reviewed", async () => {
    const { projects: byDue } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "due" });
    expect(byDue[0]?.name).toBe("Sample Active");
    const { projects: byReviewed } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "last_reviewed" });
    expect(byReviewed[0]?.name).toBe("Sample Active");
  });

  it("limit caps result count after sort", async () => {
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG, { sort: "name", limit: 2 });
    expect(projects.map((p) => p.name)).toEqual(["Bare Project", "Sample Active"]);
  });

  it("caches local-midnight Date when raw scalar misses the date-shape regex", async () => {
    // Trigger readDateField's string fallback, the path taken when the raw
    // scalar misses the date-shape regex. A YAML anchor on the date field
    // produces a raw scalar like "&u 2026-05-01", which rawScalarForKey returns
    // verbatim and the regex rejects, so the value reaches the fallback instead
    // of the raw-scalar path every other date takes. The fallback must build a
    // local-midnight Date via parseDateString: a UTC-midnight one would compare
    // inconsistently against the local-midnight Date built from a query string.
    //
    // Under js-yaml 4 this case arrived as a Date, handled by a `value
    // instanceof Date` branch that has since been removed; js-yaml 5 resolves
    // it to a string. The assertions below are unchanged, because both branches
    // always routed through parseDateString (#60).
    const tempVault = mkdtempSync(path.join(tmpdir(), "vault-"));
    try {
      const projectsDir = path.join(tempVault, DEFAULT_CONFIG.projectsFolder);
      mkdirSync(projectsDir, { recursive: true });
      const dir = path.join(projectsDir, "Anchored");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "_project.md"), `---\nupdated: &u 2026-05-01\n---\n`);
      const now = new Date(2026, 5, 15); // 2026-06-15 local
      const { projects } = await findProjects(tempVault, DEFAULT_CONFIG, { now });
      const anchored = projects.find((p) => p.name === "Anchored");
      expect(anchored?.updated).toBe("2026-05-01");
      // daysSinceUpdate = 45 with local-midnight cached Date; would be 46 (in any
      // non-UTC western timezone) with the unconverted js-yaml UTC-midnight Date.
      expect(anchored?.daysSinceUpdate).toBe(45);
      // updated_since boundary: project must match when the query date equals the
      // project's updated date. With UTC-midnight cached Date, west-of-UTC would
      // see this as "before" the local-midnight query date and exclude it.
      const { projects: matches } = await findProjects(tempVault, DEFAULT_CONFIG, { now, updatedSince: "2026-05-01" });
      expect(matches.map((p) => p.name)).toContain("Anchored");
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
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
      const { projects } = await findProjects(tempVault, DEFAULT_CONFIG);
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
    const { projects } = await findProjects(FIXTURE, DEFAULT_CONFIG);
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
      const { projects: matches } = await findProjects(tempVault, DEFAULT_CONFIG, { updatedSince: "2026-04-01" });
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
      const { projects } = await findProjects(tempVault, DEFAULT_CONFIG);
      const target = projects.find((p) => p.name === "Broken FM");
      expect(target).toBeDefined();
      expect(target!.frontmatterError).toBeDefined();
    } finally {
      rmSync(tempVault, { recursive: true, force: true });
    }
  });

  describe("parse-failure census", () => {
    const CORRUPT = `---
type: project
status: active
next-action: "Run the thing"
  next-action: "Run the thing" and then some
updated: 2026-08-01
---

# Corrupted
`;
    const HEALTHY = `---
type: project
status: active
area: "Sample Area"
tags: [ project ]
updated: 2026-08-01
---

# Healthy
`;

    function vaultWithCorruption(): { path: string; cleanup: () => void } {
      const tmp = mkdtempSync(path.join(tmpdir(), "vault-corrupt-"));
      mkdirSync(path.join(tmp, "1-Projects", "PC"), { recursive: true });
      mkdirSync(path.join(tmp, "1-Projects", "Healthy"), { recursive: true });
      writeFileSync(path.join(tmp, "1-Projects", "PC", "_project.md"), CORRUPT);
      writeFileSync(path.join(tmp, "1-Projects", "Healthy", "_project.md"), HEALTHY);
      return { path: tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
    }

    it("reports a corrupt project under every frontmatter-derived filter", async () => {
      const v = vaultWithCorruption();
      const now = new Date(2026, 7, 14);
      try {
        const filters = [
          { status: "active" },
          { area: "Sample Area" },
          { query: "#project" },
          { staleDays: 7 },
          { updatedSince: "2026-07-01" },
        ];
        for (const filter of filters) {
          const { projects, parseFailures } = await findProjects(v.path, DEFAULT_CONFIG, {
            ...filter,
            now,
          });
          expect(projects.map((p) => p.name)).toEqual(["Healthy"]);
          expect(parseFailures.map((f) => f.name)).toEqual(["PC"]);
          expect(parseFailures[0]!.error).toMatch(/bad indentation/);
        }
      } finally {
        v.cleanup();
      }
    });

    it("keeps parse failures out of the limit budget", async () => {
      const v = vaultWithCorruption();
      try {
        const { projects, parseFailures } = await findProjects(v.path, DEFAULT_CONFIG, {
          status: "active",
          limit: 1,
        });
        expect(projects.map((p) => p.name)).toEqual(["Healthy"]);
        expect(parseFailures.map((f) => f.name)).toEqual(["PC"]);
      } finally {
        v.cleanup();
      }
    });

    it("reports a failure unconditionally, even when the row also survives filtering", async () => {
      const v = vaultWithCorruption();
      try {
        const { projects, parseFailures } = await findProjects(v.path, DEFAULT_CONFIG);
        expect(projects.map((p) => p.name).sort()).toEqual(["Healthy", "PC"]);
        expect(parseFailures.map((f) => f.name)).toEqual(["PC"]);
      } finally {
        v.cleanup();
      }
    });

    it("carries an absolute path matching the project summary", async () => {
      const v = vaultWithCorruption();
      try {
        const { parseFailures } = await findProjects(v.path, DEFAULT_CONFIG);
        expect(parseFailures[0]!.path).toBe(path.join(v.path, "1-Projects", "PC"));
      } finally {
        v.cleanup();
      }
    });

    it("reports date-parse failures in the same channel", async () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "vault-baddate-"));
      mkdirSync(path.join(tmp, "1-Projects", "BadDate"), { recursive: true });
      writeFileSync(
        path.join(tmp, "1-Projects", "BadDate", "_project.md"),
        `---\nstatus: active\nupdated: 2026-13-45\n---\n`,
      );
      try {
        const { parseFailures } = await findProjects(tmp, DEFAULT_CONFIG, {
          staleDays: 7,
          now: new Date(2026, 7, 14),
        });
        expect(parseFailures).toHaveLength(1);
        expect(parseFailures[0]!.name).toBe("BadDate");
        expect(parseFailures[0]!.error).toBeUndefined();
        expect(parseFailures[0]!.dateErrors).toEqual([{ field: "updated", value: "2026-13-45" }]);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("returns an empty census for a clean vault", async () => {
      const { parseFailures } = await findProjects(FIXTURE, DEFAULT_CONFIG);
      expect(parseFailures).toEqual([]);
    });

    it("sorts the census by name, independent of directory creation order", async () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "vault-multicorrupt-"));
      try {
        // Created in reverse-alphabetical order so a passing assertion can only
        // be explained by an explicit sort, not by directory/globby ordering.
        for (const name of ["Zeta", "Mu", "Alpha"]) {
          mkdirSync(path.join(tmp, "1-Projects", name), { recursive: true });
          writeFileSync(path.join(tmp, "1-Projects", name, "_project.md"), CORRUPT);
        }
        const { parseFailures } = await findProjects(tmp, DEFAULT_CONFIG);
        expect(parseFailures.map((f) => f.name)).toEqual(["Alpha", "Mu", "Zeta"]);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("reports an unreadable _project.md as a read failure, not an absent one", async () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "vault-unreadable-"));
      try {
        const dir = path.join(tmp, "1-Projects", "Unreadable");
        mkdirSync(dir, { recursive: true });
        // A directory where the file is expected forces readFile to reject
        // with EISDIR — a real, non-ENOENT failure with no privilege
        // dependency (unlike chmod 000, which is a no-op for root).
        mkdirSync(path.join(dir, "_project.md"), { recursive: true });

        const { projects, parseFailures } = await findProjects(tmp, DEFAULT_CONFIG);
        const target = projects.find((p) => p.name === "Unreadable");
        expect(target).toBeDefined();
        expect(target!.hasProjectFile).toBe(true);
        expect(target!.readError).toMatch(/EISDIR/);

        expect(parseFailures.map((f) => f.name)).toEqual(["Unreadable"]);
        expect(parseFailures[0]!.error).toMatch(/EISDIR/);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("keeps an unreadable project in the census under a filter that excludes it from projects", async () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "vault-unreadable-filtered-"));
      try {
        const dir = path.join(tmp, "1-Projects", "Unreadable");
        mkdirSync(dir, { recursive: true });
        mkdirSync(path.join(dir, "_project.md"), { recursive: true });

        const { projects, parseFailures } = await findProjects(tmp, DEFAULT_CONFIG, {
          status: "active",
        });
        expect(projects.map((p) => p.name)).toEqual([]);
        expect(parseFailures.map((f) => f.name)).toEqual(["Unreadable"]);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("still reports a genuinely absent _project.md as hasProjectFile=false with no readError", async () => {
      const { projects, parseFailures } = await findProjects(FIXTURE, DEFAULT_CONFIG);
      const bare = projects.find((p) => p.name === "Bare Project");
      expect(bare?.hasProjectFile).toBe(false);
      expect(bare?.readError).toBeUndefined();
      expect(parseFailures.find((f) => f.name === "Bare Project")).toBeUndefined();
    });
  });
});
