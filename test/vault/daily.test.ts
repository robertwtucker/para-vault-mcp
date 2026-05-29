import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  dailyNotePath,
  ensureDailyNote,
  appendToSection,
  inboxStatus,
} from "../../src/vault/daily.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
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
});
