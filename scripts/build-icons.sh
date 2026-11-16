#!/usr/bin/env bash
#
# Build every icon the app uses from one source image.
#
# Source: build/icon-source.jpg — the HGE Clippers shield on black.
# Outputs:
#   build/icon.icns            macOS bundle icon (electron-builder)
#   src/app/icon.png           Next.js app icon (512)
#   src/app/apple-icon.png     iOS/touch icon (180)
#   src/app/favicon.ico        browser tab (16/32/48)
#
# Run after replacing the source:  bash scripts/build-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/build/icon-source.jpg"
OUT="$ROOT/build"

[ -f "$SRC" ] || { echo "ERROR: missing $SRC" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# macOS icons are drawn on a 1024 grid with the artwork inset. Trimming first
# removes the source's own padding so the emblem is centred against the icon
# grid rather than against whatever margin the export happened to have.
magick "$SRC" -fuzz 5% -trim +repage -resize 896x896 \
  -background black -gravity center -extent 1024x1024 \
  "$TMP/base.png"

# Big Sur-style rounded square. macOS does not round .icns files for you; the
# shape is baked into the artwork with transparent corners.
magick -size 1024x1024 xc:none -fill white \
  -draw "roundrectangle 0,0,1023,1023,230,230" "$TMP/mask.png"
magick "$TMP/base.png" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite \
  "$TMP/icon_1024.png"

ICONSET="$TMP/icon.iconset"
mkdir -p "$ICONSET"
for spec in "16 icon_16x16" "32 icon_16x16@2x" "32 icon_32x32" "64 icon_32x32@2x" \
            "128 icon_128x128" "256 icon_128x128@2x" "256 icon_256x256" \
            "512 icon_256x256@2x" "512 icon_512x512" "1024 icon_512x512@2x"; do
  set -- $spec
  sips -z "$1" "$1" "$TMP/icon_1024.png" --out "$ICONSET/$2.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT/icon.icns"

magick "$TMP/icon_1024.png" -resize 512x512 "$ROOT/src/app/icon.png"
magick "$TMP/icon_1024.png" -resize 180x180 "$ROOT/src/app/apple-icon.png"
magick "$TMP/icon_1024.png" -define icon:auto-resize=48,32,16 "$ROOT/src/app/favicon.ico"

echo "icon.icns        $(du -h "$OUT/icon.icns" | cut -f1)"
echo "src/app/icon.png $(magick identify -format '%wx%h' "$ROOT/src/app/icon.png")"
echo "apple-icon.png   $(magick identify -format '%wx%h' "$ROOT/src/app/apple-icon.png")"
echo "favicon.ico      $(magick identify -format '%wx%h' "$ROOT/src/app/favicon.ico")"
