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
 * - 'both':      Writes to both — import pipeline AND discovery staging
 */
export type ConnectorMode = 'import' | 'discovery' | 'both';

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
  }>;
  rawData: Record<string, any>;
}

export interface DataSourceConnector {
  name: string;
  slug: string;
  type: string;
  regionSlug: string;
  description: string;

  // Fetch and parse data from the source
  fetchAndParse(): Promise<ParsedRecord[]>;
}
