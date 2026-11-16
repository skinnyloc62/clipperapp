import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface DevUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

function usersPath(): string {
  return join(process.cwd(), ".data", "users.json");
}

function assertLocalAllowed(): void {
  if (process.env.VERCEL) throw new Error("dev user store is disabled on Vercel");
  if (process.env.DATABASE_URL) throw new Error("DATABASE_URL is set: use Prisma users");
}

/** scrypt hash in `saltHex:derivedHex` form. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [saltHex, derivedHex] = hash.split(":");
  if (!saltHex || !derivedHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(derivedHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function readUsers(): DevUser[] {
  const p = usersPath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8")) as DevUser[];
  } catch {
    return [];
  }
}

/** Dev user lookup (local only). Production uses Prisma User.passwordHash. */
export const devUsers = {
  list(): DevUser[] {
    assertLocalAllowed();
    return readUsers();
  },
  findByEmail(email: string): DevUser | null {
    assertLocalAllowed();
    return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  },
  upsert(email: string, name: string, password: string): DevUser {
    assertLocalAllowed();
    const users = readUsers();
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const passwordHash = hashPassword(password);
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.name = name;
    } else {
      users.push({
        id: `user_${users.length + 1}`,
        email,
        name,
        passwordHash,
        createdAt: new Date().toISOString(),
      });
    }
    mkdirSync(join(process.cwd(), ".data"), { recursive: true });
    writeFileSync(usersPath(), JSON.stringify(users, null, 2));
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase())!;
  },
};

/** Find a user by email from Prisma (production) or the dev store (local). */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string; passwordHash: string | null } | null> {
  if (process.env.DATABASE_URL) {
    const { getPrisma } = await import("./db");
    return getPrisma().user.findUnique({ where: { email } });
  }
  if (process.env.VERCEL) return null;
  const u = devUsers.findByEmail(email);
  return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash } : null;
}
