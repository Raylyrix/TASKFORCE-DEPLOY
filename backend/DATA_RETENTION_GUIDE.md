# Data Retention & Database Size Management Guide

## 🎯 Goal: Keep Database Under 500 MB

This guide explains how TaskForce manages database size through automated data retention policies.

---

## 📊 Default Retention Policies

| Data Type | Retention Period | Action |
|-----------|----------------|--------|
| **Completed Campaigns** | 90 days | Archive (delete with cascade) |
| **Draft Campaigns** | 30 days | Delete |
| **Sent Messages** | 90 days | Archive (delete message logs) |
| **Failed Messages** | 30 days | Delete |
| **Tracking Events** | 90 days | Delete |
| **Calendar Cache** | 7 days | Delete |
| **Email Drafts** | 30 days | Delete |
| **Old Bookings** | 180 days | Delete |
| **Bounce Records** | 365 days | Keep (important for reputation) |
| **Complaint Records** | 365 days | Keep (important for reputation) |

---

## 🔄 Automated Cleanup

### Daily Scheduled Cleanup
- **Schedule**: Runs daily at 2:00 AM
- **Trigger**: Automatically checks database size
- **Action**: Runs cleanup if database > 80% of limit (400 MB)
- **Location**: `backend/src/queue/dataRetentionQueue.ts`

### Manual Cleanup
- **API Endpoint**: `POST /api/data-retention/cleanup`
- **Custom Config**: Can override default retention periods
- **Immediate**: Runs cleanup immediately

---

## 📈 Size Monitoring

### Check Current Size
```bash
GET /api/data-retention/size
```

**Response**:
```json
{
  "totalRows": 150000,
  "estimatedSizeMB": 245.5,
  "breakdown": {
    "MessageLog": { "rows": 50000, "sizeMB": 25.0 },
    "TrackingEvent": { "rows": 100000, "sizeMB": 30.0 },
    "CampaignRecipient": { "rows": 20000, "sizeMB": 8.0 }
  }
}
```

### Check Size Status
```bash
GET /api/data-retention/check?limitMB=500
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

---

## 🗜️ Data Compression

### Recipient Payload Compression
- **What**: Compresses `CampaignRecipient.payload` JSON
- **When**: During cleanup runs
- **How**: Removes unused fields, keeps only:
  - `email`
  - `name` (or `firstName` + `lastName`)
  - `company`
- **Savings**: 30-50% reduction in payload size

---

## 🧹 Cleanup Process

### Step-by-Step Process

1. **Check Database Size**
   - Calculate current size
   - Compare to limit (500 MB)
   - If > 80% (400 MB), proceed

2. **Delete Old Tracking Events**
   - Remove events older than retention period
   - Cascade deletes from MessageLog

3. **Archive Old Message Logs**
   - Find sent messages older than retention period
   - Delete tracking events first
   - Delete message logs
   - Process in batches of 1000

4. **Archive Completed Campaigns**
   - Find completed campaigns older than retention period
   - Delete recipients (cascade handles messages)
   - Delete follow-up sequences
   - Delete campaigns

5. **Clean Up Draft Campaigns**
   - Delete draft campaigns older than retention period

6. **Clean Up Calendar Cache**
   - Delete old availability cache entries

7. **Clean Up Email Drafts**
   - Delete old email drafts

8. **Clean Up Old Bookings**
   - Delete old meeting bookings

9. **Compress Recipient Payloads**
   - Compress large payloads to save space

---

## 📝 API Usage Examples

### Manual Cleanup with Custom Config
```bash
POST /api/data-retention/cleanup
Content-Type: application/json

{
  "sentMessages": 60,  // Keep only 60 days instead of 90
  "trackingEvents": 60,
  "completedCampaigns": 60
}
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

## ⚙️ Configuration

### Environment Variables
```env
# Optional: Override default limit
DATA_RETENTION_LIMIT_MB=500

# Optional: Override cleanup schedule (cron format)
DATA_RETENTION_SCHEDULE="0 2 * * *"  # Daily at 2 AM
```

### Programmatic Configuration
```typescript
import { dataRetentionService } from "./services/dataRetentionService";

// Custom retention config
const customConfig = {
  sentMessages: 60,
  trackingEvents: 60,
  completedCampaigns: 60,
};

// Run cleanup
await dataRetentionService.runDataRetentionCleanup(customConfig);
```

---

## 📊 Size Estimation

### Per Table Estimates

| Table | Avg Size per Row | Growth Rate |
|-------|------------------|-------------|
| MessageLog | 500 bytes | High (every email sent) |
| TrackingEvent | 300 bytes | Very High (multiple per email) |
| CampaignRecipient | 400 bytes | High (every recipient) |
| Campaign | 5 KB | Medium (campaign definitions) |
| FollowUpStep | 3 KB | Low (follow-up templates) |

### Growth Projections

**Small Business (100 users, 10 campaigns/month)**:
- Monthly growth: ~50 MB
- With retention: Stays under 200 MB

**Medium Business (1,000 users, 100 campaigns/month)**:
- Monthly growth: ~500 MB
- With retention: Stays under 500 MB ✅

**Enterprise (10,000 users, 1,000 campaigns/month)**:
- Monthly growth: ~5 GB
- **Recommendation**: Increase retention limit or reduce retention periods

---

## 🚨 Alerts & Monitoring

### Size Warnings
- **80% (400 MB)**: Cleanup automatically triggered
- **90% (450 MB)**: Warning logged
- **95% (475 MB)**: Critical warning logged
- **100% (500 MB)**: Emergency cleanup triggered

### Monitoring Recommendations
1. **Daily Checks**: Monitor size daily
2. **Weekly Reports**: Review cleanup effectiveness
3. **Monthly Review**: Adjust retention policies if needed

---

## 🔒 Data Safety

### What Gets Deleted
- ✅ Old message logs (after retention period)
- ✅ Old tracking events
- ✅ Completed campaigns (after retention period)
- ✅ Draft campaigns (after retention period)
- ✅ Old calendar cache
- ✅ Old email drafts

### What's Preserved
- ✅ Active campaigns
- ✅ Recent message logs (< retention period)
- ✅ User accounts
- ✅ Campaign definitions (while active)
- ✅ Bounce/complaint records (1 year)
- ✅ Domain reputation data
- ✅ Meeting types and bookings (6 months)

### Backup Recommendations
- **Before Cleanup**: Consider backing up data older than retention period
- **Archival**: Export old data to cold storage if needed
- **Compliance**: Ensure retention meets legal requirements

---

## 🛠️ Troubleshooting

### Database Still Growing
1. Check if cleanup is running: Review logs
2. Verify retention periods: Check configuration
3. Check for stuck campaigns: Review campaign status
4. Monitor tracking events: May be growing faster than expected

### Cleanup Not Running
1. Check queue workers: Ensure data retention worker is registered
2. Check schedule: Verify cron schedule is set
3. Check logs: Review for errors
4. Manual trigger: Run cleanup manually via API

### Size Calculation Issues
- Estimates are approximate
- Actual size may vary due to:
  - Indexes
  - JSON field sizes
  - Database overhead
  - Vacuum/autovacuum

---

## 📚 Best Practices

1. **Regular Monitoring**: Check size weekly
2. **Adjust Retention**: Tune based on usage patterns
3. **Archive Important Data**: Export before cleanup if needed
4. **Test Cleanup**: Run on staging first
5. **Document Policies**: Keep retention policies documented
6. **Compliance**: Ensure policies meet legal requirements

---

## 🔄 Migration Path

If you need to implement this:

1. **Install**: Already included in codebase
2. **Configure**: Set retention periods
3. **Schedule**: Cleanup runs automatically
4. **Monitor**: Check size regularly
5. **Adjust**: Tune retention as needed

---

**Last Updated**: 2025-01-29  
**Service**: `dataRetentionService`  
**Queue**: `dataRetentionQueue`  
**Default Limit**: 500 MB


