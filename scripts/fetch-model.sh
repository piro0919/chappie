#!/usr/bin/env bash
set -euo pipefail
DEST="$HOME/.chappie/models/ggml-small.bin"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
mkdir -p "$(dirname "$DEST")"
if [ -s "$DEST" ]; then
  echo "model already present at $DEST"
  exit 0
fi
echo "downloading whisper small model to $DEST..."
curl -L --fail -o "$DEST.part" "$URL"
mv "$DEST.part" "$DEST"
echo "done"
