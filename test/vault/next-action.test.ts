import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getNextAction } from "../../src/vault/next-action.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("getNextAction", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "next-action-"));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  function writeProject(name: string, content: string): string {
    const dir = path.join(tmp, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "_project.md"), content);
    return dir;
  }

  it("returns the next-action frontmatter value when present", async () => {
    const dir = writeProject("p", `---\nnext-action: "Call Jamie"\n---\n\n## Tasks\n- [ ] Other`);
    expect(await getNextAction(dir)).toBe("Call Jamie");
  });

  it("falls back to the first unchecked task in the body when frontmatter is absent", async () => {
    const dir = writeProject(
      "p",
      `---\ntype: project\n---\n\n## Tasks\n- [x] Done thing\n- [ ] Do this next\n- [ ] Then this`,
    );
    expect(await getNextAction(dir)).toBe("Do this next");
  });

  it("returns null when there is no _project.md", async () => {
    const dir = path.join(tmp, "bare");
    mkdirSync(dir);
    expect(await getNextAction(dir)).toBeNull();
  });

  it("returns null when there are no unchecked tasks and no frontmatter", async () => {
    const dir = writeProject("p", `# Empty\n\n## Tasks\n- [x] Done`);
    expect(await getNextAction(dir)).toBeNull();
  });

  it("strips the '→ waiting on ...' suffix used in the conventions", async () => {
    const dir = writeProject(
      "p",
      `---\ntype: project\n---\n\n## Tasks\n- [ ] Review with stakeholder → waiting on @Jamie`,
    );
    expect(await getNextAction(dir)).toBe("Review with stakeholder");
  });
});
