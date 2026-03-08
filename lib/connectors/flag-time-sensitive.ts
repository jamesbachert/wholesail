import { prisma } from '../prisma';

// ============================================================
// FLAG TIME-SENSITIVE ON NEW DISTRESS SIGNAL
// Shared helper called by lookup engines after creating a NEW
// distress signal. Flags the lead as time-sensitive so the user
// knows to take action.
//
// Rules:
//   - Only flags for distress-category signals (or known distress types)
//   - If already actively time-sensitive (not dismissed), no-op
//   - If previously dismissed, re-flags (new distress = new alert)
//   - Only call in the !existingSignal branch (new signal creation)
// ============================================================

/**
 * Known distress signal types. Used as a fallback when the category
 * field is inconsistent across engines (some use 'automated' instead
 * of 'distress' for signals that are functionally distress).
 */
const DISTRESS_SIGNAL_TYPES = new Set([
  'tax_delinquent',
  'code_violation',
  'pre_foreclosure',
  'upset_sale',
  'probate',
  'divorce',
  'liens_judgments',
  'blight_certified',
  'blight_determined',
]);

function isDistressSignal(category: string, signalType?: string): boolean {
  return category === 'distress' || (!!signalType && DISTRESS_SIGNAL_TYPES.has(signalType));
}

/**
 * Flag a lead as time-sensitive when a NEW distress signal is detected.
 *
 * @param leadId       The lead to flag
 * @param category     The signal's category (e.g. 'distress', 'ownership')
 * @param signalLabel  Human-readable label (e.g. 'Tax Delinquent')
 * @param signalValue  Optional detail string (e.g. 'Delinquent taxes: $1,316.34')
 * @param signalType   Optional signal type key for fallback distress check
 * @returns true if the lead was flagged, false if skipped
 */
export async function flagTimeSensitiveIfNewDistress(
  leadId: string,
  category: string,
  signalLabel: string,
  signalValue?: string,
  signalType?: string,
): Promise<boolean> {
  // Only flag for distress signals
  if (!isDistressSignal(category, signalType)) {
    return false;
  }

  // Check the lead's current time-sensitive state
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { isTimeSensitive: true, timeSensitiveDismissedAt: true },
  });

  if (!lead) return false;

  // If already actively time-sensitive (not dismissed), don't overwrite
  if (lead.isTimeSensitive && !lead.timeSensitiveDismissedAt) {
    return false;
  }

  // Build a descriptive reason
  const reason = signalValue
    ? `New distress signal: ${signalLabel} — ${signalValue}`
    : `New distress signal: ${signalLabel}`;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      isTimeSensitive: true,
      timeSensitiveReason: reason,
      timeSensitiveDismissedAt: null, // Reset dismissal for new finding
    },
  });

  return true;
}
