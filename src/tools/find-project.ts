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
};

const inputObjectSchema = z.object(findProjectInputSchema);

export const findProjectTool = {
  name: "find_project" as const,
  description:
    "List active PARA projects under 1-Projects/. Optionally filter by name fragment or '#tag'. Returns name, path, status, next action, tags, due date, and area for each project.",
  inputSchema: findProjectInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, _config: VaultConfig) {
    const projects = await findProjects(vaultPath, { query: args.query });
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(projects, null, 2) },
      ],
    };
  },
};
