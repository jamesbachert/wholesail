import { DataSourceConnector } from './types';
import { LehighSheriffSalesConnector } from './pa/lehigh-valley/lehigh-sheriff-sales';
import { LehighRepositoryConnector } from './pa/lehigh-valley/lehigh-tax-repository';
import { NorthamptonSheriffSalesConnector } from './pa/lehigh-valley/northampton-sheriff-sales';
// NOTE: All LV connectors live in pa/lehigh-valley/ (no separate pa/northampton/ folder)
import { AllentownCodeViolationsConnector } from './pa/lehigh-valley/allentown-code-violations';

// ============================================================
// CONNECTOR REGISTRY
// Organized by: state / region / connector
// Global connectors (future) go in ./global/
// ============================================================

const connectors: DataSourceConnector[] = [
  // Pennsylvania — Lehigh Valley
  new LehighSheriffSalesConnector(),
  new LehighRepositoryConnector(),
  new NorthamptonSheriffSalesConnector(),
  new AllentownCodeViolationsConnector(),
];

const connectorMap = new Map<string, DataSourceConnector>(
  connectors.map((c) => [c.slug, c])
);

export function getConnector(slug: string): DataSourceConnector | undefined {
  return connectorMap.get(slug);
}

export function getAllConnectorSlugs(): string[] {
  return connectors.map((c) => c.slug);
}

export function getConnectorInfo() {
  return connectors.map((c) => ({
    name: c.name,
    slug: c.slug,
    type: c.type,
    regionSlug: c.regionSlug,
    description: c.description,
    state: 'PA',
    region: c.regionSlug,
  }));
}
