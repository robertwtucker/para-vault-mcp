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
      "Match on the project's `area:` frontmatter. Every common shape — bare string, quoted string, and [[wikilink]] in all variants including aliases (`[[Target|Alias]]`) and path targets (`[[Areas/Health]]`) — normalizes to one canonical form before exact-match comparison (case-insensitive).",
    ),
  stale_days: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      "Include only projects whose `updated:` date is at least N calendar days ago. Excludes projects with no `updated:` field AND projects whose `updated:` value didn't parse (see `dateErrors` in the response).",
    ),
  updated_since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Include only projects whose `updated:` date is on or after this YYYY-MM-DD. Excludes projects with no `updated:` field AND projects whose `updated:` value didn't parse (see `dateErrors` in the response).",
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
    "List PARA projects under 1-Projects/ with optional filtering, sorting, and a limit. Filters: query (name fragment or '#tag'), status, area, stale_days, updated_since. Returns name, path, hasProjectFile, status, area, goal, nextAction, tags, due, updated, last_reviewed, and daysSinceUpdate for each project. Per-project parse failures surface in `frontmatterError` (whole-file YAML invalid) or `dateErrors` (date values that didn't validate, e.g. `updated: 2026-13-45`). Projects with errors still appear in unfiltered results so callers can flag the issue; the `stale_days` and `updated_since` filters do exclude projects whose `updated:` value is invalid, since there's no meaningful date to compare.",
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
        {
          type: "text" as const,
          text: JSON.stringify(projects, (key, value) => (key.startsWith("_") ? undefined : value), 2),
        },
      ],
    };
  },
};
