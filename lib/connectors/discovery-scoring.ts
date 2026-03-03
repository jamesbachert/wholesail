// ============================================================
// DISCOVERY SCORING ENGINE
// Computes a 0–100 composite score for discovered properties.
//
// Phase 2: Generic scoring — sums all DiscoverySignal points
// plus cross-source bonuses when multiple connectors confirm
// the same property.
// ============================================================

interface SignalForScoring {
  connectorSlug: string;
  points: number;
}

/**
 * Calculate composite discovery score from all signals on a property.
 * Score = sum of signal points + cross-source bonuses, capped at 100.
 *
 * Cross-source bonuses:
 *   2 sources = +10
 *   3+ sources = +25
 */
export function calculateDiscoveryScore(
  signals: SignalForScoring[],
  sourceCount: number
): number {
  // Sum all signal points
  let score = signals.reduce((sum, s) => sum + s.points, 0);

  // Cross-source bonuses
  if (sourceCount >= 3) {
    score += 25;
  } else if (sourceCount >= 2) {
    score += 10;
  }

  return Math.min(score, 100);
}

// ============================================================
// BLIGHT-SPECIFIC SCORING HELPERS
// Used by the ARA Blight connector to calculate individual
// signal point values before passing them to the discovery engine.
// ============================================================

interface BlightScoringInput {
  blightLevel: 'certified' | 'determined' | string;
  blightCriteria?: string | null;
  dateCertified?: Date | null;
  yearBuilt?: number | null;
  notes?: string | null;
  harb?: boolean;
  inBothFeeds?: boolean;
}

/** Points for blight level signal */
export function blightLevelPoints(level: string): number {
  if (level === 'certified') return 25;
  if (level === 'determined') return 15;
  return 0;
}

/** Points for blight criteria count signal */
export function blightCriteriaPoints(criteria: string | null | undefined): number {
  if (!criteria) return 0;
  const count = criteria.split(',').map((s) => s.trim()).filter(Boolean).length;
  return Math.min(count * 4, 28);
}

/** Points for certification age signal */
export function certificationAgePoints(dateCertified: Date | string | null | undefined): number {
  if (!dateCertified) return 0;
  const certDate = dateCertified instanceof Date ? dateCertified : new Date(dateCertified);
  const yearsAgo = (Date.now() - certDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (yearsAgo >= 5) return 15;
  if (yearsAgo >= 3) return 10;
  if (yearsAgo >= 1) return 6;
  return 2;
}

/** Points for building age signal */
export function buildingAgePoints(yearBuilt: number | null | undefined): number {
  if (!yearBuilt) return 0;
  if (yearBuilt < 1950) return 8;
  if (yearBuilt < 1980) return 5;
  if (yearBuilt < 2000) return 3;
  return 1;
}

/** Points for enforcement keywords in notes */
export function enforcementKeywordPoints(notes: string | null | undefined): number {
  if (!notes) return 0;
  const lower = notes.toLowerCase();
  const KEYWORDS = [
    'rental fees', 'dot filed', 'not passed', 'demolition',
    'lien', 'condemned', 'vacant', 'unoccupied', 'boarded', 'unsafe',
  ];
  let count = 0;
  for (const kw of KEYWORDS) {
    if (lower.includes(kw)) count++;
  }
  return Math.min(count * 4, 16);
}

/** Points for HARB district */
export function harbPoints(harb: boolean | undefined): number {
  return harb ? 4 : 0;
}

/** Points for being in both blight feeds */
export function bothFeedsPoints(inBoth: boolean | undefined): number {
  return inBoth ? 4 : 0;
}
