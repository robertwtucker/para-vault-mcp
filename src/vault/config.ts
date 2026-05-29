/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

export interface VaultConfig {
  captureSection: string;
  workLogSection: string;
  endOfDayCheckSection: string;
  dailyNotesFolder: string;
  inboxFolder: string;
  projectsFolder: string;
}

export const DEFAULT_CONFIG: VaultConfig = {
  captureSection: "Captures",
  workLogSection: "Work Log",
  endOfDayCheckSection: "End-of-Day Check",
  dailyNotesFolder: "0-Inbox/Daily",
  inboxFolder: "0-Inbox",
  projectsFolder: "1-Projects",
};

const CONFIG_RELATIVE_PATH = "_system/PARA-conventions.md";

const FOLDER_KEYS = ["dailyNotesFolder", "inboxFolder", "projectsFolder"] as const;

const FRONTMATTER_KEY_MAP: Record<string, keyof VaultConfig> = {
  "capture-section": "captureSection",
  "work-log-section": "workLogSection",
  "end-of-day-check-section": "endOfDayCheckSection",
  "daily-notes-folder": "dailyNotesFolder",
  "inbox-folder": "inboxFolder",
  "projects-folder": "projectsFolder",
};

export async function loadVaultConfig(vaultPath: string): Promise<VaultConfig> {
  const configPath = path.join(vaultPath, CONFIG_RELATIVE_PATH);
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  const { data, error } = parseFrontmatter(raw);
  if (error) {
    throw new Error(
      `Failed to parse ${CONFIG_RELATIVE_PATH} frontmatter: ${error}`,
    );
  }
  const merged: VaultConfig = { ...DEFAULT_CONFIG };
  for (const [fmKey, configKey] of Object.entries(FRONTMATTER_KEY_MAP)) {
    const value = data[fmKey];
    if (typeof value === "string" && value.trim().length > 0) {
      merged[configKey] = value.trim();
    }
  }
  for (const key of FOLDER_KEYS) {
    assertContainedFolder(vaultPath, merged[key], key);
  }
  return merged;
}

function assertContainedFolder(
  vaultRoot: string,
  value: string,
  key: keyof VaultConfig,
): void {
  if (path.isAbsolute(value)) {
    throw new Error(
      `${key} in ${CONFIG_RELATIVE_PATH} must be a vault-relative path, got absolute: ${value}`,
    );
  }
  const resolved = path.resolve(vaultRoot, value);
  if (
    resolved !== vaultRoot &&
    !resolved.startsWith(vaultRoot + path.sep)
  ) {
    throw new Error(
      `${key} in ${CONFIG_RELATIVE_PATH} resolves outside vault root: ${value}`,
    );
  }
}
