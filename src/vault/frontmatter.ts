/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import matter from "@11ty/gray-matter";

export interface ParsedNote {
  data: Record<string, unknown>;
  body: string;
  rawFrontmatter: string;
  error?: string;
}

export function parseFrontmatter(raw: string): ParsedNote {
  try {
    const parsed = matter(raw);
    return {
      data: (parsed.data ?? {}) as Record<string, unknown>,
      body: parsed.content,
      rawFrontmatter: extractRawFrontmatter(raw),
    };
  } catch (e) {
    const stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
    const message = e instanceof Error ? e.message : String(e);
    return { data: {}, body: stripped, rawFrontmatter: "", error: message };
  }
}

// @11ty/gray-matter exposes a `matter` property carrying the raw YAML block, but
// it's defined as non-enumerable and gets stripped by the library's own
// Object.assign-based cache-hit path. Slicing the block from the input string
// directly sidesteps the bug.
function extractRawFrontmatter(raw: string): string {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1]! : "";
}
