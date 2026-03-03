import { DataSourceConnector, ParsedRecord, ConnectorMode } from './types';
import { LookupConnector } from './lookup-types';
import { DiscoveryRecord } from './discovery-engine';
import { LehighSheriffSalesConnector } from './pa/lehigh-valley/lehigh-sheriff-sales';
import { LehighRepositoryConnector } from './pa/lehigh-valley/lehigh-tax-repository';
import { NorthamptonSheriffSalesConnector } from './pa/lehigh-valley/northampton-sheriff-sales';
// NOTE: All LV connectors live in pa/lehigh-valley/ (no separate pa/northampton/ folder)
import { AllentownCodeViolationsConnector } from './pa/lehigh-valley/allentown-code-violations';
import { AllentownRentalLicensesConnector } from './pa/lehigh-valley/allentown-rental-licenses';
import { AllentownAraBlightConnector } from './pa/lehigh-valley/allentown-ara-blight';

// ============================================================
// CONNECTOR REGISTRY
// Organized by: state / region / connector
// Global connectors (future) go in ./global/
//
// Each connector has a `mode` that determines data flow:
//   'import'    → Property/Lead tables only
//   'discovery' → DiscoveredLead/DiscoverySignal only
//   'both'      → Both pipeline import AND discovery staging
// ============================================================

// -- Import connectors (write to Property/Lead) --

interface RegisteredConnector {
  connector: DataSourceConnector;
  mode: ConnectorMode;
}

const importConnectors: RegisteredConnector[] = [
  // Pennsylvania — Lehigh Valley
  { connector: new LehighSheriffSalesConnector(), mode: 'both' },
  { connector: new LehighRepositoryConnector(), mode: 'import' },
  { connector: new NorthamptonSheriffSalesConnector(), mode: 'both' },
  { connector: new AllentownCodeViolationsConnector(), mode: 'both' },
];

const connectorMap = new Map<string, RegisteredConnector>(
  importConnectors.map((rc) => [rc.connector.slug, rc])
);

export function getConnector(slug: string): DataSourceConnector | undefined {
  return connectorMap.get(slug)?.connector;
}

export function getConnectorWithMode(slug: string): RegisteredConnector | undefined {
  return connectorMap.get(slug);
}

export function getAllConnectorSlugs(): string[] {
  return importConnectors.map((rc) => rc.connector.slug);
}

// -- Lookup connectors (enrich existing leads, don't create new ones) --

const lookupConnectors: LookupConnector[] = [
  new AllentownRentalLicensesConnector(),
];

// -- Discovery connectors (have their own sync() method, write to DiscoveredLead) --

interface DiscoveryConnectorEntry {
  connector: {
    name: string;
    slug: string;
    regionSlug: string;
    description: string;
    sync(): Promise<any>;
  };
  mode: 'discovery';
}

const discoveryConnectors: DiscoveryConnectorEntry[] = [
  { connector: new AllentownAraBlightConnector(), mode: 'discovery' },
];

const discoveryMap = new Map(
  discoveryConnectors.map((dc) => [dc.connector.slug, dc])
);

export function getDiscoveryConnector(slug: string) {
  return discoveryMap.get(slug)?.connector;
}

export function getDiscoveryConnectorsForRegion(regionSlug: string) {
  return discoveryConnectors
    .filter((dc) => dc.connector.regionSlug === regionSlug)
    .map((dc) => dc.connector);
}

/**
 * Get all connectors that can feed the Discovery system.
 * Includes:
 *   - Pure discovery connectors (mode: 'discovery')
 *   - Import connectors with mode: 'both'
 */
export function getDiscoveryCapableConnectors(regionSlug: string) {
  const result: Array<{
    name: string;
    slug: string;
    regionSlug: string;
    description: string;
    mode: ConnectorMode;
    type: 'discovery' | 'import';
  }> = [];

  // Discovery connectors
  for (const dc of discoveryConnectors) {
    if (dc.connector.regionSlug === regionSlug) {
      result.push({
        name: dc.connector.name,
        slug: dc.connector.slug,
        regionSlug: dc.connector.regionSlug,
        description: dc.connector.description,
        mode: 'discovery',
        type: 'discovery',
      });
    }
  }

  // Import connectors with mode 'both'
  for (const rc of importConnectors) {
    if (rc.mode === 'both' && rc.connector.regionSlug === regionSlug) {
      result.push({
        name: rc.connector.name,
        slug: rc.connector.slug,
        regionSlug: rc.connector.regionSlug,
        description: rc.connector.description,
        mode: 'both',
        type: 'import',
      });
    }
  }

  return result;
}

// -- Adapter: Convert ParsedRecord → DiscoveryRecord --

/**
 * Convert import connector ParsedRecords to DiscoveryRecords
 * so they can be fed into the discovery engine.
 */
export function parsedToDiscoveryRecords(
  records: ParsedRecord[],
  connectorSlug: string
): DiscoveryRecord[] {
  return records.map((parsed) => ({
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    zipCode: parsed.zipCode,
    signals: parsed.signals.map((s) => ({
      signalType: s.signalType,
      label: s.label,
      category: s.category,
      points: s.points,
      value: s.value,
      sourceUrl: parsed.sourceUrl,
    })),
    rawData: parsed.rawData,
  }));
}

// -- Info exports (for settings page, etc.) --

export function getConnectorInfo() {
  const importInfo = importConnectors.map((rc) => ({
    name: rc.connector.name,
    slug: rc.connector.slug,
    type: rc.connector.type,
    regionSlug: rc.connector.regionSlug,
    description: rc.connector.description,
    mode: rc.mode,
    state: 'PA',
    region: rc.connector.regionSlug,
  }));

  const lookupInfo = lookupConnectors.map((c) => ({
    name: c.name,
    slug: c.slug,
    type: c.type,
    regionSlug: c.regionSlug,
    description: c.description,
    mode: 'lookup' as const,
    state: 'PA',
    region: c.regionSlug,
  }));

  const discoveryInfo = discoveryConnectors.map((dc) => ({
    name: dc.connector.name,
    slug: dc.connector.slug,
    type: 'discovery',
    regionSlug: dc.connector.regionSlug,
    description: dc.connector.description,
    mode: 'discovery' as const,
    state: 'PA',
    region: dc.connector.regionSlug,
  }));

  return [...importInfo, ...lookupInfo, ...discoveryInfo];
}
