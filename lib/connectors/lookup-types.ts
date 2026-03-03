// ============================================================
// LOOKUP CONNECTOR INTERFACE
// Lookup connectors enrich existing leads by cross-referencing
// external databases (e.g. rental license registries).
// Unlike import connectors, they don't create new leads.
// ============================================================

export interface RentalLicenseLookupResult {
  found: boolean;
  licenseNumber?: string;
  expirationDate?: Date;
  issuedDate?: Date;
  status?: string;
  numberOfUnits?: number;
  parcelNumber?: string;
  rawData: Record<string, any>;
}

export interface LookupConnector {
  name: string;
  slug: string;
  type: 'rental_license';
  regionSlug: string;
  description: string;
  supportedZipCodes: string[];

  lookupByAddress(address: string, zipCode: string): Promise<RentalLicenseLookupResult>;
}
