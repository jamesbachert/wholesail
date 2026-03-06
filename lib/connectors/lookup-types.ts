// ============================================================
// LOOKUP CONNECTOR INTERFACE
// Lookup connectors enrich existing leads by cross-referencing
// external databases (e.g. rental license registries, code violations).
// Unlike import connectors, they don't create new leads.
// ============================================================

export type LookupConnectorType = 'rental_license' | 'code_violation' | 'parcel_assessment' | 'cama_data' | 'tax_delinquent';

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

export interface ParcelAssessmentLookupResult {
  found: boolean;
  parcelId?: string;
  ownerName?: string;
  ownerMailingAddress?: string;  // Street portion only (parsed)
  ownerMailingFull?: string;     // Full mailing string (unparsed, for reference)
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
  siteAddress?: string;
  municipality?: string;
  landUseCode?: string;
  landUseDescription?: string;
  propertyType?: string;         // Mapped human-readable type (e.g. "Single Family")
  propertyClass?: string;
  propertyDescription?: string;  // e.g. "2 STORY BRICK/MASONRY"
  assessedValue?: number;
  assessedLandValue?: number;
  assessedBuildingValue?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  deedBook?: string;
  deedPage?: string;
  acreage?: number;
  isAbsenteeOwner?: boolean;
  isHomestead?: boolean;
  rawData: Record<string, any>;
}

export interface CamaDataLookupResult {
  found: boolean;
  parcelId?: string;
  ownerName?: string;
  coOwner?: string;
  instrumentNumber?: string;
  taxAccount?: string;
  className?: string;
  cleanAndGreenDate?: string;
  rawData: Record<string, any>;
}

export interface TaxDelinquentLookupResult {
  found: boolean;
  parcelNumber?: string;
  ownerName?: string;
  propertyAddress?: string;
  district?: string;
  assessedValue?: number;
  totalDelinquent?: number;
  delinquentYears?: Array<{
    year: number;
    balance: number;
  }>;
  rawData: Record<string, any>;
}

export type LookupResult = RentalLicenseLookupResult | CodeViolationLookupResult | ParcelAssessmentLookupResult | CamaDataLookupResult | TaxDelinquentLookupResult;

export interface LookupConnector {
  name: string;
  slug: string;
  type: LookupConnectorType;
  regionSlug: string;
  description: string;
  supportedZipCodes: string[];

  lookupByAddress(address: string, zipCode: string): Promise<LookupResult>;
}
