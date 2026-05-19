#!/usr/bin/env bash
# Build the release DMG using hdiutil directly. Replaces Tauri's
# built-in DMG bundler (`bundle_dmg.sh`), whose AppleScript Finder
# layout step hangs intermittently and turns every release into a
# coin flip.
#
# Inputs:  src-tauri/target/release/bundle/macos/Chappie.app
# Output:  src-tauri/target/release/bundle/dmg/Chappie_<version>_aarch64.dmg
#
# The output path matches what `pnpm release:upload` already expects,
# so no other scripts change. Run automatically as part of `pnpm tauri build`
# is NOT wired in (Tauri's beforeBuildCommand only runs before frontend
# build); call this explicitly after `pnpm tauri build` via `pnpm dmg`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="${REPO_ROOT}/src-tauri/target/release/bundle/macos/Chappie.app"
DMG_DIR="${REPO_ROOT}/src-tauri/target/release/bundle/dmg"

if [[ ! -d "$APP_PATH" ]]; then
  echo "error: ${APP_PATH} not found. Run 'pnpm tauri build' first." >&2
  exit 1
fi

VERSION="$(node -p "require('${REPO_ROOT}/package.json').version")"
DMG_PATH="${DMG_DIR}/Chappie_${VERSION}_aarch64.dmg"

mkdir -p "$DMG_DIR"

STAGING="$(mktemp -d -t chappie-dmg)"
trap 'rm -rf "$STAGING"' EXIT

# Copy the .app and create the conventional /Applications shortcut so
# the user can drag-install in one step. cp -R preserves the bundle's
# code signature; ln -s makes a relative symlink that points to the
# user's /Applications when the DMG is mounted.
cp -R "$APP_PATH" "$STAGING/Chappie.app"
ln -s /Applications "$STAGING/Applications"

# Remove any stale DMG at the target path — hdiutil refuses to
# overwrite, and we want the build to be idempotent.
rm -f "$DMG_PATH"

# UDZO = zlib-compressed read-only image. Standard for distribution;
# noticeably smaller than uncompressed UDRW. -ov is redundant given
# the rm above but keeps the command tolerant of a re-run race.
hdiutil create \
  -volname "Chappie" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "✓ DMG written: $DMG_PATH"
