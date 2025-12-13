FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client before build
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Install Prisma CLI for migrations
RUN npm install -g prisma@latest

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'if [ -n "$DATABASE_URL" ]; then' >> /app/start.sh && \
    echo '  echo "Running database migrations..."' >> /app/start.sh && \
    echo '  npx prisma migrate deploy || echo "Migration failed or already applied"' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "WARNING: DATABASE_URL not set, skipping migrations"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Starting server..."' >> /app/start.sh && \
    echo 'exec node dist/server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

USER nodejs

EXPOSE 4000

ENV PORT=4000

CMD ["/app/start.sh"]

