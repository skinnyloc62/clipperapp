export const runtime = "nodejs";

import { requireUser } from "@/lib/auth";
import { brandSchema } from "@/lib/validators";
import { getBrand, putBrand } from "@/lib/clips";

/** Single brand profile per user. Local dev JSON; Prisma BrandSetting when DATABASE_URL is set. */
export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  if (process.env.DATABASE_URL) {
    const { getPrisma } = await import("@/lib/db");
    const row = await getPrisma().brandSetting.findUnique({ where: { userId: user.userId } });
    return Response.json(
      row ?? { userId: user.userId, logoUrl: null, primaryColor: "#ffffff", captionStyle: "bottom", watermarkText: null },
    );
  }
  if (process.env.VERCEL) {
    return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
  }
  return Response.json(getBrand(user.userId));
}

export async function PUT(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON brand profile" }, { status: 400 });
  }
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (process.env.DATABASE_URL) {
    const { getPrisma } = await import("@/lib/db");
    const row = await getPrisma().brandSetting.upsert({
      where: { userId: user.userId },
      update: { ...parsed.data },
      create: { userId: user.userId, ...parsed.data },
    });
    return Response.json(row);
  }
  if (process.env.VERCEL) {
    return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
  }
  const { logoUrl, primaryColor, captionStyle, watermarkText } = parsed.data;
  return Response.json(
    putBrand(user.userId, {
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(primaryColor !== undefined ? { primaryColor } : {}),
      ...(captionStyle !== undefined ? { captionStyle } : {}),
      ...(watermarkText !== undefined ? { watermarkText } : {}),
    }),
  );
}
