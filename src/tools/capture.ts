/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { appendToSection } from "../vault/daily.js";

const MAX_BYTES = 8 * 1024;
const SECTION = "Captures";

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
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string) {
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
    await appendToSection(vaultPath, new Date(), SECTION, line);
    return {
      content: [
        {
          type: "text" as const,
          text: `Captured to ## ${SECTION} in today's daily note.`,
        },
      ],
    };
  },
};
