# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (for better layer caching)
# Try webapp/package*.json first (repo root context), fallback handled below
COPY . ./temp_copy

# Handle both build contexts: repo root (webapp/) or webapp root (.)
RUN if [ -d ./temp_copy/webapp ] && [ -f ./temp_copy/webapp/package.json ]; then \
      echo "Detected repo root build context, copying webapp files..." && \
      cp -r ./temp_copy/webapp/* ./ && \
      cp -r ./temp_copy/webapp/.* ./ 2>/dev/null || true; \
    else \
      echo "Detected webapp root build context, copying files..." && \
      cp -r ./temp_copy/* ./ && \
      cp -r ./temp_copy/.* ./ 2>/dev/null || true; \
    fi && \
    rm -rf ./temp_copy

# Verify package.json exists
RUN if [ ! -f ./package.json ]; then \
      echo "ERROR: package.json not found!" && \
      echo "Current directory:" && \
      ls -la && \
      exit 1; \
    fi

# Install dependencies
RUN npm ci

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

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Install production dependencies
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


