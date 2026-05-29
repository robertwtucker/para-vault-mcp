import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadVaultConfig, DEFAULT_CONFIG } from "../../src/vault/config.js";
import { makeTmpVault } from "../helpers/tmp-vault.js";

describe("loadVaultConfig", () => {
  let vault: { path: string; cleanup: () => void };
  beforeEach(() => (vault = makeTmpVault()));
  afterEach(() => vault.cleanup());

  it("returns defaults when _system/PARA-conventions.md is missing", async () => {
    const config = await loadVaultConfig(vault.path);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("overrides defaults with values from _system/PARA-conventions.md frontmatter", async () => {
    mkdirSync(path.join(vault.path, "_system"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "_system/PARA-conventions.md"),
      [
        "---",
        "capture-section: Inbox",
        "work-log-section: Done",
        "projects-folder: Projects",
        "---",
        "",
        "body ignored",
      ].join("\n"),
    );
    const config = await loadVaultConfig(vault.path);
    expect(config.captureSection).toBe("Inbox");
    expect(config.workLogSection).toBe("Done");
    expect(config.projectsFolder).toBe("Projects");
    expect(config.endOfDayCheckSection).toBe(DEFAULT_CONFIG.endOfDayCheckSection);
    expect(config.dailyNotesFolder).toBe(DEFAULT_CONFIG.dailyNotesFolder);
    expect(config.inboxFolder).toBe(DEFAULT_CONFIG.inboxFolder);
  });

  it("rejects an absolute folder path", async () => {
    mkdirSync(path.join(vault.path, "_system"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "_system/PARA-conventions.md"),
      `---\nprojects-folder: /etc\n---\n`,
    );
    await expect(loadVaultConfig(vault.path)).rejects.toThrow(/must be a vault-relative path/);
  });

  it("rejects a folder path that escapes the vault via ..", async () => {
    mkdirSync(path.join(vault.path, "_system"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "_system/PARA-conventions.md"),
      `---\nprojects-folder: ../escape\n---\n`,
    );
    await expect(loadVaultConfig(vault.path)).rejects.toThrow(/resolves outside vault root/);
  });

  it("throws a clear error when the config file has malformed YAML", async () => {
    mkdirSync(path.join(vault.path, "_system"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "_system/PARA-conventions.md"),
      `---\n[unclosed\n---\n`,
    );
    await expect(loadVaultConfig(vault.path)).rejects.toThrow(/Failed to parse .* frontmatter/);
  });

  it("ignores unknown frontmatter keys without error", async () => {
    mkdirSync(path.join(vault.path, "_system"), { recursive: true });
    writeFileSync(
      path.join(vault.path, "_system/PARA-conventions.md"),
      `---\ncapture-section: Inbox\nfuture-key: whatever\n---\n`,
    );
    const config = await loadVaultConfig(vault.path);
    expect(config.captureSection).toBe("Inbox");
  });
});
