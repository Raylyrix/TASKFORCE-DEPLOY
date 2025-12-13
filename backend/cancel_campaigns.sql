-- Cancel all active campaigns for user: tanish.agarwal@ktj.in
-- Simple SQL to cancel campaigns

UPDATE "Campaign"
SET status = 'CANCELLED',
    "updatedAt" = NOW()
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'tanish.agarwal@ktj.in')
AND status IN ('RUNNING', 'SCHEDULED', 'PAUSED');

-- Show results
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

