/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { readFile } from "node:fs/promises";
import { globby } from "globby";
import path from "node:path";
import { differenceInCalendarDays } from "date-fns";
import { parseFrontmatter } from "./frontmatter.js";
import type { VaultConfig } from "./config.js";

export interface ProjectSummary {
  name: string;
  path: string;
  hasProjectFile: boolean;
  status?: string;
  goal?: string;
  area?: string;
  nextAction?: string;
  due?: string;
  updated?: string;
  lastReviewed?: string;
  daysSinceUpdate?: number;
  tags: string[];
  frontmatterError?: string;
}

export type ProjectSortKey = "name" | "updated" | "lastReviewed" | "due";
export type SortOrder = "asc" | "desc";

export interface FindProjectsOptions {
  query?: string;
  status?: string;
  area?: string;
  staleDays?: number;
  updatedSince?: string;
  sort?: ProjectSortKey;
  order?: SortOrder;
  limit?: number;
  now?: Date;
}

export async function findProjects(
  vaultPath: string,
  config: VaultConfig,
  options: FindProjectsOptions = {},
): Promise<ProjectSummary[]> {
  const projectsRoot = path.join(vaultPath, config.projectsFolder);
  const dirs = await globby("*", { cwd: projectsRoot, onlyDirectories: true, dot: false });
  const now = options.now ?? new Date();

  const summaries = await Promise.all(
    dirs.map(async (dir) => loadProject(projectsRoot, dir, now)),
  );

  const statusFilter = options.status?.toLowerCase();
  const areaFilter = options.area ? normalizeArea(options.area) : undefined;
  const updatedSinceDate = parseDateString(options.updatedSince);

  const filtered = summaries.filter((p) => {
    if (!matchesQuery(p, options.query)) return false;
    if (statusFilter !== undefined && p.status?.toLowerCase() !== statusFilter) return false;
    if (areaFilter !== undefined && (p.area === undefined || normalizeArea(p.area) !== areaFilter)) return false;
    if (options.staleDays !== undefined && (p.daysSinceUpdate === undefined || p.daysSinceUpdate < options.staleDays)) return false;
    if (updatedSinceDate !== undefined) {
      const updatedDate = parseDateString(p.updated);
      if (updatedDate === undefined || updatedDate < updatedSinceDate) return false;
    }
    return true;
  });

  const sorted = sortProjects(filtered, options.sort ?? "name", options.order ?? "asc");
  return options.limit !== undefined ? sorted.slice(0, options.limit) : sorted;
}

function sortProjects(
  projects: ProjectSummary[],
  sortKey: ProjectSortKey,
  order: SortOrder,
): ProjectSummary[] {
  const dir = order === "desc" ? -1 : 1;
  return [...projects].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av === undefined && bv === undefined) return a.name.localeCompare(b.name);
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a.name.localeCompare(b.name);
  });
}

function sortValue(p: ProjectSummary, key: ProjectSortKey): string | undefined {
  switch (key) {
    case "name": return p.name;
    case "updated": return p.updated;
    case "lastReviewed": return p.lastReviewed;
    case "due": return p.due;
  }
}

function normalizeArea(value: string): string {
  let s = value.trim();
  const wikilink = s.match(/^\[\[(.+)\]\]$/);
  if (wikilink) s = wikilink[1]!.trim();
  const pipe = s.indexOf("|");
  if (pipe !== -1) {
    const alias = s.slice(pipe + 1).trim();
    if (alias.length > 0) return alias.toLowerCase();
    s = s.slice(0, pipe);
  }
  const lastSlash = s.lastIndexOf("/");
  if (lastSlash !== -1) s = s.slice(lastSlash + 1);
  return s.trim().toLowerCase();
}

function extractAreaString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length === 1) {
    const inner = value[0];
    if (Array.isArray(inner) && inner.length === 1 && typeof inner[0] === "string") {
      return inner[0];
    }
  }
  return undefined;
}

async function loadProject(projectsRoot: string, dir: string, now: Date): Promise<ProjectSummary> {
  const projectPath = path.join(projectsRoot, dir);
  const projectFile = path.join(projectPath, "_project.md");
  let raw: string | undefined;
  try {
    raw = await readFile(projectFile, "utf8");
  } catch {
    return { name: dir, path: projectPath, hasProjectFile: false, tags: [] };
  }
  const { data, error, rawFrontmatter } = parseFrontmatter(raw);
  const updated = readDateField(data, "updated", rawFrontmatter);
  const due = readDateField(data, "due", rawFrontmatter);
  const lastReviewed = readDateField(data, "last-reviewed", rawFrontmatter);
  return {
    name: dir,
    path: projectPath,
    hasProjectFile: true,
    status: typeof data.status === "string" ? data.status : undefined,
    goal: typeof data.goal === "string" ? data.goal : undefined,
    area: extractAreaString(data.area),
    nextAction: typeof data["next-action"] === "string" ? data["next-action"] : undefined,
    due,
    updated,
    lastReviewed,
    daysSinceUpdate: updated ? differenceInCalendarDays(now, parseDateString(updated)!) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [],
    frontmatterError: error,
  };
}

function readDateField(
  data: Record<string, unknown>,
  key: string,
  rawFrontmatter: string,
): string | undefined {
  const value = data[key];
  if (value === undefined) return undefined;
  const rawScalar = rawScalarForKey(rawFrontmatter, key);
  if (rawScalar !== undefined) {
    const cleaned = stripYamlQuotes(rawScalar.trim());
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return undefined;
}

function rawScalarForKey(rawYaml: string, key: string): string | undefined {
  const escaped = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const m = rawYaml.match(new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "m"));
  return m ? m[1] : undefined;
}

function stripYamlQuotes(s: string): string {
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseDateString(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function matchesQuery(p: ProjectSummary, query: string | undefined): boolean {
  if (!query) return true;
  const q = query.trim();
  if (q.startsWith("#")) {
    const tag = q.slice(1).toLowerCase();
    return p.tags.some((t) => t.toLowerCase() === tag);
  }
  return p.name.toLowerCase().includes(q.toLowerCase());
}
