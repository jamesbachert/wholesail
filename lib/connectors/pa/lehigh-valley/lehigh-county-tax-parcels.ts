import { LookupConnector, ParcelAssessmentLookupResult } from '../../lookup-types';

// ============================================================
// LEHIGH COUNTY TAX PARCELS CONNECTOR
// Source: Lehigh County Owner/Assessment Data (ArcGIS Online)
// URL: https://services1.arcgis.com/XWDNR4PQlDQwrRCL/arcgis/rest/services/ATestParcel/FeatureServer/0
// Data: County-wide parcel data with sale history, deed info, owner info, assessments
// Updates: Faster than the City of Allentown dataset (~4-5 month lag vs ~12 months)
// Coverage: All of Lehigh County (134,949 parcels)
// ============================================================

const FEATURE_SERVER_URL =
  'https://services1.arcgis.com/XWDNR4PQlDQwrRCL/arcgis/rest/services/ATestParcel/FeatureServer/0/query';

const OUT_FIELDS = [
  'ADDRESS', 'PIN',
  'SYEAR', 'SMON', 'SPRICE',
  'INSTNUM',
  'NAMOWN', 'AD1OWN', 'AD2OWN', 'RDOWN', 'ZIPOWN',
  'TOTASMT', 'TAXASMT',
  'CLASS', 'USELAND',
].join(',');

interface CountyParcelFeature {
  attributes: {
    ADDRESS: string;
    PIN: string | null;
    SYEAR: number | null;
    SMON: string | null;
    SPRICE: number | null;
    INSTNUM: string | null;
    NAMOWN: string | null;
    AD1OWN: string | null;
    AD2OWN: string | null;
    RDOWN: string | null;
    ZIPOWN: string | null;
    TOTASMT: number | null;
    TAXASMT: number | null;
    CLASS: string | null;
    USELAND: string | null;
  };
}

interface ArcGISResponse {
  features: CountyParcelFeature[];
  exceededTransferLimit?: boolean;
}

// Complete Lehigh County zip codes
const LEHIGH_COUNTY_ZIPS = [
  '18011', '18015', '18017', '18018', '18031', '18032', '18034', '18036',
  '18037', '18041', '18046', '18049', '18051', '18052', '18053', '18058',
  '18059', '18062', '18065', '18066', '18069', '18078', '18079', '18080',
  '18087', '18092',
  '18101', '18102', '18103', '18104', '18106', '18109',
];

export class LehighCountyTaxParcelsConnector implements LookupConnector {
  name = 'Lehigh County Tax Parcels';
  slug = 'lehigh-county-tax-parcels';
  type = 'parcel_assessment' as const;
  regionSlug = 'lehigh-valley';
  description = 'County-wide parcel data with sale history, deed info, and assessments from Lehigh County ArcGIS';
  supportedZipCodes = LEHIGH_COUNTY_ZIPS;

  async lookupByAddress(address: string, zipCode: string): Promise<ParcelAssessmentLookupResult> {
    const parsed = this.parseAddress(address);
    if (!parsed) {
      return { found: false, rawData: { error: 'Could not parse address', address } };
    }

    // ADDRESS contains the full site address, e.g. "326 N FOUNTAIN ST"
    // Match on street number + core street name using LIKE
    const where = `ADDRESS LIKE '${parsed.streetNumber} %${parsed.streetName.toUpperCase()}%'`;

    const params = new URLSearchParams({
      where,
      outFields: OUT_FIELDS,
      resultRecordCount: '10',
      returnGeometry: 'false',
      f: 'json',
    });

    const url = `${FEATURE_SERVER_URL}?${params.toString()}`;
    console.log(`[Lehigh County Tax Parcels] Looking up: ${address} (zip: ${zipCode})`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: ArcGISResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      console.log(`[Lehigh County Tax Parcels] No match found for: ${address}`);
      return { found: false, rawData: { query: where, address } };
    }

    // Pick the best match — prefer exact address match, then highest assessment
    const bestMatch = this.selectBestMatch(data.features, address);
    const attrs = bestMatch.attributes;

    console.log(`[Lehigh County Tax Parcels] Found parcel for: ${address} (owner: ${attrs.NAMOWN}, sale: ${attrs.SMON}/${attrs.SYEAR})`);

    // Build sale date from SYEAR + SMON
    let lastSaleDate: string | undefined;
    if (attrs.SYEAR && attrs.SYEAR > 0) {
      const month = attrs.SMON ? String(attrs.SMON).padStart(2, '0') : '01';
      lastSaleDate = `${attrs.SYEAR}-${month}-01`;
    }

    // Determine absentee owner by comparing address vs owner mailing address
    const ownerMailingAddress = attrs.AD1OWN?.trim() || undefined;
    const isAbsenteeOwner = this.checkAbsenteeOwner(address, ownerMailingAddress);

    // Parse owner mailing city/state from AD2OWN
    const mailingParts = this.parseMailingCityState(attrs.AD2OWN || '');

    return {
      found: true,
      ownerName: attrs.NAMOWN?.trim() || undefined,
      ownerMailingAddress,
      ownerMailingFull: [attrs.AD1OWN, attrs.RDOWN, attrs.AD2OWN].filter((s) => s && s.trim()).join(', '),
      ownerCity: mailingParts.city,
      ownerState: mailingParts.state,
      ownerZip: attrs.ZIPOWN?.trim() || undefined,
      siteAddress: attrs.ADDRESS?.trim() || undefined,
      assessedValue: attrs.TOTASMT ?? undefined,
      lastSaleDate,
      lastSalePrice: attrs.SPRICE && attrs.SPRICE > 0 ? attrs.SPRICE : undefined,
      // County uses INSTNUM (instrument number) instead of separate book/page
      deedBook: attrs.INSTNUM?.trim() || undefined,
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
    // AD2OWN is typically "ALLENTOWN PA" or "MACUNGIE PA"
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

  private checkAbsenteeOwner(siteAddress: string, ownerMailingAddress?: string): boolean {
    if (!ownerMailingAddress) return false;

    // Normalize both addresses for comparison
    const normalize = (addr: string) =>
      addr.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const siteNorm = normalize(siteAddress);
    const ownerNorm = normalize(ownerMailingAddress);

    // If owner mailing address is completely different from site address
    return !ownerNorm.includes(siteNorm.substring(0, 8)) && !siteNorm.includes(ownerNorm.substring(0, 8));
  }

  private selectBestMatch(features: CountyParcelFeature[], targetAddress: string): CountyParcelFeature {
    const normalizedTarget = targetAddress.toUpperCase().replace(/\s+/g, ' ').trim();

    const sorted = [...features].sort((a, b) => {
      // Prefer exact address match
      const aAddr = (a.attributes.ADDRESS || '').trim();
      const bAddr = (b.attributes.ADDRESS || '').trim();
      const aExact = aAddr === normalizedTarget ? 1 : 0;
      const bExact = bAddr === normalizedTarget ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      // Then highest assessment (most likely to be the correct/active record)
      const aVal = a.attributes.TOTASMT ?? 0;
      const bVal = b.attributes.TOTASMT ?? 0;
      return bVal - aVal;
    });

    return sorted[0];
  }
}
