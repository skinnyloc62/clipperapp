# Render chain worker contract (based on reported clip-chain demonstration)

**Provenance:** The owner provided a *report* of a separate generated `clip-chain.skill`, not the actual skill archive. That external report says PySceneDetect detected 3 cuts, Auto-Editor trimmed silence, FFmpeg produced portrait videos with logo and highlighted captions, and machine QA passed for a test fixture. It **also says WhisperX and Remotion were untested** and that local `install.sh` destinations were guesses. This document is the HGE integration contract, not an independent reproduction of those results.

## Worker pipeline

`owner-authorized asset ID -> ffprobe with sandboxed process & limits -> audio extraction -> timestamped transcription (WhisperX when installed/tested; validated fallback otherwise) -> scene segmentation (PySceneDetect) -> candidate selection (ranker) -> silence cut plan (Auto-Editor or FFmpeg with content exceptions) -> source-to-render timestamp map -> face/game framing and manual crop validation -> captions + owner brand -> FFmpeg primary renderer -> optional Remotion motion graphics only after integration tests -> final encode -> machine QA -> owner QA -> approval.md + immutable render artifact.`

## Important timing rule

All source `start_seconds/end_seconds` refer to original media. If silence is trimmed, generate an explicit **edit decision list** mapping every retained source interval to new output timeline. Apply this same mapping to word timestamps. Do not simply copy pretrim WhisperX timestamps onto trimmed output. Test subtitles on multiple cuts, boundary words and pauses.

## Required worker metadata

Store `source_asset_id`, `owner_id`, `brand_id`, `source_checksum`, `tool_versions`, `requested_dimensions`, `source_intervals`, `timeline_map`, `subtitle_version`, `render_job_id`, `output_asset_id`, `output_sha256`, `ffprobe_json`, `QA_result`, `approval_record`, `created_at`.

## Render technical defaults (not platform mandates)

Default `1080x1920` 9:16, H.264 video, AAC audio; choose FPS consistent with source, preserve speech clarity, use source-aware loudness targets (reported test ~-14 LUFS is an **app preset**, not universal Shorts requirement). Use vertical crop, face/game split, or blur-pad based on actual frame analysis. Keep captions inside verified platform safe zones and gameplay unobstructed. Validate `crop_x/crop_y` by real preview; model cannot guarantee a correct crop without frame evidence.

## Quality gates

Machine: output file exists and checksum matches; probe duration/aspect/codecs/fps; decode/keyframes; no accidental leading silence/black frames; no clipping; loudness measured; subtitle sync spotchecks using timeline map; correct watermark resource; no unexpected copy of private source. Editorial: hook truth, enough context, real payoff, readable face and gameplay. Rights: licensed source/music; target platform/brief. No `PASS` without the actual artifact and test evidence.

## MVP rollout

- Stage A: FFmpeg basic trim/encode and captions using an authenticated owned asset; automated tests and manual visual review.
- Stage B: install and confirm `whisperx --help` in actual target environment; run on a real audio file and inspect timestamp output. Fix CLI/options for installed version.
- Stage C: validate PySceneDetect and Auto-Editor versions and stable options on representative footage; keep silent-section trim optional for gameplay.
- Stage D: optional Remotion contract, then actual rendering integration and cross-check.
- Stage E: worker execution in isolated environment, bounded CPU/GPU, scheduled cleanup, safe retries and replay of failures.

## Job approval file `approval.md`

Record unique job/asset IDs, preview URI behind auth, approved source rights reference, editor/reviewer identity, target brand/platform/account, caption, resolved QA issues, approval timestamp, approver action and any subsequent version change. A generated `approval.md` alone is **not** owner approval; it must capture a real authenticated approval event.
