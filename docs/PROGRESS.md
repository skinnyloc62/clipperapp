# Progress — where this project actually stands

Last updated 2026-11-16. This file is the resumable state. If you are an agent
picking this up cold, read this first, then `BUILD_STATUS.md`, then
`JARVIS/.progress/journal.md`.

Live: <https://clip-mvp.vercel.app> · Repo: `/Users/homegrownentllc/clip-mvp`
Local pipeline: <http://localhost:3000/editor>

---

## 1. What works right now (verified, not assumed)

### Access-code login — SHIPPED
Commit `d614ff1`, pushed to `skinnyloc62/clipperapp`, deployed by Vercel.

| Check | Result |
| --- | --- |
| anonymous `GET /` | `307` → `/login` |
| `GET /login` | `200` |
| wrong code | `401` |
| correct code | `200 {"ok":true,"userId":"household","mode":"access-code"}` + `clipmvp_session` |
| all 7 pages when authed | `200` (`/`, `/clips`, `/editor`, `/radar`, `/settings`, `/approvals`, `/earnings`) |
| 6th wrong code in a row | `429` + `Retry-After: 900` (`src/lib/rate-limit.ts`) |

Code lives in `~/.clip-mvp-access-code.txt` (mode `600`). It is **not** in git
and **not** in this file. Sessions last 7 days.

The code is now a 6-digit PIN, which is only 10^6 guesses, so the login route got
a brake in the same change: `src/lib/rate-limit.ts` allows **5 failures per 15
minutes per client IP** and then returns `429` with `Retry-After`. A success
clears the counter, so a correct code is never delayed and typos don't stick.
Counters are per-process memory, so this raises the cost of an attack rather than
making it impossible — a Vercel Firewall rate rule is the durable backstop.

Three real bugs were fixed to get here:

1. `verifyAppPassword()` existed in `src/lib/auth.ts` but was never called —
   the access-code path had been written and never wired.
2. `SESSION_SECRET` and `APP_PASSWORD` were absent from every Vercel
   environment, so no login could ever have succeeded in production.
3. `middleware.ts` sat at the repo root, but this app uses `src/app/`, so
   Next.js ignored it entirely. The gate gated nothing. It now lives at
   `src/middleware.ts`, where Next actually reads it.

### Real live-stream capture — PROVEN against Kick
Channel `deenthegreat`, live mid-session (15,834 viewers, *"IRL GTA DAY 4 IN
MIAMI"*). Captured 12s of the actual feed at 1920×1080 h264/aac, then
transcoded to 1.55 MB to fit under the 4.5 MB serverless upload cap.

### Full pipeline end-to-end on that real stream — PROVEN

```
1 login            200  {"ok":true,"userId":"household","mode":"access-code"}
2 upload           201  asset_8e0e58ae… 1,547,637 bytes  stored=True
3 validate         200  valid=True  h264  1280x720  12.033s
4 cut              201  clip_f526bc58…  [0s, 10s)
5 render vertical  201  render_9e0090c9…  QA=PASS
     PASS  artifact_exists          render completed without ffmpeg error
     PASS  dimensions_1080x1920     got 1080x1920
     PASS  has_video_stream         codec=h264
     PASS  duration_positive        duration=10.005s
     NOT_TESTED  no_leading_black_frames
     NOT_TESTED  caption_safe_zones
     NOT_TESTED  branding_overlay
     NOT_TESTED  loudness_target
6 download         200  → 4,863,925 bytes
```

The downloaded artifact, probed independently of the app:
**1080×1920, h264+aac, 10.005s, 4.86 MB.** Black-frame detection found
**0 black segments**; mean luma ~75 with real saturation, so it is picture,
not a black rectangle. A still frame pulls the on-screen watermark
**"DENN THE GREAT"** — it is genuinely his stream.

### Verifiers
- `verify-all.py` — **18/18** exit 0 (anon-redirect check tightened to strict `307`)
- `contracts.py` — **21/21** exit 0
- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0, output lists `ƒ Middleware` (gate compiles in)

---

## 2. What is NOT built — say this plainly

**There is no AI in this codebase.** `grep` for `openai|anthropic|claude|gpt-|
gemini|whisper` across `src/`, `prisma/`, `package.json` returns nothing.
`/api/transcript/highlights` calls `stubCandidates()` — deterministic
placeholder windows. It does not listen to the audio and cannot tell a good
moment from a boring one.

So the pipeline you have is a **precision media machine, not an editor**. It
cuts and reframes exactly where you tell it. Choosing *what* to clip is still
a human decision.

Also true:
- Cutting and the 9:16 render are **ffmpeg**, not AI. That part is done and it
  is the expensive part to get right.
- The vertical render is a **center crop**. It does not follow a face or a
  subject that moves off-centre.
- Production cannot run the pipeline. No `DATABASE_URL`, no Blob token, and no
  `ffmpeg` in serverless. Production is the UI + demo data + the login gate.
  Real clipping runs locally at `localhost:3000/editor`.

---

## 3. Owed: what models would actually make it smart

| Job | Needs a model? | Recommendation | Cost |
| --- | --- | --- | --- |
| Cut / trim / render 9:16 | **No** — ffmpeg | done | $0 |
| Transcribe speech (captions + searchable text) | Yes — ASR | **Whisper** locally | $0 |
| Pick the good 20 seconds | Optional LLM | **DeepSeek** or Gemini Flash | ~pennies |
| Follow the subject in frame | Yes — CV | **YOLO / MediaPipe** locally | $0 |
| Burn styled captions | No — ffmpeg | after Whisper | $0 |

**Claude and ChatGPT are not required.** They are the best editorial judges
available, and if you want a machine that watches an hour of IRL and finds the
six genuinely funny moments, that is where they earn their money. But the app
runs without them, and a cheap model plus Whisper gets you most of the way.

Order of work, cheapest-first: Whisper → LLM scoring on the transcript →
subject-tracking crop.

---

## 4. Still blocked (needs the owner)

- **Supabase provisioning.** No CLI installed, Docker present but not running,
  no access token, and `https://mcp.supabase.com/mcp` returns
  `401 No access token provided`. Needs a dashboard session, an MCP OAuth
  handshake, or a scoped PAT.
- **Blob token** for hosted uploads.
- **`MCP_API_TOKEN` / `MCP_USER_EVENT`** unset, so `/api/mcp` 401s locally.
  Pre-existing, not a regression.
- Two `automation-bypass` secrets exist on the Vercel project with no CLI
  subcommand to remove them individually — revoke in Deployment Protection.

## 5. The database layer — how it works, how to use it

Target: **Supabase managed Postgres, used as a plain database.** No `@supabase/*`
package, no `supabase-js`, no PostgREST/Data API calls, no Supabase Auth, no
Supabase Storage. The only database client in this repo is Prisma. Supabase is
just where the Postgres lives.

### Two URLs, and why they are not interchangeable

```
DATABASE_URL  → pooled, port 6543, ?pgbouncer=true   → the app at runtime
DIRECT_URL    → direct, port 5432                     → DDL: db push, db:rls, migrations
```

A transaction pooler multiplexes statements across connections and cannot hold
the session state DDL needs, so schema work goes over the direct port. Both are
mandatory: `prisma/schema.prisma` declares `directUrl = env("DIRECT_URL")` and
Prisma does **not** fall back to `DATABASE_URL` — verified empirically, it exits
with `P1012`. `prisma generate` (the Vercel `postinstall`) needs neither, so this
cannot break a build.

### Schema — 7 tables

`User` (email + scrypt hash for the optional account logins), `BrandSetting`,
`MediaAsset`, `ClipProject`, `Transcript`, `RenderJob`, `ProcessingLog`.
Ownership is a `userId` column plus query scoping in application code. There is
no RLS-driven tenancy: `requireUser()` and `userId`-scoped queries are the whole
boundary, and foreign records return `404`, never `403`.

The **access code does not touch the database at all.** It compares against
`APP_PASSWORD` and writes a signed cookie against the fixed id `household`.
That is deliberate — it is why the deployed app works before any Postgres exists.

### RLS lockdown — what it does and does not do

Supabase auto-exposes `public` over PostgREST to anyone with the anon key. This
app never uses that path, so `prisma/rls-lockdown.sql` closes it:

```bash
npm run db:rls      # prisma db execute --url "$DIRECT_URL" --file prisma/rls-lockdown.sql
```

`ENABLE ROW LEVEL SECURITY` on all 7 tables with **zero policies**, plus
`REVOKE ALL ... FROM anon, authenticated`. The table owner bypasses RLS because
`FORCE ROW LEVEL SECURITY` is intentionally not set — otherwise the app itself
would be locked out.

Proof, local Postgres, 2026-11-16, with a throwaway non-owner role holding a
SELECT grant (so the result isolates RLS from table privileges):

| Actor | Before script | After script |
| --- | --- | --- |
| non-owner with SELECT grant | 2 rows | **0 rows** |
| `anon` (grants revoked) | — | `ERROR: permission denied for table User` |
| owner role (what Prisma connects as) | 2 rows | **2 rows** |

All 7 tables then report `relrowsecurity = true`, `0` rows in `pg_policies`. The
script is idempotent and a deliberate no-op when `anon` / `authenticated` do not
exist, so it is safe on plain Postgres and in CI.

Read this as "the public API door is shut", not "RLS protects user data." It
does not. Server-side scoping does.

### Day-to-day commands

| Task | Command |
| --- | --- |
| Create/update tables (needs `DIRECT_URL`) | `npm run db:push` |
| Seed the two account logins | `npm run db:seed` |
| Lock the Data API out | `npm run db:rls` |
| Inspect rows | `npx prisma studio` |
| Local Postgres right now | `127.0.0.1:5432`, role `user`, db `clipmvp`, 7 tables, RLS on, no `prisma/migrations` (schema is `db push`) |

---

## 6. Known-report-only failure

`tests/smoke.test.mjs:49` — "dashboard shell has all four placeholders"
(28/29 pass). Deliberate: the shell was replaced by real components. Do not
change code to make it green; change the test when the dashboard is final.

---

## 7. Local Mac app + live watcher (verified 2026-11-16)

### Shipped and verified
- **Packaged Mac app** at `/Applications/Street Ethics Clip Engine.app`
  (`com.streetethics.clipengine`, v0.1.0, HGE gold-shield `icon.icns`), built by
  `npm run app:mac` → `scripts/build-mac-app.sh`. The script stages a
  dependency-free copy in `electron-build/app`, excludes `.env*` and `.data`,
  installs to `/Applications`, and points the Desktop item at it with a symlink
  instead of a second 336 MB bundle.
- **No access code locally.** `electron/main.js` sets `LOCAL_AUTH_BYPASS=1` and
  `authBypassActive()` only honours it when the host is loopback and the process
  is not on Vercel. The Vercel build keeps the `APP_PASSWORD` gate.
- **Demo data removed.** `src/mocks/demo.ts` and both demo cards are deleted;
  `/` counts real rows from `assets.json`, `clips.json`, `renders.json` through
  `src/lib/dashboard.ts`, and every screen with no registry says so instead of
  printing zeros that look like a healthy pipeline. `grep` for
  `mocks/demo|DEMO_|demo data` across `src` and `tests` is clean.
- `npm test` 29/29, `npx tsc --noEmit` clean, `rm -rf .next && npm run build`
  succeeds, `npm run app:mac` exits 0 and reinstalls.
- **Three real clips cut and rendered from `https://kick.com/deenthegreat`**
  (24/7 IRL stream) while it was live at ~16.5k viewers:
  | clip | length | file | trigger | render |
  |---|---|---|---|---|
  | `clip_d988e1d2…` | 44s | 26.1 MB | audio-spike | `render_666ac459…` done, QA PASS (4/4) |
  | `clip_61c9f860…` | 44s | 18.4 MB | audio-spike | `render_9a83e50c…` done, QA PASS (4/4) |
  | `clip_6020ec98…` | 42s | 16.0 MB | fallback-loudest | `render_…` done, QA PASS |
  All three carry `assetId: live_deenthegreat`, land in the same
  `clips.json` / `renders.json` the inbox reads, and the third one proves the
  180s fallback path: no +8 dB spike arrived, so it cut the loudest buffered
  window instead of idling. First clip frame was extracted and visually checked
  (real gameplay, correct 44s trim).
- **Radar counts are real, not session-scoped.** `clipCountsByChannel()` in
  `src/lib/watchlist.ts` counts `clips.json` by `assetId: live_<slug>` and the
  board shows that number. The watcher's own `monitor.json` counters reset on
  restart; a restart never deletes a clip, so the UI must not show 0 for an
  inbox that holds 3. Per-row "Spikes · this run" is explicitly labelled as
  run-scoped. Verified on screen: summary `Clips cut 2 · in the clip inbox` →
  row `Clips 3 · 25s ago` after a third cut landed.

### What actually runs
- `scripts/watch-supervisor.mjs` — detaches the watcher with
  `subprocess.Popen(..., start_new_session=True)` semantics, restarts it with
  5s→60s exponential backoff, and resets backoff after a >120s run. This is the
  only supported way to start the watcher: a plain `nohup … &` gets SIGTERM'd
  when the launching shell exits.
- `scripts/watch.mjs` — no npm deps. Polls
  `https://kick.com/api/v2/channels/<slug>` every 15s, records the signed HLS
  stream into 4-second MPEG-TS segments in a 240s ring (700 MB hard cap), taps
  8 kHz mono PCM, and cuts `[spike-12s, spike+28s]` when rolling RMS exceeds
  baseline by +8 dB and clears -34 dBFS. Falls back to the loudest buffered
  window after `WATCH_FALLBACK_SEC` (180s). Clips land in
  `cuts/<userId>/clip_<uuid>.mp4` with a 1080x1920 render beside them.
- Live detection reads the stream payload, not chat. Kick chat REST returns
  `401 Unauthenticated`, the old Pusher key answers `4001 … not in this
  cluster`, and `wss://websockets.kick.com/viewer/v1/connect` needs a token.
  `playback_url` lives at the **top level** of `/api/v2/channels/<slug>`, not
  under `livestream`; reading only the nested field made a 16k-viewer stream
  look offline. Both are now checked, top-level first.
- `channels.json` is app-owned. The watcher seeds it from `WATCH_CHANNELS` only
  when empty (`addedBy: "watcher-seed"`) and otherwise re-reads it every poll,
  so the radar's add/remove form takes effect without a restart.
- Crash resilience, proven by killing things:
  - `kill -9` the ffmpeg child → log shows `segmenter exited (null)` →
    `retrying in 5s (attempt 1)` → `recovered after 1 restart attempt(s)` →
    `recording from segment 105`, watcher pid unchanged.
  - `kill -9` the watcher → supervisor respawns it (pid 81240), heartbeat
    resumes, no duplicate cut from the pre-restart ring (`startIndex` warm-up
    boundary).
  - Three real bugs fixed to get there: `unref()`'d intervals let the daemon
    exit when ffmpeg died; a 255 "Packet corrupt" exit had no backoff; a restart
    re-ingested the old ring and re-cut the same moment.

### How to run it
```bash
cd ~/clip-mvp
npm run app:mac                       # build + install, no access code locally
CLIPMVP_DATA_DIR="$HOME/Library/Application Support/Street Ethics Clip Engine/data" \
CLIPMVP_USER_ID=household WATCH_CHANNELS=deenthegreat \
  node scripts/watch-supervisor.mjs   # daemon; pkill -f watch-supervisor to stop
```
The watcher has been running continuously through app rebuilds and its own
kills; heartbeat stays under 20s, the ring settles near 240s of buffered video
(~267 MB on disk), and unused segments are pruned.

### Known limits — say these plainly
- Detection is **loudness**, not chat velocity or gameplay understanding. It
  will cut a loud ad, a hype moment, and a shouting argument alike. Chat-based
  detection needs a registered Kick OAuth app with `events:subscribe`.
- The hosted Vercel build cannot run the pipeline: no `ffmpeg` in serverless,
  no `DATABASE_URL`, no Blob token. Prod is the UI plus the access-code gate.
- Kick's `/api/v2` is public but unversioned for our purposes; a field change
  would break polling until updated. `watch.log` records every non-200.
- The watched stream is a third party's. Clips are local files for review; no
  upload or publish step exists.
