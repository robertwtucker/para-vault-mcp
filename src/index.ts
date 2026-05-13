#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";
import { resolveVaultPath } from "./vault/path.js";

async function main() {
  const vaultPath = resolveVaultPath();
  const { mcp } = buildServer(vaultPath);
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((err) => {
  // Errors must go to stderr; stdout is reserved for MCP protocol traffic.
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
