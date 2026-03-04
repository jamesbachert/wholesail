import { DataSourceConnector, ParsedRecord } from '../../types';
import { LookupConnector, ParcelAssessmentLookupResult } from '../../lookup-types';
import { normalizeAddress } from '../../address-utils';

// ============================================================
// BERKS COUNTY PARCEL ASSESSMENT CONNECTOR
// Source: Berks County GIS — Parcel Search Table (ArcGIS MapServer Layer 0)
// URL: https://gis.co.berks.pa.us/arcgis/rest/services/Assess/ParcelSearchTable/MapServer/0
// Data: All Berks County parcels with owner, address, assessed values, deed info
//
// Dual-purpose:
//   1. DataSourceConnector (fetchAndParse) — discovers absentee-owned residential parcels
//   2. LookupConnector (lookupByAddress) — enrichment for individual leads
//
// Discovery only emits parcels that have at least one signal (absentee owner).
// The full dataset remains available via lookupByAddress for enrichment.
// ============================================================

const ARCGIS_URL =
  'https://gis.co.berks.pa.us/arcgis/rest/services/Assess/ParcelSearchTable/MapServer/0/query';

const PAGE_SIZE = 1000; // ArcGIS server max record count

// Target municipalities for discovery feed
const TARGET_MUNICIPALITIES = [
  'READING',
  'WYOMISSING',
  'WEST READING',
  'MUHLENBERG',
  'SPRING',
  'SINKING SPRING',
  'SHILLINGTON',
  'KENHORST',
  'MOHNTON',
  'EXETER',
  'CUMRU',
  'BERN',
  'LOWER ALSACE',
  'ST LAWRENCE',
];

// Municipality → primary zip code mapping
// The Berks ArcGIS SITEADDRESS_ZIP field is null for all records,
// so we derive zip from municipality name instead.
const MUNICIPALITY_ZIP: Record<string, string> = {
  'READING':        '19601',
  'WYOMISSING':     '19610',
  'WEST READING':   '19611',
  'MUHLENBERG':     '19605',
  'SPRING':         '19608',
  'SINKING SPRING': '19608',
  'SHILLINGTON':    '19607',
  'KENHORST':       '19607',
  'MOHNTON':        '19540',
  'EXETER':         '19606',
  'CUMRU':          '19602',
  'BERN':           '19605',
  'LOWER ALSACE':   '19602',
  'ST LAWRENCE':    '19606',
};

// Berks County zip codes
export const BERKS_COUNTY_ZIPS = [
  '19501', '19503', '19504', '19506', '19507', '19508', '19510', '19511',
  '19512', '19516', '19518', '19520', '19522', '19523', '19526', '19529',
  '19530', '19533', '19534', '19535', '19536', '19539', '19540', '19541',
  '19543', '19544', '19545', '19547', '19549', '19550', '19551', '19555',
  '19559', '19560', '19562', '19564', '19565', '19567',
  '19601', '19602', '19604', '19605', '19606', '19607', '19608',
  '19609', '19610', '19611', '19612',
];

// Lancaster County zip codes
export const LANCASTER_COUNTY_ZIPS = [
  '17501', '17502', '17505', '17507', '17508', '17509', '17512', '17516',
  '17517', '17518', '17519', '17520', '17522', '17527', '17528', '17529',
  '17532', '17533', '17534', '17535', '17536', '17537', '17538', '17540',
  '17543', '17545', '17547', '17549', '17550', '17551', '17552', '17554',
  '17555', '17557', '17560', '17562', '17563', '17565', '17566', '17569',
  '17572', '17576', '17578', '17579', '17580', '17582', '17584',
  '17601', '17602', '17603',
];

interface BerksParcelFeature {
  attributes: {
    OBJECTID: number;
    PIN: string | null;
    PROPID: string | null;
    NAME1: string | null;
    FULLSITEADDRESS: string | null;
    FULLMAILADDRESS: string | null;
    SITEADDRESS_CITY: string | null;
    SITEADDRESS_STATE: string | null;
    SITEADDRESS_ZIP: string | null;
    MUNICIPALNAME: string | null;
    LANDUSE: string | null;
    CLASS: string | null;
    ACREAGE: number | null;
    VALUTOTAL: number | null;
    VALULAND: number | null;
    VALUBLDG: number | null;
    VALULNDMKT: number | null;
    DEED_DATE: number | null;
    DEEDAMOUNT: number | null;
    DEEDBOOK: string | null;
    DEEDPAGE: string | null;
    HOMESTEAD: string | null;
    SCHOOL: string | null;
    TAX_DIST_NAME: string | null;
    DESCR1: string | null;
    MAPID: string | null;
  };
}

interface BerksArcGISResponse {
  features: BerksParcelFeature[];
  exceededTransferLimit?: boolean;
}

// ============================================================
// LAND USE CODE MAPPING
// Berks County uses numeric codes with an R suffix for residential
// (e.g. 112R = single family, 117R = row home, 138R = converted apt)
// ============================================================

const LAND_USE_MAP: Record<string, { category: string; description: string }> = {
  // Residential (suffix R)
  '101R': { category: 'residential', description: 'Residential (101R)' },
  '102R': { category: 'residential', description: 'Residential (102R)' },
  '106R': { category: 'residential', description: 'Residential (106R)' },
  '107R': { category: 'residential', description: 'Residential (107R)' },
  '110R': { category: 'residential', description: 'Residential (110R)' },
  '111R': { category: 'residential', description: 'Single Family Detached' },
  '112R': { category: 'residential', description: 'Single Family Row / Townhouse' },
  '113R': { category: 'residential', description: 'Residential (113R)' },
  '114R': { category: 'residential', description: 'Residential (114R)' },
  '115R': { category: 'residential', description: 'Residential (115R)' },
  '116R': { category: 'residential', description: 'Residential (116R)' },
  '117R': { category: 'residential', description: 'Row Home' },
  '119R': { category: 'residential', description: 'Residential (119R)' },
  '121R': { category: 'residential', description: 'Two-Family / Duplex' },
  '132R': { category: 'residential', description: 'Residential (132R)' },
  '133R': { category: 'residential', description: 'Multi-Family (3-4 units)' },
  '136R': { category: 'residential', description: 'Residential (136R)' },
  '138R': { category: 'residential', description: 'Converted Apartment' },
  '151R': { category: 'residential', description: 'Residential (151R)' },
  // Non-residential (for enrichment lookups)
  '100A': { category: 'agricultural', description: 'Agricultural' },
  '4200': { category: 'commercial', description: 'Commercial' },
  '4124': { category: 'commercial', description: 'Commercial (4124)' },
  '9940': { category: 'exempt', description: 'Government / Exempt' },
};

export function mapBerksLandUseCode(code: string | null): { category: string; description: string } {
  if (!code) return { category: 'unknown', description: 'Unknown' };
  const trimmed = code.trim().toUpperCase();

  // Exact match
  if (LAND_USE_MAP[trimmed]) return LAND_USE_MAP[trimmed];

  // Suffix match — codes ending in R are residential
  if (trimmed.endsWith('R')) return { category: 'residential', description: `Residential (${trimmed})` };

  // Numeric prefix ranges
  const num = parseInt(trimmed, 10);
  if (!isNaN(num)) {
    if (num >= 1000 && num < 2000) return { category: 'residential', description: `Residential (${trimmed})` };
    if (num >= 2000 && num < 4000) return { category: 'commercial', description: `Commercial (${trimmed})` };
    if (num >= 4000 && num < 6000) return { category: 'commercial', description: `Commercial (${trimmed})` };
    if (num >= 8000 && num < 10000) return { category: 'exempt', description: `Exempt (${trimmed})` };
  }

  console.warn(`[Berks Parcel] Unknown land use code: ${trimmed}`);
  return { category: 'unknown', description: `Unknown (${trimmed})` };
}

// ============================================================
// ABSENTEE OWNER DETECTION
// Berks mailing addresses include city/state/zip after a double-space:
//   "446 BINGAMAN CT  READING PA 19602-2616"
// Site addresses are street-only:
//   "446 BINGAMAN CT"
// We strip city/state/zip from mailing before comparing.
// ============================================================

/**
 * Extract just the street portion from a Berks mailing address.
 * Strips city/state/zip that appears after a double-space separator.
 * e.g. "446 BINGAMAN CT  READING PA 19602-2616" → "446 BINGAMAN CT"
 */
function extractMailingStreet(mailingAddress: string): string {
  // Berks format: "STREET  CITY STATE ZIP" — double-space separates street from city
  const doubleSpaceIdx = mailingAddress.indexOf('  ');
  if (doubleSpaceIdx > 0) {
    return mailingAddress.slice(0, doubleSpaceIdx).trim();
  }
  return mailingAddress.trim();
}

/**
 * Parse a Berks-format mailing address into components.
 * Input: "517 FLORIDA AVE  READING PA 19605"
 * Output: { street: "517 FLORIDA AVE", city: "READING", state: "PA", zip: "19605" }
 */
function parseMailingAddress(fullMailing: string): {
  street?: string; city?: string; state?: string; zip?: string;
} {
  const trimmed = fullMailing.trim();
  const dblIdx = trimmed.indexOf('  ');
  if (dblIdx <= 0) return { street: trimmed };

  const street = trimmed.substring(0, dblIdx).trim();
  const rest = trimmed.substring(dblIdx).trim();
  const zipMatch = rest.match(/(\d{5}(?:-\d{4})?)$/);
  if (!zipMatch) return { street, city: rest };

  const zip = zipMatch[1];
  const beforeZip = rest.substring(0, rest.length - zipMatch[0].length).trim();
  const stateMatch = beforeZip.match(/\s([A-Z]{2})$/);
  if (!stateMatch) return { street, city: beforeZip, zip };

  const state = stateMatch[1];
  const city = beforeZip.substring(0, beforeZip.length - stateMatch[0].length).trim();
  return { street, city, state, zip };
}

export function detectAbsenteeOwner(
  mailingAddress: string | null | undefined,
  siteAddress: string | null | undefined
): boolean {
  if (!mailingAddress || !siteAddress) return false;

  // Extract street portion from mailing (strip city/state/zip)
  const mailingStreet = extractMailingStreet(mailingAddress.trim());
  const siteStreet = siteAddress.trim();

  if (!mailingStreet || !siteStreet) return false;

  const normalizedMailing = normalizeAddress(mailingStreet);
  const normalizedSite = normalizeAddress(siteStreet);

  // If mailing is empty or matches site, not absentee
  if (!normalizedMailing || normalizedMailing === normalizedSite) return false;

  // Extract street number from both — if different number, definitely absentee
  const mailingNum = normalizedMailing.match(/^(\d+)/)?.[1];
  const siteNum = normalizedSite.match(/^(\d+)/)?.[1];

  if (mailingNum && siteNum && mailingNum !== siteNum) return true;

  // If the street names differ, likely absentee
  // (handles cases like PO BOX vs street address, or entirely different streets)
  if (normalizedMailing !== normalizedSite) return true;

  return false;
}

// ============================================================
// TITLE CASE HELPER
// ============================================================

function titleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => {
      if (w.match(/^\d/)) return w; // Preserve numbers
      if (w.length <= 2) return w.toUpperCase(); // Keep short abbrevs
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// ============================================================
// CONNECTOR CLASS
// ============================================================

export class BerksParcelAssessmentConnector implements DataSourceConnector, LookupConnector {
  name = 'Berks County Parcel Assessment';
  slug = 'berks-parcel-assessment';
  type = 'parcel_assessment' as const;
  regionSlug = 'berks-lancaster';
  description = 'Residential parcel and assessment data from Berks County GIS for property discovery and enrichment';
  supportedZipCodes = BERKS_COUNTY_ZIPS;

  // ============================================================
  // BULK FETCH (DataSourceConnector) — Discovery feed
  // Only emits parcels that have at least one signal (e.g. absentee owner).
  // ============================================================

  async fetchAndParse(): Promise<ParsedRecord[]> {
    const allFeatures: BerksParcelFeature[] = [];

    // Build WHERE clause for target municipalities with residential land use
    // Berks land use codes ending in R = residential (e.g. 112R, 117R)
    const muniList = TARGET_MUNICIPALITIES.map((m) => `'${m}'`).join(',');
    const whereClause = `MUNICIPALNAME IN (${muniList}) AND LANDUSE LIKE '%R'`;

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        where: whereClause,
        outFields: '*',
        resultOffset: String(offset),
        resultRecordCount: String(PAGE_SIZE),
        orderByFields: 'OBJECTID ASC',
        returnGeometry: 'false',
        f: 'json',
      });

      const url = `${ARCGIS_URL}?${params.toString()}`;
      console.log(`[Berks Parcel] Fetching page at offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
      }

      const data: BerksArcGISResponse = await response.json();

      if (!data.features || data.features.length === 0) {
        hasMore = false;
        break;
      }

      allFeatures.push(...data.features);
      console.log(
        `[Berks Parcel] Got ${data.features.length} records (total: ${allFeatures.length})`
      );

      if (data.exceededTransferLimit && data.features.length === PAGE_SIZE) {
        offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`[Berks Parcel] Total parcels fetched: ${allFeatures.length}`);

    // Parse into WholeSail records — only keep parcels with signals
    const records: ParsedRecord[] = [];
    let skippedNoSignal = 0;

    for (const feature of allFeatures) {
      try {
        const record = this.parseFeature(feature);
        if (record) {
          if (record.signals.length > 0) {
            records.push(record);
          } else {
            skippedNoSignal++;
          }
        }
      } catch (err: any) {
        console.error(
          `[Berks Parcel] Parse error for OBJECTID ${feature.attributes.OBJECTID}:`,
          err.message
        );
      }
    }

    console.log(
      `[Berks Parcel] Discovery: ${records.length} leads with signals, ${skippedNoSignal} skipped (no signal) from ${allFeatures.length} total parcels`
    );

    return records;
  }

  // ============================================================
  // LIVE LOOKUP (LookupConnector) — Enrichment
  // Returns data for any parcel regardless of signals.
  // ============================================================

  async lookupByAddress(address: string, zipCode: string): Promise<ParcelAssessmentLookupResult> {
    const upperAddr = address.toUpperCase().trim().replace(/'/g, "''");

    // Berks ArcGIS SITEADDRESS_ZIP is always null, so match on address + municipality instead
    // Derive municipality from MUNICIPALITY_ZIP reverse lookup, or fall back to address-only search
    const muniEntry = Object.entries(MUNICIPALITY_ZIP).find(([, z]) => z === zipCode);
    const whereClause = muniEntry
      ? `MUNICIPALNAME = '${muniEntry[0]}' AND UPPER(FULLSITEADDRESS) LIKE '%${upperAddr}%'`
      : `UPPER(FULLSITEADDRESS) LIKE '%${upperAddr}%'`;

    const params = new URLSearchParams({
      where: whereClause,
      outFields: '*',
      resultRecordCount: '5',
      returnGeometry: 'false',
      f: 'json',
    });

    const url = `${ARCGIS_URL}?${params.toString()}`;
    console.log(`[Berks Parcel Lookup] Querying for "${address}" in ${zipCode}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: BerksArcGISResponse = await response.json();
    const features = data.features || [];

    console.log(`[Berks Parcel Lookup] Found ${features.length} parcels for "${address}"`);

    if (features.length === 0) {
      return { found: false, rawData: {} };
    }

    // Take the best match (first result)
    const attrs = features[0].attributes;
    const landUse = mapBerksLandUseCode(attrs.LANDUSE);
    const isAbsentee = detectAbsenteeOwner(attrs.FULLMAILADDRESS, attrs.FULLSITEADDRESS);

    // Parse mailing address into components
    const mailing = attrs.FULLMAILADDRESS
      ? parseMailingAddress(attrs.FULLMAILADDRESS)
      : {};

    return {
      found: true,
      parcelId: attrs.PROPID || attrs.PIN || undefined,
      ownerName: attrs.NAME1 ? titleCase(attrs.NAME1.trim()) : undefined,
      ownerMailingAddress: mailing.street || undefined,
      ownerMailingFull: attrs.FULLMAILADDRESS || undefined,
      ownerCity: mailing.city || undefined,
      ownerState: mailing.state || undefined,
      ownerZip: mailing.zip || undefined,
      siteAddress: attrs.FULLSITEADDRESS || undefined,
      municipality: attrs.MUNICIPALNAME || undefined,
      landUseCode: attrs.LANDUSE || undefined,
      landUseDescription: landUse.description,
      propertyType: landUse.description,
      propertyClass: attrs.CLASS || undefined,
      propertyDescription: attrs.DESCR1 ? attrs.DESCR1.trim() : undefined,
      assessedValue: attrs.VALUTOTAL ?? undefined,
      assessedLandValue: attrs.VALULAND ?? undefined,
      assessedBuildingValue: attrs.VALUBLDG ?? undefined,
      lastSaleDate: attrs.DEED_DATE
        ? new Date(attrs.DEED_DATE).toISOString().split('T')[0]
        : undefined,
      lastSalePrice: attrs.DEEDAMOUNT ?? undefined,
      deedBook: attrs.DEEDBOOK || undefined,
      deedPage: attrs.DEEDPAGE || undefined,
      acreage: attrs.ACREAGE ?? undefined,
      isAbsenteeOwner: isAbsentee,
      isHomestead: !!(attrs.HOMESTEAD && attrs.HOMESTEAD.trim().startsWith('ACCEPTED')),
      rawData: { ...attrs },
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private parseFeature(feature: BerksParcelFeature): ParsedRecord | null {
    const attrs = feature.attributes;

    // Skip if missing critical address data
    if (!attrs.FULLSITEADDRESS || !attrs.FULLSITEADDRESS.trim()) {
      return null;
    }

    const address = titleCase(attrs.FULLSITEADDRESS.trim());
    const city = titleCase(attrs.SITEADDRESS_CITY?.trim() || attrs.MUNICIPALNAME?.trim() || 'Reading');
    const state = attrs.SITEADDRESS_STATE || 'PA';
    const municipality = (attrs.MUNICIPALNAME || '').trim().toUpperCase();
    const zipCode = attrs.SITEADDRESS_ZIP || MUNICIPALITY_ZIP[municipality] || '';
    const county = 'Berks';

    // Generate signals
    const signals: ParsedRecord['signals'] = [];
    const isAbsentee = detectAbsenteeOwner(attrs.FULLMAILADDRESS, attrs.FULLSITEADDRESS);

    if (isAbsentee) {
      signals.push({
        signalType: 'absentee_owner',
        label: 'Absentee Owner',
        category: 'ownership',
        points: 22,
        value: `Mailing: ${extractMailingStreet(attrs.FULLMAILADDRESS?.trim() || 'Unknown')}`,
        source: 'Berks County Assessment',
      });
    }

    // Deed date for context
    const deedDate = attrs.DEED_DATE
      ? new Date(attrs.DEED_DATE).toISOString().split('T')[0]
      : undefined;

    const landUse = mapBerksLandUseCode(attrs.LANDUSE);

    return {
      address,
      city,
      state,
      zipCode,
      county,
      ownerName: attrs.NAME1 ? titleCase(attrs.NAME1.trim()) : undefined,
      parcelNumber: attrs.PROPID || attrs.PIN || undefined,
      saleDate: deedDate,
      signals,
      rawData: {
        ownerName: attrs.NAME1 ? titleCase(attrs.NAME1.trim()) : undefined,
        propId: attrs.PROPID,
        pin: attrs.PIN,
        landUse: attrs.LANDUSE,
        landUseDescription: landUse.description,
        propertyDescription: attrs.DESCR1 ? attrs.DESCR1.trim() : undefined,
        propertyClass: attrs.CLASS,
        municipality: attrs.MUNICIPALNAME,
        assessedTotal: attrs.VALUTOTAL,
        assessedLand: attrs.VALULAND,
        assessedBuilding: attrs.VALUBLDG,
        marketLandValue: attrs.VALULNDMKT,
        deedBook: attrs.DEEDBOOK,
        deedPage: attrs.DEEDPAGE,
        deedDate: deedDate,
        deedAmount: attrs.DEEDAMOUNT,
        acreage: attrs.ACREAGE,
        homestead: attrs.HOMESTEAD,
        schoolDistrict: attrs.SCHOOL,
        taxDistrict: attrs.TAX_DIST_NAME,
        mailingAddress: attrs.FULLMAILADDRESS,
        isAbsenteeOwner: isAbsentee,
      },
    };
  }
}
