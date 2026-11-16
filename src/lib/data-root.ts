import { realpathSync } from "node:fs";
import { join } from "node:path";

/**
 * Root directory for everything this app writes to local disk: uploads, cuts,
 * renders, the JSON fallback store, and the dev user file.
 *
 * Default is `<cwd>/.data`, which is what `next dev` has always used. The
 * packaged Electron build overrides it via `CLIPMVP_DATA_DIR` pointing at
 * `~/Library/Application Support/Street Ethics Clipper/data`, because a `.app`
 * bundle is read-only — writing inside it fails at runtime.
 */
export function dataRoot(): string {
  const override = process.env.CLIPMVP_DATA_DIR;
  if (override && override.trim().length > 0) return override;
  return join(process.cwd(), ".data");
}

/** Join segments onto the data root. */
export function dataPath(...segments: string[]): string {
  return join(dataRoot(), ...segments);
}

/**
 * `realpathSync` that falls back to the input when the path does not exist yet.
 *
 * Path-containment checks compare a resolved file against a resolved root. On
 * macOS `~/Library/Application Support` is real, but temp dirs live behind the
 * `/var` → `/private/var` symlink, so resolving only one side of the comparison
 * would wrongly reject legitimate files.
 */
export function safeRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
