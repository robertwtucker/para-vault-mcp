/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { findProjects } from "../vault/projects.js";
import type { VaultConfig } from "../vault/config.js";

export const findProjectInputSchema = {
  query: z
    .string()
    .optional()
    .describe(
      "Optional filter. Plain text matches project name (case-insensitive); '#tag' matches the tags array.",
    ),
  status: z
    .string()
    .optional()
    .describe(
      "Case-insensitive equality match on the project's `status:` frontmatter (e.g. 'active', 'waiting', 'done' — whatever vocabulary the vault uses). Omit to disable status filtering.",
    ),
  area: z
    .string()
    .optional()
    .describe(
      "Match on the project's `area:` frontmatter. Normalized before comparison (strips Obsidian [[wikilink]] brackets, trims, lowercases), then exact match.",
    ),
  stale_days: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      "Include only projects whose `updated:` date is at least N calendar days ago. Excludes projects without an `updated:` field.",
    ),
  updated_since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Include only projects whose `updated:` date is on or after this YYYY-MM-DD. Excludes projects without an `updated:` field.",
    ),
  sort: z
    .enum(["name", "updated", "last_reviewed", "due"])
    .optional()
    .describe("Sort key. Defaults to 'name'. Projects missing the sort-key value sink to the end."),
  order: z
    .enum(["asc", "desc"])
    .optional()
    .describe("Sort direction. Defaults to 'asc'."),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Cap result count after sort. Useful for top-N queries."),
};

const inputObjectSchema = z.object(findProjectInputSchema);

export const findProjectTool = {
  name: "find_project" as const,
  description:
    "List PARA projects under 1-Projects/ with optional filtering, sorting, and a limit. Filters: query (name fragment or '#tag'), status, area, stale_days, updated_since. Returns name, path, status, next action, tags, due, area, updated, last_reviewed, and daysSinceUpdate for each project.",
  inputSchema: findProjectInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    const projects = await findProjects(vaultPath, config, {
      query: args.query,
      status: args.status,
      area: args.area,
      staleDays: args.stale_days,
      updatedSince: args.updated_since,
      sort: args.sort,
      order: args.order,
      limit: args.limit,
    });
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(projects, null, 2) },
      ],
    };
  },
};
