# Progress — where this project actually stands

## 2026-11-17 saved handoff checkpoint

Code commit `d996547` is deployed; its Vercel deployment was checked Ready.
The Myresha hosted draft remains `cut`, its render is `done`, and its title is
`GTA CLUB BECAME THE MAIN EVENT`. It is in Approvals, not published in Clips.
The installed Electron app and 22-second local vertical test file still exist.
The Mac watcher process is up but `channels.json` is now empty and the monitor
reports zero recording channels. MyreshaTV was still live on Kick at the check,
but the Mac is not currently monitoring her. Do not assume a running watcher
means a stream is being recorded. The owner can choose Approve or Deny on the
hosted draft; automatic viral scoring remains unverified for visual-only scenes.

## 2026-11-17 live MyreshaTV and opening-title checkpoint

MyreshaTV is live and recording on the Mac; she is the only watched channel,
with Dean still off. A manual timestamp made a real 40-second GTA club clip.
The local scout abstained because speech evidence was weak, even though a
captured frame showed the crowded GTA club and Myresha's facecam. No automatic
audio-spike cut was observed for that scene at the checkpoint. The clip is a
useful visual test, not a measured viral hit.

The owner-reported title bug was real: title edits changed the record but not
the MP4. The new finishing path burns the opening title for 3.5 seconds.
Electron package/install exited 0; a real local approval returned HTTP 200,
titleApplied=true, 1080x1920, 40.033s, and 14,967,935 bytes. Its one-second
frame showed the title and the download returned HTTP 200 video/mp4. A shorter
22-second test file is at `~/Downloads/HGE Clips/test-edits/2026-11-17_myreshatv_gta-club_22s_title-test_vertical.mp4`.

On the hosted site, a real Myresha source uploaded through the browser and
became a 22-second draft. The first frame revealed that the old center crop
hid her facecam. The Mac worker now keeps the full wide stream over a blurred
vertical background. A hosted title change returned rebuilding=true and the
new render visibly showed both the changed title and facecam. Approvals showed
the draft; Clips stayed empty. Nothing was published. TypeScript, 32 tests,
Next build, Electron package, and direct FFmpeg QA passed. Speech captions
were omitted for this segment because the transcript was unreliable; no new
music was added over the club audio. Visual-only automatic scouting and a
physical iPhone check remain open.

## 2026-11-16 grounded scout checkpoint — deployed and checked

The saved Dean song-preview segment is a negative benchmark; the owner says it
missed the good moment and there are no good clips now. The published nonviral
test clip was denied, and production Clips showed its empty state. Live Dean
monitoring stays off. A local scout CLI and both Editor entry points now exist,
with a hosted queue for the Mac worker. The scout returns exact source windows
and only scores when it can verify a hook and payoff in transcript evidence.
On the negative Dean file, the real CLI and local HTTP run returned
`no_strong_verified_candidate`, one `insufficient_evidence` window, and no
score. No claim of viral prediction or successful positive scouting is made.

The new local streaming upload saved a 57,515,468-byte source byte for byte.
Next middleware had truncated the first trial at 10,485,760 bytes; the route
now streams outside middleware and enforces authentication itself. A
nonloopback Host returned HTTP 401, loopback returned 201. TypeScript exited 0,
32 tests passed, production build exited 0, Prisma schema push and RLS script
exited 0; a real Neon query found eight tables with RLS on and zero public
grants. Electron packaging/install exited 0; the installed Editor returned
200, its 57,515,468-byte upload returned 201 with the full byte count, and
its scout returned 200 with no verified score. The studio worker was restarted
and is running. Commit `d2b2aad` deployed to the stable Vercel URL. Anonymous
`/` returned 307, `/login` 200, access-code login 200, and all seven signed-in
pages 200. Unknown hosted scout asset returned 404; out-of-range mark 400; a
real saved source queued with 201 and finished on the Mac as
`no_strong_verified_candidate` with no score. At 390px mobile width, Editor
showed the result, all seven menu links, and no horizontal overflow. The denied
test clip's download returned 404. A physical iPhone and a true strong-clip
benchmark are still untested. See `docs/VIRAL_SCOUT_PLAN.md`. The old 85% estimate below
predates this additional scope and is not a current completion measurement.

## 2026-11-16 checkpoint — approximately 85% of requested creator workflow

The hosted creator workflow is deployed at `https://clip-mvp.vercel.app` from
commit `98db33d`; the Electron review changes are installed in `/Applications`.
The percentage is a scope estimate, not a viral-success prediction. The Dean
watchlist was emptied at the owner's request; do not restart it.

Live production checks: anonymous `/` returned 307 to `/login`, `/login` 200,
saved owner access-code login 200, and all seven authenticated pages returned
200 with all seven workspace links. A real 17.1 MB Dean source uploaded from
the production browser to Blob, queued a 10-second job, and the Mac worker
produced a 5,167,908-byte vertical MP4. The job appeared in Approvals.
Approving it made Clips show two published items; its download returned 302 to
Blob and Blob HEAD returned 200 `video/mp4`. An unapproved render returned 404.
The temporary QA item was then denied; Clips returned to one published item,
and the denied download returned 404. A separate browser upload of an
eight-second owner music excerpt produced a completed render with
`musicApplied=true`; it was denied after testing. Two prior QA jobs were also
denied, leaving Approvals empty. At a 390px viewport, the mobile drawer showed
all seven links with no horizontal overflow. A physical iPhone was not tested.

Verified so far: TypeScript exit 0, 29/29 tests pass, Next production build exit
0, Electron packaging/install exit 0, Prisma schema push to real Neon exit 0.
The separate Mac studio worker is running through LaunchAgent
`com.streetethics.studio-worker`; it completed a real 10-second Blob source job
with vertical render and transcription. That job remains unapproved. Frames at
2.5s and 6.5s visibly showed captions, but exact caption-change frames stacked
text in the old implementation. A single RGBA caption track now replaces the
looping images. The revised worker then completed a new real 10-second job from
the saved Dean source: 1080x1920, 4,911,611 bytes, visible single captions at
2.5s and 6.5s. The installed FFmpeg has no `subtitles` filter.

The Electron approval route returned HTTP 200 for a real 32.133-second Dean
clip. Its new 1080x1920 MP4 is 11,814,799 bytes, a speech caption is visibly
present at 28.5s, the local registry status became `approved`, and its download
returned HTTP 200 `video/mp4`. Another real local clip was approved with an
eight-second excerpt of an existing owner beat; its finishing response reported
musicApplied true. Earlier attempts failed because looping caption images had
no output duration and the many-input render timed out; the single
RGBA track and explicit duration resolved that. The title remains editable.

Shipped additions: authenticated direct-to-Blob browser upload and source
picker, manual start/end selection, optional music upload, queued edit jobs,
hosted review with Approve/Deny and editable title, all seven hosted navigation
items with truthful page content, plus Electron local caption/title/music
finishing on approval. The Mac worker, not Vercel, performs FFmpeg jobs. R2 is
not needed for this implementation.

Remaining scope: automatic viral scoring from actual footage/transcripts is not
implemented or validated; the detector still uses audio energy. The hosted
Editor marks one range of up to 60 seconds per job, not a general long-form
timeline. Whisper captions need owner review and are absent when speech is not
clear; the new browser QA clip had no usable captions, while a separate real
worker QA render showed visible captions. The Mac must be awake and online for
hosted jobs to finish. Blob media URLs are public to anyone who has the URL.
TypeScript, 29/29 tests, build, Electron package, and the RLS query passed;
seven tables retain RLS with zero public grants. Never print or commit credentials.

Resume from `docs/STUDIO_PLAN.md`, `scripts/studio-worker.mjs`, and
`src/app/api/clips/enrich/route.ts`. The worker's private environment file is
under the app's Library/Application Support directory with mode 600. No
credentials belong in the repository.

## 2026-11-16 new owner direction: hosted creator workflow

The owner now wants the girlfriend to upload and cut long videos from the
Vercel site on a laptop or iPhone. Both Vercel and Electron need a real review
queue: preview, Approve to keep and prepare captions/title, Deny to remove from
the queue, and optional music upload. This supersedes the previous viewer-only
product scope. Dean live monitoring was stopped by the owner; do not restart it.

Architecture decision: keep the existing Vercel Blob store and Neon database.
R2 is not required for the first version. Browser uploads go directly to Blob;
Vercel records source and edit jobs; a separate FFmpeg worker processes them
because Vercel functions cannot run the long edits. The Mac is the first worker,
so it must be online for jobs to finish. The live watcher remains separate.
Do not label captions or title suggestions as complete until their real
transcript/render artifacts are checked.

## 2026-11-16 earlier hosted viewer and manual mark update

At this earlier checkpoint, the Mac watcher was the only cutter and Vercel was
a session-gated viewer. The creator studio update above supersedes that hosted
scope. The Mac still performs all FFmpeg work.

Verified locally and against provisioned cloud resources:

- Neon database connected through Vercel; pooled and direct URLs set in
  Production, Preview, Development. Schema push exit 0.
- Blob store connected in all environments; Production storage driver is blob.
- RLS script exit 0. Direct query: seven tables RLS on, zero policies, no public
  SELECT grants. Neon has no Supabase anon role or public Data API.
- Owner email login stored as a scrypt hash on the household user row. Shared
  access code updated as a Vercel secret. The Electron app still bypasses login
  only on loopback.
- Publisher dry run exit 0; one approved real test clip uploaded to Blob and
  inserted into Neon. Second run said ALREADY (no duplicate upload). Blob HEAD
  confirmed both source and render files.
- Manual live timestamp POST returned 201 and saved a 40.014-second vertical
  render from the actual Dean buffer. Radar now accepts stream elapsed time or
  Mac time. A 49-second song-preview draft with title and voice introduction is
  in `~/Downloads/HGE Clips/test-edits/`; it is not published.
- TypeScript exit 0, 29/29 tests passed, Next production build exit 0,
  Electron package and install exit 0. The installed app was visually opened
  directly to Radar with no login.
- The Mac Clip Inbox now displays local renders before approval, with Approve
  and Deny buttons. A real unapproved render returned `206 video/mp4` from the
  owner preview route, while its download returned `404`; `/approvals`
  redirected to the inbox with `307`.

Production deployment `clip-jy4rpj4if-team-homegrown.vercel.app` reached Ready
after commit `3c674ab` was pushed to `main`. Live checks on
`https://clip-mvp.vercel.app`: anonymous `/` 307 to `/login`; `/login` 200;
access-code login 200 and account login 200, each with a session cookie and
`/clips` 200. The real approved test clip appeared, and its render download
returned 302 to Blob. Temporarily setting that same clip to `cut` returned
404 for the download; its approved status was restored immediately.

Remaining limits: the site does not transcribe or score viral potential; the
song-preview draft uses editorial screen text because local song ASR was
unreliable. Blob media URLs are public if someone shares a URL. The most
likely operational failure is the Mac watcher stopping, because Vercel only
views already published media. The manual timestamp buffer lasts about four
minutes, so late marks cannot recover older moments from the live feed.

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
- Production cannot run FFmpeg. It is a viewer backed by Neon and Blob; real
  clipping runs in the local Mac app.

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

## 4. Remaining external configuration

- **Neon and Blob are provisioned.** The earlier Supabase provisioning block
  was resolved by using the allowed Neon option.
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
- The hosted Vercel build cannot run FFmpeg; it displays approved clips from
  Neon and Blob once the new source is deployed.
- Kick's `/api/v2` is public but unversioned for our purposes; a field change
  would break polling until updated. `watch.log` records every non-200.
- The watched stream is a third party's. Publishing requires an explicit owner
  decision via the local publisher; a test clip was approved for verification.
