#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";
import { resolveVaultPath } from "./vault/path.js";
import { loadVaultConfig } from "./vault/config.js";

async function main() {
  const vaultPath = resolveVaultPath();
  const config = await loadVaultConfig(vaultPath);
  const { mcp } = buildServer(vaultPath, config);
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((err) => {
  // Errors must go to stderr; stdout is reserved for MCP protocol traffic.
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
