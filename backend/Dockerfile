# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy everything first (Railway may build from repo root or backend root)
COPY . .

# Handle both build contexts: repo root (backend/prisma) or backend root (prisma)
# If prisma is in backend/, copy backend files to root
RUN if [ -d ./backend/prisma ] && [ ! -d ./prisma ]; then \
      echo "Detected repo root build context, copying backend files to root..." && \
      cp -r ./backend/* ./ && \
      cp -r ./backend/.* ./ 2>/dev/null || true; \
    fi

# Ensure package.json is in root for npm ci
RUN if [ ! -f ./package.json ] && [ -f ./backend/package.json ]; then \
      cp ./backend/package*.json ./; \
    fi

# Install dependencies
RUN npm ci

# Verify prisma directory exists
RUN if [ ! -f ./prisma/schema.prisma ]; then \
      echo "ERROR: prisma/schema.prisma not found!" && \
      echo "Current directory contents:" && \
      ls -la && \
      echo "Looking for prisma directory:" && \
      find . -name "schema.prisma" -type f 2>/dev/null || echo "schema.prisma not found anywhere" && \
      exit 1; \
    fi

# Make start.sh executable
RUN chmod +x ./start.sh

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies including prisma for migrations
COPY package*.json ./
RUN npm ci --only=production && npm install prisma@6.19.0 --save

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
# Use node to check health endpoint (wget not available in Alpine by default)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use startup script that runs migrations then starts server
# Use exec form to ensure the script runs properly even if Railway overrides CMD
CMD ["./start.sh"]


