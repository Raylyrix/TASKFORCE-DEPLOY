#!/bin/sh
# Only run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL found, running migrations..."
  npx prisma migrate deploy
else
  echo "DATABASE_URL not set, skipping migrations (will run on first deploy)"
fi



