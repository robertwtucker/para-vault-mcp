import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logToTodayTool } from "../../src/tools/log-to-today.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { dailyNotePath } from "../../src/vault/daily.js";
import { readFileSync } from "node:fs";

describe("logToTodayTool", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("appends to the Captures section by default", async () => {
    const result = await logToTodayTool.handler(
      { content: "Saw an interesting MCP pattern today" },
      vault.path,
    );
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]!.text).toMatch(/Captures/);
    const file = dailyNotePath(vault.path, new Date());
    expect(readFileSync(file, "utf8")).toContain("Saw an interesting MCP pattern today");
  });

  it("appends to a named section when provided", async () => {
    await logToTodayTool.handler(
      { content: "Reviewed PRs", section: "Work Log" },
      vault.path,
    );
    const file = dailyNotePath(vault.path, new Date());
    const text = readFileSync(file, "utf8");
    const wlIdx = text.indexOf("## Work Log");
    expect(text.slice(wlIdx)).toContain("Reviewed PRs");
  });

  it("rejects content over 8KB to prevent runaway writes", async () => {
    const huge = "x".repeat(9000);
    const result = await logToTodayTool.handler({ content: huge }, vault.path);
    expect(result.content[0]!.text).toMatch(/too large/i);
  });

  it("declares snake_case name", () => {
    expect(logToTodayTool.name).toBe("log_to_today");
  });
});
