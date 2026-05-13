import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../fixtures/vault");

export function makeTmpVault(): { path: string; cleanup: () => void } {
  const tmp = mkdtempSync(path.join(tmpdir(), "vault-"));
  cpSync(FIXTURE, tmp, { recursive: true });
  return { path: tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}
