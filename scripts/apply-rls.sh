#!/usr/bin/env bash
# Apply prisma/rls-lockdown.sql over the DIRECT connection.
#
# Why not `prisma db execute --schema prisma/schema.prisma`? That resolves to
# DATABASE_URL, which on Supabase is the transaction pooler (port 6543). DDL
# through the pooler is the thing Prisma's own docs warn about, so this script
# insists on DIRECT_URL (port 5432 / session mode).
#
# Usage: npm run db:rls
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DIRECT_URL:-}" ]; then
  echo "db:rls: DIRECT_URL is not set. Add it to .env or export it (direct/session" >&2
  echo "        connection string, port 5432 — not the 6543 pooler)." >&2
  exit 1
fi

exec npx prisma db execute --file prisma/rls-lockdown.sql --url "$DIRECT_URL"
