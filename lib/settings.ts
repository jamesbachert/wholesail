import { prisma } from '@/lib/prisma';

// ============================================================
// APP PREFERENCES
// Stored in the AppSetting key-value table.
// ============================================================

const NEW_LEAD_THRESHOLD_KEY = 'new_lead_threshold_days';
const DEFAULT_NEW_LEAD_THRESHOLD = 14;

/**
 * How many days a lead is considered "new" (unviewed OR recently created).
 * Used by the "New" computed filter on the Leads page.
 */
export async function getNewLeadThresholdDays(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: NEW_LEAD_THRESHOLD_KEY },
  });
  if (!setting) return DEFAULT_NEW_LEAD_THRESHOLD;
  const parsed = parseInt(setting.value, 10);
  return isNaN(parsed) ? DEFAULT_NEW_LEAD_THRESHOLD : parsed;
}

export async function setNewLeadThresholdDays(days: number): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: NEW_LEAD_THRESHOLD_KEY },
    update: { value: String(days) },
    create: { key: NEW_LEAD_THRESHOLD_KEY, value: String(days) },
  });
}
