import { prisma } from '../prisma';

// ============================================================
// FLAG ARCHIVED LEAD FOR REACTIVATION
// Called by lookup engines after creating a NEW signal on a lead.
// If the lead is archived, set needsReview so the user can decide
// whether to bring it back into the active pipeline.
// ============================================================

/**
 * After a new signal is created on a lead, check if the lead
 * is archived. If so, set needsReview=true with a reactivation
 * reason so the user can decide whether to bring it back.
 *
 * @param leadId      The lead that received a new signal
 * @param signalLabel Human-readable label (e.g. 'Tax Delinquent')
 * @returns true if the lead was flagged, false if skipped
 */
export async function flagArchivedLeadIfNewSignal(
  leadId: string,
  signalLabel: string,
): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { status: true, needsReview: true, needsReviewDismissedAt: true },
  });

  if (!lead) return false;
  if (lead.status !== 'ARCHIVE') return false;

  // Build review reason as JSON (same structure as ownership-change review)
  const reason = JSON.stringify({
    summary: `Archived lead received new signal: ${signalLabel}`,
    action: 'reactivate',
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      needsReview: true,
      needsReviewReason: reason,
      needsReviewDismissedAt: null, // Reset dismissal for new finding
    },
  });

  return true;
}
