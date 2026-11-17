# Grounded video scout plan — 2026-11-16

## Goal

An uploaded video can produce reviewable clip suggestions with exact source
times, quoted evidence, a bounded editorial-potential score, and an explicit
skip result when the available audio/video does not support a strong clip.
The score is not a prediction of views or a viral percentage.

## Current evidence and constraints

- The hosted Editor uploads to Blob and the Mac worker renders selected ranges.
  Vercel cannot run FFmpeg. The Mac has FFmpeg, Whisper `tiny.en`, and local
  Ollama `llava:latest` for frame descriptions. No OpenAI, Claude, or AI Gateway
  API key is configured for the site or worker.
- The saved 60-second Dean song-preview source is a **negative benchmark**:
  the owner says it missed the good moment and is boring. Whisper produced
  unreliable repeated lyrics, so a scout must abstain or skip rather than
  award a high score for loud music.
- The owner has no approved clips right now. The old nonviral published test
  clip was denied and the hosted Clips page returned its truthful empty state.
- A ChatGPT account session is not a website API credential. Adding an API
  provider later requires a key stored outside the repo.

## Ordered work

1. **Build a local scout proof.** Add a CLI that probes a real video, proposes
   bounded 40–50 second windows from actual audio energy or supplied marks,
   transcribes those windows, samples actual frames, and emits a JSON report.
   Require source-time evidence for every candidate and apply the existing
   20/20/20/15/10/10/5 rubric only when transcript quality permits. A weak or
   unreliable window must return `skip` or `insufficient_evidence`, not a score
   that looks like a virality probability. Verify on the boring Dean source.
2. **Make the scout available in the hosted Editor.** Add a user-scoped scout
   job table and authenticated queue/read endpoints. The Mac worker processes
   queued scouts; the Editor displays the result and lets the owner choose a
   suggested range to feed into the existing Make clip flow. No suggestion is
   published automatically. Verify ownership and invalid input behavior.
3. **Add the same entry point to Electron.** Let the local Editor run the scout
   on a saved source file and show the same evidence and choose-range action.
   Verify it on the installed app, without adding a login.
4. **Release and document.** Run TypeScript, meaningful tests, production
   build (with `next dev` stopped), Mac package, real video and browser checks,
   then push to main. Verify the live URL and update HANDOFF, PROGRESS, and
   JARVIS with observed results and remaining limits.

## Step 1 checkpoint

`scripts/scout-video.mjs` now scans actual PCM audio, accepts exact owner
marks, transcribes selected 44-second windows, samples a real frame, and
abstains unless the local model returns two verbatim transcript quotes and a
bounded rubric breakdown. `node --test tests/scout-core.test.mjs` passed 3/3;
`node --check scripts/scout-video.mjs` passed. A real run on the owner's
negative Dean segment with `--mark 20` returned one 16.4–60.4s window,
`insufficient_evidence`, no score, and `no_strong_verified_candidate`.
The missing-file CLI path exited 1. Step 2 is implemented and undergoing
hosted verification. The local streaming upload and scout route are also
implemented. A 57,515,468-byte video uploaded byte for byte through HTTP 201;
the local HTTP scout returned one unscored `insufficient_evidence` candidate.
TypeScript, 32/32 tests, and the Next production build passed. The first
upload trial exposed Next middleware's 10 MB body clone; the upload route is
excluded from middleware and `requireUser()` enforces loopback auth itself.
Nonloopback Host checks returned 401 for upload and scout. All eight Neon
tables retain RLS with no public grants.

## Release check

`bash scripts/build-mac-app.sh` exited 0 and installed the app. The packaged
Editor returned 200, accepted all 57,515,468 source bytes with 201, and its
scout route returned 200 with no score for the negative benchmark. Commit
`d2b2aad` deployed to production and reached Ready. Access-code login and all
seven signed-in pages returned 200. The hosted scout API returned 404 for a
missing asset, 400 for an out-of-range mark, and 201 for a real saved source.
The Mac worker completed the job with one unscored `insufficient_evidence`
window. The 390px mobile Editor displayed it; all seven navigation links were
visible and there was no horizontal overflow. The denied clip's download
returned 404. A physical iPhone and a confirmed strong-clip benchmark remain
open; do not claim a measured viral hit rate.

## Risks and out of scope

- Local LLaVA can describe sampled frames but cannot verify song lyrics or
  predict audience response. It must never invent identities or events.
- The first benchmark is negative; precision on strong clips remains
  unverified until the owner supplies a correct source video and marks what
  they consider worth posting.
- A physical iPhone is unavailable on this Mac. Phone-width browser checks
  are possible; a real iPhone check remains open.
- Automated cross-platform publishing and measured viral outcomes are outside
  this pass. The owner still approves each finished clip.
