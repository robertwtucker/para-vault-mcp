/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { readFile } from "node:fs/promises";
import { globby } from "globby";
import path from "node:path";
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
  tags: string[];
  frontmatterError?: string;
}

export interface FindProjectsOptions {
  query?: string;
}

export async function findProjects(
  vaultPath: string,
  config: VaultConfig,
  options: FindProjectsOptions = {},
): Promise<ProjectSummary[]> {
  const projectsRoot = path.join(vaultPath, config.projectsFolder);
  const dirs = await globby("*", { cwd: projectsRoot, onlyDirectories: true, dot: false });

  const summaries = await Promise.all(
    dirs.map(async (dir) => loadProject(projectsRoot, dir)),
  );

  return summaries.filter((p) => matchesQuery(p, options.query));
}

async function loadProject(projectsRoot: string, dir: string): Promise<ProjectSummary> {
  const projectPath = path.join(projectsRoot, dir);
  const projectFile = path.join(projectPath, "_project.md");
  let raw: string | undefined;
  try {
    raw = await readFile(projectFile, "utf8");
  } catch {
    return { name: dir, path: projectPath, hasProjectFile: false, tags: [] };
  }
  const { data, error } = parseFrontmatter(raw);
  return {
    name: dir,
    path: projectPath,
    hasProjectFile: true,
    status: typeof data.status === "string" ? data.status : undefined,
    goal: typeof data.goal === "string" ? data.goal : undefined,
    area: typeof data.area === "string" ? data.area : undefined,
    nextAction: typeof data["next-action"] === "string" ? data["next-action"] : undefined,
    due: typeof data.due === "string" ? data.due : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [],
    frontmatterError: error,
  };
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
