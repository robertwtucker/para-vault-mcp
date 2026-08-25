import { describe, it, expect } from "vitest";
import { InMemoryTransport, LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/server";
import type { JSONRPCMessage } from "@modelcontextprotocol/server";
import { buildServer } from "../src/server.js";
import { DEFAULT_CONFIG } from "../src/vault/config.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/vault");

interface JsonRpcResult {
  id: number;
  result?: Record<string, any>;
  error?: { code: number; message: string };
}

/**
 * Boots the real McpServer over an in-memory transport pair and completes the
 * MCP initialize handshake. Returns a `request` helper that resolves with the
 * matching JSON-RPC response, plus the initialize result.
 *
 * This is the only test harness that goes through registerTool's dispatch path.
 * test/server.test.ts exercises buildServer's own handler map, which cannot
 * catch drift between our registration call and what a real client invokes.
 */
async function connectClient() {
  const { mcp } = buildServer(FIXTURE, DEFAULT_CONFIG);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const pending = new Map<number, (m: JsonRpcResult) => void>();
  clientTransport.onmessage = (m) => {
    const msg = m as unknown as JsonRpcResult;
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)!(msg);
      pending.delete(msg.id);
    }
  };

  await mcp.connect(serverTransport);
  await clientTransport.start();

  let nextId = 0;
  const request = (method: string, params?: unknown) =>
    new Promise<JsonRpcResult>((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      void clientTransport.send({ jsonrpc: "2.0", id, method, params } as JSONRPCMessage);
    });

  const init = await request("initialize", {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "para-vault-mcp-test", version: "0.0.0" },
  });
  await clientTransport.send({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  } as JSONRPCMessage);

  return { request, init, close: () => clientTransport.close() };
}

describe("MCP server over the real wire protocol", () => {
  it("completes the initialize handshake and advertises the package version", async () => {
    const { init, close } = await connectClient();
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../package.json"), "utf8"),
    ) as { version: string };

    expect(init.result?.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect(init.result?.serverInfo?.name).toBe("para-vault-mcp");
    // Guards the failure mode caught by hand during the v0.5 release: src/server.ts
    // carried a hardcoded "0.2.0" while package.json said 0.5.0, so the server
    // would have advertised the wrong version to every client.
    expect(init.result?.serverInfo?.version).toBe(pkg.version);
    await close();
  });

  it("lists all five tools through tools/list", async () => {
    const { request, close } = await connectClient();
    const res = await request("tools/list", {});
    const names = (res.result?.tools ?? []).map((t: { name: string }) => t.name);

    expect(names.sort()).toEqual([
      "capture",
      "daily_review_status",
      "find_project",
      "log_work",
      "next_action",
    ]);
    await close();
  });

  it("exposes find_project's input schema as JSON Schema through tools/list", async () => {
    const { request, close } = await connectClient();
    const res = await request("tools/list", {});
    const findProject = (res.result?.tools ?? []).find(
      (t: { name: string }) => t.name === "find_project",
    );

    expect(findProject.inputSchema.type).toBe("object");
    expect(Object.keys(findProject.inputSchema.properties).sort()).toEqual([
      "area",
      "limit",
      "order",
      "query",
      "sort",
      "stale_days",
      "status",
      "updated_since",
    ]);
    await close();
  });

  it("dispatches tools/call to the find_project handler", async () => {
    const { request, close } = await connectClient();
    const res = await request("tools/call", {
      name: "find_project",
      arguments: { query: "Sample" },
    });
    const payload = JSON.parse(res.result?.content[0].text);

    expect(Array.isArray(payload.projects)).toBe(true);
    expect(payload.projects.length).toBeGreaterThan(0);
    expect(payload.projects.every((p: { name: string }) => p.name.includes("Sample"))).toBe(true);
    expect(payload.parseFailures).toEqual([]);
    await close();
  });
});
