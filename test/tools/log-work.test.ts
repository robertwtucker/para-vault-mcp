import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logWorkTool } from "../../src/tools/log-work.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { dailyNotePath } from "../../src/vault/daily.js";
import { readFileSync } from "node:fs";

describe("logWorkTool", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("appends to the Work Log section with auto-bullet", async () => {
    const result = await logWorkTool.handler(
      { content: "Reviewed PRs and merged 3" },
      vault.path,
    );
    expect(result.content[0]!.text).toMatch(/Work Log/);
    const file = dailyNotePath(vault.path, new Date());
    const text = readFileSync(file, "utf8");
    const wlIdx = text.indexOf("## Work Log");
    expect(text.slice(wlIdx)).toContain("- Reviewed PRs and merged 3");
  });

  it("does not double-prefix when content already starts with '- '", async () => {
    await logWorkTool.handler({ content: "- already a bullet" }, vault.path);
    const file = dailyNotePath(vault.path, new Date());
    const text = readFileSync(file, "utf8");
    expect(text).toContain("- already a bullet");
    expect(text).not.toContain("- - already a bullet");
  });

  it("rejects content over 8KB", async () => {
    const huge = "x".repeat(9000);
    const result = await logWorkTool.handler({ content: huge }, vault.path);
    expect(result.content[0]!.text).toMatch(/too large/i);
  });

  it("declares snake_case name", () => {
    expect(logWorkTool.name).toBe("log_work");
  });
});
