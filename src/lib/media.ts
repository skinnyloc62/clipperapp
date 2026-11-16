import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_UPLOAD_MB } from "./validators";

export interface FetchedMedia {
  tmpPath: string;
  bytes: number;
  contentType: string | null;
}

/**
 * Worker-style fetch: download an authorized Blob URL to /tmp for
 * FFprobe/FFmpeg processing. Enforces size cap and timeout so a hostile
 * or corrupt object cannot exhaust disk or hang the function.
 */
export async function fetchBlobToTmp(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchedMedia> {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_MB * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  // Blob URLs are server-set (never client input), but enforce https anyway.
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("refusing non-https media URL");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) {
      throw new Error(`fetch failed: HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type");
    const tmpPath = join(tmpdir(), `clipmvp_${randomUUID()}.bin`);
    const { createWriteStream } = await import("node:fs");
    let bytes = 0;
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(tmpPath);
      const reader = res.body!.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          out.end();
          return;
        }
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          out.destroy();
          reject(new Error(`object exceeds ${maxBytes} byte cap`));
          return;
        }
        if (!out.write(value)) {
          await new Promise<void>((r) => out.once("drain", r));
        }
        await pump();
      };
      out.on("error", reject);
      out.on("finish", () => resolve());
      pump().catch(reject);
    });
    return { tmpPath, bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}
