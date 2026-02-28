import { DataSourceConnector } from './types';
import { LehighSheriffSalesConnector } from './lehigh-sheriff-sales';

// ============================================================
// CONNECTOR REGISTRY
// Register all data source connectors here.
// To add a new connector:
// 1. Create a new file in lib/connectors/
// 2. Implement the DataSourceConnector interface
// 3. Add it to the registry below
// ============================================================

const connectors: Record<string, () => DataSourceConnector> = {
  'lehigh-sheriff-sales': () => new LehighSheriffSalesConnector(),
  // Future connectors:
  // 'northampton-sheriff-sales': () => new NorthamptonSheriffSalesConnector(),
  // 'lehigh-tax-delinquent': () => new LehighTaxDelinquentConnector(),
  // 'lehigh-code-violations': () => new LehighCodeViolationsConnector(),
};

export function getConnector(slug: string): DataSourceConnector | null {
  const factory = connectors[slug];
  return factory ? factory() : null;
}

export function getAllConnectorSlugs(): string[] {
  return Object.keys(connectors);
}

export function getConnectorInfo(): Array<{
  slug: string;
  name: string;
  type: string;
  description: string;
  regionSlug: string;
}> {
  return Object.entries(connectors).map(([slug, factory]) => {
    const c = factory();
    return {
      slug: c.slug,
      name: c.name,
      type: c.type,
      description: c.description,
      regionSlug: c.regionSlug,
    };
  });
}
