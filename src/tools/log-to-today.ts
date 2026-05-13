import { z } from "zod";
import { appendToSection } from "../vault/daily.js";

const MAX_BYTES = 8 * 1024;

export const logToTodayInputSchema = {
  content: z
    .string()
    .min(1)
    .describe("The line or short block to append. Plain text or markdown."),
  section: z
    .string()
    .optional()
    .describe(
      "Section heading (without leading '## '). Defaults to 'Captures'. Created if missing.",
    ),
};

const inputObjectSchema = z.object(logToTodayInputSchema);

export const logToTodayTool = {
  name: "log_to_today" as const,
  description:
    "Append a line or short block to today's daily note (0-Inbox/Daily/YYYY-MM-DD.md). Creates the note from Templates/Daily Note.md if it does not exist. Defaults to the 'Captures' section.",
  inputSchema: logToTodayInputSchema,
  async handler(args: z.infer<typeof inputObjectSchema>, vaultPath: string) {
    if (Buffer.byteLength(args.content, "utf8") > MAX_BYTES) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Refusing to append: content too large (limit is ${MAX_BYTES} bytes).`,
          },
        ],
      };
    }
    const section = args.section ?? "Captures";
    await appendToSection(vaultPath, new Date(), section, args.content);
    return {
      content: [
        {
          type: "text" as const,
          text: `Appended to ## ${section} in today's daily note.`,
        },
      ],
    };
  },
};
