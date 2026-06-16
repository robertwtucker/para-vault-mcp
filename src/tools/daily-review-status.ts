/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { inboxStatus } from "../vault/daily.js";
import type { VaultConfig } from "../vault/config.js";

export const dailyReviewStatusInputSchema = {} as const;

const inputObjectSchema = z.object({});

export const dailyReviewStatusTool = {
  name: "daily_review_status" as const,
  description:
    "Report the state of today's daily-review surface: whether today's daily note exists, the unprocessed items in 0-Inbox/ (count and the list itself, sorted oldest-first by mtime), the vault-relative path of the most recent prior daily note for reconciliation, and the state of the End-of-Day Check checkboxes (if the note has them).",
  inputSchema: dailyReviewStatusInputSchema,
  async handler(_args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    const status = await inboxStatus(vaultPath, new Date(), config);
    return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
  },
};
