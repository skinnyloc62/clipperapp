# API Contract — clip-mvp (Phase 1, Section 2)

Compatibility note for the frontend track: response shapes below are stable.
`POST /api/uploads` multipart still returns `{assetId, ...}`; the only change
is `stub:true` replaced by explicit `stored` + `status` fields.

## Auth

- `POST /api/auth/login {email, password}` → `{ok, userId, email}` + session cookie. 400 bad shape, 401 invalid credentials.
- `POST /api/auth/logout` → `{ok}`.
- All other `/api/*` require the session cookie (middleware redirects pages to
  `/login`, API routes return 401 JSON). Every protected handler re-verifies
  the sealed session via `requireUser()` — middleware presence is not trusted.

## Uploads (corrected for the 4.5MB function body limit)

- `POST /api/uploads/token {filename, contentType, size}` (auth) → issuance:
  - Blob configured: `@vercel/blob` client-upload handshake (size/type/quota
    enforced before AND inside `onBeforeGenerateToken`).
  - Local dev, no Blob: `{assetId, mode:"local-direct", uploadUrl:"/api/uploads", maxFunctionBytes:4500000}`.
  - No storage: 503 `{error, code:"blob_not_configured"}`.
  - 413 `{error, code:"too_large"}` over 500MB; 415 unsupported type.
- `POST /api/uploads` multipart `file` (auth) → local-dev persistence only:
  - 201 `{assetId, filename, bytes, blobUrl:null, stored:true, storage:"local-dev", status:"uploaded"}`.
  - 413 `{error, code:"use_client_upload", tokenUrl}` when the file exceeds the
    function payload cap or Blob/production mode is active.
  - `stored:false` never appears here (multipart either persists or rejects);
    token-flow records expose `stored` explicitly instead.

## Validation (filePath removed — asset IDs only)

- `POST /api/clips/validate {assetId}` (auth) → server resolves storage:
  - 200 `{assetId, stored:true, status:"validated", valid:true, durationSec, codec, width, height}`.
  - 422 `{assetId, stored:true, valid:false, reason}` — no video stream,
    unsupported codec, or duration out of range (0,600s]. Status flips to `invalid`.
  - 404 `{error:"unknown asset"}` (or another user's asset — same code, no oracle).
  - 409 `{error:"media not stored", stored:false}` — accepted but unpersisted.
  - 403 `{error, code:"path_escape"}` — stored file resolves outside the
    per-user allowlist (traversal/symlink).
  - 410 stored file missing; 503 storage unconfigured; 500 internal.
- Clients MUST NOT send paths. There is no path parameter in any route.

## Database / security posture (actual provider)

- Provider: Prisma ORM over Postgres (`DATABASE_URL` pooled, `DIRECT_URL` direct).
  Target is **Supabase managed Postgres** (dashboard or Vercel Marketplace), used
  as a plain database. **Neon is not used.** No `@supabase/*` package, no
  `supabase-js`, no Data API / PostgREST calls: the only client is Prisma.
- RLS: `prisma/rls-lockdown.sql` (`npm run db:rls`) enables row level security on
  all 7 tables with **zero policies** and revokes `anon` / `authenticated`. That
  closes Supabase's auto-exposed Data API, which nothing in this app uses.
  It is **not** an app-user boundary: the table owner role (Prisma's connection)
  bypasses RLS because `FORCE ROW LEVEL SECURITY` is deliberately not set, so
  per-user ownership still rests entirely on server-side code (`requireUser` +
  `userId`-scoped queries), and every route returns 404 — never 403 — for a
  foreign record. Proven locally 2026-11-16 with a throwaway non-owner role that
  held a SELECT grant: it read 2 rows before the script and 0 rows after, while
  the owner kept reading 2. Do not restate this as "RLS protects user data."

## Section 3 pipeline (implemented, code-complete)

- `POST /api/clips/cut {assetId, startSec, endSec}` (auth) → requires a
  validated asset with known duration (409 `needs_validation` otherwise);
  range must sit inside the duration and be ≤60s. Real FFmpeg trim,
  artifact probed before recording. 201 `{clipId, stored:true,
  status:"cut"}`. Local dev persists `.data/cuts/`; Blob mode uploads.
- `POST /api/transcript/highlights {clipId}` (auth) → deterministic stub
  candidates per the adopted rubric (weights 20/20/20/15/10/10/5, score =
  sum, ordered windows, rights `needs_review`). Every candidate re-validated;
  any violation fails the request. Real ASR replaces the generator only.
- `POST /api/renders/vertical {clipId}` (auth) → real FFmpeg center-crop
  9:16 + 1080x1920 + AAC, then machine QA per `render-qa.schema.json`:
  artifact/dimensions/stream/duration are PASS/FAIL on the real file;
  black-frame, safe-zone, branding, and loudness checks are honest
  NOT_TESTED. 201 `{renderId, status:"done", qa}` with `qa.status`
  PASS or REVISE.
- `GET/PUT /api/brand` (auth) → per-user profile (logo URL, hex color,
  caption style, watermark text), allowlisted by schema.
- `POST /api/approvals {clipId, decision}` (auth, owner-only) → approved |
  rejected. Approval unlocks download only; it is not publication and does
  not clear the rights review.
- `GET /api/downloads/[renderId]` (auth) → accepts `render_*` or `clip_*`
  ids; 404 for foreign or unapproved; 409 when unstored; Blob mode 302s to
  the URL (public store MVP — private stores move to server-mediated serving
  in Section 4); local dev streams the file as an attachment.
- New libs: `highlights.ts` (pure rubric math, functionally tested),
  `clips.ts` (dev clip/render/brand registries, owner-scoped),
  `assets.ts` (shared server-side asset resolution; validate keeps its proven
  copy — unify in 3b), `ffmpeg.ts` gains `trimFile`/`renderVertical`
  (args arrays, timeouts, no shell strings).

## Remote MCP — `POST /api/mcp` (Vercel-hosted, CLI clipping)

- Transport: Streamable HTTP, stateless per request (no session affinity,
  serverless-safe). POST JSON-RPC only; GET/DELETE are 405.
- Auth: `Authorization: Bearer <MCP_API_TOKEN>` (timing-safe compare) mapped
  to the single configured owner via `MCP_USER_EMAIL`. No cookies, no browser.
  Every tool call is owner-scoped exactly like the dashboard routes.
- 11 tools, same contracts as above, callable from any MCP-capable CLI:
  `clipengine_status`, `clipengine_ingest_url` (server fetches an authorized
  public URL — the CLI path for clipping, since a remote server cannot read
  the CLI machine's files), `clipengine_validate`, `clipengine_cut`,
  `clipengine_highlights`, `clipengine_render`, `clipengine_qa`,
  `clipengine_approve`, `clipengine_download`, `clipengine_brand_get`,
  `clipengine_brand_update`.
- Tool implementations live in `src/lib/mcp-tools.ts` (explicit userId, no
  Next runtime imports); the route only authenticates and registers.
- Client config (Codex CLI, on your machine — OAuth/browser step is yours):
  `codex mcp add clipengine --url https://<your-app>.vercel.app/api/mcp`
  plus a `Bearer <MCP_API_TOKEN>` header. Never commit the token.

## Deferred (not in this contract yet)

Real ASR transcription, brand overlay templates, multi-ratio exports,
scheduled publishing. Kick discovery/webhooks — Phase 2.
