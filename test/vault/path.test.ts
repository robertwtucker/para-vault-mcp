import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveVaultPath } from "../../src/vault/path.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("resolveVaultPath", () => {
  const originalEnv = process.env.OBSIDIAN_VAULT_PATH;
  let realDir: string;

  beforeEach(() => {
    realDir = mkdtempSync(path.join(tmpdir(), "vault-path-"));
  });

  afterEach(() => {
    rmSync(realDir, { recursive: true, force: true });
    if (originalEnv === undefined) delete process.env.OBSIDIAN_VAULT_PATH;
    else process.env.OBSIDIAN_VAULT_PATH = originalEnv;
  });

  it("returns the absolute path when env var points to an existing directory", () => {
    process.env.OBSIDIAN_VAULT_PATH = realDir;
    expect(resolveVaultPath()).toBe(realDir);
  });

  it("expands a leading ~ to the user's home directory", () => {
    process.env.OBSIDIAN_VAULT_PATH = "~";
    expect(resolveVaultPath()).toBe(process.env.HOME);
  });

  it("throws a helpful error when the env var is unset", () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    expect(() => resolveVaultPath()).toThrow(/OBSIDIAN_VAULT_PATH/);
  });

  it("throws when the path does not exist", () => {
    process.env.OBSIDIAN_VAULT_PATH = path.join(realDir, "nope");
    expect(() => resolveVaultPath()).toThrow(/does not exist/);
  });

  it("throws when the path is a file, not a directory", () => {
    const filePath = path.join(realDir, "file.txt");
    writeFileSync(filePath, "");
    process.env.OBSIDIAN_VAULT_PATH = filePath;
    expect(() => resolveVaultPath()).toThrow(/not a directory/);
  });
});
