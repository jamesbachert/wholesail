import { LookupConnector, LookupConnectorType } from './lookup-types';
import { AllentownRentalLicensesConnector } from './pa/lehigh-valley/allentown-rental-licenses';
import { AllentownCodeViolationsConnector } from './pa/lehigh-valley/allentown-code-violations';

// ============================================================
// LOOKUP CONNECTOR REGISTRY
// Routes lookup requests to the correct connector by zip code.
// Supports multiple connectors per zip (e.g. rental + code violations).
// ============================================================

const lookupConnectors: LookupConnector[] = [
  new AllentownRentalLicensesConnector(),
  new AllentownCodeViolationsConnector(),
];

const lookupConnectorMap = new Map<string, LookupConnector>(
  lookupConnectors.map((c) => [c.slug, c])
);

// Build a map of zip code → connectors (multiple per zip)
const zipToConnectors = new Map<string, LookupConnector[]>();
for (const connector of lookupConnectors) {
  for (const zip of connector.supportedZipCodes) {
    const existing = zipToConnectors.get(zip) || [];
    existing.push(connector);
    zipToConnectors.set(zip, existing);
  }
}

export function getLookupConnectorForZip(
  zipCode: string,
  type: LookupConnectorType
): LookupConnector | undefined {
  const connectors = zipToConnectors.get(zipCode);
  if (!connectors) return undefined;
  return connectors.find((c) => c.type === type);
}

export function getLookupConnectorsForZip(zipCode: string): LookupConnector[] {
  return zipToConnectors.get(zipCode) || [];
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
