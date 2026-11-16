# Street Ethics Clip Engine — Frontend Design System & Integration Spec

Owner: frontend track. Backend track (Muse) owns all API behavior and DB.
Rule: never change an API contract here — confirm it against the scaffold, then design to it.

## 1. Scaffold review (read 2026-11-16, Section 1 only)

Entry: [page.tsx](../src/app/page.tsx) renders four labeled placeholders
(Overview, Inbox, Editor, Approval). No data wiring yet — correct for Section 1.

Contracts confirmed against real code:
- `POST /api/uploads` (multipart `file`) → `{ assetId, filename, bytes, blobUrl: null, stub: true }`. Rejects non-video with 415, oversize with 413. No persistence yet.
- `POST /api/clips/validate` (`{ assetId, filePath? }`) → real ffprobe result when `filePath` exists locally, else `{ valid: true, stub: true }`. 400 on bad shape, 422 on invalid media.
- Validators (`src/lib/validators.ts`): video mime allowlist, 500MB default cap, 60s default clip cap, `endSec > startSec` enforced.
- Schema (`prisma/schema.prisma`): User, BrandSetting, MediaAsset, ClipProject, Transcript, RenderJob, ProcessingLog. DB not connected yet.
- Smoke suite: 5 pass / 0 fail. Fixture: 30.0s h264/aac 1280x720.

## 2. Audit findings (scaffold scope, ranked)

- High — `src/app/api/clips/validate/route.ts:25`: `filePath` accepts any absolute path and `existsSync`/`probeFile` follows it. Local-only today, but this becomes arbitrary-file-read when deployed. Fix (backend): restrict to an allowlisted dir (`/tmp` uploads + fixtures) and reject everything else with 403.
- Medium — `src/lib/validators.ts:28`: `isVideoMime` allows `application/octet-stream`, so the 415 gate is permeable to non-video bytes. Fix (backend): sniff magic bytes or ffprobe the content before accepting.
- Medium — Upload stub returns `blobUrl: null` with 200. Frontend must treat `blobUrl: null` as "accepted, not stored" and never render a player for it. Contract note, not a backend bug at this stage.
- Low — Dashboard cards use a single radius and one neutral palette with no type hierarchy yet. The premium pass (below) introduces hierarchy without touching backend.
- Clean: zod validation on both routes, `runtime = "nodejs"` pinned, no secrets in `.env.example`, smoke test covers the contract. No invented problems beyond the above.

## 3. Visual direction (dark gaming-media console)

- Backgrounds: near-black `#0a0a0b` app, charcoal `#131316` panels, subtle gray `#26262b` borders. No gradients-as-identity, no glow-everywhere, no glassmorphism stacking.
- Accent: Street Ethics red, used sparingly — live badges, primary actions, active states. Status colors: green live, amber processing, red failed.
- Type: one grotesk for display, system stack for body, tabular numerals for timestamps and scores. Clear hierarchy: 28px view title, 15px section heads, 13px body, 12px metadata.
- Motion: instant state changes, single 150ms ease on hover only, full `prefers-reduced-motion` support. No scroll-in choreography.

## 4. Component specs (frontend-owned, `src/components/`)

Priority order: Live Radar, Clip Inbox, Video Editor, Approval Queue, System Status. Naming matches backend contracts so integration is mechanical later.
- `StreamerCard`: channel name, title, thumbnail, viewers, category, live/offline badge, watchlist toggle, open-stream link, recent alerts. Props: streamer object + `onWatchlistToggle`. Empty state: "No streamers monitored yet."
- `ClipOpportunityCard`: streamer, source URL, event time UTC, score with reason breakdown, media badge (`available` | `needs_media`), preview or upload CTA. Never renders a player when media is absent.
- `EditorPanel`: preview, play/pause/scrub, start/end trim inputs bound to `cutSchema` limits, caption list editor, layout preset select, brand controls, render button. Every control writes real local state; anything awaiting a backend route shows "pending" text, never a fake success.
- `ApprovalBar`: approve / reject / request-revision, each with loading, success, and error states. Only approved clips expose download.
- `StatusStrip`: monitored count, live count, detected moments, awaiting media, processing, awaiting approval, exported, errors. Every number binds to API data or is labeled demo.

## 5. Responsive and a11y floor

- Desktop 3-column radar grid → tablet 2-column → mobile single column, no horizontal scroll. Touch targets 44px minimum. Contrast 4.5:1 body, 3:1 large text. Full keyboard path: tab order, visible focus, aria labels on players and dialogs. Loading, empty, error, and saved states for every mutation.

## 6. Isolation and handoff

- This doc is the only frontend-track file until Phase 1 APIs land. No backend files touched, no contracts changed.
- Mock data lives in `src/mocks/` only, every mock badge labeled DEMO.
- When Phase 1 + Phase 2 complete, build the five priority views against the real endpoints, then run the full audit prompt: integration, security, end-to-end upload-to-MP4, and the final report with verified / broken / fixed / simulated-only / not-tested splits.
