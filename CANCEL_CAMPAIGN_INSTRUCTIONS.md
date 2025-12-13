# 🛑 Cancel Campaign for tanish.agarwal@ktj.in

## Quick Method: Using Railway Database UI

1. **Go to Railway Dashboard**: https://railway.app
2. **Open your project** → Click on **`taskforce-db`** service
3. **Click "Query" or "Data" tab** (SQL editor)
4. **Run this SQL**:

```sql
-- Cancel all active campaigns for tanish.agarwal@ktj.in
UPDATE "Campaign"
SET status = 'CANCELLED',
    "updatedAt" = NOW()
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'tanish.agarwal@ktj.in')
AND status IN ('RUNNING', 'SCHEDULED', 'PAUSED');

-- Verify cancellation
SELECT 
    c.id,
    c.name,
    c.status,
    c."createdAt",
    COUNT(cr.id) as recipient_count,
    COUNT(CASE WHEN cr.status = 'SENT' THEN 1 END) as sent_count
FROM "Campaign" c
LEFT JOIN "CampaignRecipient" cr ON cr."campaignId" = c.id
WHERE c."userId" = (SELECT id FROM "User" WHERE email = 'tanish.agarwal@ktj.in')
AND c.status = 'CANCELLED'
GROUP BY c.id, c.name, c.status, c."createdAt"
ORDER BY c."createdAt" DESC;
```

---

## Alternative: Using Railway CLI

```powershell
# Connect to database
railway connect taskforce-db

# Then paste the SQL above into the psql prompt
```

---

## What This Does

✅ **Cancels all active campaigns** (RUNNING, SCHEDULED, PAUSED) for the user  
✅ **Updates status to CANCELLED** in the database  
✅ **Queue jobs will automatically skip** when processed (they check campaign status)  
✅ **No emails will be sent** after cancellation  

---

## Note

The queue cleanup (removing pending jobs) will happen automatically:
- When jobs are processed, they check `campaign.status === CANCELLED` and skip
- The duplicate prevention logic we added will prevent any sends

---

## Verification

After running the SQL, check the results:
- You should see the cancelled campaigns listed
- Status should be `CANCELLED`
- No new emails will be sent







