import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

const TASK_LINE = /^\s*-\s*\[\s\]\s+(.+?)\s*$/;
const WAITING_SUFFIX = /\s*→\s*waiting on\s.+$/i;

export async function getNextAction(projectPath: string): Promise<string | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(projectPath, "_project.md"), "utf8");
  } catch {
    return null;
  }
  const { data, body } = parseFrontmatter(raw);
  const fm = data["next-action"];
  if (typeof fm === "string" && fm.trim().length > 0) {
    return stripWaiting(fm.trim());
  }
  for (const line of body.split("\n")) {
    const match = line.match(TASK_LINE);
    if (match) return stripWaiting(match[1]!.trim());
  }
  return null;
}

function stripWaiting(s: string): string {
  return s.replace(WAITING_SUFFIX, "").trim();
}
