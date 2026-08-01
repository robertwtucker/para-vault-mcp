/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { format } from "date-fns";
import { readFile, writeFile, rename, mkdir, stat, readdir, open } from "node:fs/promises";
import path from "node:path";
import type { VaultConfig } from "./config.js";

export const BODY_MAX_BYTES = 128 * 1024;

export interface BodyEnvelope {
  content: string;
  truncated: boolean;
  totalBytes: number;
  error?: string;
}

export function buildBodyEnvelope(content: string, maxBytes: number): BodyEnvelope {
  const totalBytes = Buffer.byteLength(content, "utf8");
  if (totalBytes < maxBytes) {
    return { content, truncated: false, totalBytes };
  }
  // Encode, cut, back off to last complete UTF-8 code point boundary.
  const encoded = Buffer.from(content, "utf8");
  let cutAt = Math.min(maxBytes, encoded.length);
  // Back off while the byte at cutAt-1 is a UTF-8 continuation byte (10xxxxxx)
  // AND the leading byte of the code point at cutAt was itself cut.
  // Simplest correct approach: back off any trailing bytes that form an
  // incomplete code point at the boundary. A UTF-8 lead byte is 0xxxxxxx (1B),
  // 110xxxxx (2B), 1110xxxx (3B), or 11110xxx (4B). Continuation bytes are
  // 10xxxxxx. If cutAt lands inside a multi-byte sequence, back off to the
  // preceding lead byte and drop that lead too.
  while (cutAt > 0 && (encoded[cutAt - 1]! & 0xc0) === 0x80) {
    // trailing byte is a continuation; back off
    cutAt--;
  }
  // Now cutAt-1 is either an ASCII byte (0xxxxxxx) or a lead byte (11xxxxxx).
  // If it's a lead byte, the code point is incomplete — drop it too.
  if (cutAt > 0 && (encoded[cutAt - 1]! & 0x80) === 0x80) {
    // top bit set AND we didn't back off past it, so this is a lead byte
    cutAt--;
  }
  const safeContent = encoded.subarray(0, cutAt).toString("utf8");
  return { content: safeContent, truncated: true, totalBytes };
}

export async function readBodyBounded(
  filePath: string,
  maxBytes: number,
): Promise<BodyEnvelope | undefined> {
  let size: number;
  try {
    ({ size } = await stat(filePath));
  } catch {
    return undefined;
  }
  if (size <= maxBytes) {
    try {
      const content = await readFile(filePath, "utf8");
      return { content, truncated: false, totalBytes: size };
    } catch (e) {
      return {
        content: "",
        truncated: false,
        totalBytes: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  // Bounded read for oversized file
  try {
    const fh = await open(filePath, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      await fh.read(buf, 0, maxBytes, 0);
      const safeContent = buildBodyEnvelope(buf.toString("utf8"), maxBytes).content;
      return { content: safeContent, truncated: true, totalBytes: size };
    } finally {
      await fh.close();
    }
  } catch (e) {
    return {
      content: "",
      truncated: false,
      totalBytes: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

const fileLocks = new Map<string, Promise<unknown>>();

function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(file) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  fileLocks.set(file, next.catch(() => {}));
  return next;
}

export function dailyNotePath(vaultPath: string, date: Date, config: VaultConfig): string {
  return path.join(vaultPath, config.dailyNotesFolder, `${format(date, "yyyy-MM-dd")}.md`);
}

export async function ensureDailyNote(vaultPath: string, date: Date, config: VaultConfig): Promise<string> {
  const file = dailyNotePath(vaultPath, date, config);
  try {
    await stat(file);
    return file;
  } catch {
    // does not exist
  }
  await mkdir(path.dirname(file), { recursive: true });
  const content = await renderTemplate(vaultPath, date, config);
  await atomicWrite(file, content);
  return file;
}

async function renderTemplate(vaultPath: string, date: Date, config: VaultConfig): Promise<string> {
  const tplPath = path.join(vaultPath, "Templates/Daily Note.md");
  const ymd = format(date, "yyyy-MM-dd");
  const dddd = format(date, "EEEE");
  let template: string;
  try {
    template = await readFile(tplPath, "utf8");
  } catch {
    template =
      `---\ntype: daily\ncreated: "${ymd}"\ntags: [daily]\n---\n\n# ${ymd} — ${dddd}\n\n## ${config.captureSection}\n\n## ${config.workLogSection}\n`;
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
  config: VaultConfig,
): Promise<void> {
  const file = dailyNotePath(vaultPath, date, config);
  await withFileLock(file, async () => {
    await ensureDailyNote(vaultPath, date, config);
    const content = await readFile(file, "utf8");
    const updated = upsertSectionAppend(content, section, line);
    await atomicWrite(file, updated);
  });
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

export async function prependToSectionList(
  vaultPath: string,
  date: Date,
  section: string,
  line: string,
  config: VaultConfig,
): Promise<void> {
  const file = dailyNotePath(vaultPath, date, config);
  await withFileLock(file, async () => {
    await ensureDailyNote(vaultPath, date, config);
    const content = await readFile(file, "utf8");
    const updated = upsertSectionListPrepend(content, section, line);
    await atomicWrite(file, updated);
  });
}

function upsertSectionListPrepend(content: string, section: string, line: string): string {
  const heading = `## ${section}`;
  const idx = content.indexOf(heading);
  if (idx === -1) {
    const sep = content.endsWith("\n") ? "" : "\n";
    return `${content}${sep}\n${heading}\n${line}\n`;
  }
  const afterHeadingStart = idx + heading.length;
  const afterHeading = content.slice(afterHeadingStart);
  const nextHeadingMatch = afterHeading.match(/\n##\s/);
  const sectionEnd =
    nextHeadingMatch === null || nextHeadingMatch.index === undefined
      ? content.length
      : afterHeadingStart + nextHeadingMatch.index;
  const body = content.slice(afterHeadingStart, sectionEnd);

  const bodyLines = body.split("\n");
  let firstSubsectionLineIdx = -1;
  let firstBulletLineIdx = -1;
  for (let i = 0; i < bodyLines.length; i++) {
    const l = bodyLines[i]!;
    if (/^###\s/.test(l)) {
      firstSubsectionLineIdx = i;
      break;
    }
    if (firstBulletLineIdx === -1 && /^[-*]\s/.test(l)) {
      firstBulletLineIdx = i;
    }
  }

  let insertLineIdx: number;
  if (
    firstBulletLineIdx !== -1 &&
    (firstSubsectionLineIdx === -1 || firstBulletLineIdx < firstSubsectionLineIdx)
  ) {
    insertLineIdx = firstBulletLineIdx;
  } else if (firstSubsectionLineIdx !== -1) {
    insertLineIdx = firstSubsectionLineIdx;
  } else {
    insertLineIdx = 0;
    while (insertLineIdx < bodyLines.length) {
      const l = bodyLines[insertLineIdx]!;
      if (l.trim() === "" || l.trimStart().startsWith("<!--")) {
        insertLineIdx++;
      } else {
        break;
      }
    }
  }

  const newBodyLines = [...bodyLines];
  newBodyLines.splice(insertLineIdx, 0, line);
  const newBody = newBodyLines.join("\n");

  return content.slice(0, afterHeadingStart) + newBody + content.slice(sectionEnd);
}

export interface InboxItem {
  name: string;
  path: string;
}

export interface InboxStatus {
  dailyNoteExists: boolean;
  inboxItemCount: number;
  inboxItems: InboxItem[];
  previousDailyNotePath?: string;
  endOfDayChecks?: { label: string; checked: boolean }[];
}

export async function inboxStatus(vaultPath: string, date: Date, config: VaultConfig): Promise<InboxStatus> {
  const file = dailyNotePath(vaultPath, date, config);
  const [content, inboxItems, previousDailyNotePath] = await Promise.all([
    readFile(file, "utf8").catch(() => undefined),
    listInboxItems(vaultPath, config),
    findPreviousDailyNote(vaultPath, date, config),
  ]);
  return {
    dailyNoteExists: content !== undefined,
    inboxItemCount: inboxItems.length,
    inboxItems,
    previousDailyNotePath,
    endOfDayChecks: content !== undefined
      ? extractEndOfDayChecks(content, config.endOfDayCheckSection)
      : undefined,
  };
}

async function findPreviousDailyNote(
  vaultPath: string,
  today: Date,
  config: VaultConfig,
): Promise<string | undefined> {
  const dailyFolder = path.join(vaultPath, config.dailyNotesFolder);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dailyFolder, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const todayKey = format(today, "yyyy-MM-dd");
  const dated = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => {
      const m = e.name.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? { name: e.name, key: m[1]! } : undefined;
    })
    .filter((x): x is { name: string; key: string } => x !== undefined)
    .filter((x) => x.key < todayKey);
  if (dated.length === 0) return undefined;
  dated.sort((a, b) => {
    if (a.key !== b.key) return a.key < b.key ? 1 : -1;
    // Tie-break: suffixed variant (e.g. "— Weekly Review") wins over plain
    // YYYY-MM-DD.md. Lexically the space after the date sorts before ".md",
    // so ascending name order puts the suffixed variant first.
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  return toVaultRelative(vaultPath, path.join(dailyFolder, dated[0]!.name));
}

async function listInboxItems(vaultPath: string, config: VaultConfig): Promise<InboxItem[]> {
  const inbox = path.join(vaultPath, config.inboxFolder);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(inbox, { withFileTypes: true });
  } catch {
    return [];
  }
  const markdown = entries.filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== ".DS_Store");
  const withStats = await Promise.all(
    markdown.map(async (e) => {
      const full = path.join(inbox, e.name);
      try {
        const s = await stat(full);
        return { name: e.name.replace(/\.md$/, ""), full, mtime: s.mtimeMs };
      } catch {
        // File vanished between readdir and stat (sync race, broken link). Skip.
        return undefined;
      }
    }),
  );
  const valid = withStats.filter((x): x is { name: string; full: string; mtime: number } => x !== undefined);
  valid.sort((a, b) => a.mtime - b.mtime);
  return valid.map((e) => ({
    name: e.name,
    path: toVaultRelative(vaultPath, e.full),
  }));
}

function toVaultRelative(vaultPath: string, absPath: string): string {
  return path.relative(vaultPath, absPath).split(path.sep).join("/");
}

function extractEndOfDayChecks(content: string, sectionName: string): { label: string; checked: boolean }[] {
  const heading = `## ${sectionName}`;
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
