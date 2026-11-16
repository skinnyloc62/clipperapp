#!/bin/bash
# Generate a >4.5MB test video (exercises the client-upload path, not the fixture path).
set -euo pipefail
OUT="fixtures/sample-big.mp4"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc=size=1280x720:rate=30:duration=60" \
  -f lavfi -i "sine=frequency=440:duration=60" \
  -c:v libx264 -b:v 2M -pix_fmt yuv420p -c:a aac "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
