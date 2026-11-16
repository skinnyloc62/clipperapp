# Build Status — clip-mvp Phase 1

Goal acceptance path: upload -> validate -> cut -> stub highlights -> brand ->
stub vertical render -> approve -> download, one 30s MP4, no manual DB edits.

Repo: `/Users/homegrownentllc/clip-mvp/` (fresh `git init`, greenfield).

> **Current state, 2026-11-16 — read [`docs/PROGRESS.md`](docs/PROGRESS.md) first.**
> Access-code login is live at <https://clip-mvp.vercel.app> (`d614ff1`), and the
> full pipeline has been proven end-to-end against a **real live Kick stream**:
> upload → validate → cut → vertical render (QA PASS) → download, producing a
> 1080×1920 h264/aac artifact verified non-black with the streamer's watermark
> visible. There is **no AI in this codebase** — cutting and reframing are ffmpeg,
> and highlight selection is still `stubCandidates()`. See PROGRESS.md §3 for
> what models would actually be needed and why Claude/ChatGPT are not required.

## Toolchain (verified 2026-11-16)

| Tool | Version | Status |
| ---- | ------- | ------ |
| node | v26.3.1 | verified |
| npm | 11.16.0 | verified |
| ffmpeg + ffprobe | 8.1.2 (Apple clang 21) | verified |
| git | 2.50.1 Apple Git-155 | verified |
| WhisperX / PySceneDetect / Auto-Editor / Remotion | — | NOT present; excluded from scaffold deps |

## Env checklist

`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `APP_PASSWORD`, `STORAGE_DRIVER`
(`local`), `FFMPEG_PATH`/`FFPROBE_PATH` overrides, `MAX_UPLOAD_MB=500`,
`MAX_CLIP_SEC=60` — all documented in `.env.example` (no secrets committed).

## Database provider (decided: Supabase Postgres)

Prisma ORM + Supabase Postgres via `DATABASE_URL` (pooled, 6543) with
`DIRECT_URL` (direct, 5432) for migrations. Owner uses Supabase as their SQL
database — Neon is out. Tables are accessed through Prisma with a direct
role that bypasses RLS, so ownership is enforced server-side
(`requireUser` + `userId`-scoped queries); RLS must not be claimed as
protection without a test proving the connection role is restricted.
See [API contract](docs/API_CONTRACT.md).

## Section tracker

- [x] **Section 1 — scaffold** (done, verified): Next.js App Router + Tailwind
  skeleton, dashboard shell, sample fixture + smoke test (5/5 pass), ffprobe
  fixture 30.0s h264/aac. Upload/validate were stubs.
- [in progress] **Section 2 — storage + persistence**:
  - [x] Schema pass: `User.passwordHash` (scrypt, independent logins), `updatedAt`
    on MediaAsset/ClipProject/RenderJob, `@@index` on all FKs + status columns.
  - [x] Upload architecture fix: 4.5MB function cap, `POST /api/uploads/token`
    (Blob client-upload handshake w/ pre-token policy checks), multipart kept
    for local dev only. `blobUrl:null` stub-that-looks-stored removed —
    responses carry `stored` + `status`.
  - [x] `filePath` removed everywhere: validate takes `{assetId}`, resolves
    server-side with ownership scoping, realpath containment (traversal +
    symlink escape → 403), codec allowlist + duration-range content checks via
    ffprobe (MIME never trusted), invalid media flips status.
  - [x] Auth: iron-session login/logout, per-user scrypt passwords, seed script
    (Prisma when `DATABASE_URL`, else `.data/users.json` dev store), middleware
    gate + per-route `requireUser`.
  - [x] Boot evidence (this session): `npm install` exit 0; `npm test`
    12/12 pass exit 0; `npm run build` success (all 7 routes compiled);
    `npx prisma generate` exit 0; `npx prisma validate` fails ONLY on missing
    `DATABASE_URL` (P1012 env, not a schema error); `npm run db:seed` created
    2 dev users; 5.9MB test fixture generated (over the 4.5MB function cap).
  - [ ] Live HTTP checks (BLOCKED by sandbox: `listen EPERM`, no sockets;
    run on your machine): `npm run dev`, then login → upload small file (201
    `stored:true`) → upload 5.9MB file (413 `use_client_upload`) → token
    issuance (200 local-direct) → validate (200 `validated`) → foreign asset
    (404) → traversal attempt (no path param exists; 404). See README.
  - [ ] Supabase: provision project → `DATABASE_URL`/`DIRECT_URL` → `db push` + `db:seed` (BLOCKED: needs your Supabase project + `vercel env pull`). Neon is out — Supabase is the database.
- [x] **Section 3 — pipeline** (code-complete, live HTTP pending): cut persistence, transcript/highlight scoring per adopted rubric, vertical render + machine QA, brand routes, approval gate, authenticated downloads. Real FFmpeg evidence on fixture (15s trim + 1080x1920 render, both probed). Full suite 29/29 pass (incl. 4 MCP + scoring tests); build green with `/api/mcp` compiled.
- [x] **Section 4 (routes) — brand + approval + downloads**: API routes done (pending live test); remaining is premium UI wiring (ChatGPT High track) + private-store server-mediated downloads.
- [x] **Remote MCP for CLI clipping**: `POST /api/mcp`, Streamable HTTP stateless, Bearer → owner mapping, 11 tools sharing dashboard contracts. Build lists `/api/mcp`. Client: add MCP with deployment URL + token on your machine.
- [x] **Dashboard wired to real components** (was Section 1 shell): Overview StatusStrip, Live-radar StreamerCards, Inbox ClipOpportunityCards, all DEMO-labeled; Editor/Approval sections point at the API until frontend panels land. Tests 29/29, build green.
- [ ] **Confirm on DeepSeek's localhost** (waiting on their machine): (1) restarted dev shows cards not placeholders; (2) logged-out `/` redirects to `/login` (middleware gate); (3) README HTTP sequence codes.
- [ ] **Section 5 — deploy + acceptance**: `vercel deploy`, 30s MP4 end-to-end on Vercel URL.

## Dependency upgrades (2026-11-16, user-approved, no blind --force)

- `next` 15.1.6 → 15.5.29 (latest patched 15.x, stays on Next 15 architecture).
  Tests 12/12 pass, production build green, all 7 routes compiled.
- `@vercel/blob` 0.27.0 → 2.9.0 (supported v2 line). Compat verified against
  installed types: `handleUpload` + `HandleUploadBody` protocol unchanged,
  `onBeforeGenerateToken(pathname, clientPayload)` signature intact,
  `head`/`del` still exported. Token route needed zero logic changes after the
  earlier `NextResponse.json` correction. Tests 12/12, build green.
- Remaining `npm audit`: 6 advisories (1 moderate, 5 high), all transitive and
  fixable only via breaking `--force` majors (postcss chain under next,
  zod under `@vercel/cli-config`). No direct vulnerable dependency remains in
  our declared range. Previous critical Next RCE/dev-server items and the
  Blob 0.x undici/busboy chain are resolved by these upgrades.
- Setup guide for Neon + private Blob: [docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md).
  Private store means `/api/downloads` must move to server-mediated serving
  (Section 4) instead of 302-redirect.

## Adopted skill-pack specs (2026-11-16, user-supplied, read-only copies)

- Source: `Downloads/street-ethics-clip-engine/` (the two same-named folders
  are byte-identical; the `.skill` zip is the same pack — folders used, no
  double import). Nothing executed from the pack; code copied: none.
  Only spec documents adopted.
- Adopted into `docs/reference/`: `clip-candidate.schema.json`,
  `render-qa.schema.json`, `HIGHLIGHT_RANKER.md` (hook 20/clarity 20/payoff 20/
  novelty 15/emotion 10/fit 10/technical 5 = 100, editorial not probability),
  `RENDER_CHAIN.md` (worker pipeline, edit-decision-list timing rule, QA gates).
  Sample: `fixtures/sample-candidate.json` (labeled illustrative, not real media).
- `MASTER_CODEX_PROMPT (1).md` matches the pack's `MASTER_CODEX_PROMPT.md`
  (same 14KB); the duplicate folder and zip add nothing new.
- Kick cross-check: pack confirms our Phase 2 route list (v2 discovery,
  users/livestreams watchlist, public-key webhooks, deprecated v1 list, Drops
  unrelated, no public clip create/download API). Matches API_CONTRACT posture.
- New lock: `tests/section3-contract.test.mjs` — sample obeys schema
  (score = breakdown sum, ordered window, QA enum closed). Suite now 15/15.
  Section 3 scoring/render code must emit rows satisfying these invariants.

## Known limits / flags

- API routes pinned `runtime = "nodejs"` (never edge — FFmpeg/Node APIs).
- Serverless writable dir is `/tmp` only; no cross-invocation memory cache.
- `vercel.json` function `maxDuration: 60` — Hobby-plan safe (300s needs Pro).
- Heavy FFmpeg/Whisper work belongs off-serverless in P2+ (worker + queue).
- Schema note: model names follow the Phase 1 entity list
  (`brand_settings`, `clip_projects`, `transcripts`, `render_jobs`,
  `processing_logs`); the Drizzle names from the synthesis ref
  (`brand_profiles`, `clips`, `clip_highlights`, `renders`) map 1:1 and are
  noted in `prisma/schema.prisma`.
