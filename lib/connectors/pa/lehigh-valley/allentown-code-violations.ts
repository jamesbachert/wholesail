import { DataSourceConnector, ParsedRecord } from '../../types';

// ============================================================
// ALLENTOWN CODE VIOLATIONS CONNECTOR
// Source: City of Allentown EnerGov Code Cases (ArcGIS FeatureServer)
// URL: https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/EnerGov_Code_Cases_Current/FeatureServer/0
// Data: Open code enforcement cases with address, case number, dates
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

export class AllentownCodeViolationsConnector implements DataSourceConnector {
  name = 'Allentown Code Violations';
  slug = 'allentown-code-violations';
  type = 'automated' as const;
  regionSlug = 'lehigh-valley';
  description = 'Active code enforcement cases from the City of Allentown EnerGov system via ArcGIS FeatureServer';

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
