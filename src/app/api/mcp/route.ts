export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CLIPENGINE_TOOLS } from "@/lib/mcp-tools";
import { findUserByEmail } from "@/lib/users";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

function tokensEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Remote Clip Engine MCP (Streamable HTTP, stateless per request).
 * Auth: `Authorization: Bearer <MCP_API_TOKEN>`; the token maps to the single
 * configured owner via MCP_USER_EMAIL. Every tool call is owner-scoped.
 * Stateless transport: no session affinity, safe on serverless.
 */
async function authedUserId(req: Request): Promise<{ userId: string } | Response> {
  const expected = process.env.MCP_API_TOKEN || "";
  const got = bearerToken(req);
  if (!got || !tokensEqual(got, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const email = process.env.MCP_USER_EMAIL || "";
  if (!email) {
    return Response.json({ error: "MCP owner not configured", code: "mcp_no_owner" }, { status: 503 });
  }
  const user = await findUserByEmail(email);
  if (!user) {
    return Response.json({ error: "MCP owner not provisioned — run db:seed", code: "mcp_no_user" }, { status: 503 });
  }
  return { userId: user.id };
}

export async function POST(req: Request): Promise<Response> {
  const auth = await authedUserId(req);
  if (auth instanceof Response) return auth;

  interface AnyTool {
    description: string;
    inputSchema: z.AnyZodObject;
    annotations: {
      readOnlyHint: boolean;
      destructiveHint: boolean;
      idempotentHint: boolean;
      openWorldHint: boolean;
    };
    handler: (args: never, userId: string) => Promise<unknown>;
  }
  const server = new McpServer({ name: "street-ethics-clip-engine", version: "0.2.0" });
  for (const [name, tool] of Object.entries(CLIPENGINE_TOOLS) as [string, AnyTool][]) {
    server.registerTool(
      name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
        annotations: tool.annotations,
      },
      async (args: Record<string, unknown>) => {
        const out = await tool.handler(args as never, auth.userId);
        return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON-RPC body" }, { status: 400 });
  }

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({});
    await server.connect(transport);
    return await transport.handleRequest(req, { parsedBody: body });
  } catch (err) {
    console.error("mcp request failed:", (err as Error).message);
    return Response.json({ error: "mcp request failed" }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  return Response.json({ error: "method not allowed — POST JSON-RPC only", allow: "POST" }, { status: 405 });
}

export async function DELETE(): Promise<Response> {
  return Response.json({ error: "method not allowed — POST JSON-RPC only", allow: "POST" }, { status: 405 });
}
