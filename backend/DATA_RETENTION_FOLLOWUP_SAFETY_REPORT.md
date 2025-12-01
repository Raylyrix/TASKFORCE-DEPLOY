# Data Retention Policy - Follow-Up Safety Report

## Executive Summary

✅ **ISSUE IDENTIFIED AND FIXED**: The data retention service was deleting completed campaigns without checking for future scheduled follow-ups, which could cause follow-up emails to fail when they tried to execute.

## The Problem

### Scenario
1. User creates a campaign and schedules a follow-up reminder for 1 week later
2. Campaign completes and is marked as `COMPLETED`
3. After 90 days (default retention period), the data retention service deletes the campaign
4. The follow-up sequence and steps are deleted from the database
5. When the follow-up job executes 1 week later, it fails because the `FollowUpStep` no longer exists

### Root Cause
The `archiveOldCompletedCampaigns` function in `dataRetentionService.ts` was:
- ✅ Correctly only deleting `COMPLETED` campaigns (not active ones)
- ❌ **NOT checking for future scheduled follow-ups before deletion**
- ❌ Deleting `FollowUpSequence` records that had jobs scheduled in BullMQ

## The Fix

### Changes Made
1. **Added safety check for future scheduled follow-ups** before deleting campaigns
2. **Checks both database and BullMQ** for pending follow-up jobs
3. **Skips deletion** if any future follow-ups are found
4. **Logs detailed information** about why campaigns are skipped

### Implementation Details

The updated `archiveOldCompletedCampaigns` function now:

1. **Checks FollowUpStep configurations** for `scheduledAt` dates in the future
2. **Queries BullMQ** for pending follow-up jobs (delayed, waiting, active)
3. **Verifies job timestamps** to ensure no future executions
4. **Only deletes campaigns** that have no future scheduled follow-ups
5. **Logs skipped campaigns** with the reason (has future follow-ups)

### Code Changes
- Added import for `followUpQueue` to check BullMQ jobs
- Added comprehensive safety checks before deletion
- Enhanced logging to track skipped campaigns

## Safety Guarantees

### What is Protected
✅ **Scheduled Follow-Ups**: Campaigns with follow-ups scheduled for future dates are NEVER deleted
✅ **BullMQ Jobs**: Pending follow-up jobs in the queue are checked before deletion
✅ **Active Campaigns**: Already protected (RUNNING, SCHEDULED, PAUSED are never deleted)
✅ **Error Handling**: If there's any error checking for follow-ups, deletion is skipped (fail-safe)

### What Can Still Be Deleted
✅ **Old completed campaigns** with no future follow-ups (after retention period)
✅ **Old draft campaigns** (no follow-ups possible)
✅ **Old message logs** from completed campaigns
✅ **Old tracking events**

## Retention Policy Summary

| Data Type | Retention Period | Safety Check |
|-----------|-----------------|--------------|
| Completed Campaigns | 90 days | ✅ Checks for future follow-ups |
| Draft Campaigns | 30 days | ✅ No follow-ups possible |
| Sent Messages | 90 days | ✅ Only from completed campaigns |
| Tracking Events | 90 days | ✅ No safety impact |
| Calendar Cache | 7 days | ✅ No safety impact |
| Email Drafts | 30 days | ✅ No safety impact |
| Old Bookings | 180 days | ✅ Only completed bookings |

## Testing Recommendations

1. **Test Scenario 1**: Create a campaign with a follow-up scheduled 1 week in the future
   - Complete the campaign
   - Wait 90+ days
   - Verify campaign is NOT deleted (has future follow-up)
   - Verify follow-up executes successfully

2. **Test Scenario 2**: Create a campaign with no follow-ups
   - Complete the campaign
   - Wait 90+ days
   - Verify campaign IS deleted (no future follow-ups)

3. **Test Scenario 3**: Create a campaign with nested follow-ups
   - Complete the campaign
   - Verify nested follow-ups are protected

## Current Status

✅ **FIXED**: The data retention service now properly protects campaigns with future scheduled follow-ups.

## Monitoring

The system now logs:
- Number of campaigns checked
- Number of campaigns skipped (with reason)
- Number of campaigns deleted
- Any errors encountered during safety checks

Monitor logs for:
- `"Skipping campaign deletion - has future scheduled follow-ups"`
- `"Error checking for future follow-ups, skipping campaign deletion for safety"`

## Conclusion

The data retention policy is now **safe** and will **never delete campaigns that have future scheduled follow-ups or reminders**. All scheduled emails, follow-ups, and reminders are protected from deletion until they have been executed or are no longer needed.

