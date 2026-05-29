/**
 * SPDX-FileCopyrightText: (c) 2026 Robert Tucker
 * SPDX-License-Identifier: MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findProjectTool } from "./tools/find-project.js";
import { nextActionTool } from "./tools/next-action.js";
import { captureTool } from "./tools/capture.js";
import { logWorkTool } from "./tools/log-work.js";
import { dailyReviewStatusTool } from "./tools/daily-review-status.js";
import type { VaultConfig } from "./vault/config.js";

type ToolHandler = (args: unknown) => Promise<{ content: { type: "text"; text: string }[] }>;

export interface BuiltServer {
  mcp: McpServer;
  listToolNames(): string[];
  callTool(name: string, args: unknown): ReturnType<ToolHandler>;
}

export function buildServer(vaultPath: string, config: VaultConfig): BuiltServer {
  const mcp = new McpServer({ name: "para-vault-mcp", version: "0.2.0" });

  const tools = [findProjectTool, nextActionTool, captureTool, logWorkTool, dailyReviewStatusTool] as const;
  const handlerMap = new Map<string, ToolHandler>();

  for (const tool of tools) {
    const handler: ToolHandler = (args) => tool.handler(args as never, vaultPath, config);
    handlerMap.set(tool.name, handler);
    mcp.tool(tool.name, tool.description, tool.inputSchema, async (args: unknown) => handler(args));
  }

  return {
    mcp,
    listToolNames: () => Array.from(handlerMap.keys()),
    callTool: (name, args) => {
      const h = handlerMap.get(name);
      if (!h) throw new Error(`Unknown tool: ${name}`);
      return h(args);
    },
  };
}
