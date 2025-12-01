# Admin Dashboard Guide

## Overview

The admin dashboard provides system administrators with real-time metrics, data management capabilities, and safe database cleanup tools. Access is restricted to the admin email: `rayvicalraylyrix@gmail.com`.

## Features

### 1. Admin Authentication
- **Email-based access control**: Only `rayvicalraylyrix@gmail.com` can access admin endpoints
- **Middleware**: `requireAdmin` middleware verifies admin status
- **Automatic redirect**: Non-admin users are redirected to dashboard

### 2. Real-Time Metrics Dashboard

The admin dashboard displays:

#### Overview Metrics
- Total Users
- Total Campaigns
- Total Recipients
- Total Messages
- Total Tracking Events
- Active Campaigns
- Database Size (MB and row count)

#### Campaign Status Distribution
- Running campaigns
- Scheduled campaigns
- Paused campaigns
- Completed campaigns
- Visual pie chart representation

#### Activity Charts (Last 30 Days)
- Daily campaigns created (line chart)
- Daily messages sent (bar chart)
- Daily tracking events (line chart)

#### Recent Activity (24 Hours)
- Messages sent in last 24h
- Tracking events in last 24h
- Campaigns created in last 24h

#### Top Users
- Top 10 users by campaign count
- User email and display name
- Campaign count per user

#### Database Breakdown
- Table-by-table breakdown
- Row counts per table
- Size (MB) per table

### 3. Safe Data Deletion

The admin can safely delete old data with **guaranteed protection** for active operations:

#### What Gets Deleted
- ✅ Old COMPLETED campaigns (90+ days by default)
- ✅ Old DRAFT campaigns (30+ days by default)
- ✅ Old messages from COMPLETED campaigns (90+ days)
- ✅ Old tracking events (90+ days)
- ✅ Old calendar cache (7+ days)
- ✅ Old email drafts (30+ days)
- ✅ Old bookings (180+ days)

#### What NEVER Gets Deleted
- ❌ Running campaigns
- ❌ Scheduled campaigns
- ❌ Paused campaigns
- ❌ Follow-ups (active or scheduled)
- ❌ Replies (active or scheduled)
- ❌ Messages from active campaigns
- ❌ Any data related to active operations

#### Safety Features
1. **Pre-deletion verification**: Counts active campaigns before deletion
2. **Post-deletion verification**: Verifies active campaigns still exist after deletion
3. **Automatic rollback**: If active campaigns are affected, deletion is aborted
4. **Configurable retention**: Admin can set custom retention periods per data type

## API Endpoints

### GET /api/admin/metrics
Get real-time system metrics.

**Response**:
```json
{
  "overview": {
    "totalUsers": 150,
    "totalCampaigns": 500,
    "totalRecipients": 10000,
    "totalMessages": 50000,
    "totalTrackingEvents": 200000,
    "activeCampaigns": 25,
    "databaseSizeMB": 245.5,
    "totalRows": 150000
  },
  "campaignStatus": {
    "running": 10,
    "scheduled": 8,
    "paused": 7,
    "completed": 475
  },
  "charts": {
    "dailyCampaigns": [...],
    "dailyMessages": [...],
    "dailyTrackingEvents": [...]
  },
  ...
}
```

### POST /api/admin/delete-data
Safely delete old data.

**Request Body**:
```json
{
  "completedCampaigns": 90,
  "draftCampaigns": 30,
  "sentMessages": 90,
  "trackingEvents": 90,
  "calendarCache": 7,
  "emailDrafts": 30,
  "oldBookings": 180
}
```

**Response**:
```json
{
  "success": true,
  "message": "Data deleted safely. Active campaigns were not affected.",
  "result": {
    "deleted": {
      "trackingEvents": 5000,
      "messageLogs": 2000,
      "completedCampaigns": 10
    },
    "totalDeleted": 7685,
    "sizeBefore": 450.2,
    "sizeAfter": 320.5
  },
  "safetyCheck": {
    "activeCampaignsBefore": 25,
    "activeCampaignsAfter": 25,
    "verified": true
  }
}
```

### GET /api/admin/is-admin
Check if current user is admin.

**Response**:
```json
{
  "isAdmin": true,
  "email": "rayvicalraylyrix@gmail.com"
}
```

### GET /api/admin/database-size
Get current database size and status.

### GET /api/admin/active-campaigns
Get list of active campaigns (for verification).

## Accessing the Dashboard

1. **Login**: Log in with `rayvicalraylyrix@gmail.com`
2. **Navigate**: Go to `/admin` in the webapp
3. **View Metrics**: Dashboard automatically loads and refreshes every 30 seconds
4. **Delete Data**: Click "Delete Old Data" button, configure retention periods, and confirm

## Safety Guarantees

### Protection Mechanisms

1. **Query-level protection**: All deletion queries explicitly exclude active campaigns
   ```typescript
   where: {
     campaign: {
       status: CampaignStatus.COMPLETED // Only completed campaigns
     }
   }
   ```

2. **Pre-deletion count**: System counts active campaigns before deletion
3. **Post-deletion verification**: System verifies active campaigns still exist
4. **Automatic abort**: If counts don't match, deletion is aborted and error is logged

### What "Active" Means

- **Campaigns**: Status is `RUNNING`, `SCHEDULED`, or `PAUSED`
- **Follow-ups**: Associated with active campaigns
- **Replies**: Associated with active campaigns
- **Messages**: Belong to active campaigns

### Logging

All admin actions are logged:
- Admin access attempts
- Data deletion operations
- Safety check results
- Any errors or warnings

## Configuration

### Default Retention Periods

- **Completed Campaigns**: 90 days
- **Draft Campaigns**: 30 days
- **Sent Messages**: 90 days
- **Tracking Events**: 90 days
- **Calendar Cache**: 7 days
- **Email Drafts**: 30 days
- **Old Bookings**: 180 days

### Custom Retention

Admin can customize retention periods when deleting data:
- Set number of days to keep for each data type
- Minimum: 1 day
- Recommended: 30-90 days for most data types

## Troubleshooting

### "Access Denied" Error
- Verify you're logged in with `rayvicalraylyrix@gmail.com`
- Check browser console for authentication errors
- Ensure `X-User-Id` header is being sent

### Metrics Not Loading
- Check network tab for API errors
- Verify backend is running
- Check browser console for errors

### Delete Data Fails
- Verify active campaigns count
- Check backend logs for errors
- Ensure database connection is stable
- Review safety check results in response

## Best Practices

1. **Regular Monitoring**: Check dashboard weekly to monitor database size
2. **Gradual Cleanup**: Delete data in smaller batches rather than all at once
3. **Verify Before Delete**: Always check active campaigns count before deletion
4. **Review Logs**: Check backend logs after deletion to verify safety
5. **Backup First**: Consider backing up database before large deletions (optional)

## Technical Details

### Middleware Stack
1. `requireUser`: Verifies user authentication
2. `requireAdmin`: Verifies admin email matches `rayvicalraylyrix@gmail.com`

### Data Retention Service
- Uses `dataRetentionService.runDataRetentionCleanup()` for safe deletion
- All deletion functions have explicit safety checks
- Only operates on `COMPLETED` or `DRAFT` campaigns

### Real-Time Updates
- Dashboard auto-refreshes every 30 seconds
- Manual refresh button available
- Charts update automatically

---

**Last Updated**: 2025-01-29  
**Admin Email**: rayvicalraylyrix@gmail.com  
**Safety Level**: Maximum Protection for Active Operations


