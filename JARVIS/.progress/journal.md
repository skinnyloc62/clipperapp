# JARVIS progress — Street Ethics Clip Engine

2026-11-16: The active repository is `/Users/homegrownentllc/clip-mvp`.
The installed Electron app lives in `/Applications` and its Desktop icon is a
shortcut. The Mac watcher alone records and cuts Kick video. The hosted Vercel
site is a viewer for approved published clips.

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

Pending at this journal entry: push the reviewed source to main, check both
production login paths, hosted clip listing, approved download, unapproved 404,
and update this journal with those HTTP results. No hosted cutting or automatic
viral scoring exists.
