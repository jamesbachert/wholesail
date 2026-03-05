import { LookupConnector, ParcelAssessmentLookupResult } from '../../lookup-types';

// ============================================================
// ALLENTOWN TAX PARCELS CONNECTOR
// Source: City of Allentown Tax Parcels (ArcGIS FeatureServer)
// URL: https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/CityTaxParcelsFEMASFHA/FeatureServer/0
// Data: Tax parcel data with sale history, deed info, owner info, assessments
// Supported zips: 18101, 18102, 18103, 18104, 18105, 18106, 18107, 18108, 18109
// ============================================================

const FEATURE_SERVER_URL =
  'https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/CityTaxParcelsFEMASFHA/FeatureServer/0/query';

const OUT_FIELDS = [
  'PROPERTYADDR', 'ZIP',
  'SYEAR', 'SMON', 'SPRICE',
  'BOOK', 'PAGE', 'XINSTNUM',
  'NAMOWN', 'AD1OWN', 'AD2OWN', 'RDOWN', 'ZIPOWN',
  'TOTASMT', 'TAXASMT', 'TAXLND', 'TAXBLD',
  'CLASS', 'LNDUSE',
].join(',');

interface TaxParcelFeature {
  attributes: {
    PROPERTYADDR: string;
    ZIP: string;
    SYEAR: number | null;
    SMON: string | null;
    SPRICE: number | null;
    BOOK: string | null;
    PAGE: string | null;
    XINSTNUM: string | null;
    NAMOWN: string | null;
    AD1OWN: string | null;
    AD2OWN: string | null;
    RDOWN: string | null;
    ZIPOWN: string | null;
    TOTASMT: number | null;
    TAXASMT: number | null;
    TAXLND: number | null;
    TAXBLD: number | null;
    CLASS: string | null;
    LNDUSE: string | null;
  };
}

interface ArcGISResponse {
  features: TaxParcelFeature[];
  exceededTransferLimit?: boolean;
}

export class AllentownTaxParcelsConnector implements LookupConnector {
  name = 'Allentown Tax Parcels';
  slug = 'allentown-tax-parcels';
  type = 'parcel_assessment' as const;
  regionSlug = 'lehigh-valley';
  description = 'Tax parcel data with sale history, deed info, and assessments from City of Allentown ArcGIS';
  supportedZipCodes = ['18101', '18102', '18103', '18104', '18105', '18106', '18107', '18108', '18109'];

  async lookupByAddress(address: string, zipCode: string): Promise<ParcelAssessmentLookupResult> {
    const parsed = this.parseAddress(address);
    if (!parsed) {
      return { found: false, rawData: { error: 'Could not parse address', address } };
    }

    // PROPERTYADDR contains the full site address, e.g. "123 N MAIN ST"
    // Match on street number + core street name using LIKE
    const where = `PROPERTYADDR LIKE '${parsed.streetNumber} %${parsed.streetName.toUpperCase()}%'`;

    const params = new URLSearchParams({
      where,
      outFields: OUT_FIELDS,
      resultRecordCount: '10',
      f: 'json',
    });

    const url = `${FEATURE_SERVER_URL}?${params.toString()}`;
    console.log(`[Allentown Tax Parcels] Looking up: ${address} (zip: ${zipCode})`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: ArcGISResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      console.log(`[Allentown Tax Parcels] No match found for: ${address}`);
      return { found: false, rawData: { query: where, address } };
    }

    // Pick the best match: prefer matching zip code, then highest assessment
    const bestMatch = this.selectBestMatch(data.features, zipCode);
    const attrs = bestMatch.attributes;

    console.log(`[Allentown Tax Parcels] Found parcel for: ${address} (owner: ${attrs.NAMOWN})`);

    // Build sale date from SYEAR + SMON
    let lastSaleDate: string | undefined;
    if (attrs.SYEAR && attrs.SYEAR > 0) {
      const month = attrs.SMON ? String(attrs.SMON).padStart(2, '0') : '01';
      lastSaleDate = `${attrs.SYEAR}-${month}-01`;
    }

    // Determine absentee owner by comparing site zip vs owner zip
    const siteZip = (attrs.ZIP || zipCode).substring(0, 5);
    const ownerZip = attrs.ZIPOWN ? attrs.ZIPOWN.trim().substring(0, 5) : '';
    const isAbsenteeOwner = ownerZip.length > 0 && ownerZip !== siteZip;

    // Parse owner mailing address from AD1OWN + AD2OWN
    const ownerMailingAddress = attrs.AD1OWN?.trim() || undefined;
    // AD2OWN typically contains "CITY STATE ZIP" format
    const mailingParts = this.parseMailingCityState(attrs.AD2OWN || '');

    return {
      found: true,
      ownerName: attrs.NAMOWN?.trim() || undefined,
      ownerMailingAddress,
      ownerMailingFull: [attrs.AD1OWN, attrs.AD2OWN].filter(Boolean).join(', '),
      ownerCity: mailingParts.city,
      ownerState: mailingParts.state,
      ownerZip: attrs.ZIPOWN?.trim() || undefined,
      siteAddress: attrs.PROPERTYADDR?.trim() || undefined,
      assessedValue: attrs.TOTASMT ?? undefined,
      lastSaleDate,
      lastSalePrice: attrs.SPRICE && attrs.SPRICE > 0 ? attrs.SPRICE : undefined,
      deedBook: attrs.BOOK?.trim() || undefined,
      deedPage: attrs.PAGE?.trim() || undefined,
      isAbsenteeOwner,
      rawData: {
        ...attrs,
        matchCount: data.features.length,
      },
    };
  }

  private parseAddress(address: string): { streetNumber: string; streetName: string } | null {
    const trimmed = address.trim();
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) return null;

    const streetNumber = match[1];
    let streetName = match[2];

    // Remove unit/apt suffixes
    streetName = streetName
      .replace(/\s+(apt|unit|ste|suite|#)\s*\S*$/i, '')
      .trim();

    const streetParts = streetName.split(/\s+/);

    // Remove leading direction
    const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST'];
    if (streetParts.length > 1 && directions.includes(streetParts[0].toUpperCase())) {
      streetParts.shift();
    }

    // Remove trailing street type
    const streetTypes = ['ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'DR', 'DRIVE', 'CT', 'COURT',
      'LN', 'LANE', 'BLVD', 'BOULEVARD', 'CIR', 'CIRCLE', 'PL', 'PLACE', 'WAY', 'TER', 'TERRACE'];
    if (streetParts.length > 1 && streetTypes.includes(streetParts[streetParts.length - 1].toUpperCase())) {
      streetParts.pop();
    }

    // Remove trailing direction (postdirection)
    if (streetParts.length > 1 && directions.includes(streetParts[streetParts.length - 1].toUpperCase())) {
      streetParts.pop();
    }

    const coreStreetName = streetParts.join(' ');
    if (!coreStreetName) return null;

    return { streetNumber, streetName: coreStreetName };
  }

  private parseMailingCityState(ad2own: string): { city?: string; state?: string } {
    // AD2OWN is typically "ALLENTOWN PA" or "SOME CITY STATE"
    const trimmed = ad2own.trim();
    if (!trimmed) return {};

    // Try to extract state as the last 2-char word
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 2 && /^[A-Z]{2}$/i.test(lastPart)) {
        return {
          city: parts.slice(0, -1).join(' '),
          state: lastPart.toUpperCase(),
        };
      }
    }

    return { city: trimmed };
  }

  private selectBestMatch(features: TaxParcelFeature[], targetZip: string): TaxParcelFeature {
    const sorted = [...features].sort((a, b) => {
      // Prefer matching zip code
      const aZipMatch = (a.attributes.ZIP || '').startsWith(targetZip.substring(0, 5)) ? 1 : 0;
      const bZipMatch = (b.attributes.ZIP || '').startsWith(targetZip.substring(0, 5)) ? 1 : 0;
      if (aZipMatch !== bZipMatch) return bZipMatch - aZipMatch;

      // Then highest assessment (most likely to be the correct/active record)
      const aVal = a.attributes.TOTASMT ?? 0;
      const bVal = b.attributes.TOTASMT ?? 0;
      return bVal - aVal;
    });

    return sorted[0];
  }
}
