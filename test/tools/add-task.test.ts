import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addTaskTool } from "../../src/tools/add-task.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";
import { dailyNotePath } from "../../src/vault/daily.js";
import { readFileSync } from "node:fs";

describe("addTaskTool", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("appends to the Tasks section with checkbox prefix", async () => {
    const result = await addTaskTool.handler(
      { content: "Review draft PR" },
      vault.path,
    );
    expect(result.content[0]!.text).toMatch(/Tasks/);
    const file = dailyNotePath(vault.path, new Date());
    const text = readFileSync(file, "utf8");
    const tIdx = text.indexOf("## Tasks");
    expect(text.slice(tIdx)).toContain("- [ ] Review draft PR");
  });

  it("does not double-prefix when content already starts with '- [ ] '", async () => {
    await addTaskTool.handler({ content: "- [ ] already a task" }, vault.path);
    const file = dailyNotePath(vault.path, new Date());
    const text = readFileSync(file, "utf8");
    expect(text).toContain("- [ ] already a task");
    expect(text).not.toContain("- [ ] - [ ] already a task");
  });

  it("rejects content over 8KB", async () => {
    const huge = "x".repeat(9000);
    const result = await addTaskTool.handler({ content: huge }, vault.path);
    expect(result.content[0]!.text).toMatch(/too large/i);
  });

  it("declares snake_case name", () => {
    expect(addTaskTool.name).toBe("add_task");
  });
});
