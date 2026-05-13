/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function resolveVaultPath(): string {
  const raw = process.env.OBSIDIAN_VAULT_PATH;
  if (!raw) {
    throw new Error(
      "OBSIDIAN_VAULT_PATH is not set. Set it to the absolute path of your Obsidian vault, " +
        "e.g. OBSIDIAN_VAULT_PATH=/Users/you/vault.",
    );
  }
  const expanded = raw.startsWith("~") ? path.join(homedir(), raw.slice(1)) : raw;
  const absolute = path.resolve(expanded);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    throw new Error(`OBSIDIAN_VAULT_PATH does not exist: ${absolute}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`OBSIDIAN_VAULT_PATH is not a directory: ${absolute}`);
  }
  return absolute;
}
