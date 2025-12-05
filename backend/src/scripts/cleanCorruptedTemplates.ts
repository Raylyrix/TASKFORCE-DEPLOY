/**
 * Database Cleanup Script: Clean Corrupted Email Templates
 * 
 * This script sanitizes all existing campaign templates in the database
 * to fix encoding corruption issues (gibberish characters, double-encoding, etc.)
 * 
 * Usage:
 *   npx tsx src/scripts/cleanCorruptedTemplates.ts
 * 
 * OR:
 *   npm run clean-templates
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { sanitizeEmailTemplate } from "../utils/templateSanitizer";

interface CleanupStats {
  totalCampaigns: number;
  cleanedCampaigns: number;
  failedCampaigns: number;
  totalFollowUps: number;
  cleanedFollowUps: number;
  failedFollowUps: number;
  warnings: number;
}

async function cleanCampaignTemplates(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    totalCampaigns: 0,
    cleanedCampaigns: 0,
    failedCampaigns: 0,
    totalFollowUps: 0,
    cleanedFollowUps: 0,
    failedFollowUps: 0,
    warnings: 0,
  };

  console.log('🔍 Fetching all campaigns...');

  // Get all campaigns with their sendStrategy
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      sendStrategy: true,
      status: true,
    },
  });

  stats.totalCampaigns = campaigns.length;
  console.log(`📊 Found ${campaigns.length} campaigns to check`);

  for (const campaign of campaigns) {
    try {
      const strategy = campaign.sendStrategy as any;

      if (!strategy || !strategy.template) {
        console.log(`⚠️  Campaign ${campaign.id} (${campaign.name}) has no template - skipping`);
        continue;
      }

      const { subject, html, attachments } = strategy.template;

      // Sanitize the template
      const result = sanitizeEmailTemplate({
        subject: subject || '',
        html: html || '',
        attachments: attachments || [],
      });

      // Check if template needed cleaning
      const hadIssues = result.warnings.length > 0 || !result.isValid;

      if (hadIssues) {
        console.log(`\n🔧 Cleaning campaign: ${campaign.name} (${campaign.id})`);
        
        if (result.errors.length > 0) {
          console.log(`   ❌ Errors found: ${result.errors.join(', ')}`);
          stats.failedCampaigns++;
          continue;
        }

        if (result.warnings.length > 0) {
          console.log(`   ⚠️  Warnings: ${result.warnings.join(', ')}`);
          stats.warnings += result.warnings.length;
        }

        // Update the campaign with sanitized template
        const updatedStrategy = {
          ...strategy,
          template: result.template,
        };

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            sendStrategy: updatedStrategy,
          },
        });

        console.log(`   ✅ Campaign cleaned successfully`);
        stats.cleanedCampaigns++;
      }
    } catch (error) {
      console.error(`❌ Failed to clean campaign ${campaign.id}:`, error);
      stats.failedCampaigns++;
    }
  }

  return stats;
}

async function cleanFollowUpTemplates(): Promise<Partial<CleanupStats>> {
  const stats: Partial<CleanupStats> = {
    totalFollowUps: 0,
    cleanedFollowUps: 0,
    failedFollowUps: 0,
    warnings: 0,
  };

  console.log('\n🔍 Fetching all follow-up steps...');

  // Get all follow-up steps
  const followUpSteps = await prisma.followUpStep.findMany({
    select: {
      id: true,
      followUpSequenceId: true,
      order: true,
      templateSubject: true,
      templateHtml: true,
    },
  });

  stats.totalFollowUps = followUpSteps.length;
  console.log(`📊 Found ${followUpSteps.length} follow-up steps to check`);

  for (const step of followUpSteps) {
    try {
      // Sanitize the template
      const result = sanitizeEmailTemplate({
        subject: step.templateSubject || '',
        html: step.templateHtml || '',
      });

      // Check if template needed cleaning
      const hadIssues = result.warnings.length > 0 || !result.isValid;

      if (hadIssues) {
        console.log(`\n🔧 Cleaning follow-up step: ${step.followUpSequenceId} - Step ${step.order + 1}`);
        
        if (result.errors.length > 0) {
          console.log(`   ❌ Errors found: ${result.errors.join(', ')}`);
          stats.failedFollowUps!++;
          continue;
        }

        if (result.warnings.length > 0) {
          console.log(`   ⚠️  Warnings: ${result.warnings.join(', ')}`);
          stats.warnings! += result.warnings.length;
        }

        // Update the follow-up step with sanitized template
        await prisma.followUpStep.update({
          where: { id: step.id },
          data: {
            templateSubject: result.template.subject,
            templateHtml: result.template.html,
          },
        });

        console.log(`   ✅ Follow-up step cleaned successfully`);
        stats.cleanedFollowUps!++;
      }
    } catch (error) {
      console.error(`❌ Failed to clean follow-up step ${step.id}:`, error);
      stats.failedFollowUps!++;
    }
  }

  return stats;
}

async function main() {
  console.log('🚀 Starting template cleanup script...\n');
  console.log('This script will sanitize all email templates to fix encoding issues.');
  console.log('It is safe to run multiple times - already clean templates will be skipped.\n');

  try {
    // Clean campaign templates
    const campaignStats = await cleanCampaignTemplates();

    // Clean follow-up templates
    const followUpStats = await cleanFollowUpTemplates();

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log('\n📧 Campaigns:');
    console.log(`   Total checked: ${campaignStats.totalCampaigns}`);
    console.log(`   Cleaned: ${campaignStats.cleanedCampaigns}`);
    console.log(`   Failed: ${campaignStats.failedCampaigns}`);
    console.log(`   Untouched (already clean): ${campaignStats.totalCampaigns - campaignStats.cleanedCampaigns - campaignStats.failedCampaigns}`);

    console.log('\n📝 Follow-up Steps:');
    console.log(`   Total checked: ${followUpStats.totalFollowUps}`);
    console.log(`   Cleaned: ${followUpStats.cleanedFollowUps}`);
    console.log(`   Failed: ${followUpStats.failedFollowUps}`);
    console.log(`   Untouched (already clean): ${followUpStats.totalFollowUps! - followUpStats.cleanedFollowUps! - followUpStats.failedFollowUps!}`);

    console.log('\n⚠️  Total warnings addressed: ' + (campaignStats.warnings + followUpStats.warnings!));
    console.log('='.repeat(60));

    if (campaignStats.failedCampaigns > 0 || followUpStats.failedFollowUps! > 0) {
      console.log('\n❌ Some templates failed to clean. Check logs above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All templates cleaned successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Fatal error during cleanup:', error);
    logger.error({ error }, 'Template cleanup script failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();

