#!/usr/bin/env bash
#
# Package the app as a runnable macOS .app for local testing.
#
# Why a staging directory: the Next server must sit beside Electron's main.js on
# plain disk (asar is disabled), and it must NOT drag the repo's dev dependencies
# into the bundle. Staging a tiny project with an empty dependency list makes
# electron-builder copy exactly the standalone server tree and nothing else.
#
# Usage:  npm run app:mac
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$ROOT/electron-build/app"
OUT="$ROOT/electron-build/out"

cd "$ROOT"

if pgrep -f "next dev" >/dev/null 2>&1; then
  echo "ERROR: a Next dev server is running. It shares .next/ and will corrupt this build." >&2
  echo "       Stop it first (Ctrl-C, or: pkill -f 'next dev'), then re-run." >&2
  exit 1
fi

echo "==> Building Next.js standalone bundle"
rm -rf "$ROOT/.next/standalone" "$STAGE" "$OUT"
ELECTRON_BUILD=1 npx next build

# Normally `.next/standalone/server.js`. If Next ever infers a different tracing
# root again it nests one level deeper, so locate the entry point instead of
# assuming the flat layout.
SERVER_JS="$(find "$ROOT/.next/standalone" -maxdepth 2 -name server.js -print -quit 2>/dev/null || true)"
if [ -z "$SERVER_JS" ]; then
  echo "ERROR: standalone server.js was not produced." >&2
  exit 1
fi
STANDALONE_ROOT="$(dirname "$SERVER_JS")"
echo "    standalone root: ${STANDALONE_ROOT#$ROOT/}"

echo "==> Staging app"
mkdir -p "$STAGE/server" "$STAGE/build"

# The standalone output does not include static assets or public/ — copy them in.
cp -R "$STANDALONE_ROOT/." "$STAGE/server/"

# Next copies .env* and the traced .data tree into standalone. Both must not ship:
#  - .env holds the Supabase secret key and the hosted APP_PASSWORD. The desktop
#    app supplies its own environment from electron/main.js, and a .env inside the
#    bundle would be read by the spawned server and silently re-add DATABASE_URL.
#  - .data is this machine's local dev state, not part of the app.
rm -rf "$STAGE/server/.env" "$STAGE/server/.env.local" "$STAGE/server/.env.production" \
       "$STAGE/server/.env.development" "$STAGE/server/.data"

if [ -e "$STAGE/server/.env" ]; then
  echo "ERROR: .env survived staging; refusing to ship secrets inside the app." >&2
  exit 1
fi

mkdir -p "$STAGE/server/.next/static"
cp -R "$ROOT/.next/static/." "$STAGE/server/.next/static/"
if [ -d "$ROOT/public" ]; then
  cp -R "$ROOT/public" "$STAGE/server/public"
fi

cp "$ROOT/electron/main.js" "$STAGE/main.js"
cp "$ROOT/electron/preload.js" "$STAGE/preload.js"
cp "$ROOT/build/icon.icns" "$STAGE/build/icon.icns"

cat > "$STAGE/package.json" <<'JSON'
{
  "name": "street-ethics-clip-engine",
  "version": "0.1.0",
  "private": true,
  "description": "Street Ethics Clip Engine (desktop)",
  "author": "Street Ethics",
  "main": "main.js"
}
JSON

# Builder config goes in its own file. Passing package.json to --config makes
# electron-builder validate the whole npm manifest as a builder config and it
# rejects name/main/description. A dedicated file is also the only way to keep
# `build` out of a package.json that Electron itself will read.
#
# This staging project deliberately has no dependencies, so electron-builder
# cannot infer an Electron build from a local node_modules and would otherwise
# reject the caret range in the real manifest (or try to download a runtime).
# Pin the exact version and point it at the copy already installed in the repo.
ELECTRON_VERSION="$(node -p "require('$ROOT/node_modules/electron/package.json').version")"
[ -d "$ROOT/node_modules/electron/dist/Electron.app" ] || {
  echo "ERROR: electron runtime missing. Run: node node_modules/electron/install.js" >&2
  exit 1
}

cat > "$STAGE/electron-builder.json" <<JSON
{
  "appId": "com.streetethics.clipengine",
  "productName": "Street Ethics Clip Engine",
  "electronVersion": "$ELECTRON_VERSION",
  "electronDist": "../../node_modules/electron/dist",
  "asar": false,
  "directories": {
    "output": "../out",
    "buildResources": "build"
  },
  "files": [
    "main.js",
    "preload.js",
    "package.json",
    "server/**/*"
  ],
  "mac": {
    "icon": "icon.icns",
    "category": "public.app-category.video",
    "target": [
      {
        "target": "dir",
        "arch": ["arm64"]
      }
    ]
  }
}
JSON

echo "==> Packaging .app"
cd "$STAGE"
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir --config electron-builder.json

APP_PATH="$OUT/mac-arm64/Street Ethics Clip Engine.app"
if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: expected app bundle at $APP_PATH" >&2
  ls -la "$OUT" || true
  exit 1
fi

echo "==> Verifying bundle"
fail() { echo "ERROR: $*" >&2; exit 1; }

RES="$APP_PATH/Contents/Resources/app"
[ -f "$RES/server/server.js" ] || fail "server/server.js missing from bundle"
[ -f "$RES/main.js" ] || fail "main.js missing from bundle"
[ -f "$APP_PATH/Contents/Resources/icon.icns" ] || fail "icon.icns not embedded"

# Secrets and local dev state must never ship inside the app.
LEAKED="$(cd "$APP_PATH" && find . \( -name '.env' -o -name '.env.*' -o -name '.data' \) -print 2>/dev/null || true)"
if [ -n "$LEAKED" ]; then
  echo "$LEAKED" >&2
  fail ".env/.data found inside the bundle; refusing to install it"
fi

echo "    server.js, main.js, icon.icns present; no .env/.data"

# Install next to the other self-built apps so Spotlight, Launchpad, and the
# Dock all find it by name. Quit a running copy first: replacing a bundle while
# macOS has it open leaves the old process running against deleted inodes.
INSTALLED="/Applications/Street Ethics Clip Engine.app"
echo "==> Installing to /Applications"
osascript -e 'tell application "Street Ethics Clip Engine" to quit' >/dev/null 2>&1 || true
pkill -f "/Applications/Street Ethics Clip Engine.app" >/dev/null 2>&1 || true
sleep 2
rm -rf "$INSTALLED"
ditto "$APP_PATH" "$INSTALLED"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$INSTALLED"

# Desktop shortcut is a symlink to the installed copy, never a second 300 MB bundle.
SHORTCUT="$HOME/Desktop/Street Ethics Clip Engine.app"
echo "==> Refreshing the Desktop shortcut"
rm -rf "$SHORTCUT"
ln -s "$INSTALLED" "$SHORTCUT"

echo
echo "Built:     $APP_PATH"
echo "Installed: $INSTALLED"
echo "Shortcut:  $SHORTCUT"
