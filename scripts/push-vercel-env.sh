#!/usr/bin/env bash
# Push all non-empty, non-comment vars from web/.env.local to Vercel for
# all three environments (production, preview, development).

cd "$(dirname "$0")/../web"

if [[ ! -f .env.local ]]; then
  echo "no web/.env.local"
  exit 1
fi

# Read entire file into a temp file we'll process line-by-line via sed —
# avoids macOS bash 3.2 missing-mapfile issue and stdin contention.
tmp=$(mktemp)
cp .env.local "$tmp"
trap 'rm -f "$tmp" /tmp/vercel-env-add.out' EXIT

i=0
total=$(wc -l < "$tmp")
while [[ $i -lt $total ]]; do
  i=$((i + 1))
  line=$(sed -n "${i}p" "$tmp")
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  raw_key="${line%%=*}"
  raw_value="${line#*=}"
  key=$(echo "$raw_key" | tr -d '[:space:]')
  value=${raw_value%\"}
  value=${value#\"}

  if [[ -z "$value" ]]; then
    echo "skip $key (empty)"
    continue
  fi

  succeeded=""
  for env in production preview development; do
    vercel env rm "$key" "$env" --yes < /dev/null > /dev/null 2>&1 || true
    if [[ "$env" == "preview" ]]; then
      vercel env add "$key" "preview" "" --value "$value" --yes < /dev/null > /tmp/vercel-env-add.out 2>&1
    else
      vercel env add "$key" "$env" --value "$value" --yes < /dev/null > /tmp/vercel-env-add.out 2>&1
    fi
    rc=$?
    if [[ $rc -eq 0 ]]; then
      succeeded="$succeeded $env"
    else
      echo "  ! failed: $key for $env (rc=$rc)"
      tail -3 /tmp/vercel-env-add.out | sed 's/^/    /'
    fi
  done
  echo "set $key (${succeeded# })"
done

echo ""
echo "Final state:"
vercel env ls 2>&1 | sed -n '/^ name/,/Common next/p' | head -50
