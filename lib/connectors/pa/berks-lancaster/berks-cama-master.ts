import { LookupConnector, CamaDataLookupResult } from '../../lookup-types';
import { BERKS_COUNTY_ZIPS } from './berks-parcel-assessment';

// ============================================================
// BERKS COUNTY CAMA MASTER CONNECTOR
// Source: Berks County GIS — CAMA_Master Table (ArcGIS MapServer Table 3)
// URL: https://gis.co.berks.pa.us/arcgis/rest/services/Assess/ParcelSearchTable/MapServer/3
// Data: Supplemental owner and assessment details not in the Parcels layer.
//
// Enrichment only — adds co-owner, instrument number, tax account,
// human-readable class name, and Clean & Green status.
//
// Join: CAMA_Master.PARID ↔ Parcels.PROPID
// ============================================================

const CAMA_URL =
  'https://gis.co.berks.pa.us/arcgis/rest/services/Assess/ParcelSearchTable/MapServer/3/query';

interface CamaFeature {
  attributes: {
    OBJECTID: number;
    NAME1: string | null;
    OWNER1: string | null;
    OWNER2: string | null;
    FULLMAILADDRESS: string | null;
    PROPERTY_LOCATION: string | null;
    PROPERTY_CSZ: string | null;
    CITYNAME: string | null;
    STATECODE: string | null;
    ZIP: string | null;
    DEEDBOOK: string | null;
    DEEDPAGE: string | null;
    INSTRUNO: string | null;
    PARID: string | null;
    TAX_DIST: string | null;
    ACCOUNT: string | null;
    CG_ENROLLED_DATE: string | null;
    ACRES: number | null;
    DEED_DATE: number | null;
    DEED_AMOUNT: number | null;
    MUNI_NAME: string | null;
    CLASS: string | null;
    CLASS_NAME: string | null;
    LAND_USE: string | null;
    TOT_VALUE: number | null;
    LAND_VALUE: number | null;
    BLDG_VALUE: number | null;
    HOMESTEAD: string | null;
    FARMSTEAD: string | null;
    SCHL_DIST_CODE: string | null;
    TAX_DIST_NAME: string | null;
  };
}

interface CamaArcGISResponse {
  features: CamaFeature[];
  exceededTransferLimit?: boolean;
}

export class BerksCamaMasterConnector implements LookupConnector {
  name = 'Berks County CAMA Data';
  slug = 'berks-cama-master';
  type = 'cama_data' as const;
  regionSlug = 'berks-lancaster';
  description = 'Supplemental owner and assessment data from the Berks County CAMA Master table for property enrichment';
  supportedZipCodes = BERKS_COUNTY_ZIPS;

  // ============================================================
  // LIVE LOOKUP (LookupConnector) — Enrichment
  // ============================================================

  async lookupByAddress(address: string, zipCode: string): Promise<CamaDataLookupResult> {
    const upperAddr = address.toUpperCase().trim().replace(/'/g, "''");

    // CAMA table uses PROPERTY_LOCATION for site address and ZIP for zip code
    const whereClause = `ZIP = '${zipCode}' AND UPPER(PROPERTY_LOCATION) LIKE '%${upperAddr}%'`;

    const params = new URLSearchParams({
      where: whereClause,
      outFields: 'PARID,NAME1,OWNER1,OWNER2,INSTRUNO,ACCOUNT,CLASS_NAME,CG_ENROLLED_DATE,MUNI_NAME,TOT_VALUE,LAND_VALUE,BLDG_VALUE,DEED_DATE,DEED_AMOUNT,PROPERTY_LOCATION,FULLMAILADDRESS',
      resultRecordCount: '5',
      f: 'json',
    });

    const url = `${CAMA_URL}?${params.toString()}`;
    console.log(`[CAMA Lookup] Querying for "${address}" in ${zipCode}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: CamaArcGISResponse = await response.json();
    const features = data.features || [];

    console.log(`[CAMA Lookup] Found ${features.length} records for "${address}"`);

    if (features.length === 0) {
      return { found: false, rawData: {} };
    }

    const attrs = features[0].attributes;

    return {
      found: true,
      parcelId: attrs.PARID || undefined,
      ownerName: attrs.OWNER1 || attrs.NAME1 || undefined,
      coOwner: attrs.OWNER2 || undefined,
      instrumentNumber: attrs.INSTRUNO || undefined,
      taxAccount: attrs.ACCOUNT || undefined,
      className: attrs.CLASS_NAME || undefined,
      cleanAndGreenDate: attrs.CG_ENROLLED_DATE || undefined,
      rawData: { ...attrs },
    };
  }

  // ============================================================
  // LOOKUP BY PARCEL ID (direct join key)
  // ============================================================

  async lookupByParcelId(parcelId: string): Promise<CamaDataLookupResult> {
    const escapedId = parcelId.replace(/'/g, "''");
    const whereClause = `PARID = '${escapedId}'`;

    const params = new URLSearchParams({
      where: whereClause,
      outFields: 'PARID,NAME1,OWNER1,OWNER2,INSTRUNO,ACCOUNT,CLASS_NAME,CG_ENROLLED_DATE,MUNI_NAME,TOT_VALUE,LAND_VALUE,BLDG_VALUE,DEED_DATE,DEED_AMOUNT,PROPERTY_LOCATION,FULLMAILADDRESS',
      resultRecordCount: '1',
      f: 'json',
    });

    const url = `${CAMA_URL}?${params.toString()}`;
    console.log(`[CAMA Lookup] Querying by PARID "${parcelId}"...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
    }

    const data: CamaArcGISResponse = await response.json();
    const features = data.features || [];

    if (features.length === 0) {
      return { found: false, rawData: {} };
    }

    const attrs = features[0].attributes;

    return {
      found: true,
      parcelId: attrs.PARID || undefined,
      ownerName: attrs.OWNER1 || attrs.NAME1 || undefined,
      coOwner: attrs.OWNER2 || undefined,
      instrumentNumber: attrs.INSTRUNO || undefined,
      taxAccount: attrs.ACCOUNT || undefined,
      className: attrs.CLASS_NAME || undefined,
      cleanAndGreenDate: attrs.CG_ENROLLED_DATE || undefined,
      rawData: { ...attrs },
    };
  }
}
