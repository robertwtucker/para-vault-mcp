/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { z } from "zod";
import { inboxStatus } from "../vault/daily.js";
import type { VaultConfig } from "../vault/config.js";

export const dailyReviewStatusInputSchema = {
  include_body: z
    .boolean()
    .optional()
    .describe(
      "When true, include today's on-disk daily-note body under the `dailyNoteBody` response field as {content, truncated, totalBytes, error?}. Read at call time — no caching, so successive calls reflect live edits. Content is capped at 128 KB with UTF-8-safe truncation; the `truncated` flag surfaces the cut explicitly. Defaults to false.",
    ),
  include_previous_body: z
    .boolean()
    .optional()
    .describe(
      "When true, include the previous daily note's on-disk body under `previousDailyNoteBody` in the same envelope shape as `dailyNoteBody`. Only populated when `previousDailyNotePath` resolves to a real file. Defaults to false.",
    ),
};

const inputObjectSchema = z.object(dailyReviewStatusInputSchema);

export const dailyReviewStatusTool = {
  name: "daily_review_status" as const,
  description:
    "Report the state of today's daily-review surface: whether today's daily note exists, the unprocessed items in 0-Inbox/ (count and the list itself, sorted oldest-first by mtime), the vault-relative path of the most recent prior daily note for reconciliation, and the state of the End-of-Day Check checkboxes (if the note has them). Opt in to `include_body: true` to receive today's on-disk daily-note body directly (freshness invariant: read at call time, no caching), and `include_previous_body: true` for the previous note's body. Body fields carry `{content, truncated, totalBytes}` with a 128 KB cap; `truncated: true` surfaces the cut explicitly rather than silently trimming.",
  inputSchema: dailyReviewStatusInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string, config: VaultConfig) {
    const status = await inboxStatus(vaultPath, new Date(), config, {
      includeBody: args.include_body,
      includePreviousBody: args.include_previous_body,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
  },
};
