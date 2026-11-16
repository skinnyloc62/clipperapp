# JARVIS progress — Street Ethics Clip Engine

2026-11-16 checkpoint: approximately **85%** of the new owner request is done.
This percentage is an estimate of implementation and proof, not a measured
viral-success rate. Commit `98db33d` deployed the creator studio to
`https://clip-mvp.vercel.app`, and the installed Electron app has the local
review changes. The Dean watchlist remains empty at the owner's request.

Live production verification: anonymous `/` 307 to `/login`; `/login` 200;
saved owner access-code login 200; all seven authenticated pages 200 with seven
menu links. A real 17.1 MB Dean video uploaded through the production browser
and became a 10-second vertical Mac render in Approvals. Approve exposed the
5,167,908-byte MP4 in Clips; download 302 to Blob, Blob HEAD 200. An
unapproved render returned 404. Denying the temporary QA clip removed it from
Clips and changed its download to 404. A separate browser job uploaded an
eight-second excerpt of owner-provided music and completed with
`musicApplied=true`. At 390px width the phone-size drawer showed all seven
links with no horizontal overflow. Test QA review jobs were denied; Approvals
now has a truthful empty state. One earlier real Dean test clip stays published
and is labeled as a non-viral test. A physical iPhone has not been tested.

Code now includes all seven hosted workspace pages, direct browser-to-Vercel
Blob upload, manual video range selection, title editing, an optional music
upload, a queued FFmpeg job processed by the Mac, and Approve/Deny review.
Electron local approval gained caption/title/music finishing. Neon schema was
pushed. A real cloud worker test rendered 10 seconds with transcription and
visible caption pixels. The old caption method stacked text on exact change
frames, so it was replaced by a single RGBA caption track; the revised worker
completed a new real 10-second job with a 1080x1920, 4,911,611-byte Blob
render and visible single captions. Electron finishing returned HTTP 200 on a real
32.133-second Dean cut. Its new MP4 is 1080x1920 and 11,814,799 bytes; a
caption is visibly present at 28.5s; registry status became approved; and its
download returned HTTP 200 video/mp4. A second real local clip was approved
with an eight-second excerpt of an existing owner beat, reporting
musicApplied=true. These local test clips were not published to Vercel. The
generated title is editable, not a verified viral judgment.

Proof already obtained: `npx tsc --noEmit` exit 0, `npm test` 29/29,
`npm run build` exit 0, `bash scripts/build-mac-app.sh` exit 0, `prisma db push`
exit 0. LaunchAgent `com.streetethics.studio-worker` is running. Dean's
watchlist is empty and recording stopped at the owner's request; leave it off.

Remaining: real footage/transcript-based viral scoring, a general long-video
timeline, and physical iPhone QA. The production browser upload had no usable
speech captions; another real worker render showed captions. Whisper output
still needs human review. Mac studio worker must remain awake and connected to
process hosted jobs. TypeScript, 29/29 tests, Next build, Electron package,
and Neon RLS query passed before deployment. Read `docs/STUDIO_PLAN.md` for
the detailed plan. Never print secrets or database URLs.

New owner direction on 2026-11-16: expand the hosted site from viewer to
creator. Girlfriend should upload long videos and select clip ranges on her
laptop/iPhone. Both hosted and Electron should show a review queue with preview,
Approve, Deny, real captions and an editable title, plus optional user-provided
music. Deny should remove the item from the active queue without pretending
that media analysis ran. The owner stopped Dean live monitoring; leave it
stopped. Existing Blob + Neon are enough for MVP; R2 is optional later if
storage/egress costs justify it. FFmpeg jobs need a separate worker, initially
on the Mac, not a Vercel function. The deployed result is documented above.

2026-11-16: The active repository is `/Users/homegrownentllc/clip-mvp`.
The installed Electron app lives in `/Applications` and its Desktop icon is a
shortcut. At this earlier checkpoint, the Mac watcher alone recorded and cut
Kick video, and the hosted site was a viewer. The creator workflow above
supersedes that hosted scope.

Cloud setup verified: Neon Postgres schema pushed; all seven tables have RLS
enabled, zero policies, and no public SELECT. Vercel Blob is connected. The
owner login uses a scrypt hash on the household row; the shared access code is
a Vercel secret. Do not log, print, or commit credentials.

The publish script reads actual Mac registries, checks source and render files,
uploads only approved clips, and upserts rows. One real Dean clip is published
as `TEST CLIP - not a viral pick`. A repeat run reported ALREADY. The hosted
Clips page reads approved rows and the render download route checks approval.

Radar in the rebuilt Electron app has a manual timestamp control. It accepts
stream elapsed time, Mac time, or Mark now. An actual request returned 201 with
a 40.014-second vertical render. The live buffer is about four minutes; old
timestamps cannot be recovered from it.

Local verification: TypeScript exit 0, 29/29 tests, Next build exit 0,
Electron build/install exit 0, app visually opened without login. The live
song-preview draft at `~/Downloads/HGE Clips/test-edits/` is not published;
its lyric transcription was too unreliable to use as subtitles.

The Mac Clip Inbox was corrected so the owner can preview unapproved vertical
renders and approve or deny each clip. The fake empty Approvals screen now
routes to the real inbox. HTTP checked an unapproved render: preview 206 with
1024 MP4 bytes for a range request, download 404. No status was changed in
this check. The rebuilt Electron app was installed again.

Commit `3c674ab` was pushed to `main`; Vercel deployment
`clip-jy4rpj4if-team-homegrown.vercel.app` reached Ready. The stable production
URL returned 307 from `/` to `/login`, and `/login` returned 200. Both the
real access-code and owner-email logins returned 200 with session cookies;
each opened `/clips` with 200. The real test clip was present. Its approved
render returned 302 to Blob. The same render returned 404 while the test clip
was temporarily unapproved; approval was restored.

No Vercel FFmpeg cutting or automatic viral scoring exists. The most likely next
failure is the Mac worker stopping; the hosted site has no FFmpeg cutter. Blob URLs
are public to anyone holding the URL. The song-preview edit remains a local
draft, unpublished.
