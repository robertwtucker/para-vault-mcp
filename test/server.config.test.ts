import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { format } from "date-fns";
import { buildServer } from "../src/server.js";
import { loadVaultConfig } from "../src/vault/config.js";
import { makeTmpVault } from "./helpers/tmp-vault.js";

describe("end-to-end with non-default config", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => {
    vault = makeTmpVault();
    mkdirSync(path.join(vault.path, "_system"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "_system/PARA-conventions.md"),
      [
        "---",
        "capture-section: Inbox",
        "work-log-section: Done",
        "daily-notes-folder: Journal",
        "inbox-folder: Capture",
        "projects-folder: Projects",
        "---",
      ].join("\n"),
    );
    // Re-arrange a project under the new folder so find_project sees it.
    mkdirSync(path.join(vault.path, "Projects/Sample"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "Projects/Sample/_project.md"),
      `---\nstatus: active\nnext-action: Do thing\n---\n`,
    );
  });
  afterEach(() => vault.cleanup());

  it("writes captures to the configured section in the configured daily folder", async () => {
    const config = await loadVaultConfig(vault.path);
    const server = buildServer(vault.path, config);
    const result = await server.callTool("capture", { content: "Hello" });
    expect(result.content[0]!.text).toContain("Captured to ## Inbox");
    const ymd = format(new Date(), "yyyy-MM-dd");
    expect(existsSync(path.join(vault.path, "Journal", `${ymd}.md`))).toBe(true);
  });

  it("find_project lists projects from the configured projects-folder", async () => {
    const config = await loadVaultConfig(vault.path);
    const server = buildServer(vault.path, config);
    const result = await server.callTool("find_project", {});
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.map((p: { name: string }) => p.name)).toContain("Sample");
  });
});
