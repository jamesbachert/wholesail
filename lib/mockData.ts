// ============================================================
// WholeSail — Helpers & Configuration
// Scoring weights, formatting, and display utilities
// ============================================================

// ============================================================
// SCORING WEIGHTS (configurable)
// ============================================================

export const defaultScoringWeights = [
  { signalType: 'pre_foreclosure', label: 'Pre-Foreclosure / NOD', category: 'automated', weight: 20, description: 'Property is in pre-foreclosure or has received NOD' },
  { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', weight: 18, description: 'Property has delinquent taxes' },
  { signalType: 'probate', label: 'Probate / Estate', category: 'automated', weight: 20, description: 'Owner deceased, property in probate' },
  { signalType: 'divorce', label: 'Divorce – Recent Filing or Finalized', category: 'automated', weight: 16, description: 'Owner has a recent divorce filing' },
  { signalType: 'code_violation', label: 'Code Violation', category: 'automated', weight: 10, description: 'Property has municipal code violations' },
  { signalType: 'absentee_owner', label: 'Absentee Owner', category: 'automated', weight: 8, description: 'Owner does not live at the property' },
  { signalType: 'high_equity', label: 'High Equity', category: 'automated', weight: 12, description: 'Estimated equity above 40% of value' },
  { signalType: 'vacant', label: 'Vacant Property', category: 'automated', weight: 10, description: 'Property appears to be vacant' },
  { signalType: 'expired_listing', label: 'Expired Listing', category: 'automated', weight: 8, description: 'Property had an expired or withdrawn MLS listing' },
  { signalType: 'lien_stacking', label: 'Multiple Liens', category: 'automated', weight: 14, description: 'Property has multiple liens filed against it' },
  { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', weight: 5, description: 'Owned for 15+ years' },
  { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', weight: 6, description: 'Zip code has low wholesaler competition' },
  // Manual signals
  { signalType: 'owner_willing', label: 'Owner Willing to Sell', category: 'manual', weight: 25, description: 'Owner expressed willingness to sell during contact' },
  { signalType: 'owner_timeline', label: 'Urgent Timeline', category: 'manual', weight: 20, description: 'Owner has urgent need to sell (moving, health, etc.)' },
  { signalType: 'owner_life_event', label: 'Life Event Confirmed', category: 'manual', weight: 15, description: 'Confirmed life event: job loss, illness, relocation, etc.' },
  { signalType: 'property_condition', label: 'Poor Property Condition', category: 'manual', weight: 10, description: 'Property confirmed to be in poor condition' },
  { signalType: 'owner_responsive', label: 'Owner Responsive', category: 'manual', weight: 8, description: 'Owner is responsive to calls/texts' },
  { signalType: 'inherited', label: 'Inherited Property', category: 'manual', weight: 18, description: 'Owner confirmed they inherited the property' },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getScoreColor(score: number): string {
  if (score >= 100) return 'priority';
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export function getScoreColorHex(score: number): string {
  if (score >= 100) return '#DC2626'; // priority — red
  if (score >= 70) return '#EA580C'; // hot — orange
  if (score >= 40) return '#F59E0B'; // warm — amber
  if (score >= 20) return '#3B82F6'; // cold — blue
  return '#64748B'; // minimal — slate
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    COLD: 'Cold',
    CONTACTED: 'Contacted',
    WARM: 'Warm',
    HOT: 'Hot',
    UNDER_CONTRACT: 'Under Contract',
    HANDED_OFF: 'Handed Off',
    CLOSED: 'Closed',
    ARCHIVE: 'Archive',
    DO_NOT_CONTACT: 'Do Not Contact',
  };
  return map[status] || status;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    COLD: 'info',
    CONTACTED: 'info',
    WARM: 'warning',
    HOT: 'danger',
    UNDER_CONTRACT: 'success',
    HANDED_OFF: 'info',
    CLOSED: 'success',
    ARCHIVE: 'neutral',
    DO_NOT_CONTACT: 'neutral',
  };
  return map[status] || 'neutral';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getSignalTagColor(signalType: string): string {
  // Matches the 4 categories in SignalsTab for consistent colors
  const distressSignals = ['pre_foreclosure', 'probate', 'tax_delinquent', 'upset_sale', 'divorce', 'code_violation', 'liens_judgments', 'lien_stacking'];
  const ownershipSignals = ['owner_deceased', 'inherited', 'absentee_owner', 'out_of_state_owner', 'tired_landlord', 'rental_property', 'long_term_owner', 'owner_willing', 'owner_timeline', 'owner_responsive', 'owner_life_event'];
  const financialSignals = ['bankruptcy', 'high_equity', 'free_and_clear', 'job_loss'];
  const conditionSignals = ['vacant', 'fire_flood_damage', 'deferred_maintenance', 'property_condition', 'expired_listing'];

  if (distressSignals.includes(signalType)) return 'danger';
  if (ownershipSignals.includes(signalType)) return 'ownership';
  if (financialSignals.includes(signalType)) return 'financial';
  if (conditionSignals.includes(signalType)) return 'neutral';
  return 'neutral';
}

/** Shorten verbose signal labels for pill display.
 *  e.g. "Long-Term Owner (20+ Years)" → "Long-Term Owner"
 *  e.g. "Absentee Owner (Tenant Occupied)" → "Absentee Owner"
 *  e.g. "Rental Property (Section 8)" → "Rental Property"  */
export function shortenSignalLabel(label: string): string {
  if (label.startsWith('Long-Term Owner')) return 'Long-Term Owner';
  if (label.startsWith('Absentee Owner')) return 'Absentee Owner';
  if (label.startsWith('Rental Property')) return 'Rental Property';
  return label;
}
