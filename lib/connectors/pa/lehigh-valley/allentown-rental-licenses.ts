import { LookupConnector, RentalLicenseLookupResult } from '../../lookup-types';

// ============================================================
// ALLENTOWN RENTAL LICENSES CONNECTOR
// Source: City of Allentown EnerGov Rental Licenses (ArcGIS FeatureServer)
// URL: https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/EnerGov_Rental_Licenses_Current/FeatureServer/0
// Data: Active rental licenses with address, license number, expiration
// Supported zips: 18101, 18102, 18103, 18104, 18109
// ============================================================

const FEATURE_SERVER_URL =
  'https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/EnerGov_Rental_Licenses_Current/FeatureServer/0/query';

interface RentalLicenseFeature {
  attributes: {
    OBJECTID: number;
    LICENSENUMBER: string;
    LICENSETYPE: string;
    STATUSNAME: string;
    ISSUEDDATE: number | null;
    EXPIRATIONDATE: number | null;
    NUMBEROFUNITS: number | null;
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
}

interface ArcGISResponse {
  features: RentalLicenseFeature[];
  exceededTransferLimit?: boolean;
}

export class AllentownRentalLicensesConnector implements LookupConnector {
  name = 'Allentown Rental Licenses';
  slug = 'allentown-rental-licenses';
  type = 'rental_license' as const;
  regionSlug = 'lehigh-valley';
  description = 'Active rental licenses from the City of Allentown EnerGov system via ArcGIS FeatureServer';
  supportedZipCodes = ['18101', '18102', '18103', '18104', '18109'];

  async lookupByAddress(address: string, zipCode: string): Promise<RentalLicenseLookupResult> {
    // Parse the address into street number and street name for ArcGIS query
    const parsed = this.parseAddress(address);
    if (!parsed) {
      return { found: false, rawData: { error: 'Could not parse address', address } };
    }

    // Build WHERE clause: match street number and street name, filter by zip
    // Use LIKE for street name to handle abbreviation differences (ST vs STREET, etc.)
    const zipFilter = zipCode.length > 5 ? zipCode.substring(0, 5) : zipCode;
    const where = `ADDRESSLINE1 = '${parsed.streetNumber}' AND UPPER(ADDRESSLINE2) LIKE '%${parsed.streetName.toUpperCase()}%' AND POSTALCODE LIKE '${zipFilter}%'`;

    const params = new URLSearchParams({
      where,
      outFields: '*',
      resultRecordCount: '10',
      f: 'json',
    });

    const url = `${FEATURE_SERVER_URL}?${params.toString()}`;
    console.log(`[Allentown Rental] Looking up: ${address} (zip: ${zipCode})`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: ArcGISResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      console.log(`[Allentown Rental] No match found for: ${address}`);
      return { found: false, rawData: { query: where, address } };
    }

    // Pick the best match: prefer active status, then latest expiration
    const bestMatch = this.selectBestMatch(data.features);
    const attrs = bestMatch.attributes;

    console.log(`[Allentown Rental] Found license ${attrs.LICENSENUMBER} for: ${address}`);

    return {
      found: true,
      licenseNumber: attrs.LICENSENUMBER,
      expirationDate: attrs.EXPIRATIONDATE ? new Date(attrs.EXPIRATIONDATE) : undefined,
      issuedDate: attrs.ISSUEDDATE ? new Date(attrs.ISSUEDDATE) : undefined,
      status: attrs.STATUSNAME,
      numberOfUnits: attrs.NUMBEROFUNITS ?? undefined,
      parcelNumber: attrs.PARCELNUMBER ?? undefined,
      rawData: {
        ...attrs,
        matchCount: data.features.length,
      },
    };
  }

  private parseAddress(address: string): { streetNumber: string; streetName: string } | null {
    // Address format: "123 N Main St" or "456 Elm Ave Apt 2"
    const trimmed = address.trim();
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) return null;

    const streetNumber = match[1];
    let streetName = match[2];

    // Remove unit/apt suffixes for matching
    streetName = streetName
      .replace(/\s+(apt|unit|ste|suite|#)\s*\S*$/i, '')
      .trim();

    // Extract just the core street name (remove direction prefix and street type suffix)
    // "N Main St" → "Main", "Elm Ave" → "Elm"
    const streetParts = streetName.split(/\s+/);

    // Remove leading direction (N, S, E, W, NE, NW, SE, SW)
    const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST'];
    if (streetParts.length > 1 && directions.includes(streetParts[0].toUpperCase())) {
      streetParts.shift();
    }

    // Remove trailing street type (St, Ave, Rd, Dr, etc.)
    const streetTypes = ['ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'DR', 'DRIVE', 'CT', 'COURT',
      'LN', 'LANE', 'BLVD', 'BOULEVARD', 'CIR', 'CIRCLE', 'PL', 'PLACE', 'WAY', 'TER', 'TERRACE'];
    if (streetParts.length > 1 && streetTypes.includes(streetParts[streetParts.length - 1].toUpperCase())) {
      streetParts.pop();
    }

    // Also remove trailing direction (postdirection)
    if (streetParts.length > 1 && directions.includes(streetParts[streetParts.length - 1].toUpperCase())) {
      streetParts.pop();
    }

    const coreStreetName = streetParts.join(' ');
    if (!coreStreetName) return null;

    return { streetNumber, streetName: coreStreetName };
  }

  private selectBestMatch(features: RentalLicenseFeature[]): RentalLicenseFeature {
    // Prefer active licenses, then latest expiration date
    const sorted = [...features].sort((a, b) => {
      // Active status first
      const aActive = a.attributes.STATUSNAME?.toLowerCase().includes('active') ? 1 : 0;
      const bActive = b.attributes.STATUSNAME?.toLowerCase().includes('active') ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      // Then latest expiration
      const aExp = a.attributes.EXPIRATIONDATE ?? 0;
      const bExp = b.attributes.EXPIRATIONDATE ?? 0;
      return bExp - aExp;
    });

    return sorted[0];
  }
}
