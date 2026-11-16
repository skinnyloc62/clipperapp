#!/usr/bin/env bash
# Generates fixtures/sample-30s.mp4 (30s 720p testsrc) for local acceptance.
# Requires system ffmpeg. Output is gitignored; never commit the mp4.
set -euo pipefail
OUT="$(cd "$(dirname "$0")/../fixtures" && pwd)/sample-30s.mp4"
ffmpeg -y -f lavfi -i "testsrc=size=1280x720:rate=30:duration=30" \
  -f lavfi -i "sine=frequency=440:duration=30" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT"
echo "wrote $OUT"
