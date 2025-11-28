#!/usr/bin/env node

/**
 * Script to resolve failed Prisma migrations
 * Usage: node scripts/resolve-migration.js
 */

const { execSync } = require('child_process');

const failedMigration = '20251112153000_meeting_reminders';

console.log(`Attempting to resolve failed migration: ${failedMigration}`);

try {
  // Try to resolve as rolled back
  try {
    execSync(`npx prisma migrate resolve --rolled-back ${failedMigration}`, {
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
    console.log('✅ Migration resolved as rolled back');
  } catch (error) {
    // If that fails, try to resolve as applied
    try {
      execSync(`npx prisma migrate resolve --applied ${failedMigration}`, {
        stdio: 'inherit',
        cwd: __dirname + '/..'
      });
      console.log('✅ Migration resolved as applied');
    } catch (error2) {
      console.log('⚠️  Could not resolve migration (may already be resolved)');
    }
  }

  // Now try to deploy migrations
  console.log('Running migrations...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: __dirname + '/..'
  });
  console.log('✅ Migrations deployed successfully');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}



