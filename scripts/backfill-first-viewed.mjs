import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// BACKFILL firstViewedAt + archivedAt
//
// 1. firstViewedAt: Mark all existing leads as "viewed" today
//    EXCEPT those created within the "New Lead Threshold" (default 14 days).
//    Those recent leads stay "new" until someone actually views them.
//
// 2. archivedAt: Set archivedAt = now() for any lead with status = ARCHIVE
//    that doesn't have archivedAt set. Fixes legacy data where archivedAt
//    was never populated.
// ============================================================

async function main() {
  const now = new Date();

  // Read threshold from AppSetting (default 14 days)
  let thresholdDays = 14;
  const setting = await prisma.appSetting.findUnique({
    where: { key: 'new_lead_threshold_days' },
  });
  if (setting) {
    const parsed = parseInt(setting.value, 10);
    if (!isNaN(parsed)) thresholdDays = parsed;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  console.log(`Threshold: ${thresholdDays} days (cutoff: ${cutoff.toISOString()})`);

  // 1. Backfill firstViewedAt for leads created BEFORE the cutoff
  const viewedResult = await prisma.lead.updateMany({
    where: {
      firstViewedAt: null,
      createdAt: { lt: cutoff },
    },
    data: { firstViewedAt: now },
  });
  console.log(`firstViewedAt: Marked ${viewedResult.count} older leads as viewed`);

  // Count remaining "new" leads (within threshold, still unviewed)
  const remainingNew = await prisma.lead.count({
    where: {
      firstViewedAt: null,
      createdAt: { gte: cutoff },
    },
  });
  console.log(`firstViewedAt: ${remainingNew} recent leads remain "new" (created within ${thresholdDays} days)`);

  // 2. Backfill archivedAt for archived leads missing the timestamp
  const archivedResult = await prisma.lead.updateMany({
    where: {
      status: 'ARCHIVE',
      archivedAt: null,
    },
    data: { archivedAt: now },
  });
  console.log(`archivedAt: Backfilled ${archivedResult.count} archived leads`);

  console.log('Done!');
}

main()
  .catch((err) => {
    console.error('Backfill error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
