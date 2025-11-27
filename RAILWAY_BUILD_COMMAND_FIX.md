# Railway Build Command Fix

## Problem

Railway's Railpack is auto-detecting the build command and including `npx prisma migrate deploy`, which fails because `DATABASE_URL` isn't available during the build phase.

## Solution

You need to **manually set the build command** in Railway Dashboard to exclude migrations.

### Steps:

1. **Go to Railway Dashboard**
2. **Select your Backend service**
3. **Go to Settings tab**
4. **Find "Build Command" section**
5. **Change it from:**
   ```
   cd backend && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
   ```
   
   **To:**
   ```
   cd backend && npm ci && npx prisma generate && npm run build
   ```

6. **Save changes**
7. **Redeploy the service**

## Alternative: Use the build script

Or you can use the new `build:railway` script:
```
cd backend && npm run build:railway
```

## Why This Works

- **Build phase**: Only compiles TypeScript and generates Prisma client (no DATABASE_URL needed)
- **Startup phase**: Migrations run automatically when server starts (DATABASE_URL is available)
- **No build failures**: Build completes successfully even without database connection

## Migration Flow

1. Railway builds the code ✅
2. Railway starts the server
3. Server checks for `DATABASE_URL`
4. If found, runs migrations automatically ✅
5. Server continues starting normally ✅

This way, migrations run at the right time (when DATABASE_URL is available) instead of during build.

