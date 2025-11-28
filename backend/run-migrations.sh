#!/bin/sh
echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations completed!"

