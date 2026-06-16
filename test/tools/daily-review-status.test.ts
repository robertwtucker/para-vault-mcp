import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { dailyReviewStatusTool } from "../../src/tools/daily-review-status.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { ensureDailyNote } from "../../src/vault/daily.js";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

describe("dailyReviewStatusTool", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("reports dailyNoteExists=false before today's note is created", async () => {
    const result = await dailyReviewStatusTool.handler({}, vault.path, DEFAULT_CONFIG);
    const status = JSON.parse(result.content[0]!.text);
    expect(status.dailyNoteExists).toBe(false);
  });

  it("reports dailyNoteExists=true after the note is created and includes inbox count", async () => {
    await ensureDailyNote(vault.path, new Date(), DEFAULT_CONFIG);
    mkdirSync(path.join(vault.path, "0-Inbox"), { recursive: true });
    writeFileSync(path.join(vault.path, "0-Inbox/some-capture.md"), "");
    const result = await dailyReviewStatusTool.handler({}, vault.path, DEFAULT_CONFIG);
    const status = JSON.parse(result.content[0]!.text);
    expect(status.dailyNoteExists).toBe(true);
    expect(status.inboxItemCount).toBe(1);
  });

  it("includes endOfDayChecks parsed from the daily note when present", async () => {
    await ensureDailyNote(vault.path, new Date(), DEFAULT_CONFIG);
    const result = await dailyReviewStatusTool.handler({}, vault.path, DEFAULT_CONFIG);
    const status = JSON.parse(result.content[0]!.text);
    expect(Array.isArray(status.endOfDayChecks)).toBe(true);
    expect(status.endOfDayChecks.length).toBeGreaterThan(0);
    expect(status.endOfDayChecks[0]).toHaveProperty("label");
    expect(status.endOfDayChecks[0]).toHaveProperty("checked");
  });

  it("declares snake_case name", () => {
    expect(dailyReviewStatusTool.name).toBe("daily_review_status");
  });

  it("description advertises the new response fields", () => {
    expect(dailyReviewStatusTool.description).toMatch(/inbox/i);
    expect(dailyReviewStatusTool.description).toMatch(/prior daily note|previous daily/i);
  });

  it("returns inboxItems and previousDailyNotePath through the tool layer", async () => {
    await ensureDailyNote(vault.path, new Date(), DEFAULT_CONFIG);
    mkdirSync(path.join(vault.path, "0-Inbox"), { recursive: true });
    writeFileSync(path.join(vault.path, "0-Inbox/capture.md"), "");
    const daily = path.join(vault.path, DEFAULT_CONFIG.dailyNotesFolder);
    writeFileSync(path.join(daily, "2020-01-01.md"), "");
    const result = await dailyReviewStatusTool.handler({}, vault.path, DEFAULT_CONFIG);
    const status = JSON.parse(result.content[0]!.text);
    expect(Array.isArray(status.inboxItems)).toBe(true);
    expect(status.inboxItems[0]).toHaveProperty("name");
    expect(status.inboxItems[0]).toHaveProperty("path");
    expect(status.previousDailyNotePath).toBe("0-Inbox/Daily/2020-01-01.md");
  });
});
