#!/bin/bash
# Environment variables setup for wallet-backend

# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

echo "JWT_SECRET=$JWT_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "JWT_EXPIRES_IN=7d"
echo "PORT=4000"
echo "NODE_ENV=production"

