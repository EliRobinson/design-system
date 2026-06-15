#!/usr/bin/env bash
set -euo pipefail

output="$(mktemp)"
trap 'rm -f "$output"' EXIT

if pnpm changeset publish 2>"$output"; then
  exit 0
fi

if grep -q 'cannot publish over the previously published versions' "$output"; then
  echo 'Packages already published; skipping duplicate publish.'
  cat "$output" >&2
  exit 0
fi

cat "$output" >&2
exit 1
