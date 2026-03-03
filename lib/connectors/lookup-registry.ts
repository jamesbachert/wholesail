import { LookupConnector } from './lookup-types';
import { AllentownRentalLicensesConnector } from './pa/lehigh-valley/allentown-rental-licenses';

// ============================================================
// LOOKUP CONNECTOR REGISTRY
// Routes lookup requests to the correct connector by zip code.
// ============================================================

const lookupConnectors: LookupConnector[] = [
  new AllentownRentalLicensesConnector(),
];

const lookupConnectorMap = new Map<string, LookupConnector>(
  lookupConnectors.map((c) => [c.slug, c])
);

// Build a map of zip code → connector for fast routing
const zipToConnector = new Map<string, LookupConnector>();
for (const connector of lookupConnectors) {
  for (const zip of connector.supportedZipCodes) {
    zipToConnector.set(zip, connector);
  }
}

export function getLookupConnectorForZip(
  zipCode: string,
  type: 'rental_license'
): LookupConnector | undefined {
  const connector = zipToConnector.get(zipCode);
  if (connector && connector.type === type) {
    return connector;
  }
  return undefined;
}

export function getRentalLicenseSupportedZipCodes(): string[] {
  const zips = new Set<string>();
  for (const connector of lookupConnectors) {
    if (connector.type === 'rental_license') {
      for (const zip of connector.supportedZipCodes) {
        zips.add(zip);
      }
    }
  }
  return Array.from(zips).sort();
}

export function getLookupConnector(slug: string): LookupConnector | undefined {
  return lookupConnectorMap.get(slug);
}
