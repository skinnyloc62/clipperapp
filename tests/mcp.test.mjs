// Remote MCP route contract — static assertions (handlers need Next runtime).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const EXPECTED_TOOLS = [
  "clipengine_status",
  "clipengine_ingest_url",
  "clipengine_validate",
  "clipengine_cut",
  "clipengine_highlights",
  "clipengine_render",
  "clipengine_qa",
  "clipengine_approve",
  "clipengine_download",
  "clipengine_brand_get",
  "clipengine_brand_update",
];

describe("remote clip-engine mcp", () => {
  it("route + tool library exist and are registered by name", () => {
    assert.ok(existsSync(join(ROOT, "src/app/api/mcp/route.ts")), "missing mcp route");
    const lib = read("src/lib/mcp-tools.ts");
    for (const t of EXPECTED_TOOLS) {
      assert.ok(lib.includes(t), `tool library missing ${t}`);
    }
    const route = read("src/app/api/mcp/route.ts");
    assert.ok(route.includes("CLIPENGINE_TOOLS"), "route must register the shared tool table");
    assert.ok(route.includes("registerTool"), "route must register tools on the server");
  });

  it("transport is web-standard stateless and methods are POST-only", () => {
    const route = read("src/app/api/mcp/route.ts");
    assert.ok(route.includes("WebStandardStreamableHTTPServerTransport"), "must use the web-standard transport");
    assert.ok(!route.includes("sessionIdGenerator"), "must omit session IDs (stateless) for serverless");
    assert.ok(route.includes("handleRequest"), "must delegate to the transport handler");
    assert.ok(route.includes("405"), "GET/DELETE must be rejected");
  });

  it("bearer token gate with timing-safe compare, mapped to one owner", () => {
    const route = read("src/app/api/mcp/route.ts");
    assert.ok(route.includes("MCP_API_TOKEN"), "missing bearer token env");
    assert.ok(route.includes("timingSafeEqual"), "token compare must be timing-safe");
    assert.ok(route.includes("MCP_USER_EMAIL"), "token must map to a configured owner");
    assert.ok(!/MCP_API_TOKEN="[^"]+"/.test(read(".env.example")), "example must not contain a real token");
  });

  it("every tool carries MCP annotations and user scoping", () => {
    const lib = read("src/lib/mcp-tools.ts");
    assert.ok(lib.includes("readOnlyHint") && lib.includes("destructiveHint"), "tools need annotations");
    assert.ok(lib.includes("openWorldHint: true"), "ingest tool must flag open-world fetch");
    const handlers = (lib.match(/async handler\(/g) || []).length;
    assert.equal(handlers, EXPECTED_TOOLS.length, `expected ${EXPECTED_TOOLS.length} handlers, found ${handlers}`);
    assert.ok(!lib.includes("filePath"), "tool library must never take client paths");
    assert.ok(!lib.includes("next/headers"), "tool library must stay runtime-free (explicit userId)");
  });
});
