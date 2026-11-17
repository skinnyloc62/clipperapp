/** Render a short, owner-edited hook in the opening seconds of a vertical clip. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);

export function wrapTitle(raw) {
  const words = String(raw || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ").slice(0, 100).split(" ").filter(Boolean);
  const lines = [];
  for (const word of words) {
    if (!lines.length || `${lines.at(-1)} ${word}`.length > 27) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines.slice(0, 4).join("\n");
}

export async function makeTitleCard(title, dir) {
  const text = wrapTitle(title);
  if (!text) return null;
  const output = join(dir, "title-card.png");
  await run(process.env.MAGICK_PATH || "/opt/homebrew/bin/magick", [
    "-size", "980x350", "xc:none",
    "-fill", "rgba(10,10,16,0.78)", "-draw", "roundrectangle 12,28 968,322 30,30",
    "-fill", "#ef3434", "-draw", "roundrectangle 42,28 938,37 4,4",
    "-font", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "-pointsize", "54", "-gravity", "center", "-fill", "white", "-stroke", "black",
    "-strokewidth", "3", "-annotate", "+0+0", text,
    "-depth", "8", "-define", "png:color-type=6", output,
  ], { timeout: 30_000, maxBuffer: 1024 * 1024 });
  return output;
}
