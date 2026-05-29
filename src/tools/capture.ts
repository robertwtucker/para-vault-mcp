/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { prependToSectionList } from "../vault/daily.js";
import type { VaultConfig } from "../vault/config.js";

const MAX_BYTES = 8 * 1024;

export const captureInputSchema = {
  content: z
    .string()
    .min(1)
    .describe(
      "Idea, URL, or note to capture for later processing. Plain text or markdown; a list bullet is added automatically.",
    ),
};

const inputObjectSchema = z.object(captureInputSchema);

export const captureTool = {
  name: "capture" as const,
  description:
    "Capture an idea, URL, or quick note into today's daily-note Captures section for later processing.",
  inputSchema: captureInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    if (Buffer.byteLength(args.content, "utf8") > MAX_BYTES) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Refusing to capture: content too large (limit is ${MAX_BYTES} bytes).`,
          },
        ],
      };
    }
    const line = args.content.startsWith("- ") ? args.content : `- ${args.content}`;
    await prependToSectionList(vaultPath, new Date(), config.captureSection, line, config);
    return {
      content: [
        {
          type: "text" as const,
          text: `Captured to ## ${config.captureSection} in today's daily note.`,
        },
      ],
    };
  },
};
