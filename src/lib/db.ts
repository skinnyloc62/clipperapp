import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __clipmvp_prisma: PrismaClient | undefined;
}

/** Lazy Prisma client. Throws a clear 503-style error when DATABASE_URL is missing. */
export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set: provision Neon (Marketplace) and pull env first");
  }
  if (!global.__clipmvp_prisma) {
    global.__clipmvp_prisma = new PrismaClient();
  }
  return global.__clipmvp_prisma;
}
