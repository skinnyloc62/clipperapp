"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { HelpPanel } from "./PageHeader";

/* Real pipeline driver. Every action below calls the same endpoints the
   contract tests call — no mocks, no simulated progress, no timers faking
   work. Server responses are surfaced verbatim, failures included, so this
   screen can be read as evidence instead of decoration. */

type StepKey = "upload" | "validate" | "cut" | "render";
type StepStatus = "idle" | "running" | "done" | "error";
type Asset = { assetId: string; filename: string; bytes: number };
type Probe = { durationSec: number; codec: string; width: number; height: number };
type Cut = { clipId: string; startSec: number; endSec: number };
type QaCheck = { name: string; status: string; detail: string };
type Render = { renderId: string; qaStatus: string; checks: QaCheck[] };

const STEPS: { key: StepKey; label: string; route: string; blurb: string }[] = [
  {
    key: "upload",
    label: "Upload source",
    route: "POST /api/uploads",
    blurb: "Stores the bytes server-side and returns an asset ID. The browser never sends a path.",
  },
  {
    key: "validate",
    label: "Validate source",
    route: "POST /api/clips/validate",
    blurb: "Probes the stored file for codec, dimensions, and duration. Declared MIME type is ignored.",
  },
  {
    key: "cut",
    label: "Cut range",
    route: "POST /api/clips/cut",
    blurb: "Trims the validated source, then re-probes the output before the cut is recorded.",
  },
  {
    key: "render",
    label: "Render vertical",
    route: "POST /api/renders/vertical",
    blurb: "Center-crops to 9:16 at 1080 × 1920 and runs the machine QA gates on the finished file.",
  },
];

/* The multipart route caps request bodies below the function payload limit. */
const PAYLOAD_LIMIT_MB = 4.5;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function shortId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 18)}…` : id;
}

function clockNow(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

/* The API answers with `{error: string}`, a zod flatten object, or a reason.
   Pull whichever is present so the screen never shows a bare status code. */
function serverMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as Record<string, unknown>;
  const err = obj.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const field = Object.entries(flat.fieldErrors ?? {})[0];
    if (field && field[1]?.length) return `${field[0]}: ${field[1][0]}`;
    if (flat.formErrors?.length) return flat.formErrors[0];
  }
  if (typeof obj.reason === "string" && obj.reason.trim()) return obj.reason;
  if (obj.code === "use_client_upload") {
    return "This route requires direct browser-to-storage upload, which is not configured in this environment.";
  }
  return fallback;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(serverMessage(data, `request failed (HTTP ${res.status})`));
  return data as T;
}

export default function PipelinePanel({
  maxClipSec,
  maxUploadMb,
}: {
  maxClipSec: number;
  maxUploadMb: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [cut, setCut] = useState<Cut | null>(null);
  const [render, setRender] = useState<Render | null>(null);
  const [startSec, setStartSec] = useState("0");
  const [endSec, setEndSec] = useState("");
  const [status, setStatus] = useState<Record<StepKey, StepStatus>>({
    upload: "idle",
    validate: "idle",
    cut: "idle",
    render: "idle",
  });
  const [error, setError] = useState<{ step: StepKey; message: string } | null>(null);
  const [busy, setBusy] = useState<StepKey | null>(null);
  const [log, setLog] = useState<{ at: string; text: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopAt = useRef<number | null>(null);

  /* The object URL belongs to the selected file, not to the server copy. */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function note(text: string): void {
    setLog((prev) => [...prev.slice(-5), { at: clockNow(), text }]);
  }

  function mark(step: StepKey, next: StepStatus): void {
    setStatus((prev) => ({ ...prev, [step]: next }));
  }

  function pickFile(next: File | null | undefined): void {
    if (!next) return;
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setAsset(null);
    setProbe(null);
    setCut(null);
    setRender(null);
    setStatus({ upload: "idle", validate: "idle", cut: "idle", render: "idle" });
    setError(null);
    setStartSec("0");
    setEndSec("");
    setLog([{ at: clockNow(), text: `selected ${next.name} · ${formatBytes(next.size)}` }]);
  }

  function reset(): void {
    setFile(null);
    setPreviewUrl(null);
    setAsset(null);
    setProbe(null);
    setCut(null);
    setRender(null);
    setStatus({ upload: "idle", validate: "idle", cut: "idle", render: "idle" });
    setError(null);
    setStartSec("0");
    setEndSec("");
    setLog([]);
    stopAt.current = null;
  }

  /* Range problems are computed locally so the CTA can explain itself
     before a round trip. The server still enforces the same rule. */
  function cutProblem(): string | null {
    if (!probe) return "Validate the source before choosing a range.";
    const start = Number(startSec);
    const end = Number(endSec === "" ? probe.durationSec : endSec);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "Enter numeric seconds for both ends.";
    if (start < 0) return "Start must be zero or greater.";
    if (end <= start) return "End must be after start.";
    if (end > probe.durationSec + 0.05) return `End runs past the probed duration of ${probe.durationSec.toFixed(2)}s.`;
    if (end - start > maxClipSec) return `That range is ${(end - start).toFixed(2)}s — the cap is ${maxClipSec}s.`;
    return null;
  }

  async function runStep(step: StepKey): Promise<void> {
    if (busy) return;
    setError(null);
    setBusy(step);
    mark(step, "running");
    try {
      if (step === "upload") {
        if (!file) throw new Error("Choose a source file first.");
        if (file.size > PAYLOAD_LIMIT_MB * 1024 * 1024) {
          throw new Error(
            `This route caps multipart bodies at ${PAYLOAD_LIMIT_MB} MB and the file is ${formatBytes(file.size)}.`,
          );
        }
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) throw new Error(serverMessage(data, `upload failed (HTTP ${res.status})`));
        const assetId = String(data?.assetId ?? "");
        if (!assetId) throw new Error("upload returned no asset ID");
        setAsset({
          assetId,
          filename: String(data?.filename ?? file.name),
          bytes: Number(data?.bytes ?? file.size),
        });
        note(`upload 201 · ${assetId} · storage=${String(data?.storage ?? "unknown")}`);
        mark(step, "done");
        return;
      }

      if (step === "validate") {
        if (!asset) throw new Error("Upload the source first.");
        const data = await postJson<Record<string, unknown>>("/api/clips/validate", { assetId: asset.assetId });
        const durationSec = Number(data.durationSec);
        const next: Probe = {
          durationSec,
          codec: String(data.codec ?? "unknown"),
          width: Number(data.width ?? 0),
          height: Number(data.height ?? 0),
        };
        if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error("probe returned no duration");
        setProbe(next);
        setEndSec(String(Number(Math.min(durationSec, maxClipSec).toFixed(2))));
        note(`validate 200 · ${next.codec} ${next.width}×${next.height} · ${durationSec.toFixed(2)}s`);
        mark(step, "done");
        return;
      }

      if (step === "cut") {
        if (!asset) throw new Error("Upload the source first.");
        const problem = cutProblem();
        if (problem) throw new Error(problem);
        const start = Number(startSec);
        const end = Number(endSec === "" ? probe?.durationSec ?? 0 : endSec);
        const data = await postJson<Record<string, unknown>>("/api/clips/cut", {
          assetId: asset.assetId,
          startSec: start,
          endSec: end,
        });
        const clipId = String(data.clipId ?? "");
        if (!clipId) throw new Error("cut returned no clip ID");
        setCut({ clipId, startSec: start, endSec: end });
        note(`cut 201 · ${clipId} · ${start.toFixed(2)}s → ${end.toFixed(2)}s`);
        mark(step, "done");
        return;
      }

      if (!cut) throw new Error("Cut the source first.");
      const data = await postJson<Record<string, unknown>>("/api/renders/vertical", {
        clipId: cut.clipId,
        preset: "vertical-1080x1920",
      });
      const renderId = String(data.renderId ?? "");
      if (!renderId) throw new Error("render returned no render ID");
      const qa = (data.qa ?? {}) as { status?: string; checks?: QaCheck[] };
      setRender({
        renderId,
        qaStatus: String(qa.status ?? data.status ?? "unknown"),
        checks: Array.isArray(qa.checks) ? qa.checks : [],
      });
      note(`render 201 · ${renderId} · QA ${String(qa.status ?? "unknown")}`);
      mark(step, "done");
    } catch (err) {
      const message = (err as Error).message || "request failed";
      setError({ step, message });
      note(`${step} failed · ${message}`);
      mark(step, "error");
    } finally {
      setBusy(null);
    }
  }

  /* One CTA, always pointing at the first thing that is actually missing. */
  function nextStep(): StepKey | null {
    if (!asset) return "upload";
    if (!probe) return "validate";
    if (!cut) return "cut";
    if (!render) return "render";
    return null;
  }

  const ACTION: Record<StepKey, string> = {
    upload: "Upload source",
    validate: "Validate source",
    cut: "Cut range",
    render: "Render vertical",
  };

  const pending = nextStep();
  const problem = probe ? cutProblem() : null;

  function previewCut(): void {
    const video = videoRef.current;
    if (!video || !probe) return;
    const start = Number(startSec) || 0;
    const end = Number(endSec === "" ? probe.durationSec : endSec);
    video.currentTime = start;
    stopAt.current = Number.isFinite(end) ? end : null;
    void video.play().catch(() => undefined);
  }

  function onTimeUpdate(): void {
    const video = videoRef.current;
    if (!video || stopAt.current == null) return;
    if (video.currentTime >= stopAt.current) {
      video.pause();
      stopAt.current = null;
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_332px]">
        {/* ---------- Stage ---------- */}
        <section className="panel-3d overflow-hidden" aria-labelledby="stage-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="kicker">Stage</span>
              <span className="num text-[11px] text-[var(--faint)]">
                {file ? "Source preview" : "Target 1080 × 1920 · 9:16"}
              </span>
            </div>
            {file ? (
              <button
                type="button"
                onClick={reset}
                className="btn btn-quiet !h-7 whitespace-nowrap !px-2.5 !text-[11.5px]"
              >
                <Icon name="close" size={12} /> Clear
              </button>
            ) : null}
          </div>

          <div className="relative bg-black">
            {previewUrl ? (
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                playsInline
                onTimeUpdate={onTimeUpdate}
                className="mx-auto block max-h-[62vh] w-full bg-black object-contain"
              />
            ) : (
              <label
                htmlFor="source-file"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-4 px-6 py-14 text-center transition-colors sm:py-20 ${
                  dragging ? "bg-[var(--red-soft)]" : "bg-[#08080a]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="relative grid aspect-[9/16] h-32 place-items-center rounded-[6px] border border-dashed border-[var(--line-2)]"
                >
                  <Icon name="upload" size={18} />
                </span>
                <span className="block">
                  <span className="block text-[14px] font-medium text-[var(--text)]">
                    Drop a video, or choose a file
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-[var(--muted)]">
                    MP4, MOV, or WebM. This route accepts up to {PAYLOAD_LIMIT_MB} MB per request.
                  </span>
                </span>
              </label>
            )}
            <input
              id="source-file"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {/* Trim controls */}
          <div className="border-t border-[var(--line)] px-4 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <label className="block">
                  <span className="label mb-1.5 block">Start (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={startSec}
                    onChange={(e) => setStartSec(e.target.value)}
                    className="field !w-[104px] !py-2 num"
                  />
                </label>
                <label className="block">
                  <span className="label mb-1.5 block">End (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={endSec}
                    placeholder={probe ? probe.durationSec.toFixed(2) : "—"}
                    onChange={(e) => setEndSec(e.target.value)}
                    className="field !w-[104px] !py-2 num"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={previewCut}
                disabled={!probe}
                className="btn !h-9 !text-[12px]"
              >
                <Icon name="play" size={12} /> Preview range
              </button>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
              {probe
                ? `Source is ${probe.durationSec.toFixed(2)}s. Clip cap is ${maxClipSec}s. Bounds are re-checked on the server.`
                : "Validate the source first — the range is checked against the probed duration, not the container header."}
            </p>
            {problem ? (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--amber)]">{problem}</p>
            ) : null}
          </div>
        </section>

        {/* ---------- Controls ---------- */}
        <aside className="space-y-4">
          <section className="card p-4" aria-labelledby="action-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="action-heading" className="text-[13px] font-semibold text-[var(--text)]">
                Next action
              </h2>
              <span className={`chip ${pending ? "" : "chip-live"}`}>{pending ? "pending" : "complete"}</span>
            </div>

            {pending ? (
              <>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  {STEPS.find((s) => s.key === pending)?.blurb}
                </p>
                <button
                  type="button"
                  onClick={() => void runStep(pending)}
                  disabled={busy !== null || (pending === "cut" && problem !== null) || (pending === "upload" && !file)}
                  className="btn btn-primary mt-3.5 w-full"
                >
                  {busy === pending ? (
                    <>
                      <Icon name="clock" size={14} /> Working…
                    </>
                  ) : (
                    <>
                      <Icon name={pending === "upload" ? "upload" : pending === "render" ? "play" : "check"} size={14} />
                      {ACTION[pending]}
                    </>
                  )}
                </button>
                {pending === "upload" && !file ? (
                  <p className="mt-2 text-[11px] text-[var(--amber)]">Choose a file above to enable this step.</p>
                ) : null}
                {pending === "cut" && problem ? (
                  <p className="mt-2 text-[11px] text-[var(--amber)]">{problem}</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  The vertical render passed its machine checks. The file is stored on the server — this link streams it
                  back to you.
                </p>
                <a
                  href={render ? `/api/downloads/${render.renderId}` : "#"}
                  className="btn btn-primary mt-3.5 w-full"
                  download
                >
                  <Icon name="external" size={14} /> Download render
                </a>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="steps-heading">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <h2 id="steps-heading" className="text-[13px] font-semibold text-[var(--text)]">
                Pipeline
              </h2>
              <span className="num text-[11px] text-[var(--faint)]">4 stages</span>
            </div>
            <ol className="divide-y divide-[var(--line)]">
              {STEPS.map((step, i) => {
                const state = status[step.key];
                return (
                  <li key={step.key} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="num text-[10.5px] text-[var(--faint)]">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-[12.5px] font-medium text-[var(--text)]">{step.label}</span>
                      </div>
                      <span
                        className={`chip shrink-0 ${
                          state === "done" ? "chip-live" : state === "error" ? "chip-red" : state === "running" ? "chip-warn" : "chip-demo"
                        }`}
                      >
                        {state === "idle" ? "queued" : state}
                      </span>
                    </div>
                    <p className="num mt-1.5 truncate text-[10.5px] text-[var(--faint)]">{step.route}</p>
                    {state === "done" ? (
                      <p className="mt-1 truncate text-[10.5px] text-[var(--muted)]">
                        {step.key === "upload" && asset
                          ? `${asset.assetId} · ${formatBytes(asset.bytes)}`
                          : step.key === "validate" && probe
                            ? `${probe.codec} · ${probe.width}×${probe.height} · ${probe.durationSec.toFixed(2)}s`
                            : step.key === "cut" && cut
                              ? `${cut.clipId} · ${(cut.endSec - cut.startSec).toFixed(2)}s`
                              : step.key === "render" && render
                                ? `${render.renderId} · QA ${render.qaStatus}`
                                : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          {error ? (
            <div role="alert" className="card border-[var(--red-line)] bg-[var(--red-soft)] p-4">
              <div className="flex items-center gap-2">
                <Icon name="info" size={14} />
                <span className="text-[12px] font-semibold text-[var(--text)]">Step failed: {error.step}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{error.message}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
                This is the server&apos;s own message. Nothing was simulated — fix the cause and run the step again.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      {render ? (
        <section className="card" aria-labelledby="qa-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <h2 id="qa-heading" className="text-[13px] font-semibold text-[var(--text)]">
              Render QA
            </h2>
            <span className={`chip ${render.qaStatus === "PASS" ? "chip-live" : "chip-warn"}`}>{render.qaStatus}</span>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {render.checks.map((c) => (
              <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="num text-[11.5px] text-[var(--text)]">{c.name}</span>
                <span
                  className={`chip ${
                    c.status === "PASS" ? "chip-live" : c.status === "FAIL" ? "chip-red" : "chip-demo"
                  }`}
                >
                  {c.status}
                </span>
                <span className="w-full text-[11px] leading-relaxed text-[var(--faint)]">{c.detail}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-[var(--line)] px-4 py-3 text-[11px] leading-relaxed text-[var(--faint)]">
            NOT_TESTED is recorded honestly: those gates need frame inspection that this build does not run yet. It is
            not a pass.
          </p>
        </section>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card" aria-labelledby="log-heading">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <h2 id="log-heading" className="text-[13px] font-semibold text-[var(--text)]">
              Activity
            </h2>
            <span className="num text-[11px] text-[var(--faint)]">{log.length} entries</span>
          </div>
          {log.length === 0 ? (
            <p className="px-4 py-5 text-[12px] leading-relaxed text-[var(--muted)]">
              Nothing has run yet. Each entry below is written from a real response, never from a timer.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {log.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="flex items-baseline gap-3 px-4 py-2">
                  <span className="num shrink-0 text-[10.5px] text-[var(--faint)]">{entry.at}</span>
                  <span className="min-w-0 break-words text-[11.5px] leading-relaxed text-[var(--muted)]">{entry.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <HelpPanel
          title="How this pipeline runs"
          items={[
            {
              label: "Local only",
              body: "This build stores media on the machine running the dev server and shells out to FFmpeg. On a serverless host neither exists, so the same buttons report that instead of pretending to work.",
            },
            {
              label: "Order matters",
              body: "Upload → validate → cut → render. Validation probes the actual bytes, so a .mp4 that is really another container is rejected before any trimming.",
            },
            {
              label: "Limits",
              body: `One request may carry up to ${PAYLOAD_LIMIT_MB} MB here, and a clip may span at most ${maxClipSec}s. The app-wide limit is ${maxUploadMb} MB, which needs direct-to-storage upload.`,
            },
            {
              label: "Download",
              body: "The render is downloadable without an approval step. Clip previews are gated — an unapproved clip intentionally answers 404 rather than confirming it exists.",
            },
          ]}
        />
      </div>
    </div>
  );
}
