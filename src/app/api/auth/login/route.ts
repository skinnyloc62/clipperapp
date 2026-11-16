export const runtime = "nodejs";

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { findUserByEmail, verifyPassword } from "@/lib/users";

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON {email, password}" }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const user = await findUserByEmail(parsed.data.email);
  if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return Response.json({ error: "invalid credentials" }, { status: 401 });
  }
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();
  return Response.json({ ok: true, userId: user.id, email: user.email });
}
