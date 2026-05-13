import matter from "gray-matter";

export interface ParsedNote {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedNote {
  try {
    const parsed = matter(raw);
    return { data: (parsed.data ?? {}) as Record<string, unknown>, body: parsed.content };
  } catch {
    const stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
    return { data: {}, body: stripped };
  }
}
