# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from backend directory (Railway builds from repo root)
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy start.sh first (before copying everything else, to ensure it's included)
COPY backend/start.sh ./start.sh
RUN chmod +x ./start.sh

# Copy source code from backend directory
COPY backend/ .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies including prisma for migrations
COPY backend/package*.json ./
RUN npm ci --only=production && npm install prisma --save

# Copy built files and Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy startup script from builder stage (already copied there)
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create non-root user and ensure it owns the app directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check (backend listens on port 3000 internally, PORT env is for external)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --spider --quiet http://localhost:3000/health || exit 1

# Use startup script that runs migrations then starts server
# Inline the commands to avoid Railway auto-detection issues
CMD ["/bin/sh", "-c", "if [ -n \"$DATABASE_URL\" ] && echo \"$DATABASE_URL\" | grep -q \"^postgres\"; then npx prisma migrate resolve --rolled-back 20251112153000_meeting_reminders 2>/dev/null || npx prisma migrate resolve --applied 20251112153000_meeting_reminders 2>/dev/null || true; npx prisma migrate deploy || echo 'Migration failed but continuing...'; fi && exec node dist/server.js"]


