# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (Railway builds from backend/ directory as root)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy start.sh first (before copying everything else, to ensure it's included)
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies including prisma for migrations
COPY package*.json ./
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
# Use node to check health endpoint (wget not available in Alpine by default)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use startup script that runs migrations then starts server
# Use exec form to ensure the script runs properly even if Railway overrides CMD
CMD ["./start.sh"]


