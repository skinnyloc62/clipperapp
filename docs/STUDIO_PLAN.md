# Hosted and Mac studio plan — 2026-11-16

## Goal

The household can upload a long video from Vercel on a laptop or iPhone,
select a short moment, receive a real vertical edit, preview it, approve or
deny it, and optionally add owned music. Electron offers the same review
decision and finishing controls for clips saved on the Mac.

## Files and steps

1. **Cloud upload and queue.** Extend `prisma/schema.prisma`; add
   `src/app/api/studio/{intent,blob,complete,submit,title}` and
   `src/components/HostedEditor.tsx`. Verify an actual browser upload creates a
   MediaAsset row, a queued job, and a bad or oversized upload is rejected.
2. **Mac render worker.** Add `scripts/studio-worker.mjs`, configured by a
   private env file and LaunchAgent. Verify a real queued source produces wide
   and 1080×1920 Blob files, a saved transcript, and a reviewable job row.
3. **Review decisions.** Wire `src/app/approvals/page.tsx`, `ClipDecision`, and
   `src/app/api/approvals/route.ts`. Verify approved clips appear in `/clips`,
   denied clips leave the queue, and unfinished clips cannot be approved.
4. **Actual captions, title, optional music.** Use local Whisper and the
   installed FFmpeg/ImageMagick tools in the worker and Electron finishing
   route. Verify rendered pixels contain caption overlays, music is only added
   when selected, and the title can be edited before approval. If speech is
   unclear, preserve the clip and disclose that captions were not applied.
5. **Full workspace navigation.** Show all seven pages on Vercel; Command
   Center uses real cloud counts, Editor and Approvals perform work, Live Radar
   states that recording is Mac-only, Earnings stays empty until a payout
   source exists, and Settings shows real configuration booleans. Verify menu
   and routes on desktop and mobile.
6. **Live stop and release.** Make an existing empty `channels.json` stay empty
   in `scripts/watch.mjs`; verify zero active recording after the owner removes
   Dean. Run TypeScript, tests, Next build, Electron package, real HTTP and
   media QA. Commit and push to `main` after checks; verify stable production
   URL and update `HANDOFF.md`, `docs/PROGRESS.md`, and JARVIS journal.

## Risks and limits

- Vercel Blob and Neon are already connected. R2 is optional for later cost
  tuning; it is not required to make this workflow work.
- Mac processing needs the Mac awake and network-connected. Vercel does not
  run FFmpeg. A separate cloud worker would remove that dependency later.
- One selected clip is at most 60 seconds, even when the source is long. This
  is clip extraction, not a multi-track timeline editor.
- Speech transcription and generated titles require owner review. Do not
  call a title or caption accurate solely because a model produced text.
- The installed FFmpeg lacks `subtitles` and `drawtext` filters; caption text
  must be rendered as PNG overlays with ImageMagick, then composited by FFmpeg.
- Blob media URLs are public if someone obtains a direct URL. Auth protects
  the app's pages and decisions, not the Blob URL itself.

## Verification gate

Proof requires a real browser upload, a real worker render, video frames with
caption pixels, approval/denial HTTP results, local Electron review, all seven
hosted routes, and clean build/test outputs. Any skipped check stays marked
unverified in the final report.
