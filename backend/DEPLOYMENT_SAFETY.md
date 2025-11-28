# Deployment Safety & Campaign Continuity

## Current State ✅

### What's Protected:
1. **Campaign Data**: All campaigns, recipients, follow-ups, and messages are stored in **PostgreSQL database** which persists across deployments
2. **Queue Jobs**: Jobs are stored in **Redis** (BullMQ) which should persist on Railway
3. **Job Retries**: BullMQ is configured with `attempts: 3` and `removeOnFail: false`, so failed jobs are retried
4. **Health Checks**: Railway is configured with `/health` endpoint for deployment health checks

### Current Deployment Flow:
1. Railway sends SIGTERM to old container
2. HTTP server closes gracefully (stops accepting new requests)
3. **⚠️ Queue workers may be interrupted** if processing jobs
4. New container starts and reconnects to Redis
5. Interrupted jobs are retried automatically by BullMQ

## Potential Issues ⚠️

1. **No Graceful Queue Worker Shutdown**: Workers may be killed mid-job during deployment
2. **Single Replica**: With `numReplicas: 1`, there's a brief downtime during deployment
3. **In-Flight Jobs**: Jobs being processed when deployment happens may be interrupted

## What Happens to Running Campaigns:

### ✅ Safe:
- **Campaign state** in database is preserved
- **Scheduled jobs** in Redis queue are preserved
- **Failed/interrupted jobs** are automatically retried (up to 3 attempts)
- **Campaign progress** (sent count, opens, clicks) is saved to database

### ⚠️ Potential Impact:
- **Brief interruption** (1-2 seconds) during deployment
- **In-flight email sends** may be interrupted and retried
- **Follow-up scheduling** may be delayed by a few seconds

## Recommendations for Zero-Downtime:

### 1. Improve Graceful Shutdown (Recommended)
Add graceful shutdown for queue workers to finish current jobs before exiting.

### 2. Enable Redis Persistence on Railway
Ensure Redis has persistence enabled so jobs survive Redis restarts.

### 3. Consider Multiple Replicas (Advanced)
For true zero-downtime, use multiple replicas with proper load balancing.

## Conclusion:

**Your campaigns are generally safe** because:
- All data is in persistent PostgreSQL
- Jobs are in Redis (persistent)
- Failed jobs are automatically retried
- Brief interruptions (1-2 seconds) are acceptable for most use cases

**However**, for production-critical campaigns, consider implementing graceful queue worker shutdown.

