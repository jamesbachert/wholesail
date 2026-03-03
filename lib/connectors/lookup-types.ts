// ============================================================
// LOOKUP CONNECTOR INTERFACE
// Lookup connectors enrich existing leads by cross-referencing
// external databases (e.g. rental license registries, code violations).
// Unlike import connectors, they don't create new leads.
// ============================================================

export type LookupConnectorType = 'rental_license' | 'code_violation';

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

export interface CodeViolationLookupResult {
  found: boolean;
  cases: Array<{
    caseNumber: string;
    status: string;
    openedDate?: string;
    parcelNumber?: string;
  }>;
  rawData: Record<string, any>;
}

export type LookupResult = RentalLicenseLookupResult | CodeViolationLookupResult;

export interface LookupConnector {
  name: string;
  slug: string;
  type: LookupConnectorType;
  regionSlug: string;
  description: string;
  supportedZipCodes: string[];

  lookupByAddress(address: string, zipCode: string): Promise<LookupResult>;
}
