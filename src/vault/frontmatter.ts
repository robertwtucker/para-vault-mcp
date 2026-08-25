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
    // Pass a (truthy) options object to opt out of gray-matter's content-keyed
    // cache. The cache stores the pre-parse `file` object *before* parsing runs,
    // so when parsing throws (invalid YAML), the cache is left holding that
    // empty, error-free object — memoizing the throw as a success. Every later
    // call with byte-identical content then returns the cached non-error result
    // instead of re-parsing and re-throwing. In a long-lived process (this MCP
    // server), that would report a corrupt file's parse failure once and then
    // silently hide it on every subsequent read.
    const parsed = matter(raw, {});
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

// This is how `rawFrontmatter` is computed — not a defensive fallback for a
// path parseFrontmatter no longer takes. @11ty/gray-matter exposes a `matter`
// property carrying the raw YAML block, but it's defined as non-enumerable,
// and on a cache hit the library returns it via `Object.assign({}, cached)`,
// which drops non-enumerable properties — so `parsed.matter` would be
// undefined there. parseFrontmatter opts out of that cache above
// (`matter(raw, {})`), so the cache-hit path is currently unreachable from
// here — but the workaround is kept belt-and-braces: it's free, and the
// defect is live again the moment that opt-out is ever removed. Slicing the
// block from the raw input directly sidesteps the bug regardless of caching:
// reading `parsed.matter` here would be wrong whether or not the cache-hit
// path is reachable, since this function is `rawFrontmatter`'s only source.
function extractRawFrontmatter(raw: string): string {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1]! : "";
}
