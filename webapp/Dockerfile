# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from webapp directory (Railway builds from repo root)
COPY webapp/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code from webapp directory
COPY webapp/ .

# Build Next.js app
# Railway automatically passes environment variables as build args
# We need to accept them and set them as ENV vars for Next.js build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_OLLAMA_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_OLLAMA_URL=${NEXT_PUBLIC_OLLAMA_URL}

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install production dependencies
COPY webapp/package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

# Health check (uses PORT env var)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000), (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]


