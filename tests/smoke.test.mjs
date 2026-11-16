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

  it("dashboard shell exposes the core workflow areas", () => {
    // Section 1 shipped four placeholder cards on the home page. They were
    // replaced by the real command center, and Inbox/Editor/Approval became real
    // routes in the shell nav. Assert the shipped structure instead of the
    // scaffold copy it superseded.
    const shell = read("src/components/AppShell.tsx");
    for (const href of ['href: "/"', 'href: "/clips"', 'href: "/editor"', 'href: "/approvals"']) {
      assert.ok(shell.includes(href), `nav missing ${href}`);
    }
    assert.ok(read("src/app/page.tsx").includes("What is real on this screen"), "home must label demo vs real data");
  });

  it("sample fixture manifest exists", () => {
    assert.ok(existsSync(join(ROOT, "fixtures/sample-clip.json")));
  });
});
