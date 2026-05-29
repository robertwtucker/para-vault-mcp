import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureTool } from "../../src/tools/capture.js";
import { DEFAULT_CONFIG } from "../../src/vault/config.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { dailyNotePath } from "../../src/vault/daily.js";
import { readFileSync } from "node:fs";

describe("captureTool", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("appends to the Captures section with auto-bullet", async () => {
    const result = await captureTool.handler(
      { content: "Saw an interesting MCP pattern today" },
      vault.path,
      DEFAULT_CONFIG,
    );
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]!.text).toMatch(/Captures/);
    const file = dailyNotePath(vault.path, new Date(), DEFAULT_CONFIG);
    const text = readFileSync(file, "utf8");
    const capIdx = text.indexOf("## Captures");
    expect(text.slice(capIdx)).toContain("- Saw an interesting MCP pattern today");
  });

  it("does not double-prefix when content already starts with '- '", async () => {
    await captureTool.handler({ content: "- already a bullet" }, vault.path, DEFAULT_CONFIG);
    const file = dailyNotePath(vault.path, new Date(), DEFAULT_CONFIG);
    const text = readFileSync(file, "utf8");
    expect(text).toContain("- already a bullet");
    expect(text).not.toContain("- - already a bullet");
  });

  it("rejects content over 8KB to prevent runaway writes", async () => {
    const huge = "x".repeat(9000);
    const result = await captureTool.handler({ content: huge }, vault.path, DEFAULT_CONFIG);
    expect(result.content[0]!.text).toMatch(/too large/i);
  });

  it("inserts new captures at the top of the section's bullet list", async () => {
    await captureTool.handler({ content: "first" }, vault.path, DEFAULT_CONFIG);
    await captureTool.handler({ content: "second" }, vault.path, DEFAULT_CONFIG);
    const content = readFileSync(dailyNotePath(vault.path, new Date(), DEFAULT_CONFIG), "utf8");
    expect(content.indexOf("- second")).toBeLessThan(content.indexOf("- first"));
  });

  it("declares snake_case name", () => {
    expect(captureTool.name).toBe("capture");
  });
});
