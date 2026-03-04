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
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'medium';
  return 'cold';
}

export function getScoreColorHex(score: number): string {
  if (score >= 80) return '#DC2626'; // hot — red
  if (score >= 60) return '#EA580C'; // warm — orange
  if (score >= 40) return '#F59E0B'; // medium — amber
  return '#94A3B8'; // cold — gray
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: 'New',
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
    NEW: 'info',
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
  const urgentSignals = ['pre_foreclosure', 'probate', 'tax_delinquent', 'lien_stacking', 'code_violation', 'owner_willing', 'owner_timeline'];
  const warningSignals = ['divorce', 'inherited', 'owner_life_event', 'property_condition'];
  const infoSignals = ['absentee_owner', 'vacant', 'expired_listing', 'owner_responsive', 'rental_property'];

  if (urgentSignals.includes(signalType)) return 'danger';
  if (warningSignals.includes(signalType)) return 'warning';
  if (infoSignals.includes(signalType)) return 'info';
  return 'neutral';
}
