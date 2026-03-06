// ============================================================
// CONNECTOR INTERFACE
// All data source connectors follow this pattern.
// To add a new source, create a new file that exports
// a class implementing DataSourceConnector.
// ============================================================

/**
 * ConnectorMode determines how a connector's data flows:
 * - 'import':    Writes to Property/Lead tables only (classic pipeline import)
 * - 'discovery': Writes to DiscoveredLead/DiscoverySignal only (staging area)
 * - 'both':          Writes to both — import pipeline AND discovery staging
 * - 'manual_import': Like discovery, but requires manual paste instead of auto-fetch
 */
export type ConnectorMode = 'import' | 'discovery' | 'both' | 'manual_import';

export interface ConnectorResult {
  success: boolean;
  newLeads: number;
  updatedLeads: number;
  errors: number;
  errorMessages: string[];
  rawRecords: number;
  duration: number; // ms
}

export interface ParsedRecord {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  ownerName?: string;
  parcelNumber?: string;
  caseNumber?: string;
  saleDate?: string;
  plaintiff?: string;
  attorney?: string;
  sourceUrl?: string;
  signals: Array<{
    signalType: string;
    label: string;
    category: string; // 'distress' | 'ownership' | 'financial' | 'condition' | 'automated' | 'manual'
    points: number;
    value?: string;
    source?: string;
    eventDate?: string; // ISO date or parseable date string for timeline events
  }>;
  rawData: Record<string, any>;
}

export interface DataSourceConnector {
  name: string;
  slug: string;
  type: string;
  regionSlug: string;
  description: string;
  sourceUrl?: string;

  // Fetch and parse data from the source
  fetchAndParse(): Promise<ParsedRecord[]>;

  // Parse manually pasted data (for manual_import connectors)
  parseManualInput?(rawText: string): ParsedRecord[];
}
