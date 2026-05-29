/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { appendToSection } from "../vault/daily.js";
import type { VaultConfig } from "../vault/config.js";

const MAX_BYTES = 8 * 1024;

export const logWorkInputSchema = {
  content: z
    .string()
    .min(1)
    .describe(
      "What you worked on or accomplished. Plain text or markdown; a list bullet is added automatically.",
    ),
};

const inputObjectSchema = z.object(logWorkInputSchema);

export const logWorkTool = {
  name: "log_work" as const,
  description:
    "Log a work-log entry (something done or worked on) to today's daily-note Work Log section.",
  inputSchema: logWorkInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    if (Buffer.byteLength(args.content, "utf8") > MAX_BYTES) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Refusing to log: content too large (limit is ${MAX_BYTES} bytes).`,
          },
        ],
      };
    }
    const line = args.content.startsWith("- ") ? args.content : `- ${args.content}`;
    await appendToSection(vaultPath, new Date(), config.workLogSection, line, config);
    return {
      content: [
        {
          type: "text" as const,
          text: `Logged to ## ${config.workLogSection} in today's daily note.`,
        },
      ],
    };
  },
};
