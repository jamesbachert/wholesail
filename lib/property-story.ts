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
  label: string;          // "Purchased for $120,000"
  detail?: string;        // Extra context (case number, amount, etc.)
  signalType?: string;    // If derived from a signal
}

interface PropertyInput {
  yearBuilt?: number | null;
  purchaseDate?: string | Date | null;
  purchasePrice?: number | null;
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
      events.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        date: d.toISOString(),
        label: `Purchased${priceStr}`,
      });
    }
  }

  // 3. Active signals with eventDate
  for (const signal of signals) {
    if (!signal.isActive || !signal.eventDate) continue;

    const d = new Date(signal.eventDate);
    if (isNaN(d.getTime())) continue;

    events.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      date: d.toISOString(),
      label: signal.label,
      detail: signal.value || undefined,
      signalType: signal.signalType,
    });
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

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${amount.toLocaleString()}`;
}
