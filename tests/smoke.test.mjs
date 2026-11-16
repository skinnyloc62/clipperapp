// Section 1 smoke test — no dependencies, runs with `npm test` (node --test).
// Asserts the scaffold contract: schema models, env keys, routes, placeholders.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

describe("section 1 scaffold", () => {
  it("prisma schema covers all Phase 1 entities", () => {
    const schema = read("prisma/schema.prisma");
    for (const model of [
      "model User",
      "model BrandSetting",
      "model MediaAsset",
      "model ClipProject",
      "model Transcript",
      "model RenderJob",
      "model ProcessingLog",
    ]) {
      assert.ok(schema.includes(model), `missing ${model}`);
    }
  });

  it(".env.example documents required keys without secrets", () => {
    const env = read(".env.example");
    for (const key of [
      "DATABASE_URL",
      "BLOB_READ_WRITE_TOKEN",
      "APP_PASSWORD",
      "STORAGE_DRIVER",
      "MAX_UPLOAD_MB",
      "MAX_CLIP_SEC",
    ]) {
      assert.ok(env.includes(key), `missing ${key}`);
    }
    assert.ok(!/sk-|live_|AKIA/.test(env), "looks like a real secret");
  });

  it("upload + validate routes exist and run on nodejs", () => {
    for (const route of ["src/app/api/uploads/route.ts", "src/app/api/clips/validate/route.ts"]) {
      assert.ok(existsSync(join(ROOT, route)), `missing ${route}`);
      assert.ok(read(route).includes('runtime = "nodejs"'), `${route} must pin nodejs runtime`);
    }
  });

  it("dashboard shell has all four placeholders", () => {
    const page = read("src/app/page.tsx");
    for (const section of ["Overview", "Inbox", "Editor", "Approval"]) {
      assert.ok(page.includes(section), `missing ${section} placeholder`);
    }
  });

  it("sample fixture manifest exists", () => {
    assert.ok(existsSync(join(ROOT, "fixtures/sample-clip.json")));
  });
});
