#!/bin/sh
# Script to resolve failed migration in Railway
# This marks the failed migration as rolled back so new migrations can run

echo "Resolving failed migration: 20251112153000_meeting_reminders"
echo "This will mark it as rolled back so new migrations can proceed..."

npx prisma migrate resolve --rolled-back 20251112153000_meeting_reminders || {
  echo "Failed to resolve migration. Trying to mark as applied instead..."
  npx prisma migrate resolve --applied 20251112153000_meeting_reminders || {
    echo "Could not resolve migration. You may need to manually fix the database."
    exit 1
  }
}

echo "Migration resolved successfully!"
echo "Now running migrations..."
npx prisma migrate deploy


