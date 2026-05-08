#!/usr/bin/env bash
# Wrapper for the golden tool-routing test.
#
# Sources .env.golden (gitignored) so the user can keep
# OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY out of their
# shell rc and out of git. Already-set env vars from the parent shell
# take precedence over the file.
#
# Usage:
#   pnpm test:golden
#
# Setup once:
#   cp .env.golden.example .env.golden  # or create from scratch
#   $EDITOR .env.golden                  # paste the keys you have
#   chmod 600 .env.golden                # belt and braces
#
# The test itself skips any provider whose key isn't set, so you can
# run with just one key.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.golden ]]; then
    # shellcheck disable=SC1091
    set -a
    . ./.env.golden
    set +a
fi

cd src-tauri
exec cargo test --test golden_tool_routing --release -- --nocapture
