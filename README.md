# clip-mvp (Section 1 scaffold)

Vercel-first clip pipeline skeleton. Section 1 only: no DB connection, no
storage writes, no secrets.

## Prerequisites

- node >= 20, npm, system `ffmpeg`/`ffprobe` (for real validate probes)

## Run

```bash
cd /Users/homegrownentllc/clip-mvp
cp .env.example .env   # optional for Section 1; nothing required to be filled
npm install
npm run dev            # http://localhost:3000 — dashboard shell
npm test               # node --test smoke suite
```

## Try it (dev server running, after `npm run db:seed`)

```bash
# log in (dev passwords are printed by the seed script)
curl -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"husband@streetethics.local","password":"<from seed output>"}'
# 1. small upload (multipart, local dev) -> {assetId, stored:true}
curl -b jar.txt -F file=@fixtures/sample-30s.mp4 http://localhost:3000/api/uploads
# 2. big upload (5.9MB) -> 413 {code:"use_client_upload"}
curl -b jar.txt -F file=@fixtures/sample-big.mp4 http://localhost:3000/api/uploads
# 3. token issuance (local-direct, no Blob) -> {assetId, uploadUrl}
curl -b jar.txt -X POST http://localhost:3000/api/uploads/token \
  -H 'content-type: application/json' \
  -d '{"filename":"clip.mp4","contentType":"video/mp4","size":5933054}'
# 4. validate by asset ID (never a path) -> {valid:true, durationSec,...}
curl -b jar.txt -X POST http://localhost:3000/api/clips/validate \
  -H 'content-type: application/json' \
  -d '{"assetId":"<assetId from step 1>"}'
```

## Layout

- `src/app/page.tsx` — dashboard shell (Overview/Inbox/Editor/Approval placeholders)
- `src/app/api/uploads/route.ts` — upload stub (size/type checks, no persistence)
- `src/app/api/clips/validate/route.ts` — validate stub + real ffprobe when given a local `filePath`
- `src/lib/ffmpeg.ts`, `src/lib/validators.ts` — probe helper + zod schemas/limits
- `prisma/schema.prisma` — 7 Phase 1 models (needs `DATABASE_URL` from Section 2 on)
- `fixtures/sample-clip.json`, `scripts/make-sample-mp4.sh` — sample fixture
- `tests/smoke.test.mjs` — `npm test` contract suite
