import { describe, it, expect } from "vitest";
import { nextActionTool } from "../../src/tools/next-action.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../fixtures/vault");

describe("nextActionTool", () => {
  it("returns the next action for a named project", async () => {
    const result = await nextActionTool.handler({ project: "Sample Active" }, FIXTURE);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]!.text).toContain("Write the failing test");
  });

  it("returns next actions for all active projects when no project name is provided", async () => {
    const result = await nextActionTool.handler({}, FIXTURE);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.find((p: { name: string }) => p.name === "Sample Active")).toBeDefined();
    expect(parsed.find((p: { name: string }) => p.name === "Sample Waiting")).toBeDefined();
  });

  it("returns a clear message when the named project does not exist", async () => {
    const result = await nextActionTool.handler({ project: "Nonexistent" }, FIXTURE);
    expect(result.content[0]!.text).toMatch(/not found/i);
  });

  it("declares snake_case name", () => {
    expect(nextActionTool.name).toBe("next_action");
  });
});
