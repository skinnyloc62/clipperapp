// Seed the two authorized users (husband + wife).
// - DATABASE_URL set: upserts Prisma User rows (passwords from env, else random printed once).
// - Local dev: writes .data/users.json (gitignored). Never commit real passwords.
import { randomBytes, scryptSync } from "node:crypto";

function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordFor(role, email) {
  const fromEnv = process.env[`${role}_PASSWORD`];
  if (fromEnv) return { password: fromEnv, random: false };
  const generated = randomBytes(12).toString("base64url");
  console.log(`[seed] ${email}: no ${role}_PASSWORD set — generated dev password: ${generated}`);
  return { password: generated, random: true };
}

const users = [
  { role: "HUSBAND", email: process.env.HUSBAND_EMAIL || "husband@streetethics.local", name: "Husband" },
  { role: "WIFE", email: process.env.WIFE_EMAIL || "wife@streetethics.local", name: "Wife" },
];

if (process.env.DATABASE_URL) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  for (const u of users) {
    const { password } = passwordFor(u.role, u.email);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash: hashPassword(password) },
      create: { email: u.email, name: u.name, passwordHash: hashPassword(password) },
    });
    console.log(`[seed] upserted ${u.email}`);
  }
  await prisma.$disconnect();
} else {
  if (process.env.VERCEL) throw new Error("refusing to seed dev users on Vercel");
  const { mkdirSync, writeFileSync, existsSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const p = join(process.cwd(), ".data", "users.json");
  let existing = [];
  if (existsSync(p)) {
    try {
      existing = JSON.parse(readFileSync(p, "utf8"));
    } catch { /* start fresh */ }
  }
  const next = [...existing];
  for (const u of users) {
    const { password } = passwordFor(u.role, u.email);
    const found = next.find((x) => x.email.toLowerCase() === u.email.toLowerCase());
    const entry = {
      id: found?.id || `user_${next.length + 1}`,
      email: u.email,
      name: u.name,
      passwordHash: hashPassword(password),
      createdAt: found?.createdAt || new Date().toISOString(),
    };
    if (found) next[next.indexOf(found)] = entry;
    else next.push(entry);
    console.log(`[seed] upserted ${u.email} (dev store)`);
  }
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  writeFileSync(p, JSON.stringify(next, null, 2));
}
console.log("[seed] done");
