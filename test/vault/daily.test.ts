import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  dailyNotePath,
  ensureDailyNote,
  appendToSection,
  prependToSectionList,
  inboxStatus,
} from "../../src/vault/daily.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync, utimesSync } from "node:fs";
import path from "node:path";

describe("dailyNotePath", () => {
  it("formats the path as 0-Inbox/Daily/YYYY-MM-DD.md", () => {
    const date = new Date("2026-05-10T12:00:00Z");
    expect(dailyNotePath("/v", date, DEFAULT_CONFIG)).toBe("/v/0-Inbox/Daily/2026-05-10.md");
  });
});

describe("ensureDailyNote", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("creates the file from Templates/Daily Note.md when missing, expanding date tokens", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, "utf8");
    expect(content).toContain("# 2026-05-10 — Sunday");
    expect(content).toContain("type: daily");
    expect(content).toContain("## Captures");
  });

  it("does not overwrite an existing daily note", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    writeFileSync(file, "EXISTING CONTENT");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    expect(readFileSync(file, "utf8")).toBe("EXISTING CONTENT");
  });

  it("creates a minimal note when no template exists", async () => {
    const tplPath = path.join(vault.path, "Templates/Daily Note.md");
    rmSync(tplPath);
    const date = new Date("2026-05-10T12:00:00Z");
    const file = await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    const content = readFileSync(file, "utf8");
    expect(content).toMatch(/^---/);
    expect(content).toContain("type: daily");
    expect(content).toContain("## Captures");
  });
});

describe("appendToSection", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("appends a line under the named section, preserving other sections", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    await appendToSection(vault.path, date, "Captures", "First capture", DEFAULT_CONFIG);
    await appendToSection(vault.path, date, "Captures", "Second capture", DEFAULT_CONFIG);
    const content = readFileSync(dailyNotePath(vault.path, date, DEFAULT_CONFIG), "utf8");
    const capturesIdx = content.indexOf("## Captures");
    const workLogIdx = content.indexOf("## Work Log");
    const captures = content.slice(capturesIdx, workLogIdx);
    expect(captures).toContain("First capture");
    expect(captures).toContain("Second capture");
    expect(content.indexOf("First capture")).toBeLessThan(content.indexOf("Second capture"));
  });

  it("creates the section if it does not exist", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    await appendToSection(vault.path, date, "Brand New", "Hi", DEFAULT_CONFIG);
    const content = readFileSync(dailyNotePath(vault.path, date, DEFAULT_CONFIG), "utf8");
    expect(content).toContain("## Brand New");
    expect(content).toContain("Hi");
  });
});

describe("appendToSection concurrency", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("does not lose updates when many appends race", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const N = 50;
    const writes = Array.from({ length: N }, (_, i) =>
      appendToSection(vault.path, date, "Captures", `- entry-${i}`, DEFAULT_CONFIG),
    );
    await Promise.all(writes);
    const content = readFileSync(dailyNotePath(vault.path, date, DEFAULT_CONFIG), "utf8");
    for (let i = 0; i < N; i++) {
      expect(content).toContain(`entry-${i}`);
    }
  });
});

describe("inboxStatus", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("reports dailyNoteExists=false when there is no note for today", async () => {
    const status = await inboxStatus(vault.path, new Date("2026-05-10T12:00:00Z"), DEFAULT_CONFIG);
    expect(status.dailyNoteExists).toBe(false);
  });

  it("reports inboxItemCount = number of files in 0-Inbox/ excluding Daily/", async () => {
    mkdirSync(path.join(vault.path, "0-Inbox"), { recursive: true });
    writeFileSync(path.join(vault.path, "0-Inbox/capture-1.md"), "");
    writeFileSync(path.join(vault.path, "0-Inbox/capture-2.md"), "");
    const status = await inboxStatus(vault.path, new Date("2026-05-10T12:00:00Z"), DEFAULT_CONFIG);
    expect(status.inboxItemCount).toBe(2);
  });

  it("returns inboxItems sorted by mtime oldest-first, with name and vault-relative path", async () => {
    const inbox = path.join(vault.path, "0-Inbox");
    mkdirSync(inbox, { recursive: true });
    const older = path.join(inbox, "older.md");
    const newer = path.join(inbox, "newer.md");
    writeFileSync(older, "");
    writeFileSync(newer, "");
    const t = new Date("2026-05-01T12:00:00Z");
    utimesSync(older, t, t);
    const t2 = new Date("2026-05-09T12:00:00Z");
    utimesSync(newer, t2, t2);
    const status = await inboxStatus(vault.path, new Date("2026-05-10T12:00:00Z"), DEFAULT_CONFIG);
    expect(status.inboxItems).toEqual([
      { name: "older", path: "0-Inbox/older.md" },
      { name: "newer", path: "0-Inbox/newer.md" },
    ]);
  });

  it("excludes .DS_Store and non-markdown files from inboxItems", async () => {
    const inbox = path.join(vault.path, "0-Inbox");
    mkdirSync(inbox, { recursive: true });
    writeFileSync(path.join(inbox, "capture.md"), "");
    writeFileSync(path.join(inbox, ".DS_Store"), "");
    writeFileSync(path.join(inbox, "image.png"), "");
    const status = await inboxStatus(vault.path, new Date("2026-05-10T12:00:00Z"), DEFAULT_CONFIG);
    expect(status.inboxItems.map((i) => i.name)).toEqual(["capture"]);
  });

  it("returns empty inboxItems when the inbox folder is empty or missing", async () => {
    const status = await inboxStatus(vault.path, new Date("2026-05-10T12:00:00Z"), DEFAULT_CONFIG);
    expect(status.inboxItems).toEqual([]);
  });


  it("returns previousDailyNotePath as the most recent daily note strictly before today", async () => {
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    mkdirSync(daily, { recursive: true });
    writeFileSync(path.join(daily, "2026-05-07.md"), "");
    writeFileSync(path.join(daily, "2026-05-08.md"), "");
    writeFileSync(path.join(daily, "2026-05-10.md"), ""); // today
    const today = new Date(2026, 4, 10);
    const status = await inboxStatus(vault.path, today, DEFAULT_CONFIG);
    expect(status.previousDailyNotePath).toBe("0-Inbox/Daily/2026-05-08.md");
  });

  it("recognizes weekly-review style filenames by their YYYY-MM-DD prefix", async () => {
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    mkdirSync(daily, { recursive: true });
    writeFileSync(path.join(daily, "2026-05-07.md"), "");
    writeFileSync(path.join(daily, "2026-05-09 — Weekly Review W19.md"), "");
    const today = new Date(2026, 4, 10);
    const status = await inboxStatus(vault.path, today, DEFAULT_CONFIG);
    expect(status.previousDailyNotePath).toBe("0-Inbox/Daily/2026-05-09 — Weekly Review W19.md");
  });

  it("breaks ties between same-date filenames deterministically (suffixed variant wins)", async () => {
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    mkdirSync(daily, { recursive: true });
    writeFileSync(path.join(daily, "2026-05-09.md"), "");
    writeFileSync(path.join(daily, "2026-05-09 — Weekly Review W19.md"), "");
    const today = new Date(2026, 4, 10);
    const status = await inboxStatus(vault.path, today, DEFAULT_CONFIG);
    expect(status.previousDailyNotePath).toBe("0-Inbox/Daily/2026-05-09 — Weekly Review W19.md");
  });

  it("leaves previousDailyNotePath undefined when no prior notes exist", async () => {
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    mkdirSync(daily, { recursive: true });
    writeFileSync(path.join(daily, "2026-05-10.md"), ""); // only today
    const today = new Date(2026, 4, 10);
    const status = await inboxStatus(vault.path, today, DEFAULT_CONFIG);
    expect(status.previousDailyNotePath).toBeUndefined();
  });

  it("ignores files in dailyNotesFolder that don't start with YYYY-MM-DD", async () => {
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    mkdirSync(daily, { recursive: true });
    writeFileSync(path.join(daily, "README.md"), "");
    writeFileSync(path.join(daily, "2026-05-08.md"), "");
    const today = new Date(2026, 4, 10);
    const status = await inboxStatus(vault.path, today, DEFAULT_CONFIG);
    expect(status.previousDailyNotePath).toBe("0-Inbox/Daily/2026-05-08.md");
  });
});

describe("prependToSectionList", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("inserts at the top of an existing bullet list under the section", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    await appendToSection(vault.path, date, "Captures", "- first", DEFAULT_CONFIG);
    await appendToSection(vault.path, date, "Captures", "- second", DEFAULT_CONFIG);
    await prependToSectionList(vault.path, date, "Captures", "- newest", DEFAULT_CONFIG);
    const content = readFileSync(dailyNotePath(vault.path, date, DEFAULT_CONFIG), "utf8");
    const newestIdx = content.indexOf("- newest");
    const firstIdx = content.indexOf("- first");
    const secondIdx = content.indexOf("- second");
    expect(newestIdx).toBeGreaterThan(-1);
    expect(newestIdx).toBeLessThan(firstIdx);
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("inserts above the first subsection when subsections exist", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    const initial = readFileSync(file, "utf8").replace(
      "## Captures",
      "## Captures\n- existing bullet\n\n### Sub\n- sub item\n",
    );
    writeFileSync(file, initial);
    await prependToSectionList(vault.path, date, "Captures", "- newest", DEFAULT_CONFIG);
    const content = readFileSync(file, "utf8");
    const newestIdx = content.indexOf("- newest");
    const existingIdx = content.indexOf("- existing bullet");
    const subHeadingIdx = content.indexOf("### Sub");
    expect(newestIdx).toBeLessThan(subHeadingIdx);
    expect(newestIdx).toBeLessThan(existingIdx);
  });

  it("creates the section with the bullet when the section is missing", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    await prependToSectionList(vault.path, date, "Brand New", "- hi", DEFAULT_CONFIG);
    const content = readFileSync(dailyNotePath(vault.path, date, DEFAULT_CONFIG), "utf8");
    expect(content).toContain("## Brand New");
    expect(content).toContain("- hi");
  });

  it("starts a new list at section top when the section has no bullet list yet", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    await prependToSectionList(vault.path, date, "Captures", "- newest", DEFAULT_CONFIG);
    const content = readFileSync(dailyNotePath(vault.path, date, DEFAULT_CONFIG), "utf8");
    expect(content).toContain("- newest");
    const capIdx = content.indexOf("## Captures");
    const workIdx = content.indexOf("## Work Log");
    const captures = content.slice(capIdx, workIdx);
    expect(captures).toContain("- newest");
  });
});
