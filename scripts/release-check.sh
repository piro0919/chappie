#!/usr/bin/env bash
# Pre-flight for `pnpm release`. Refuses to publish when what would be
# uploaded can't be tied to one commit and one version.
#
#   scripts/release-check.sh create   before `gh release create`
#   scripts/release-check.sh upload   before `gh release upload`
#
# Checks:
#   - the working tree is clean (no uncommitted or untracked files)
#   - package.json and src-tauri/tauri.conf.json agree on the version
#   - the tag v<version>, wherever it already exists (locally or on
#     origin), points at HEAD; for `upload` it must exist on origin
#   - for `upload`, the built Chappie.app reports the same version
set -euo pipefail

stage="${1:-}"
if [[ "$stage" != "create" && "$stage" != "upload" ]]; then
  echo "usage: $0 create|upload" >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

fail() {
  echo "release-check: $*" >&2
  exit 1
}

dirty="$(git status --porcelain)"
if [[ -n "$dirty" ]]; then
  echo "$dirty" >&2
  fail "working tree is not clean; commit or remove the files above first"
fi

pkg_version="$(node -p "require('./package.json').version")"
tauri_version="$(node -p "require('./src-tauri/tauri.conf.json').version")"
if [[ "$pkg_version" != "$tauri_version" ]]; then
  fail "package.json is $pkg_version but tauri.conf.json is $tauri_version"
fi

tag="v$pkg_version"
head="$(git rev-parse HEAD)"

if local_sha="$(git rev-parse -q --verify "refs/tags/$tag^{commit}")"; then
  [[ "$local_sha" == "$head" ]] || fail "local tag $tag points at $local_sha, not HEAD ($head)"
fi

# Peeled entry (^{}) first so an annotated tag compares by its commit.
remote_sha="$(git ls-remote --tags origin "refs/tags/$tag^{}" | cut -f1)"
if [[ -z "$remote_sha" ]]; then
  remote_sha="$(git ls-remote --tags origin "refs/tags/$tag" | cut -f1)"
fi
if [[ -n "$remote_sha" && "$remote_sha" != "$head" ]]; then
  fail "tag $tag on origin points at $remote_sha, not HEAD ($head)"
fi

if [[ "$stage" == "upload" ]]; then
  [[ -n "$remote_sha" ]] || fail "tag $tag does not exist on origin; run release:create first"
  plist="src-tauri/target/release/bundle/macos/Chappie.app/Contents/Info.plist"
  [[ -f "$plist" ]] || fail "$plist not found; run the release build first"
  built="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$plist")"
  [[ "$built" == "$pkg_version" ]] || fail "built app is $built but package.json is $pkg_version; rebuild first"
fi

echo "release-check ($stage): $tag at $head"
