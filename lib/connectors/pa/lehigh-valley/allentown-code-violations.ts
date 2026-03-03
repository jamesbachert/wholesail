import { DataSourceConnector, ParsedRecord } from '../../types';
import { LookupConnector, CodeViolationLookupResult } from '../../lookup-types';

// ============================================================
// ALLENTOWN CODE VIOLATIONS CONNECTOR
// Source: City of Allentown EnerGov Code Cases (ArcGIS FeatureServer)
// URL: https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/EnerGov_Code_Cases_Current/FeatureServer/0
// Data: Open code enforcement cases with address, case number, dates
//
// Dual-purpose:
//   1. DataSourceConnector (fetchAndParse) — bulk import for sync
//   2. LookupConnector (lookupByAddress) — live enrichment for individual leads
// ============================================================

const FEATURE_SERVER_URL =
  'https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/EnerGov_Code_Cases_Current/FeatureServer/0/query';

const PAGE_SIZE = 1000; // ArcGIS max record count

interface ArcGISFeature {
  attributes: {
    OBJECTID: number;
    CASENUMBER: string;
    OPENEDDATE: number | null;
    CLOSEDDATE: number | null;
    STATUSNAME: string;
    ADDRESSLINE1: string; // street number
    PREDIRECTION: string | null;
    ADDRESSLINE2: string; // street name
    STREETTYPE: string | null;
    POSTDIRECTION: string | null;
    UNITORSUITE: string | null;
    CITY: string;
    STATE: string;
    POSTALCODE: string;
    PARCELNUMBER: string | null;
  };
  geometry: {
    x: number;
    y: number;
  } | null;
}

interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

// Allentown zip codes for lookup support
const ALLENTOWN_ZIPS = ['18101', '18102', '18103', '18104', '18109'];

export class AllentownCodeViolationsConnector implements DataSourceConnector, LookupConnector {
  name = 'Allentown Code Violations';
  slug = 'allentown-code-violations';
  type = 'code_violation' as const;
  regionSlug = 'lehigh-valley';
  description = 'Active code enforcement cases from the City of Allentown EnerGov system via ArcGIS FeatureServer';
  supportedZipCodes = ALLENTOWN_ZIPS;

  // ============================================================
  // BULK FETCH (DataSourceConnector)
  // ============================================================

  async fetchAndParse(): Promise<ParsedRecord[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    let hasMore = true;

    // Paginate through all open cases
    while (hasMore) {
      const params = new URLSearchParams({
        where: "CLOSEDDATE IS NULL", // Only open/active cases
        outFields: '*',
        resultOffset: String(offset),
        resultRecordCount: String(PAGE_SIZE),
        orderByFields: 'OPENEDDATE DESC',
        f: 'json',
      });

      const url = `${FEATURE_SERVER_URL}?${params.toString()}`;
      console.log(`[Allentown Code Violations] Fetching page at offset ${offset}...`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `ArcGIS API returned ${response.status}: ${response.statusText}`
        );
      }

      const data: ArcGISResponse = await response.json();

      if (!data.features || data.features.length === 0) {
        hasMore = false;
        break;
      }

      allFeatures.push(...data.features);
      console.log(
        `[Allentown Code Violations] Got ${data.features.length} records (total: ${allFeatures.length})`
      );

      // ArcGIS signals more data with exceededTransferLimit
      if (data.exceededTransferLimit && data.features.length === PAGE_SIZE) {
        offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(
      `[Allentown Code Violations] Total open cases fetched: ${allFeatures.length}`
    );

    // Parse into WholeSail records
    const records: ParsedRecord[] = [];

    for (const feature of allFeatures) {
      try {
        const record = this.parseFeature(feature);
        if (record) records.push(record);
      } catch (err: any) {
        console.error(
          `[Allentown Code Violations] Parse error for case ${feature.attributes.CASENUMBER}:`,
          err.message
        );
      }
    }

    console.log(
      `[Allentown Code Violations] Parsed ${records.length} valid records from ${allFeatures.length} features`
    );

    return records;
  }

  // ============================================================
  // LIVE LOOKUP (LookupConnector)
  // Query ArcGIS for open code cases at a specific address.
  // ============================================================

  async lookupByAddress(address: string, zipCode: string): Promise<CodeViolationLookupResult> {
    // Parse the address into components for ArcGIS query
    // Input format: "909 N 17th St" → ADDRESSLINE1=909, search for rest
    const upperAddr = address.toUpperCase().trim();

    // Build a LIKE-based WHERE clause for flexibility
    // ArcGIS concatenates: ADDRESSLINE1 + PREDIRECTION + ADDRESSLINE2 + STREETTYPE + POSTDIRECTION
    // We'll search for a match on the full constructed address
    const escapedAddr = upperAddr.replace(/'/g, "''");

    const whereClause = `CLOSEDDATE IS NULL AND POSTALCODE = '${zipCode}' AND UPPER(CONCAT(ADDRESSLINE1, ' ', COALESCE(PREDIRECTION, ''), ' ', ADDRESSLINE2, ' ', COALESCE(STREETTYPE, ''), ' ', COALESCE(POSTDIRECTION, ''))) LIKE '%${escapedAddr}%'`;

    const params = new URLSearchParams({
      where: whereClause,
      outFields: 'CASENUMBER,OPENEDDATE,CLOSEDDATE,STATUSNAME,ADDRESSLINE1,PREDIRECTION,ADDRESSLINE2,STREETTYPE,POSTDIRECTION,PARCELNUMBER,POSTALCODE',
      resultRecordCount: '50',
      orderByFields: 'OPENEDDATE DESC',
      f: 'json',
    });

    const url = `${FEATURE_SERVER_URL}?${params.toString()}`;
    console.log(`[Code Violation Lookup] Querying for "${address}" in ${zipCode}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: ArcGISResponse = await response.json();
    const features = data.features || [];

    console.log(`[Code Violation Lookup] Found ${features.length} open cases for "${address}"`);

    if (features.length === 0) {
      return { found: false, cases: [], rawData: {} };
    }

    const cases = features.map((f) => ({
      caseNumber: f.attributes.CASENUMBER,
      status: f.attributes.STATUSNAME,
      openedDate: f.attributes.OPENEDDATE
        ? new Date(f.attributes.OPENEDDATE).toISOString().split('T')[0]
        : undefined,
      parcelNumber: f.attributes.PARCELNUMBER || undefined,
    }));

    return {
      found: true,
      cases,
      rawData: { features: features.map((f) => f.attributes) },
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private parseFeature(feature: ArcGISFeature): ParsedRecord | null {
    const attrs = feature.attributes;

    // Skip if missing critical address data
    if (!attrs.ADDRESSLINE1 || !attrs.ADDRESSLINE2) {
      return null;
    }

    // Skip closed cases (shouldn't happen with our query, but safety check)
    if (attrs.CLOSEDDATE) {
      return null;
    }

    // Reconstruct full address: "909 N 17TH ST"
    const addressParts = [
      attrs.ADDRESSLINE1.trim(),
      attrs.PREDIRECTION?.trim(),
      attrs.ADDRESSLINE2.trim(),
      attrs.STREETTYPE?.trim(),
      attrs.POSTDIRECTION?.trim(),
    ].filter(Boolean);

    const fullAddress = addressParts.join(' ')
      .split(' ')
      .map((w) => {
        if (w.match(/^\d/)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    // Parse opened date from epoch milliseconds
    const openedDate = attrs.OPENEDDATE
      ? new Date(attrs.OPENEDDATE).toISOString().split('T')[0]
      : undefined;

    // Build value string with case details
    const valueDetails = [
      `Case: ${attrs.CASENUMBER}`,
      attrs.STATUSNAME ? `Status: ${attrs.STATUSNAME}` : null,
      attrs.PARCELNUMBER ? `Parcel: ${attrs.PARCELNUMBER}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    // Unit/suite info for property details
    const unit = attrs.UNITORSUITE?.trim() || undefined;

    return {
      address: unit ? `${fullAddress} ${unit}` : fullAddress,
      city: (attrs.CITY || 'Allentown')
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' '),
      state: attrs.STATE || 'PA',
      zipCode: attrs.POSTALCODE || '',
      county: 'Lehigh',
      ownerName: undefined, // Code violations don't include owner info
      saleDate: openedDate, // Used for eventDate on the signal
      signals: [
        {
          signalType: 'code_violation',
          label: 'Code Violation',
          category: 'distress',
          points: 22,
          value: valueDetails,
          source: 'Allentown Code Enforcement',
        },
      ],
      rawData: {
        caseNumber: attrs.CASENUMBER,
        openedDate: attrs.OPENEDDATE,
        closedDate: attrs.CLOSEDDATE,
        status: attrs.STATUSNAME,
        parcelNumber: attrs.PARCELNUMBER,
        fullAddress,
        unit: attrs.UNITORSUITE,
        geometry: feature.geometry,
      },
    };
  }
}
