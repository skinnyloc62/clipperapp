export const runtime = "nodejs";

import { getSession } from "@/lib/auth";

export async function POST(): Promise<Response> {
  const session = await getSession();
  session.destroy();
  return Response.json({ ok: true });
}
