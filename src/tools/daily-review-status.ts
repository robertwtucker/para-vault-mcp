/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { inboxStatus } from "../vault/daily.js";

export const dailyReviewStatusInputSchema = {} as const;

const inputObjectSchema = z.object({});

export const dailyReviewStatusTool = {
  name: "daily_review_status" as const,
  description:
    "Report whether today's daily note exists, the count of unprocessed items in 0-Inbox/, and the state of the End-of-Day Check checkboxes (if the note has them).",
  inputSchema: dailyReviewStatusInputSchema,
  async handler(_args: z.infer<typeof inputObjectSchema>, vaultPath: string) {
    const status = await inboxStatus(vaultPath, new Date());
    return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
  },
};
