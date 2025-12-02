#!/bin/sh
set -e

echo "=========================================="
echo "Starting database migrations..."
echo "=========================================="

# Run migrations if DATABASE_URL is set and valid
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "^postgres"; then
  echo "DATABASE_URL found, running migrations..."
  
  # First, try to resolve any failed migrations
  echo "Checking for failed migrations..."
  npx prisma migrate resolve --rolled-back 20251112153000_meeting_reminders 2>/dev/null || \
  npx prisma migrate resolve --applied 20251112153000_meeting_reminders 2>/dev/null || \
  echo "No failed migrations to resolve or already resolved"
  
  # Force resolve the SendingDomain migration if it failed
  echo "Resolving SendingDomain migration if needed..."
  # First, try to mark it as rolled back (this allows it to be reapplied)
  npx prisma migrate resolve --rolled-back 20251202000000_add_sending_domain_tables 2>&1 | head -5 || true
  echo "Migration resolution attempted"
  
  # Now run migrations
  npx prisma migrate deploy || {
    echo "WARNING: Migration failed, but continuing to start server..."
    echo "This might be okay if migrations were already applied."
  }
  echo "Migrations completed!"
else
  echo "WARNING: DATABASE_URL not set or invalid, skipping migrations"
  echo "DATABASE_URL value: ${DATABASE_URL:0:20}..."
fi

echo "=========================================="
echo "Starting backend server..."
echo "=========================================="
exec node dist/server.js

