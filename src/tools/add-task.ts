/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { appendToSection } from "../vault/daily.js";

const MAX_BYTES = 8 * 1024;
const SECTION = "Tasks";

export const addTaskInputSchema = {
  content: z
    .string()
    .min(1)
    .describe(
      "Task description. Plain text; an unchecked checkbox bullet is added automatically.",
    ),
};

const inputObjectSchema = z.object(addTaskInputSchema);

export const addTaskTool = {
  name: "add_task" as const,
  description:
    "Add an unchecked task to today's daily-note Tasks section.",
  inputSchema: addTaskInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string) {
    if (Buffer.byteLength(args.content, "utf8") > MAX_BYTES) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Refusing to add task: content too large (limit is ${MAX_BYTES} bytes).`,
          },
        ],
      };
    }
    const line = args.content.startsWith("- [ ] ") ? args.content : `- [ ] ${args.content}`;
    await appendToSection(vaultPath, new Date(), SECTION, line);
    return {
      content: [
        {
          type: "text" as const,
          text: `Added task to ## ${SECTION} in today's daily note.`,
        },
      ],
    };
  },
};
