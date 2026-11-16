// Section 2 corrections contract — static assertions, runs with `npm test` (node --test).
// Verifies the upload-architecture fix, filePath removal, auth gating, and schema hardening.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

describe("section 2 upload architecture", () => {
  it("multipart upload enforces the function payload cap and redirects large files", () => {
    const src = read("src/app/api/uploads/route.ts");
    assert.ok(src.includes("FUNCTION_PAYLOAD_LIMIT"), "missing function payload cap");
    assert.ok(src.includes("use_client_upload"), "missing client-upload redirect code");
    assert.ok(src.includes("/api/uploads/token"), "missing token route pointer");
  });

  it("token route mints storage tokens server-side with policy checks", () => {
    const p = "src/app/api/uploads/token/route.ts";
    assert.ok(existsSync(join(ROOT, p)), "token route missing");
    const src = read(p);
    assert.ok(src.includes("handleUpload"), "missing @vercel/blob handleUpload");
    assert.ok(src.includes("onBeforeGenerateToken"), "missing pre-token policy check");
    assert.ok(src.includes("requireUser"), "token route must require auth");
  });

  it("no client-controlled filesystem paths anywhere in upload/validate", () => {
    for (const p of ["src/app/api/uploads/route.ts", "src/app/api/clips/validate/route.ts", "src/lib/validators.ts"]) {
      assert.ok(!read(p).includes("filePath"), `${p} still accepts client filePath`);
    }
  });

  it("validate resolves server-side with traversal + symlink protection", () => {
    const src = read("src/app/api/clips/validate/route.ts");
    assert.ok(src.includes("realpathSync"), "missing symlink resolution");
    assert.ok(src.includes("path_escape"), "missing escape rejection");
    assert.ok(src.includes("ALLOWED_VIDEO_CODECS"), "missing codec allowlist");
    assert.ok(src.includes("markInvalid"), "invalid media must flip asset status");
  });

  it("auth gate covers uploads, validate, and token routes", () => {
    for (const p of ["src/app/api/uploads/route.ts", "src/app/api/uploads/token/route.ts", "src/app/api/clips/validate/route.ts"]) {
      assert.ok(read(p).includes("requireUser"), `${p} missing requireUser`);
    }
    // The gate lives in src/middleware.ts. A root middleware.ts was deleted on
    // purpose: this app uses src/app, and Next.js reads middleware.ts from the
    // repo root OR src/ — never both. The root copy was silently ignored, so the
    // gate did not run at all. Assert the path that Next actually executes.
    for (const p of ["src/middleware.ts", "src/lib/auth.ts", "src/app/login/page.tsx", "src/app/api/auth/login/route.ts", "src/app/api/auth/logout/route.ts", "src/lib/users.ts", "prisma/seed.mjs"]) {
      assert.ok(existsSync(join(ROOT, p)), `missing ${p}`);
    }
  });

  it("schema has FK indexes, state timestamps, and per-user credentials", () => {
    const schema = read("prisma/schema.prisma");
    assert.ok(schema.includes("passwordHash"), "User.passwordHash missing");
    const indexes = (schema.match(/@@index\(/g) || []).length;
    assert.ok(indexes >= 7, `expected >=7 @@index, found ${indexes}`);
    for (const m of ["MediaAsset", "ClipProject", "RenderJob"]) {
      const block = schema.slice(schema.indexOf(`model ${m}`), schema.indexOf(`model ${m}`) + 1200);
      assert.ok(block.includes("updatedAt"), `${m} missing updatedAt`);
    }
  });

  it("upload responses carry machine-readable storage state", () => {
    const src = read("src/app/api/uploads/route.ts");
    assert.ok(src.includes("stored"), "missing stored flag");
    assert.ok(!src.includes("stub: true"), "stub-that-looks-stored response must be gone");
  });
});
