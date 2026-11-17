# Handoff — Street Ethics Clip Engine / HGE Clippers

## Saved runtime checkpoint — 2026-11-17

The latest code commit is `d996547`; Vercel deployment
`clip-cg5e41o6r-team-homegrown.vercel.app` was checked Ready and aliases
`https://clip-mvp.vercel.app`. The real Myresha hosted draft remains `cut` with
a `done` render and title `GTA CLUB BECAME THE MAIN EVENT`. It is visible in
Approvals and is **not approved or published**; Clips remains empty. The
22-second local test file and installed Electron app still exist.

Current runtime differs from the live test below: `channels.json` is now `{}`.
The watcher and supervisor processes are running but the monitor reports zero
live/recording channels. MyreshaTV was still live on Kick when checked, yet
the Mac was no longer recording her; Dean is also absent. The Electron app was
not running at this checkpoint. Leave the empty watchlist as found unless the
owner asks to resume monitoring. The next editorial decision is the owner's
Approve or Deny on the hosted Myresha draft. No measured viral rate exists;
the scout withheld a score for this scene because speech was uncertain.

## MyreshaTV live test and title fix — 2026-11-17

The owner asked to test `kick.com/myreshatv` during a GTA 5 club scene. Kick
reported it live; the Mac Radar added it with HTTP 201 and the watcher reported
live=true, recording=1. It is the only watched channel. Dean remains off. A
real captured frame showed the crowded GTA club and Myresha's facecam. A manual
live mark returned 201 and produced a 40.018-second 1080x1920 render. The
audio/speech scout withheld a score (`no_strong_verified_candidate`) because
the transcript was uncertain; that result does not judge the visual joke. The
audio spike detector had made no automatic cut for this scene at the checkpoint.

The title field previously saved metadata without putting words on the video.
Local approval and hosted Mac renders now burn an owner title into the first
3.5 seconds. If a hosted title changes after rendering, the title route queues
a new render before approval. A real local Myresha approval returned 200,
`titleApplied=true`, QA PASS, 1080x1920, 40.033s, and 14,967,935 bytes; a
frame at one second visibly showed `GTA CLUB WAS THE REAL MISSION`. Its local
download returned 200 with the full MP4. A 22-second, 8,617,928-byte test edit
is in `~/Downloads/HGE Clips/test-edits/2026-11-17_myreshatv_gta-club_22s_title-test_vertical.mp4`.
No speech captions or added music were used; club audio was retained. This
approved local test is not published to Vercel.

A real 40-second Myresha source uploaded through the hosted browser, and the
Mac worker made a 22-second draft. The first hosted frame showed the title but
revealed an old center crop hiding the facecam. The worker now preserves the
full wide stream in the center over a blurred 9:16 background. Changing the
hosted draft title through `/api/studio/title` returned 200 with
`rebuilding=true`; the worker finished the new render, and its one-second frame
showed both the new title `GTA CLUB BECAME THE MAIN EVENT` and the facecam.
`/approvals` returned 200 with that draft; `/clips` returned 200 with its empty
state. The hosted draft is awaiting owner approval and is not published.
TypeScript, 32 tests, Next build, Electron package/install, direct FFmpeg layout
check, and the real local/hosted title renders passed. A measured viral rate
and reliable visual-only automatic scouting remain unverified.

## Grounded scout work — 2026-11-16 (deployed and checked)

The owner rejected the saved Dean song-preview segment as boring and says
there are no good clips yet. The previously published nonviral test clip was
denied; the production Clips page returned its empty state. Do not republish
that clip or treat the saved segment as a positive scouting benchmark. Dean
live monitoring remains off.

The new scout reads real video audio, transcribes candidate windows locally,
samples a frame, and withholds a score when it cannot verify an opening hook
and later payoff. The saved negative Dean segment returned one 16.4–60.4s
candidate with `insufficient_evidence`, no score, and
`no_strong_verified_candidate`. A real 57,515,468-byte local upload saved all
57,515,468 bytes; an HTTP scout run on that upload returned the same abstention.
The local upload bypasses Next middleware's 10 MB request-body clone limit but
`requireUser()` now enforces the loopback host rule itself. A nonloopback Host
returned 401 for both local upload and scout; a loopback upload returned 201.
TypeScript, 32/32 tests, a production build, and Electron package/install
passed. The installed app's Editor returned 200, accepted the full 57,515,468
bytes, and its scout route returned 200 with the same unscored abstention. The
studio worker was restarted and is running. Commit `d2b2aad` reached Ready at
`clip-pbbx7upeq-team-homegrown.vercel.app` and became the stable production
alias. Anonymous `/` returned 307 to `/login`; `/login` returned 200. The real
saved access code logged in with 200 and all seven authenticated pages returned
200. An unknown hosted scout asset returned 404; an out-of-range mark returned
400. A real saved source queued a scout with 201, and the Mac worker finished it
with one unscored `insufficient_evidence` window. The hosted Editor showed the
result. At 390px mobile width the seven navigation links were visible and there
was no horizontal overflow. The denied test clip's download returned 404.
No ChatGPT/Claude website API key is configured; the owner's ChatGPT Mac login
is not an API credential. See `docs/VIRAL_SCOUT_PLAN.md`.

## Creator studio update — 2026-11-16 (deployed and live-verified)

The owner expanded the hosted product from a viewer to a creator workflow.
Production now has all seven workspace pages on Vercel: Command Center,
Live Radar, Clip Inbox, Editor, Approvals, Earnings, and Settings. The hosted
Editor accepts a long video from a laptop or iPhone directly into Vercel Blob,
lets the owner mark a range of at most 60 seconds, optionally attach an audio
file, and queues the render in Neon. The Mac studio worker does the FFmpeg work;
Vercel itself still has no FFmpeg cutter. Approvals shows completed previews,
an editable title, Approve and Deny. Approved videos appear in Clip Inbox and
become downloadable. Deny removes a clip from the active queue while retaining
the source upload. R2 is not required; the existing Blob + Neon stack is used.

The installed Electron app has no login. Its Clip Inbox now finishes a local
clip with Whisper speech captions, an editable suggested title, and optional
owner-provided music on Approve. A 32.133-second real Dean clip completed over
HTTP 200; the 1080x1920 MP4 had a visible caption, and its approved download
returned HTTP 200 video/mp4. Another real local clip was approved with an
eight-second excerpt of an existing owner beat; musicApplied was true. Both
were local tests and were not published to Vercel. The Electron package was
rebuilt and installed in `/Applications`; the Desktop icon is a shortcut.

The studio worker is a persistent LaunchAgent named
`com.streetethics.studio-worker`, with its private 600-mode credentials file
in the app's Library/Application Support directory. It processed a new real
10-second job from the previously uploaded Dean source after the single-track
caption fix. The 1080x1920 Blob render was 4,911,611 bytes with visible, single
caption lines. Those worker QA jobs were denied after testing and are no longer
in the review queue. The worker requires this Mac awake and connected to Neon/Blob.
There is no verified automatic viral prediction or general long-form timeline
editing. Titles are suggestions for human review; Whisper can mishear speech.

Dean live monitoring was stopped by the owner. `channels.json` is currently
empty; the watcher now respects an existing empty file instead of reseeding
Dean. The watcher heartbeat reported zero recording and no channels. Do not
restart Dean capture without the owner asking.

Before deployment, local checks passed: TypeScript exit 0, 29/29 tests,
Next production build exit 0, Electron package/install exit 0, and
`git diff --check` exit 0. After the schema update, a real Neon query found
all seven tables with RLS enabled, zero policies, and zero public grants.
Commit `98db33d` was pushed to `main`; deployment
`clip-6iqgmqrq7-team-homegrown.vercel.app` reached Ready. Live checks on the
stable URL found anonymous `/` 307 to `/login`, `/login` 200, saved owner access
code login 200, and all seven authenticated pages 200 with seven menu entries.
The saved code matches the owner's requested PIN without printing it. A real
17.1 MB Dean video uploaded through the production browser to Blob and queued
a 10-second Mac render. The resulting 5,167,908-byte MP4 appeared in Approvals.
Approving it made Clips show two rows; its download returned 302 to a Blob MP4
whose HEAD returned 200. An unapproved render returned 404. Denying the QA
clip returned Clips to one row and made its download return 404. A separate
hosted job uploaded an eight-second excerpt of owner-provided music and
finished with `musicApplied=true`. The 390px mobile browser showed the full
seven-item drawer with no horizontal overflow. Test-only review jobs were
denied, leaving a truthful empty Approvals state. At that checkpoint the
previously published Dean test clip was visible and labeled non-viral; it was
denied in the later scout checkpoint above.

This verifies the workflow in a desktop browser at phone width, not on a
physical iPhone. The production browser job had no usable speech captions;
another real Mac worker job did have visible captions. No general long-form
timeline editing or measured viral prediction exists yet. See
`docs/STUDIO_PLAN.md`, `docs/PROGRESS.md`, and
`JARVIS/.progress/journal.md` for the resumable state. Never print credentials.

Original handoff written 2026-11-16 01:12 EST. The verified hosted-viewer
update below supersedes older "no database / no Blob / no publish path" notes.

## Hosted viewer update — 2026-11-16

- The active source repository is `/Users/homegrownentllc/clip-mvp`. The
  Desktop icon links to `/Applications/Street Ethics Clip Engine.app`.
- Vercel Blob store `hge-clippers-media` was created and connected to
  Production, Preview, and Development. `STORAGE_DRIVER=blob` is Production
  only. The store is public, so a Blob URL can be opened by anyone holding it;
  the dashboard and download route still require a session.
- Neon Postgres `hge-clippers-db` was provisioned through Vercel. Its pooled
  `DATABASE_URL` and direct `DIRECT_URL` are set in all three environments.
  Neon uses a pooler hostname rather than Supabase's port 6543 convention.
- `prisma db push` succeeded. `npm run db:rls` succeeded. A direct query
  found all seven tables with RLS enabled, zero policies, and no public SELECT.
  Neon has no Supabase `anon` role or PostgREST Data API.
- The owner account was created on the `household` user row with a scrypt
  password hash. The shared access code was updated as a Vercel secret in all
  environments. Neither credential is stored in this repository.
- `scripts/publish-clips.mjs --dry-run` reports eligible local records;
  `--approve clip_<id> --title <title>` is an explicit owner approval and
  publishes the real source cut and vertical render. It refuses missing files.
  Re-running the same approved ID reports `ALREADY` and does not upload again.
- One real Dean clip was published with the title
  `TEST CLIP - not a viral pick`. Blob HEAD verified the 26,086,952-byte cut
  and 14,565,406-byte render. The source footage is not being called viral.
- The hosted Clips page now lists approved database rows; the render download
  route also checks approval. At this earlier checkpoint, hosted navigation was
  viewer-only. The creator studio update above supersedes that scope. The Mac
  app keeps local auth bypass.
- The Mac Clip Inbox plays local vertical renders before approval. Each card
  has Approve or Deny; `/approvals` opens that real inbox. Local review playback
  uses `/api/previews/<renderId>` with session ownership and byte-range support.
  `/api/downloads/<renderId>` still returns 404 until the clip is approved.
- The Radar page in the rebuilt Mac app has a manual timestamp control. It
  accepts stream elapsed time (for example `4:04:23`), Mac time, or Mark now.
  A real local request returned 201 with a 40.014-second vertical render.
  The buffer lasts about four minutes, so old marks expire.
- The rebuilt Electron app was installed at `/Applications/Street Ethics Clip
  Engine.app` and visually opened to Live Radar without a login screen.
- Commit `3c674ab` was pushed to `main`; Vercel deployment
  `clip-jy4rpj4if-team-homegrown.vercel.app` reached Ready. The stable URL is
  `https://clip-mvp.vercel.app`. Anonymous `/` returned 307 to `/login` and
  `/login` returned 200. The real access code and owner email login each
  returned 200, issued a cookie, and opened `/clips` with 200.
- The hosted page contained the published real test clip. Its approved render
  download returned 302 to Blob. Temporarily setting that test clip to `cut`
  made the same download return 404; approval was restored immediately.
- Local checks: `npx tsc --noEmit` exit 0, `npm test` 29/29, `npm run build`
  exit 0, packaged Mac build exit 0. The local unapproved render returned
  206 from owner preview and 404 from download. See `docs/PROGRESS.md` for
  remaining limits.

## What this is

A local Next.js app + long-running watcher that records a Kick live stream,
detects a moment, cuts a clip, renders a vertical 9:16 version, and stores both
in a JSON registry the UI reads. There is also a packaged Mac Electron app.

Live channel: <https://kick.com/deenthegreat> (24/7, ~16k viewers).

## Where the videos are

```
~/Downloads/HGE Clips/
  vertical/  1080x1920 — the file to post
  wide/      source-aspect cut
  manifest.txt
```

`manifest.txt` lists every clip in local time with length, trigger, audio peak
and mean, the detector's verbatim evidence string, QA verdict, and filenames.
Re-running the exporter never overwrites an existing file.

```bash
cd ~/clip-mvp && node scripts/export-clips.mjs           # → ~/Downloads/HGE Clips
cd ~/clip-mvp && node scripts/export-clips.mjs /some/dir # → somewhere else
```

## Processes at the original handoff (historical PIDs; check current state)

| Thing | pid | Notes |
|---|---|---|
| `scripts/watch-supervisor.mjs` | 80771 | PPID 1, detached, respawns the watcher on crash with 5s→60s backoff |
| `scripts/watch.mjs` | 85092 | the watcher itself; child of 80771 |
| Electron app | installed and launchable | `/Applications/Street Ethics Clip Engine.app`; HTTP port changes per launch |
| Local Postgres | 127.0.0.1:5432 | db `clipmvp`, used for the app's own auth/registry tables |

Stop the watcher (only this — the supervisor will not resurrect it if you kill
the supervisor first):

```bash
pkill -f watch-supervisor && pkill -f "scripts/watch.mjs"
```

Restart after editing `scripts/watch.mjs` — kill the child only, the supervisor
picks up the fresh file:

```bash
pkill -f "scripts/watch.mjs"
```

Do **not** use `nohup … &` for the watcher. It gets SIGTERM'd by the harness's
process-group cleanup. Always go through the supervisor.

## The cut rule, and why it is what it is

`CONFIG` at the top of `scripts/watch.mjs`:

```
segmentSec 4 · ringSec 240 · clipWindowSec [12, 28]
spikeDb 9 · jumpDb 6 · spikeFloorDb -30 · spikeConfirmSegments 2
localBedSegments 4 · cooldownSec 180
fallbackSec 900 · fallbackMinDb -20
```

A cut needs a segment that is **+9 dB over the median of the ring AND +6 dB
over the median of the last 4 segments** (the onset test), above `-30 dBFS`,
**held for 2 consecutive segments (8s)**. The anchor is the *first* segment of
that run, so the clip opens 12s before the moment. After a cut, 180s of
cooldown measured anchor-to-anchor.

Thresholds were derived by replaying real buffered audio, not guessed. Over 65
real segments (260s) the old rule cut at segment 252 and the new rule cuts
there exactly once; `jumpDb 8 + confirm 2` produced zero clips in that window,
which is why jump sits at 6.

The fallback used to fire every 180s regardless of level, so quiet stretches
became clips that were just room tone. It is now 900s and requires the loudest
segment to clear `-20 dBFS`; otherwise the watcher logs "nothing special yet"
at most once per interval and cuts nothing.

UI copy reads these numbers **live from `monitor.json` → `config`**, so the
screens cannot describe a rule the watcher is not actually running.

## Proven vs not proven

Proven:

- 5 clips + 5 vertical renders exist, all QA PASS, all from `deenthegreat`,
  durations 42–44s, RMS peaks −10 to −12 dB. They are five *distinct* stream
  windows (05:48:35, 05:49:41, 05:59:53, 06:04:39, 06:05:24 UTC).
- Crash resilience: `kill -9` on ffmpeg → backoff → recover; `kill -9` on the
  watcher → supervisor respawns; no duplicate cut (there is a `startIndex`
  warm-up).
- 29/29 tests, `npx tsc --noEmit` clean, clean `npm run build`.

**Not proven:** that the new rule cuts *better* moments. It was restarted at
01:10 EST and has cut nothing since, because the stream has been sitting around
−24 to −28 dBFS. Do not tell anyone the clips got better on the strength of the
tuning alone. The honest statement is: the old rule was measurably too loose on
replayed audio, the new one is measurably tighter, and time will tell.

The automatic watcher renders do not have burned-in captions, brand overlay,
or loudness mastering. The QA record marks those three `NOT_TESTED`. A separate
49-second song-preview draft has editorial title text and a voice introduction;
its lyrics were not captioned because the local transcription was unreliable.

## Known dead ends / blocked

- **Kick chat is unreachable anonymously.** REST returns 401, the Pusher key
  returns `4001 not in this cluster`, realtime needs tokens. So there is no
  chat-velocity detection. That needs a registered Kick OAuth app with
  `events:subscribe` and a public key, then `chat.message.sent` webhooks.
  Nobody has supplied those credentials.
- **Production (Vercel) cannot cut or render.** No `ffmpeg` in a serverless
  function. It serves approved clips published from the Mac.
- **Database is Neon.** The Supabase 6543/`pgbouncer=true` convention in the
  earlier plan does not apply. Neon supplied a pooler hostname and a direct URL.
- `/api/mcp` returns 401 locally because `MCP_API_TOKEN` / `MCP_USER_EVENT` are
  unset. Pre-existing, not a regression.
- Two `automation-bypass` secrets on the Vercel project cannot be deleted with
  the CLI. Revoke them in Deployment Protection settings.

## Auth model

- The **local** host does not need an access code: `LOCAL_AUTH_BYPASS=1`, and
  the bypass is guarded on `process.env.VERCEL` being absent plus a loopback
  hostname.
- The **Vercel** copy keeps the gate. Shared `APP_PASSWORD`, verified by
  `verifyAppPassword()` (timing-safe), session `userId: "household"`. Gate lives
  in `src/middleware.ts`. Five failures per 15 min per IP → `429` +
  `Retry-After`.
- Row level security is on with zero policies and `REVOKE ALL` from `anon` and
  `authenticated`. `FORCE ROW LEVEL SECURITY` is deliberately unset so Prisma
  still works. `requireUser` is the real boundary.
- Never print `SUPABASE_SECRET_KEY` or `APP_PASSWORD`, and never paste them into
  a chat.

## Commands that matter

```bash
cd ~/clip-mvp
npm run dev                                   # Next dev, http://localhost:3000
npx tsc --noEmit                              # typecheck
npm test                                      # 29 tests
node scripts/export-clips.mjs                 # clips → ~/Downloads/HGE Clips
tail -f "~/Library/Application Support/Street Ethics Clip Engine/data/watch/watch.log"
```

Rebuild and reinstall the Mac app:

```bash
cd ~/clip-mvp
bash scripts/build-mac-app.sh # builds, installs, and refreshes Desktop shortcut
```

The installed app was rebuilt after the manual mark and inbox review changes.

Data lives in `~/Library/Application Support/Street Ethics Clip Engine/data`:

```
clips.json      clips.json is an object keyed by clip id
renders.json    object keyed by render id
channels.json   watchlist, multi-channel
watch/monitor.json   live state; session counters reset on restart
watch/watch.log      the log
cuts/household/      source cuts
renders/household/   vertical renders
```

`segmentsJson` on a clip is a JSON **array containing one provenance object**:
`{source, channel, trigger, evidence, spikeAt, capturedWindowStart,
capturedWindowEnd, segments:[{index, rmsDb}]}`. Per-segment items carry only
`index` and `rmsDb` — no `baselineDb`. Both the exporter and anything else that
reads it must handle that shape (the exporter also tolerates the bare object).

`startSec` / `endSec` on a live clip are **clip-relative trim offsets**, not
stream time. Real stream time is in `capturedWindowStart` / `capturedWindowEnd`.

## Traps worth knowing before editing

- Never run `npm run build` while `next dev` is running. They share `.next` and
  it breaks with `Cannot find module './887.js'`.
- Shell heredocs over ~19k characters fail. Write large files in ≤6k chunks.
- Don't fire two edits at the same file path in parallel.
- `write` fails on `src/app/radar/page.tsx`; edit it via a shell heredoc +
  `python3`.
- Disk is tight, ~20 GB free. A 4s segment is ~3.96 MB, 76 MB/min per channel,
  ring is 240s with a 700 MB cap.
- Local time is EST (UTC−5). `createdAt` is stored UTC, so 05:48 UTC is 00:48
  EST. This has caused misreadings more than once.

## Sensible next steps

1. Watch the log until the new rule produces its first cut, then judge whether
   it is a real moment. If it never fires on a genuinely loud bit, the honest
   fix is to lower `jumpDb` toward 5 before touching anything else.
2. Wire `export-clips.mjs` into the flow — run it after each cut, or add an
   export button — so nobody has to remember the command.
3. Build `scripts/clip-file.mjs`: yt-dlp or local file → audio-energy peak scan
   → cut at given timestamps or the peak → vertical render + QA, writing the
   same registries. Then add an import/URL entry point in the UI.
4. Rebuild the Electron app so the radar copy matches the running rule.
5. Vercel side for the girlfriend once DB and Blob credentials arrive.
