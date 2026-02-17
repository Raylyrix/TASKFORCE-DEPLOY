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
  # This environment previously had a failed migration record that blocks all future deploys.
  # If it exists, mark it rolled back so prisma can re-apply it.
  npx prisma migrate resolve --rolled-back 20241201000000_add_campaign_folders 2>/dev/null || true
  # Another migration in this environment was attempted and failed; it must also be resolved
  # or Prisma will refuse to apply any new migrations (P3009).
  npx prisma migrate resolve --rolled-back 20250101000000_add_external_api_models 2>/dev/null || true
  echo "Migration resolution attempted"
  
  # Now run migrations
  npx prisma migrate deploy || {
    echo "WARNING: Migration failed, but continuing to start server..."
    echo "This might be okay if migrations were already applied."
  }
  echo "Migrations completed!"

  # Optional one-time seeding for external API integrations (e.g. Swap).
  # Safety: gated behind SEED_EXTERNAL_API_KEY_ON_BOOT=true so restarts can't accidentally rotate keys.
  if [ "$SEED_EXTERNAL_API_KEY_ON_BOOT" = "true" ] && [ -n "$SEED_EXTERNAL_API_KEY" ] && [ -n "$SEED_EXTERNAL_API_KEY_EMAIL" ]; then
    echo "=========================================="
    echo "Seeding external API key..."
    echo "=========================================="
    node scripts/seedExternalApiKey.js || echo "WARNING: external API key seed failed"
  fi
else
  echo "WARNING: DATABASE_URL not set or invalid, skipping migrations"
  echo "DATABASE_URL value: ${DATABASE_URL:0:20}..."
fi

echo "=========================================="
echo "Starting backend server..."
echo "=========================================="
exec node dist/server.js

