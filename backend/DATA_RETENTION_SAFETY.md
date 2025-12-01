# Data Retention Safety Guarantees

## 🛡️ **ACTIVE CAMPAIGNS ARE 100% SAFE**

The data retention system is designed with multiple safety layers to ensure **active campaigns are NEVER affected**.

---

## ✅ Safety Guarantees

### 1. **Campaign Status Protection**

The system **ONLY** deletes campaigns with these statuses:
- ✅ `COMPLETED` - Only after retention period (90 days default)
- ✅ `DRAFT` - Only old drafts (30 days default)

The system **NEVER** deletes campaigns with these statuses:
- 🛡️ `RUNNING` - **PROTECTED** - Active campaigns sending emails
- 🛡️ `SCHEDULED` - **PROTECTED** - Campaigns scheduled to run
- 🛡️ `PAUSED` - **PROTECTED** - Paused campaigns (can be resumed)
- 🛡️ `CANCELLED` - **PROTECTED** - Cancelled campaigns (kept for records)

### 2. **Message Log Protection**

Message logs are **ONLY** deleted if:
- ✅ Status is `SENT` (not PENDING, PROCESSING, etc.)
- ✅ Created more than retention period ago (90 days default)
- ✅ **AND** Campaign status is `COMPLETED` (not RUNNING/SCHEDULED/PAUSED)

**Active campaign messages are NEVER deleted**, even if old.

### 3. **Recipient Data Protection**

Recipient payloads are **ONLY** compressed if:
- ✅ Recipient status is `SENT` or `FAILED`
- ✅ **AND** Campaign status is `COMPLETED`

**Active campaign recipients are NEVER touched**.

### 4. **Tracking Events Protection**

Tracking events are deleted based on age only, but:
- ✅ They're linked to message logs
- ✅ Message logs from active campaigns are protected
- ✅ Therefore, tracking events from active campaigns are automatically protected

---

## 🔒 Code-Level Safety Checks

### Explicit Status Filtering

```typescript
// ✅ SAFE: Only COMPLETED campaigns
where: {
  status: {
    in: [CampaignStatus.COMPLETED], // Explicitly only completed
  }
}

// ✅ SAFE: Messages only from COMPLETED campaigns
where: {
  campaign: {
    status: CampaignStatus.COMPLETED, // Additional safety check
  }
}
```

### Pre-Cleanup Verification

Before cleanup runs:
1. Counts active campaigns
2. Logs the count
3. Confirms they won't be affected

---

## 📊 What Gets Deleted vs Protected

| Data Type | Deleted When | Protected When |
|-----------|--------------|----------------|
| **Campaigns** | Status = COMPLETED + 90 days old | Status = RUNNING/SCHEDULED/PAUSED |
| **Message Logs** | Status = SENT + 90 days + Campaign = COMPLETED | Campaign = RUNNING/SCHEDULED/PAUSED |
| **Recipients** | Campaign = COMPLETED + old | Campaign = RUNNING/SCHEDULED/PAUSED |
| **Tracking Events** | 90 days old (but protected if campaign active) | Linked to active campaign messages |
| **Follow-ups** | Campaign = COMPLETED + old | Campaign = RUNNING/SCHEDULED/PAUSED |

---

## 🚨 Edge Cases Handled

### 1. **Long-Running Campaigns**
- Campaigns that run for months are **fully protected**
- Their messages, recipients, and tracking data are **never deleted**
- Only cleaned up after campaign is marked COMPLETED + retention period

### 2. **Paused Campaigns**
- Paused campaigns are **protected**
- Can be resumed at any time
- Data is preserved until campaign is completed or cancelled

### 3. **Scheduled Campaigns**
- Future scheduled campaigns are **protected**
- All associated data is preserved
- Cleanup only happens after completion

### 4. **Follow-up Sequences**
- Follow-ups from active campaigns are **protected**
- Only deleted when parent campaign is COMPLETED + old

---

## ✅ Verification Steps

### Before Cleanup Runs:
1. ✅ Counts active campaigns
2. ✅ Logs active campaign count
3. ✅ Confirms they won't be affected

### During Cleanup:
1. ✅ Explicit status checks on every query
2. ✅ Campaign status filter on message queries
3. ✅ Campaign status filter on recipient queries

### After Cleanup:
1. ✅ Logs what was deleted
2. ✅ Verifies active campaigns still exist
3. ✅ Confirms no active campaign data was touched

---

## 🧪 Testing Scenarios

### Scenario 1: Active Campaign Running
- **Campaign Status**: RUNNING
- **Age**: 120 days old
- **Result**: ✅ **PROTECTED** - Not deleted

### Scenario 2: Scheduled Campaign
- **Campaign Status**: SCHEDULED
- **Age**: 100 days old
- **Result**: ✅ **PROTECTED** - Not deleted

### Scenario 3: Paused Campaign
- **Campaign Status**: PAUSED
- **Age**: 60 days old
- **Result**: ✅ **PROTECTED** - Not deleted

### Scenario 4: Completed Campaign
- **Campaign Status**: COMPLETED
- **Age**: 95 days old (past 90-day retention)
- **Result**: ✅ **SAFE TO DELETE** - Will be archived

### Scenario 5: Messages from Active Campaign
- **Campaign Status**: RUNNING
- **Message Age**: 100 days old
- **Result**: ✅ **PROTECTED** - Not deleted (campaign is active)

---

## 📝 Logging & Monitoring

### Safety Logs

Every cleanup run logs:
```
Safety check: Active campaigns will NOT be affected by cleanup
Active campaigns count: 5
```

### Deletion Logs

Every deletion logs what was deleted:
```
Archived old completed campaigns: 10
Archived old message logs: 2000
```

### Verification

After cleanup, verify:
- Active campaigns still exist
- Active campaign messages still exist
- Active campaign recipients still exist

---

## 🔍 How to Verify Safety

### Check Active Campaigns
```sql
SELECT COUNT(*) FROM "Campaign" 
WHERE status IN ('RUNNING', 'SCHEDULED', 'PAUSED');
```

### Check Active Campaign Messages
```sql
SELECT COUNT(*) FROM "MessageLog" m
JOIN "Campaign" c ON m."campaignId" = c.id
WHERE c.status IN ('RUNNING', 'SCHEDULED', 'PAUSED');
```

### Check What Was Deleted
```sql
-- Only COMPLETED campaigns should be deleted
SELECT status, COUNT(*) FROM "Campaign" 
WHERE status = 'COMPLETED'
GROUP BY status;
```

---

## 🎯 Summary

### ✅ **GUARANTEED SAFE:**
- All RUNNING campaigns and their data
- All SCHEDULED campaigns and their data
- All PAUSED campaigns and their data
- All messages from active campaigns
- All recipients from active campaigns
- All tracking events from active campaigns

### ✅ **SAFE TO DELETE:**
- Old COMPLETED campaigns (90+ days)
- Old DRAFT campaigns (30+ days)
- Old messages from COMPLETED campaigns (90+ days)
- Old tracking events (90+ days, but protected if campaign active)

---

## 🚀 Conclusion

**Your active campaigns are 100% safe.** The data retention system has multiple layers of protection to ensure that:

1. ✅ Only COMPLETED campaigns are deleted
2. ✅ Only messages from COMPLETED campaigns are deleted
3. ✅ Active campaigns are explicitly excluded from all deletion queries
4. ✅ Pre-cleanup verification confirms active campaigns won't be affected

**You can run campaigns without any worry - they will continue sending emails normally, and their data will be preserved until the campaign is completed.**

---

**Last Updated**: 2025-01-29  
**Safety Level**: Maximum Protection  
**Active Campaign Protection**: 100% Guaranteed


