# Admin Page Issues Report

**Date:** December 13, 2025  
**Status:** Issues Found - Fixes Required

## 🔴 Critical Issues Found

### 1. **MessageLog Status Not Updated on Bounce/Failure** ❌

**Problem:**
- When emails fail to send or bounce, the `MessageLog` status is **NOT** being updated
- Bounces are recorded in `EmailBounce` table, but `MessageLog.status` remains `PENDING`
- Failed sends don't update `MessageLog.status` to `FAILED`

**Location:** `backend/src/services/campaignEngine.ts` - `processCampaignDispatch` function

**Current Code Flow:**
1. `processCampaignDispatch` calls `sendEmailViaGmail()`
2. If error occurs, `gmailDelivery.ts` records bounce in `EmailBounce` table
3. Error is thrown but **MessageLog status is never updated**
4. MessageLog remains in `PENDING` status

**Impact:**
- Admin page shows incorrect message status counts
- Bounced emails appear as "PENDING" instead of "BOUNCED"
- Failed emails appear as "PENDING" instead of "FAILED"
- Analytics are inaccurate

**Fix Required:**
Add try-catch block in `processCampaignDispatch` to:
- Update `MessageLog.status` to `BOUNCED` when bounce occurs
- Update `MessageLog.status` to `FAILED` when send fails
- Update `MessageLog.error` field with error message
- Update `CampaignRecipient.status` appropriately

---

### 2. **Bounce Data Not Displayed in Admin Page** ❌

**Problem:**
- Admin page shows `messageStatus` breakdown but doesn't specifically highlight bounces
- No dedicated section showing bounce statistics
- Bounce data exists in `EmailBounce` table but isn't queried/displayed

**Location:** 
- Backend: `backend/src/routes/modules/admin.ts` - `/api/admin/metrics`
- Frontend: `webapp/src/app/admin/page.tsx`

**Current State:**
- Admin metrics query `MessageLog.groupBy(["status"])` which should show BOUNCED/FAILED
- But since MessageLog status isn't updated (Issue #1), these counts are wrong
- No separate query for `EmailBounce` table statistics

**Impact:**
- Admin can't see bounce rates
- Can't identify problematic email addresses
- Can't track bounce trends over time

**Fix Required:**
1. Query `EmailBounce` table for bounce statistics
2. Add bounce breakdown by type (HARD/SOFT) and category
3. Display bounce data in admin page UI
4. Add bounce rate calculations

---

### 3. **Failed Email Tracking Incomplete** ⚠️

**Problem:**
- Failed emails are tracked in `ScheduledEmail` table (for scheduled emails)
- But campaign email failures aren't properly tracked
- No distinction between different failure types

**Location:** `backend/src/services/campaignEngine.ts`

**Current State:**
- `ScheduledEmail` failures are tracked (has `status: FAILED`)
- Campaign email failures via `MessageLog` are not tracked (status stays PENDING)
- No error categorization

**Impact:**
- Can't see which campaigns have high failure rates
- Can't identify patterns in failures
- Hard to debug email delivery issues

**Fix Required:**
- Update MessageLog status to FAILED on send failure
- Categorize failures (authentication error, rate limit, invalid email, etc.)
- Add failure statistics to admin metrics

---

### 4. **Admin Page Missing Bounce/Failure Metrics** ⚠️

**Problem:**
- Admin page doesn't show:
  - Total bounces count
  - Bounce rate percentage
  - Hard vs Soft bounce breakdown
  - Failure rate
  - Top bounced email addresses
  - Bounce trends over time

**Location:** `webapp/src/app/admin/page.tsx`

**Current Metrics Displayed:**
- ✅ Total messages
- ✅ Message status breakdown (but inaccurate due to Issue #1)
- ✅ Campaign status
- ❌ Bounce statistics (missing)
- ❌ Failure statistics (missing)
- ❌ Bounce rate (missing)

**Fix Required:**
- Add bounce metrics section
- Add failure metrics section
- Add bounce rate calculations
- Add bounce trend charts

---

## 📊 Data Accuracy Issues

### Message Status Breakdown (Currently Inaccurate)

**Expected:**
```json
{
  "PENDING": 10,
  "SENT": 100,
  "FAILED": 5,
  "BOUNCED": 3
}
```

**Actual (Due to Issue #1):**
```json
{
  "PENDING": 18,  // Includes failed/bounced emails!
  "SENT": 100,
  "FAILED": 0,    // Should be 5
  "BOUNCED": 0    // Should be 3
}
```

### User Email Statistics (Partially Accurate)

**Current Query:** `backend/src/routes/modules/admin.ts` line 714
```sql
COUNT(DISTINCT CASE WHEN ml.status = 'FAILED' THEN ml.id END)::bigint as "totalEmailsFailed"
```

**Problem:** Since MessageLog status isn't updated, this count is always 0

---

## 🔧 Required Fixes

### Fix 1: Update MessageLog Status on Error

**File:** `backend/src/services/campaignEngine.ts`

**Add error handling in `processCampaignDispatch`:**

```typescript
try {
  const sendResult = await gmailDeliveryService.sendEmailViaGmail({...});
  
  // Success path (existing code)
  await prisma.messageLog.update({
    where: { id: messageLog.id },
    data: {
      status: MessageStatus.SENT,
      sendAt: new Date(),
      gmailMessageId: sendResult.id,
    },
  });
} catch (error: any) {
  // NEW: Handle errors properly
  const errorMessage = error.message || String(error);
  
  // Check if it's a bounce (bounce was already recorded in gmailDelivery)
  const isBounce = errorMessage.toLowerCase().includes('invalid') ||
                   errorMessage.toLowerCase().includes('does not exist') ||
                   errorMessage.toLowerCase().includes('bounce');
  
  // Update MessageLog status
  await prisma.messageLog.update({
    where: { id: messageLog.id },
    data: {
      status: isBounce ? MessageStatus.BOUNCED : MessageStatus.FAILED,
      error: errorMessage,
      sendAt: null,
    },
  });
  
  // Update recipient status
  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      status: isBounce ? RecipientStatus.BOUNCED : RecipientStatus.FAILED,
    },
  });
  
  // Re-throw to let queue handle retry logic
  throw error;
}
```

### Fix 2: Add Bounce Statistics to Admin Metrics

**File:** `backend/src/routes/modules/admin.ts`

**Add bounce queries:**

```typescript
// Get bounce statistics
const bounceStats = await prisma.emailBounce.groupBy({
  by: ["bounceType", "bounceCategory"],
  _count: true,
});

const totalBounces = await prisma.emailBounce.count();
const hardBounces = await prisma.emailBounce.count({
  where: { bounceType: "HARD" },
});
const softBounces = await prisma.emailBounce.count({
  where: { bounceType: "SOFT" },
});

// Add to response
bounceStatistics: {
  total: totalBounces,
  hard: hardBounces,
  soft: softBounces,
  byCategory: bounceStats.reduce((acc, item) => {
    acc[`${item.bounceType}_${item.bounceCategory}`] = item._count;
    return acc;
  }, {} as Record<string, number>),
},
```

### Fix 3: Update Admin Page UI

**File:** `webapp/src/app/admin/page.tsx`

**Add bounce metrics display section**

---

## ✅ Verification Checklist

After fixes, verify:
- [ ] MessageLog status is updated to BOUNCED when email bounces
- [ ] MessageLog status is updated to FAILED when email fails
- [ ] Admin page shows accurate message status counts
- [ ] Admin page displays bounce statistics
- [ ] Admin page displays failure statistics
- [ ] Bounce rate is calculated correctly
- [ ] User email statistics show correct failed count

---

## 📝 Summary

**Total Issues:** 4
- **Critical:** 2 (MessageLog status not updated, bounce data not displayed)
- **Important:** 2 (Failed email tracking, missing metrics)

**Priority:** HIGH - Data accuracy is critical for admin dashboard

**Estimated Fix Time:** 2-3 hours

**Files to Modify:**
1. `backend/src/services/campaignEngine.ts` - Add error handling
2. `backend/src/routes/modules/admin.ts` - Add bounce queries
3. `webapp/src/app/admin/page.tsx` - Add bounce UI


