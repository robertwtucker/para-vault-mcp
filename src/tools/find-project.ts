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
    "List PARA projects under 1-Projects/ with optional filtering, sorting, and a limit. Filters: query (name fragment or '#tag'), status, area, stale_days, updated_since. Returns an object with two fields. `projects` is the filtered, sorted, limited result set; each entry carries name, path, hasProjectFile, status, area, goal, nextAction, tags, due, updated, last_reviewed, daysSinceUpdate, and — when that file had problems — frontmatterError and dateErrors. `parseFailures` is a census of every project whose frontmatter had a parse problem, carrying name, path, and the error detail. It is present on every call (an empty array when the vault is clean), is never affected by the filters, and is excluded from sort and limit. It exists because a project whose frontmatter fails to parse is dropped by all five frontmatter-derived filters (status, area, '#tag', stale_days, updated_since), and a project whose date value fails to validate is dropped by stale_days and updated_since — so without this channel a corrupted project disappears from filtered views with nothing indicating it was ever there.",
  inputSchema: findProjectInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    const { projects, parseFailures } = await findProjects(vaultPath, config, {
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
          text: JSON.stringify(
            { projects, parseFailures },
            (key, value) => (key.startsWith("_") ? undefined : value),
            2,
          ),
        },
      ],
    };
  },
};
