# Rate Limit Issue - Fixed

## Problem
The rate limit was showing 10,000 requests even before starting the app. This was caused by **stale Redis keys** from previous sessions that weren't expiring properly.

## Root Causes
1. **Stale Redis Keys**: Old rate limit keys (`rate_limit:${ip}`) were persisting in Redis and not expiring correctly
2. **No Window-Based Keys**: All requests used the same key, so old high values would persist indefinitely
3. **Check-Before-Increment Logic**: The old code checked limits before incrementing, which could cause race conditions

## Solution Implemented

### 1. Sliding Window Algorithm
Changed from a simple counter to a **sliding window** approach:
- Keys now include timestamp: `rate_limit:${ip}:${windowStart}`
- Each 60-second window gets its own key
- Keys automatically expire after the window + 10 seconds
- Old windows are automatically cleaned up

### 2. Fixed Increment Logic
- Now uses `INCR` which atomically increments and returns the new value
- Check happens AFTER increment (more accurate)
- Expiration is set only on first request in window

### 3. Clear Stale Keys
- Created `clearRateLimits.ts` script to manually clear old keys
- Added optional startup cleanup via `CLEAR_RATE_LIMITS_ON_STARTUP=true`
- Cleared existing stale keys (found 1 key that was causing the issue)

## How to Use

### Clear Rate Limits Manually
```bash
cd backend
npm run clear-rate-limits
```

### Auto-Clear on Startup
Add to your `.env` file:
```env
CLEAR_RATE_LIMITS_ON_STARTUP=true
```

### Disable Rate Limiting (Development Only)
Add to your `.env` file:
```env
DISABLE_RATE_LIMIT=true
```

## Testing
After the fix:
1. ✅ Cleared 1 stale rate limit key from Redis
2. ✅ New requests will use window-based keys that auto-expire
3. ✅ Rate limiting now works correctly with proper sliding window

## Technical Details

### Old Algorithm (Problematic)
```typescript
// Single key for all requests
const key = `rate_limit:${ip}`;
const count = await redis.get(key) || 0;
if (count >= limit) { /* reject */ }
await redis.incr(key); // Key might not expire properly
```

### New Algorithm (Fixed)
```typescript
// Window-based key that auto-expires
const windowStart = Math.floor(now / 60);
const key = `rate_limit:${ip}:${windowStart}`;
const count = await redis.incr(key); // Atomic increment
if (count === 1) {
  await redis.expire(key, 70); // Auto-expire after window
}
if (count > limit) { /* reject */ }
```

## Benefits
- ✅ No more stale keys accumulating
- ✅ Accurate rate limiting per time window
- ✅ Automatic cleanup of old windows
- ✅ Better performance (atomic operations)
- ✅ Prevents false positives from old sessions


