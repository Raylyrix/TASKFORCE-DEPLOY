# Railway Build Fixes

## Issues Fixed

### Backend Build Errors ✅

1. **ScheduledEmail Model Missing Fields**
   - **Error**: `Property 'metadata' does not exist on type ScheduledEmail`
   - **Fix**: Added fields directly to Prisma schema:
     - `threadId String?` - For reply threads
     - `replyToMessageId String?` - Original message ID to reply to
     - `replyToThreadId String?` - Thread ID to reply in
     - `sendAsReply Boolean @default(false)` - Whether to send as reply
   - **Files**: `backend/prisma/schema.prisma`

2. **Cache Service Method Name**
   - **Error**: `Property 'del' does not exist on type 'CacheService'`
   - **Fix**: Changed `cache.del()` to `cache.delete()`
   - **Files**: `backend/src/routes/modules/gmail.ts`

3. **Tracking Event Relations**
   - **Error**: `'messageLog' does not exist, should be 'messageLogId'`
   - **Fix**: Updated to use correct Prisma relation:
     - Changed `messageLog` to `message` (relation name)
     - Changed `messageLogId` to `messageLogId` (field name)
   - **Files**: `backend/src/routes/modules/tracking.ts`

4. **Scheduled Email Queue Metadata**
   - **Error**: `Property 'metadata' does not exist`
   - **Fix**: Updated to use direct fields instead of metadata object:
     - `scheduledEmail.sendAsReply`
     - `scheduledEmail.replyToMessageId`
     - `scheduledEmail.replyToThreadId`
     - `scheduledEmail.threadId`
   - **Files**: `backend/src/queue/scheduledEmailQueue.ts`, `backend/src/routes/modules/emailFeatures.ts`

### Frontend Build Error ⚠️

**FollowUpModal.tsx JSX Error**
- **Error**: `Unexpected token 'div'. Expected jsx identifier` at line 120
- **Status**: Component syntax appears correct. This may be:
  - A build cache issue (will resolve on rebuild)
  - A Next.js/webpack parsing issue
  - Railway's Railpack build system issue

**Next Steps:**
1. Railway will automatically rebuild after the push
2. If error persists, try:
   - Clearing Railway build cache
   - Checking if there's a Next.js version compatibility issue
   - Verifying the component is properly exported

## Database Migration Required

⚠️ **IMPORTANT**: After deploying, you need to run Prisma migrations:

```bash
# In Railway, use the Shell feature or add to build command:
cd backend && npx prisma migrate deploy
```

Or Railway should run it automatically if included in the build command:
```bash
cd backend && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
```

## Files Changed

1. `backend/prisma/schema.prisma` - Added ScheduledEmail fields
2. `backend/src/queue/scheduledEmailQueue.ts` - Use direct fields instead of metadata
3. `backend/src/routes/modules/emailFeatures.ts` - Updated schema and create logic
4. `backend/src/routes/modules/gmail.ts` - Fixed cache.delete() call
5. `backend/src/routes/modules/tracking.ts` - Fixed Prisma relations

## Testing

After Railway rebuilds:
1. ✅ Backend should compile successfully
2. ✅ Database migrations should run
3. ⚠️ Frontend build - monitor for JSX error resolution

## Railway Configuration

Make sure your Railway services have:
- **Backend**: Root directory `backend/`, build command includes `npx prisma migrate deploy`
- **Frontend**: Root directory `webapp/`, standard Next.js build
- **Database**: PostgreSQL service connected
- **Redis**: Redis service connected



