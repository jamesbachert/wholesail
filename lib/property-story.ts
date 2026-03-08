// ============================================================
// PROPERTY STORY — Timeline Event Aggregation
// Builds a chronological narrative of property events from
// existing property data and signal records. Pure function,
// no API calls — just transforms data already loaded.
// ============================================================

export interface PropertyStoryEvent {
  year: number;
  month?: number;         // 1-12, for sorting within a year
  date?: string;          // ISO date string for precise sorting
  monthDay?: string;      // "Apr 30" — shown in the month/day column
  label: string;          // "Purchased for $120,000"
  detail?: string;        // Extra context (case number, amount, etc.)
  signalType?: string;    // If derived from a signal
}

interface PropertyInput {
  yearBuilt?: number | null;
  purchaseDate?: string | Date | null;
  purchasePrice?: number | null;
  ownerName?: string | null;
}

interface SignalInput {
  signalType: string;
  label: string;
  category: string;
  value: string | null;
  eventDate: string | Date | null;
  isActive: boolean;
}

export function buildPropertyStory(
  property: PropertyInput,
  signals: SignalInput[]
): PropertyStoryEvent[] {
  const events: PropertyStoryEvent[] = [];

  // 1. Year Built
  if (property.yearBuilt) {
    events.push({
      year: property.yearBuilt,
      label: 'Built',
    });
  }

  // 2. Purchase Date/Price
  if (property.purchaseDate) {
    const d = new Date(property.purchaseDate);
    if (!isNaN(d.getTime())) {
      const priceStr = property.purchasePrice
        ? ` for ${formatCurrency(property.purchasePrice)}`
        : '';
      const buyerStr = property.ownerName ? ` by ${titleCase(property.ownerName)}` : '';
      events.push({
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        date: d.toISOString(),
        monthDay: formatMonthDay(d),
        label: `Purchased${priceStr}`,
        detail: buyerStr || undefined,
      });
    }
  }

  // 3. Active signals with eventDate
  for (const signal of signals) {
    if (!signal.isActive || !signal.eventDate) continue;

    const d = new Date(signal.eventDate);
    if (isNaN(d.getTime())) continue;

    // Signals whose eventDate is an expiration/status (not a specific occurrence)
    // should only show the year — the month/day isn't meaningful.
    const yearOnly = YEAR_ONLY_SIGNALS.has(signal.signalType);

    events.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      date: d.toISOString(),
      monthDay: yearOnly ? undefined : formatMonthDay(d),
      label: signal.label,
      detail: signal.value || undefined,
      signalType: signal.signalType,
    });
  }

  // 4. Tax delinquent signals — no eventDate, parse years from value string
  //    Value format: "Delinquent taxes: $1,234.56 (2022, 2023)"
  for (const signal of signals) {
    if (!signal.isActive || signal.signalType !== 'tax_delinquent') continue;

    const parsed = parseTaxDelinquentValue(signal.value);
    if (!parsed) continue;

    for (const yearEntry of parsed.years) {
      events.push({
        year: yearEntry,
        label: signal.label,
        detail: parsed.amount,
        signalType: signal.signalType,
      });
    }
  }

  // Sort chronologically (oldest first)
  events.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month && b.month && a.month !== b.month) return a.month - b.month;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    // Events with dates sort after those without (year-only events first)
    if (a.date && !b.date) return 1;
    if (!a.date && b.date) return -1;
    return 0;
  });

  return events;
}

// Signals whose eventDate is an expiration/status rather than a
// specific occurrence — show year only in the timeline.
const YEAR_ONLY_SIGNALS = new Set([
  'rental_property',
]);

/**
 * Format the month+day portion for the timeline column.
 * Returns "Apr 30" for a full date, or "Apr" when only year+month was known
 * (day = 1 is the connector default when no day is available).
 */
function formatMonthDay(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Use UTC methods — dates are stored as UTC midnight, and local-time
  // methods shift them back a day in US timezones (e.g. Oct 1 → Sep 30).
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();

  // If day is 1st, connector likely only had year+month
  if (day === 1) {
    return month;
  }
  return `${month} ${day}`;
}

/** Convert "LOPEZ RAYMOND ET AL" → "Lopez Raymond Et Al" */
function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * Parse a tax_delinquent signal's value string to extract years and amount.
 * Expected format: "Delinquent taxes: $1,234.56 (2022, 2023)"
 */
function parseTaxDelinquentValue(value: string | null): { years: number[]; amount: string } | null {
  if (!value) return null;

  // Extract dollar amount
  const amountMatch = value.match(/\$([\d,]+\.?\d*)/);
  const amount = amountMatch ? `$${amountMatch[1]}` : '';

  // Extract years from parentheses
  const yearsMatch = value.match(/\(([^)]+)\)/);
  if (!yearsMatch) return null;

  const years = yearsMatch[1]
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n > 1900 && n < 2100);

  if (years.length === 0) return null;

  return { years, amount };
}
