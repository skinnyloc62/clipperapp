// Section 3 route contracts — static assertions (handlers need Next runtime).
// Complements functional scoring tests: every pipeline route must be authed,
// nodejs-pinned, and free of client-controlled paths.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const ROUTES = [
  "src/app/api/clips/cut/route.ts",
  "src/app/api/transcript/highlights/route.ts",
  "src/app/api/renders/vertical/route.ts",
  "src/app/api/brand/route.ts",
  "src/app/api/approvals/route.ts",
  "src/app/api/downloads/[renderId]/route.ts",
];

describe("section 3 pipeline routes", () => {
  it("all six routes exist and are auth-gated nodejs handlers", () => {
    for (const p of ROUTES) {
      assert.ok(existsSync(join(ROOT, p)), `missing ${p}`);
      const src = read(p);
      assert.ok(src.includes("requireUser"), `${p} missing requireUser`);
      assert.ok(src.includes('runtime = "nodejs"'), `${p} must pin nodejs runtime`);
    }
  });

  it("no client-controlled paths in cut/render/validate", () => {
    for (const p of ["src/app/api/clips/cut/route.ts", "src/app/api/renders/vertical/route.ts", "src/app/api/clips/validate/route.ts"]) {
      assert.ok(!read(p).includes("filePath"), `${p} still accepts client filePath`);
    }
    assert.ok(read("src/lib/assets.ts").includes("path_escape"), "shared resolver missing escape guard");
  });

  it("cut enforces validation-first and in-duration ranges", () => {
    const src = read("src/app/api/clips/cut/route.ts");
    assert.ok(src.includes("needs_validation"), "cut must require validated asset");
    assert.ok(src.includes("outside asset duration"), "cut must bound range to duration");
    assert.ok(src.includes("trimFile"), "cut must use the shared trim helper");
    assert.ok(src.includes("probeFile"), "cut must verify the trimmed artifact");
  });

  it("render records machine QA with honest NOT_TESTED gates", () => {
    const src = read("src/app/api/renders/vertical/route.ts");
    assert.ok(src.includes("dimensions_1080x1920"), "QA must check output dimensions");
    assert.ok(src.includes("NOT_TESTED"), "unimplemented checks must be NOT_TESTED, never PASS");
    assert.ok(src.includes("renderVertical"), "render must use the shared vertical helper");
  });

  it("downloads require ownership and approval for clips", () => {
    const src = read("src/app/api/downloads/[renderId]/route.ts");
    assert.ok(src.includes('startsWith("clip_")'), "clip download path missing");
    assert.ok(src.includes("approved"), "clip downloads must require approval");
    assert.ok(!src.includes("unlink"), "download must never delete");
  });

  it("brand profile fields are allowlisted by schema", () => {
    const src = read("src/lib/validators.ts");
    assert.ok(src.includes("brandSchema") && src.includes("watermarkText"), "brand schema missing");
    assert.ok(src.includes("approvalSchema") && src.includes("renderSchema"), "approval/render schemas missing");
  });
});
