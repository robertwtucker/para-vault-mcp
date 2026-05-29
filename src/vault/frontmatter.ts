/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import matter from "gray-matter";

export interface ParsedNote {
  data: Record<string, unknown>;
  body: string;
  error?: string;
}

export function parseFrontmatter(raw: string): ParsedNote {
  try {
    const parsed = matter(raw);
    return { data: (parsed.data ?? {}) as Record<string, unknown>, body: parsed.content };
  } catch (e) {
    const stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
    const message = e instanceof Error ? e.message : String(e);
    return { data: {}, body: stripped, error: message };
  }
}
