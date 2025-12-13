/**
 * Admin Script: Cancel Campaigns for a User (Database Only)
 * 
 * This script finds and cancels all active campaigns for a specific user by email.
 * This version only updates the database - queue cleanup happens automatically
 * when the service processes jobs (they'll be skipped due to CANCELLED status).
 * 
 * Usage:
 *   railway run --service taskforce-backend npx tsx src/scripts/cancelUserCampaignsSimple.ts <userEmail>
 * 
 * Example:
 *   railway run --service taskforce-backend npx tsx src/scripts/cancelUserCampaignsSimple.ts tanish.agarwal@ktj.in
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { CampaignStatus } from "@prisma/client";

async function cancelUserCampaigns(userEmail: string) {
  console.log(`🔍 Looking up user: ${userEmail}...`);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase().trim() },
    select: { id: true, email: true, displayName: true },
  });

  if (!user) {
    console.error(`❌ User not found: ${userEmail}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.displayName || user.email} (ID: ${user.id})`);

  // Find all active campaigns for this user
  const activeStatuses = [
    CampaignStatus.RUNNING,
    CampaignStatus.SCHEDULED,
    CampaignStatus.PAUSED,
  ];

  const campaigns = await prisma.campaign.findMany({
    where: {
      userId: user.id,
      status: { in: activeStatuses },
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      scheduledSendAt: true,
      recipients: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (campaigns.length === 0) {
    console.log(`ℹ️  No active campaigns found for ${userEmail}`);
    return;
  }

  console.log(`\n📋 Found ${campaigns.length} active campaign(s):`);
  campaigns.forEach((campaign, index) => {
    const sentCount = campaign.recipients.filter((r) => r.status === "SENT").length;
    const totalCount = campaign.recipients.length;
    console.log(
      `  ${index + 1}. "${campaign.name}" (${campaign.id})\n` +
      `     Status: ${campaign.status}\n` +
      `     Created: ${campaign.createdAt.toISOString()}\n` +
      `     Scheduled: ${campaign.scheduledSendAt?.toISOString() || "N/A"}\n` +
      `     Progress: ${sentCount}/${totalCount} sent`
    );
  });

  console.log(`\n⚠️  About to cancel ${campaigns.length} campaign(s)...`);
  console.log("Press Ctrl+C to abort, or wait 3 seconds to continue...\n");

  // Give user 3 seconds to abort
  await new Promise((resolve) => setTimeout(resolve, 3000));

  let successCount = 0;
  let errorCount = 0;

  for (const campaign of campaigns) {
    try {
      console.log(`\n🛑 Cancelling campaign: "${campaign.name}" (${campaign.id})...`);
      
      // Update campaign status to CANCELLED
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: CampaignStatus.CANCELLED,
        },
      });

      console.log(`✅ Successfully cancelled: "${campaign.name}"`);
      logger.info(
        { campaignId: campaign.id, userId: user.id, userEmail },
        "Campaign cancelled via admin script"
      );
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to cancel "${campaign.name}": ${error.message}`);
      logger.error(
        { campaignId: campaign.id, error: error.message, stack: error.stack },
        "Failed to cancel campaign in script"
      );
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully cancelled: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📦 Total: ${campaigns.length}`);
  
  if (successCount > 0) {
    console.log(`\n⚠️  Note: Queue jobs will be automatically skipped when processed`);
    console.log(`   (Campaign status is now CANCELLED, so jobs will check and skip)`);
  }
}

// Main execution
const userEmail = process.argv[2];

if (!userEmail) {
  console.error("❌ Usage: npx tsx src/scripts/cancelUserCampaignsSimple.ts <userEmail>");
  console.error("   Example: npx tsx src/scripts/cancelUserCampaignsSimple.ts tanish.agarwal@ktj.in");
  process.exit(1);
}

cancelUserCampaigns(userEmail)
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    logger.error({ error, stack: error.stack }, "cancelUserCampaignsSimple script failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });







