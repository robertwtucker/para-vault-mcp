import { format } from "date-fns";
import { readFile, writeFile, rename, mkdir, stat, readdir } from "node:fs/promises";
import path from "node:path";

export function dailyNotePath(vaultPath: string, date: Date): string {
  return path.join(vaultPath, "0-Inbox/Daily", `${format(date, "yyyy-MM-dd")}.md`);
}

export async function ensureDailyNote(vaultPath: string, date: Date): Promise<string> {
  const file = dailyNotePath(vaultPath, date);
  try {
    await stat(file);
    return file;
  } catch {
    // does not exist
  }
  await mkdir(path.dirname(file), { recursive: true });
  const content = await renderTemplate(vaultPath, date);
  await atomicWrite(file, content);
  return file;
}

async function renderTemplate(vaultPath: string, date: Date): Promise<string> {
  const tplPath = path.join(vaultPath, "Templates/Daily Note.md");
  const ymd = format(date, "yyyy-MM-dd");
  const dddd = format(date, "EEEE");
  let template: string;
  try {
    template = await readFile(tplPath, "utf8");
  } catch {
    template =
      `---\ntype: daily\ncreated: "${ymd}"\ntags: [daily]\n---\n\n# ${ymd} — ${dddd}\n\n## Captures\n\n## Work Log\n`;
    return template;
  }
  return template
    .replaceAll("{{date:YYYY-MM-DD}}", ymd)
    .replaceAll("{{date:dddd}}", dddd);
}

export async function appendToSection(
  vaultPath: string,
  date: Date,
  section: string,
  line: string,
): Promise<void> {
  const file = await ensureDailyNote(vaultPath, date);
  const content = await readFile(file, "utf8");
  const updated = upsertSectionAppend(content, section, line);
  await atomicWrite(file, updated);
}

function upsertSectionAppend(content: string, section: string, line: string): string {
  const heading = `## ${section}`;
  const idx = content.indexOf(heading);
  if (idx === -1) {
    const sep = content.endsWith("\n") ? "" : "\n";
    return `${content}${sep}\n${heading}\n${line}\n`;
  }
  const after = content.slice(idx + heading.length);
  const nextHeadingMatch = after.match(/\n##\s/);
  const insertAt =
    nextHeadingMatch === null || nextHeadingMatch.index === undefined
      ? content.length
      : idx + heading.length + nextHeadingMatch.index;
  const before = content.slice(0, insertAt).replace(/\s*$/, "");
  const tail = content.slice(insertAt);
  return `${before}\n${line}\n${tail.startsWith("\n") ? tail : `\n${tail}`}`;
}

export interface InboxStatus {
  dailyNoteExists: boolean;
  inboxItemCount: number;
  endOfDayChecks?: { label: string; checked: boolean }[];
}

export async function inboxStatus(vaultPath: string, date: Date): Promise<InboxStatus> {
  const file = dailyNotePath(vaultPath, date);
  let dailyNoteExists = false;
  let endOfDayChecks: { label: string; checked: boolean }[] | undefined;
  try {
    const content = await readFile(file, "utf8");
    dailyNoteExists = true;
    endOfDayChecks = extractEndOfDayChecks(content);
  } catch {
    // not present
  }
  const inbox = path.join(vaultPath, "0-Inbox");
  let inboxItemCount = 0;
  try {
    const entries = await readdir(inbox, { withFileTypes: true });
    inboxItemCount = entries.filter(
      (e) => e.isFile() && e.name.endsWith(".md") && e.name !== ".DS_Store",
    ).length;
  } catch {
    // missing inbox dir
  }
  return { dailyNoteExists, inboxItemCount, endOfDayChecks };
}

function extractEndOfDayChecks(content: string): { label: string; checked: boolean }[] {
  const heading = "## End-of-Day Check";
  const idx = content.indexOf(heading);
  if (idx === -1) return [];
  const tail = content.slice(idx);
  const next = tail.slice(heading.length).match(/\n##\s/);
  const block = next && next.index !== undefined ? tail.slice(0, heading.length + next.index) : tail;
  const lines = block.split("\n");
  const checks: { label: string; checked: boolean }[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[( |x)\]\s+(.+?)\s*$/);
    if (m) checks.push({ label: m[2]!.trim(), checked: m[1] === "x" });
  }
  return checks;
}

async function atomicWrite(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, file);
}
