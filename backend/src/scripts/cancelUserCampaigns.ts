/**
 * Admin Script: Cancel Campaigns for a User
 * 
 * This script finds and cancels all active campaigns for a specific user by email.
 * 
 * Usage:
 *   npx tsx src/scripts/cancelUserCampaigns.ts <userEmail>
 * 
 * Example:
 *   npx tsx src/scripts/cancelUserCampaigns.ts tanish.agarwal@ktj.in
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { campaignEngine } from "../services/campaignEngine";
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
      await campaignEngine.cancelCampaign(campaign.id);
      console.log(`✅ Successfully cancelled: "${campaign.name}"`);
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
}

// Main execution
const userEmail = process.argv[2];

if (!userEmail) {
  console.error("❌ Usage: npx tsx src/scripts/cancelUserCampaigns.ts <userEmail>");
  console.error("   Example: npx tsx src/scripts/cancelUserCampaigns.ts tanish.agarwal@ktj.in");
  process.exit(1);
}

cancelUserCampaigns(userEmail)
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    logger.error({ error, stack: error.stack }, "cancelUserCampaigns script failed");
    process.exit(1);
  });

