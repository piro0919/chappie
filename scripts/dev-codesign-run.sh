#!/usr/bin/env bash
# Cargo runner used by `cargo run` (and therefore `pnpm tauri dev`) on macOS.
#
# Why this exists: a vanilla `cargo run` produces a "linker-signed" ad-hoc
# binary whose code-signing identifier embeds a random hash that changes
# every rebuild. macOS TCC tracks granted permissions (Screen Recording
# in particular) by that identifier, so the entry the user added in
# System Settings is invalidated on the very next rebuild — the dev binary
# can never hold onto the permission across iterations.
#
# Re-signing the binary with a stable identifier (`io.kkweb.chappie`,
# matching the production bundle ID) before launch makes the TCC entry
# stick across rebuilds. Adds ~0.4 s per `cargo run`. No effect on
# `cargo build` / `cargo check` or on `pnpm tauri build` (the production
# build path does its own signing via tauri-build).

set -euo pipefail

BINARY="$1"
shift

if [[ "$(uname -s)" == "Darwin" ]]; then
    codesign --sign - --force --identifier io.kkweb.chappie "$BINARY" \
        >/dev/null 2>&1 || true
fi

exec "$BINARY" "$@"
