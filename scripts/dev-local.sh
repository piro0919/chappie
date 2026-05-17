#!/usr/bin/env bash
# Run `pnpm tauri dev` with .env.local sourced into the process env so
# the Rust side picks up CHAPPIE_PROXY_URL (Vite picks VITE_* up
# automatically from .env.local — this script is only needed for the
# non-prefixed vars that Rust reads via std::env::var).
set -euo pipefail

if [[ ! -f .env.local ]]; then
  echo "error: .env.local not found at repo root" >&2
  echo "       expected vars: CHAPPIE_PROXY_URL, VITE_CHAPPIE_PROXY_URL" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

exec pnpm tauri dev
