/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { findProjects } from "../vault/projects.js";
import { getNextAction } from "../vault/next-action.js";
import type { VaultConfig } from "../vault/config.js";

export const nextActionInputSchema = {
  project: z
    .string()
    .optional()
    .describe(
      "Optional project name (case-insensitive substring). If omitted, returns next actions for every project.",
    ),
};

const inputObjectSchema = z.object(nextActionInputSchema);

export const nextActionTool = {
  name: "next_action" as const,
  description:
    "Get the next action for a PARA project. Reads the `next-action` frontmatter field, falling back to the first unchecked task. With no `project`, returns next actions for every project.",
  inputSchema: nextActionInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    const projects = await findProjects(vaultPath, config);
    if (args.project) {
      const match = projects.find((p) =>
        p.name.toLowerCase().includes(args.project!.toLowerCase()),
      );
      if (!match) {
        return { content: [{ type: "text" as const, text: `Project not found: ${args.project}` }] };
      }
      const action = await getNextAction(match.path);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ name: match.name, nextAction: action }, null, 2),
          },
        ],
      };
    }
    const all = await Promise.all(
      projects.map(async (p) => ({ name: p.name, status: p.status, nextAction: await getNextAction(p.path) })),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(all, null, 2) }] };
  },
};
