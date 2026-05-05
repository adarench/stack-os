#!/usr/bin/env bash
# Push all non-empty, non-comment vars from web/.env.local to Vercel for
# all three environments (production, preview, development).

set -uo pipefail

cd "$(dirname "$0")/../web"

if [[ ! -f .env.local ]]; then
  echo "no web/.env.local"
  exit 1
fi

# Read .env.local on FD 3 so vercel subcommands keep their own stdin.
while IFS='=' read -r raw_key raw_value <&3 || [[ -n "$raw_key" ]]; do
  [[ -z "$raw_key" ]] && continue
  [[ "$raw_key" =~ ^[[:space:]]*# ]] && continue

  key=$(echo "$raw_key" | tr -d '[:space:]')
  value=${raw_value%\"}
  value=${value#\"}

  if [[ -z "$value" ]]; then
    echo "skip $key (empty)"
    continue
  fi

  ok_envs=()
  for env in production preview development; do
    vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    # Preview requires an explicit empty git-branch arg to mean "all branches".
    if [[ "$env" == "preview" ]]; then
      add_args=("$key" "preview" "" --value "$value" --yes)
    else
      add_args=("$key" "$env" --value "$value" --yes)
    fi
    if vercel env add "${add_args[@]}" >/dev/null 2>&1; then
      ok_envs+=("$env")
    else
      echo "  ! failed: $key for $env"
    fi
  done
  echo "set $key (${ok_envs[*]})"
done 3< .env.local

echo ""
echo "Final state:"
vercel env ls 2>&1 | sed -n '/^ name/,/Common next/p' | head -30
