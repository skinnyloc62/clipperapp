# Handoff — Street Ethics Clip Engine / HGE Clippers

Written 2026-11-16 01:12 EST (06:12 UTC). Last commit `e4ed3bb`, pushed to
`skinnyloc62/clipperapp` (main). Working tree is clean.

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

## What is actually running right now

| Thing | pid | Notes |
|---|---|---|
| `scripts/watch-supervisor.mjs` | 80771 | PPID 1, detached, respawns the watcher on crash with 5s→60s backoff |
| `scripts/watch.mjs` | 85092 | the watcher itself; child of 80771 |
| Electron app | not running | `/Applications/Street Ethics Clip Engine.app`, CDP port 9222, HTTP port changes per launch |
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

Also not proven, because it does not exist: no burned-in captions, no brand
overlay, no loudness mastering. The QA record marks those three `NOT_TESTED`.

## Known dead ends / blocked

- **Kick chat is unreachable anonymously.** REST returns 401, the Pusher key
  returns `4001 not in this cluster`, realtime needs tokens. So there is no
  chat-velocity detection. That needs a registered Kick OAuth app with
  `events:subscribe` and a public key, then `chat.message.sent` webhooks.
  Nobody has supplied those credentials.
- **Production (Vercel) cannot run the pipeline.** No `ffmpeg` in a serverless
  function. Prod is the UI plus the access-code gate only.
- **Postgres provisioning** needs two connection strings: pooled `6543` with
  `?pgbouncer=true` → `DATABASE_URL`, direct `5432` → `DIRECT_URL`. Pooler user
  is `postgres.liijagrcphwqczaatuno`.
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
bash scripts/build-app.sh     # then copy the .app to /Applications
killall Finder                # so the icon and Launchpad entry refresh
```

The installed app currently renders **old** radar copy, because the copy edits
shipped after the last build. Rebuilding fixes that; it is cosmetic only.

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
