import { describe, it, expect } from "vitest";
import { buildServer } from "../src/server.js";
import { DEFAULT_CONFIG } from "../src/vault/config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/vault");

describe("buildServer", () => {
  it("registers the v0.1 tools with snake_case names", () => {
    const server = buildServer(FIXTURE, DEFAULT_CONFIG);
    const tools = server.listToolNames();
    expect(tools.sort()).toEqual([
      "capture",
      "daily_review_status",
      "find_project",
      "log_work",
      "next_action",
    ]);
  });

  it("dispatches a find_project call to the right handler", async () => {
    const server = buildServer(FIXTURE, DEFAULT_CONFIG);
    const result = await server.callTool("find_project", { query: "Sample" });
    const projects = JSON.parse(result.content[0]!.text);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((p: { name: string }) => p.name.includes("Sample"))).toBe(true);
  });
});
