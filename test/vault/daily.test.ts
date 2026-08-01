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

  it("omits dailyNoteBody by default (backward-compat)", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    const status = await inboxStatus(vault.path, date, DEFAULT_CONFIG);
    expect(status.dailyNoteBody).toBeUndefined();
    expect(status.previousDailyNoteBody).toBeUndefined();
  });

  it("returns dailyNoteBody when includeBody=true and the note exists", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    const on_disk = readFileSync(file, "utf8");
    const status = await inboxStatus(vault.path, date, DEFAULT_CONFIG, { includeBody: true });
    expect(status.dailyNoteBody).toBeDefined();
    expect(status.dailyNoteBody!.content).toBe(on_disk);
    expect(status.dailyNoteBody!.truncated).toBe(false);
    expect(status.dailyNoteBody!.totalBytes).toBe(Buffer.byteLength(on_disk, "utf8"));
  });

  it("omits dailyNoteBody when includeBody=true but the note is missing", async () => {
    const status = await inboxStatus(vault.path, new Date("2026-05-10T12:00:00Z"), DEFAULT_CONFIG, {
      includeBody: true,
    });
    expect(status.dailyNoteExists).toBe(false);
    expect(status.dailyNoteBody).toBeUndefined();
  });

  it("returns dailyNoteBody with empty envelope when the note is empty", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = dailyNotePath(vault.path, date, DEFAULT_CONFIG);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "");
    const status = await inboxStatus(vault.path, date, DEFAULT_CONFIG, { includeBody: true });
    expect(status.dailyNoteBody).toEqual({ content: "", truncated: false, totalBytes: 0 });
  });

  it("returns previousDailyNoteBody when includePreviousBody=true and prior note exists", async () => {
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    mkdirSync(daily, { recursive: true });
    writeFileSync(path.join(daily, "2026-05-08.md"), "prior note body");
    const status = await inboxStatus(vault.path, new Date(2026, 4, 10), DEFAULT_CONFIG, {
      includePreviousBody: true,
    });
    expect(status.previousDailyNotePath).toBe("0-Inbox/Daily/2026-05-08.md");
    expect(status.previousDailyNoteBody?.content).toBe("prior note body");
    expect(status.previousDailyNoteBody?.truncated).toBe(false);
  });

  it("omits previousDailyNoteBody when includePreviousBody=true but no prior note exists", async () => {
    const status = await inboxStatus(vault.path, new Date(2026, 4, 10), DEFAULT_CONFIG, {
      includePreviousBody: true,
    });
    expect(status.previousDailyNotePath).toBeUndefined();
    expect(status.previousDailyNoteBody).toBeUndefined();
  });

  it("returns both bodies when both options are true", async () => {
    const date = new Date(2026, 4, 10);
    await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    writeFileSync(path.join(daily, "2026-05-08.md"), "prior");
    const status = await inboxStatus(vault.path, date, DEFAULT_CONFIG, {
      includeBody: true,
      includePreviousBody: true,
    });
    expect(status.dailyNoteBody).toBeDefined();
    expect(status.previousDailyNoteBody?.content).toBe("prior");
  });

  it("truncates dailyNoteBody when the file exceeds BODY_MAX_BYTES", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = dailyNotePath(vault.path, date, DEFAULT_CONFIG);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "x".repeat(200 * 1024)); // 200 KB
    const status = await inboxStatus(vault.path, date, DEFAULT_CONFIG, { includeBody: true });
    expect(status.dailyNoteBody?.truncated).toBe(true);
    expect(status.dailyNoteBody?.totalBytes).toBe(200 * 1024);
    expect(status.dailyNoteBody?.content.length).toBe(BODY_MAX_BYTES);
  });

  it("freshness invariant: successive calls reflect on-disk mutations", async () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const file = await ensureDailyNote(vault.path, date, DEFAULT_CONFIG);
    const first = await inboxStatus(vault.path, date, DEFAULT_CONFIG, { includeBody: true });
    writeFileSync(file, "MUTATED CONTENT");
    const second = await inboxStatus(vault.path, date, DEFAULT_CONFIG, { includeBody: true });
    expect(first.dailyNoteBody?.content).not.toBe(second.dailyNoteBody?.content);
    expect(second.dailyNoteBody?.content).toBe("MUTATED CONTENT");
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

import { buildBodyEnvelope, readBodyBounded, BODY_MAX_BYTES } from "../../src/vault/daily.js";

describe("buildBodyEnvelope", () => {
  it("returns content as-is when under the limit", () => {
    const env = buildBodyEnvelope("hello", 100);
    expect(env).toEqual({ content: "hello", truncated: false, totalBytes: 5 });
  });

  it("returns content as-is at exactly the limit", () => {
    const s = "a".repeat(128);
    const env = buildBodyEnvelope(s, 128);
    expect(env).toEqual({ content: s, truncated: true, totalBytes: 128 });
    // At exact limit, we consider it truncated: consumer can't distinguish
    // "exactly the limit" from "one byte more, cut at the limit". Being
    // loud is the v0.4 discipline; being conservative here matches that.
  });

  it("truncates when over the limit", () => {
    const s = "a".repeat(200);
    const env = buildBodyEnvelope(s, 128);
    expect(env.content.length).toBe(128);
    expect(env.truncated).toBe(true);
    expect(env.totalBytes).toBe(200);
  });

  it("does not split a multi-byte UTF-8 code point at the boundary", () => {
    // 127 ASCII bytes + one 4-byte code point (😀 = U+1F600) spans byte 127..130.
    // Cut at 128: the boundary lands inside the code point. Safe cut backs
    // off to byte 127, dropping the partial code point entirely.
    const emoji = "\u{1F600}"; // 4 UTF-8 bytes
    const content = "a".repeat(127) + emoji;
    // Encoded byte length: 127 + 4 = 131
    const totalBytes = Buffer.byteLength(content, "utf8");
    expect(totalBytes).toBe(131);
    const env = buildBodyEnvelope(content, 128);
    expect(env.truncated).toBe(true);
    expect(env.totalBytes).toBe(131);
    // The emoji is dropped entirely; content is the 127 leading 'a's.
    expect(env.content).toBe("a".repeat(127));
    // And critically, the returned content is valid UTF-8 (implicit — it's
    // a JS string, but we assert length in bytes to make the intent explicit).
    expect(Buffer.byteLength(env.content, "utf8")).toBeLessThanOrEqual(128);
  });

  it("handles empty content", () => {
    expect(buildBodyEnvelope("", 128)).toEqual({ content: "", truncated: false, totalBytes: 0 });
  });
});

describe("readBodyBounded", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("returns undefined for a missing file", async () => {
    const missing = path.join(vault.path, "does-not-exist.md");
    expect(await readBodyBounded(missing, BODY_MAX_BYTES)).toBeUndefined();
  });

  it("returns envelope for an empty file", async () => {
    const empty = path.join(vault.path, "empty.md");
    writeFileSync(empty, "");
    expect(await readBodyBounded(empty, BODY_MAX_BYTES)).toEqual({
      content: "",
      truncated: false,
      totalBytes: 0,
    });
  });

  it("returns full content for a small file", async () => {
    const small = path.join(vault.path, "small.md");
    writeFileSync(small, "hello world");
    expect(await readBodyBounded(small, BODY_MAX_BYTES)).toEqual({
      content: "hello world",
      truncated: false,
      totalBytes: 11,
    });
  });

  it("truncates a file that exceeds the limit", async () => {
    const big = path.join(vault.path, "big.md");
    const content = "a".repeat(200 * 1024); // 200 KB
    writeFileSync(big, content);
    const env = await readBodyBounded(big, BODY_MAX_BYTES);
    expect(env).toBeDefined();
    expect(env!.truncated).toBe(true);
    expect(env!.totalBytes).toBe(200 * 1024);
    expect(env!.content.length).toBe(BODY_MAX_BYTES);
  });

  it("does not split a multi-byte UTF-8 code point at the boundary", async () => {
    const boundary = path.join(vault.path, "boundary.md");
    // (BODY_MAX_BYTES - 1) ASCII bytes + one 4-byte emoji straddles the boundary.
    const emoji = "\u{1F600}";
    const content = "a".repeat(BODY_MAX_BYTES - 1) + emoji;
    writeFileSync(boundary, content);
    const env = await readBodyBounded(boundary, BODY_MAX_BYTES);
    expect(env!.truncated).toBe(true);
    expect(env!.content.length).toBe(BODY_MAX_BYTES - 1);
    expect(Buffer.byteLength(env!.content, "utf8")).toBe(BODY_MAX_BYTES - 1);
  });
});
