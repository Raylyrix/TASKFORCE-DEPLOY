# Admin Manual Database Cleanup Guide

## 🛡️ Safe Manual Database Cleanup for Admins

This guide shows you how to safely clean up the database manually as an admin.

---

## 📋 Prerequisites

1. **Admin Access**: You need authentication token/credentials
2. **Backend URL**: Know your backend API URL
3. **Safety First**: Always check size before cleanup

---

## 🔍 Step 1: Check Current Database Size

### Using API (Recommended)

```bash
# Get current database size
curl -X GET "https://your-backend-url.com/api/data-retention/size" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response**:
```json
{
  "totalRows": 150000,
  "estimatedSizeMB": 245.5,
  "breakdown": {
    "MessageLog": { "rows": 50000, "sizeMB": 25.0 },
    "TrackingEvent": { "rows": 100000, "sizeMB": 30.0 },
    "CampaignRecipient": { "rows": 20000, "sizeMB": 8.0 },
    "Campaign": { "rows": 500, "sizeMB": 2.5 }
  }
}
```

### Check if Cleanup is Needed

```bash
# Check if approaching limit (default 500 MB)
curl -X GET "https://your-backend-url.com/api/data-retention/check?limitMB=500" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response**:
```json
{
  "currentSizeMB": 245.5,
  "limitMB": 500,
  "percentageUsed": 49.1,
  "needsCleanup": false,
  "breakdown": { ... }
}
```

**If `needsCleanup: true`**, it's time to run cleanup.

---

## ✅ Step 2: Verify Active Campaigns (Safety Check)

Before cleanup, verify active campaigns won't be affected:

### Using API

```bash
# Check active campaigns count
curl -X GET "https://your-backend-url.com/api/campaigns?status=RUNNING&status=SCHEDULED&status=PAUSED" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Using Database Query (Direct)

```sql
-- Count active campaigns
SELECT 
  status,
  COUNT(*) as count
FROM "Campaign"
WHERE status IN ('RUNNING', 'SCHEDULED', 'PAUSED')
GROUP BY status;

-- Expected output:
-- RUNNING: 5
-- SCHEDULED: 3
-- PAUSED: 2
```

**✅ If you see active campaigns, they will be PROTECTED during cleanup.**

---

## 🧹 Step 3: Run Manual Cleanup

### Option A: Use Default Retention Settings

```bash
# Run cleanup with default settings (90 days for most data)
curl -X POST "https://your-backend-url.com/api/data-retention/cleanup" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}"
```

### Option B: Custom Retention Settings

```bash
# Run cleanup with custom retention periods
curl -X POST "https://your-backend-url.com/api/data-retention/cleanup" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sentMessages": 60,        // Keep 60 days instead of 90
    "trackingEvents": 60,      // Keep 60 days instead of 90
    "completedCampaigns": 60, // Keep 60 days instead of 90
    "draftCampaigns": 30,     // Keep 30 days (default)
    "calendarCache": 7,       // Keep 7 days (default)
    "emailDrafts": 30,        // Keep 30 days (default)
    "oldBookings": 180        // Keep 180 days (default)
  }'
```

**Response**:
```json
{
  "deleted": {
    "trackingEvents": 5000,
    "messageLogs": 2000,
    "completedCampaigns": 10,
    "draftCampaigns": 5,
    "calendarCache": 100,
    "emailDrafts": 50,
    "bookings": 20,
    "compressedPayloads": 500
  },
  "totalDeleted": 7685,
  "sizeBefore": 450.2,
  "sizeAfter": 320.5
}
```

---

## 🔍 Step 4: Verify Cleanup Results

### Check Size After Cleanup

```bash
# Verify new size
curl -X GET "https://your-backend-url.com/api/data-retention/size" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Verify Active Campaigns Still Exist

```bash
# Verify active campaigns are still there
curl -X GET "https://your-backend-url.com/api/campaigns?status=RUNNING" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Using Database Query

```sql
-- Verify active campaigns still exist
SELECT COUNT(*) FROM "Campaign"
WHERE status IN ('RUNNING', 'SCHEDULED', 'PAUSED');

-- Should return the same count as before cleanup
```

---

## 🛠️ Advanced: Direct Database Cleanup (For Experts)

### ⚠️ WARNING: Only use if you understand SQL and database operations

### Step 1: Backup First

```bash
# PostgreSQL backup
pg_dump -h your-host -U your-user -d your-database > backup_$(date +%Y%m%d).sql
```

### Step 2: Check What Will Be Deleted

```sql
-- Check old completed campaigns (will be deleted)
SELECT 
  id,
  name,
  status,
  "updatedAt",
  EXTRACT(DAY FROM NOW() - "updatedAt") as days_old
FROM "Campaign"
WHERE status = 'COMPLETED'
  AND "updatedAt" < NOW() - INTERVAL '90 days'
ORDER BY "updatedAt" ASC;

-- Check old message logs (will be deleted)
SELECT 
  COUNT(*) as count,
  MIN("createdAt") as oldest,
  MAX("createdAt") as newest
FROM "MessageLog" m
JOIN "Campaign" c ON m."campaignId" = c.id
WHERE m.status = 'SENT'
  AND m."createdAt" < NOW() - INTERVAL '90 days'
  AND c.status = 'COMPLETED';
```

### Step 3: Run Cleanup (In Transaction)

```sql
BEGIN;

-- Delete old tracking events first
DELETE FROM "TrackingEvent"
WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- Delete old message logs from completed campaigns
DELETE FROM "MessageLog"
WHERE status = 'SENT'
  AND "createdAt" < NOW() - INTERVAL '90 days'
  AND "campaignId" IN (
    SELECT id FROM "Campaign" WHERE status = 'COMPLETED'
  );

-- Delete old completed campaigns (cascade will handle recipients)
DELETE FROM "Campaign"
WHERE status = 'COMPLETED'
  AND "updatedAt" < NOW() - INTERVAL '90 days';

-- Delete old draft campaigns
DELETE FROM "Campaign"
WHERE status = 'DRAFT'
  AND "updatedAt" < NOW() - INTERVAL '30 days';

-- Verify active campaigns still exist
SELECT COUNT(*) as active_campaigns
FROM "Campaign"
WHERE status IN ('RUNNING', 'SCHEDULED', 'PAUSED');

-- If everything looks good, commit
COMMIT;

-- If something went wrong, rollback
-- ROLLBACK;
```

---

## 📊 Monitoring & Reporting

### Create a Cleanup Report Script

```bash
#!/bin/bash
# cleanup-report.sh

BACKEND_URL="https://your-backend-url.com"
AUTH_TOKEN="YOUR_AUTH_TOKEN"

echo "=== Database Cleanup Report ==="
echo ""

# Check current size
echo "Current Database Size:"
curl -s -X GET "$BACKEND_URL/api/data-retention/size" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'

echo ""
echo "Cleanup Status:"
curl -s -X GET "$BACKEND_URL/api/data-retention/check?limitMB=500" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'

echo ""
echo "Active Campaigns:"
curl -s -X GET "$BACKEND_URL/api/campaigns?status=RUNNING&status=SCHEDULED&status=PAUSED" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.campaigns | length'
```

---

## 🎯 Recommended Cleanup Schedule

### Daily (Automatic)
- System runs automatic cleanup at 2 AM
- Only runs if database > 80% of limit (400 MB)

### Weekly (Manual Check)
- Check database size
- Review cleanup effectiveness
- Adjust retention if needed

### Monthly (Manual Deep Clean)
- Run manual cleanup with custom settings
- Review and archive important data
- Update retention policies if needed

---

## ⚙️ Custom Retention Policies

### Conservative (Keep More Data)
```json
{
  "completedCampaigns": 180,  // 6 months
  "sentMessages": 180,        // 6 months
  "trackingEvents": 180,      // 6 months
  "draftCampaigns": 60,       // 2 months
  "calendarCache": 14,        // 2 weeks
  "emailDrafts": 60,          // 2 months
  "oldBookings": 365          // 1 year
}
```

### Aggressive (Save More Space)
```json
{
  "completedCampaigns": 30,   // 1 month
  "sentMessages": 30,          // 1 month
  "trackingEvents": 30,        // 1 month
  "draftCampaigns": 7,        // 1 week
  "calendarCache": 3,         // 3 days
  "emailDrafts": 7,           // 1 week
  "oldBookings": 90           // 3 months
}
```

### Balanced (Recommended)
```json
{
  "completedCampaigns": 90,   // 3 months
  "sentMessages": 90,         // 3 months
  "trackingEvents": 90,       // 3 months
  "draftCampaigns": 30,      // 1 month
  "calendarCache": 7,         // 1 week
  "emailDrafts": 30,          // 1 month
  "oldBookings": 180          // 6 months
}
```

---

## 🚨 Emergency Cleanup

If database is approaching limit and automatic cleanup hasn't run:

### Quick Emergency Cleanup

```bash
# Aggressive cleanup to free space immediately
curl -X POST "https://your-backend-url.com/api/data-retention/cleanup" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completedCampaigns": 30,
    "sentMessages": 30,
    "trackingEvents": 30,
    "draftCampaigns": 7,
    "calendarCache": 3,
    "emailDrafts": 7
  }'
```

---

## ✅ Safety Checklist

Before running cleanup, verify:

- [ ] Checked current database size
- [ ] Verified active campaigns count
- [ ] Confirmed active campaigns won't be affected
- [ ] Reviewed retention settings
- [ ] Backed up database (if doing direct SQL)
- [ ] Tested on staging first (if possible)
- [ ] Have rollback plan ready

After cleanup, verify:

- [ ] Database size reduced
- [ ] Active campaigns still exist
- [ ] Active campaign messages still exist
- [ ] No errors in logs
- [ ] System functioning normally

---

## 📝 Example Workflow

### Complete Manual Cleanup Session

```bash
# 1. Check current size
echo "Step 1: Checking database size..."
curl -X GET "$BACKEND_URL/api/data-retention/size" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'

# 2. Check if cleanup needed
echo "Step 2: Checking if cleanup is needed..."
curl -X GET "$BACKEND_URL/api/data-retention/check?limitMB=500" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.needsCleanup'

# 3. Verify active campaigns
echo "Step 3: Verifying active campaigns..."
curl -X GET "$BACKEND_URL/api/campaigns?status=RUNNING" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.campaigns | length'

# 4. Run cleanup
echo "Step 4: Running cleanup..."
curl -X POST "$BACKEND_URL/api/data-retention/cleanup" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

# 5. Verify results
echo "Step 5: Verifying cleanup results..."
curl -X GET "$BACKEND_URL/api/data-retention/size" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.estimatedSizeMB'
```

---

## 🔧 Troubleshooting

### Cleanup Not Working

1. **Check Authentication**: Verify your auth token is valid
2. **Check Logs**: Review backend logs for errors
3. **Check Queue**: Ensure data retention worker is running
4. **Manual Trigger**: Try running cleanup manually via API

### Size Not Reducing

1. **Check Retention Settings**: Verify retention periods are correct
2. **Check Active Campaigns**: Large active campaigns won't be deleted
3. **Check Database**: Verify cleanup actually ran (check logs)
4. **Run Again**: Sometimes need to run multiple times for large databases

### Active Campaigns Affected (Should Never Happen)

1. **STOP**: Immediately stop any cleanup
2. **Check Logs**: Review what was deleted
3. **Restore Backup**: If you have backup, restore it
4. **Report Bug**: This is a critical issue - report immediately

---

## 📚 Additional Resources

- **Safety Guide**: `DATA_RETENTION_SAFETY.md`
- **Full Guide**: `DATA_RETENTION_GUIDE.md`
- **Database Schema**: `DATABASE_SCHEMA_DOCUMENTATION.md`

---

## 🎯 Quick Reference

### Most Common Commands

```bash
# Check size
GET /api/data-retention/size

# Check if cleanup needed
GET /api/data-retention/check?limitMB=500

# Run cleanup (default settings)
POST /api/data-retention/cleanup
Body: {}

# Run cleanup (custom settings)
POST /api/data-retention/cleanup
Body: { "sentMessages": 60, "trackingEvents": 60 }
```

---

**Last Updated**: 2025-01-29  
**For**: System Administrators  
**Safety Level**: Maximum Protection for Active Campaigns


