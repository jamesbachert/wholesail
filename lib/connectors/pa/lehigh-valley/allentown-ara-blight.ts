import {
  discoverRecords,
  DiscoveryRecord,
  DiscoverySyncResult,
  DiscoverySignalInput,
} from '../../discovery-engine';
import {
  blightLevelPoints,
  blightCriteriaPoints,
  certificationAgePoints,
  buildingAgePoints,
  enforcementKeywordPoints,
  harbPoints,
  bothFeedsPoints,
} from '../../discovery-scoring';

// ============================================================
// ALLENTOWN ARA BLIGHT DISCOVERY CONNECTOR
// Pulls from two ArcGIS FeatureServer endpoints:
//   1. ARA Certified Blight (more severe designation)
//   2. ARA Determined Blight (preliminary designation)
// Deduplicates by normalized address, preferring Certified.
// Produces DiscoveryRecord[] → fed into the generic discovery engine.
// ============================================================

const CERTIFIED_URL =
  'https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/ARA_Certified_Blight/FeatureServer/0/query';

const DETERMINED_URL =
  'https://services1.arcgis.com/WUqVDRuvIiIiH2Pl/ArcGIS/rest/services/ARA_Determined_Blight/FeatureServer/0/query';

const PAGE_SIZE = 2000;

// -- Types for ArcGIS responses --

interface ArcGISFeature {
  attributes: Record<string, any>;
  geometry?: { x: number; y: number } | null;
}

interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

// -- Normalized blight record (internal) --

interface NormalizedBlightRecord {
  address: string;
  addressNormalized: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  blightLevel: 'certified' | 'determined';
  dateCertified: Date | null;
  propertyType: string | null;
  yearBuilt: number | null;
  lotSize: number | null;
  buildingSF: number | null;
  zoning: string | null;
  blightCriteria: string | null;
  harb: boolean;
  notes: string | null;
  externalId: string | null;
  rawData: Record<string, any>;
}

// -- Main connector --

export class AllentownAraBlightConnector {
  name = 'ARA Blight Data';
  slug = 'ara-blight';
  regionSlug = 'lehigh-valley';
  description =
    'Allentown Redevelopment Authority certified and determined blight designations via ArcGIS FeatureServer';

  async sync(): Promise<DiscoverySyncResult> {
    console.log(`[ARA Blight] Starting sync...`);

    // 1. Fetch both feeds
    const [certifiedRaw, determinedRaw] = await Promise.all([
      this.fetchFeed(CERTIFIED_URL, 'certified'),
      this.fetchFeed(DETERMINED_URL, 'determined'),
    ]);

    console.log(
      `[ARA Blight] Fetched ${certifiedRaw.length} certified + ${determinedRaw.length} determined records`
    );

    // 2. Normalize both feeds
    const certifiedRecords = certifiedRaw
      .map((f) => this.normalizeRecord(f, 'certified'))
      .filter(Boolean) as NormalizedBlightRecord[];

    const determinedRecords = determinedRaw
      .map((f) => this.normalizeRecord(f, 'determined'))
      .filter(Boolean) as NormalizedBlightRecord[];

    // 3. Deduplicate: build address → record map, certified takes priority
    const addressMap = new Map<string, NormalizedBlightRecord>();
    const inBothFeeds = new Set<string>();

    // Add determined first, then overlay certified (certified wins on conflict)
    for (const rec of determinedRecords) {
      addressMap.set(rec.addressNormalized, rec);
    }
    for (const rec of certifiedRecords) {
      if (addressMap.has(rec.addressNormalized)) {
        inBothFeeds.add(rec.addressNormalized);
      }
      addressMap.set(rec.addressNormalized, rec);
    }

    const allRecords = Array.from(addressMap.values());
    console.log(
      `[ARA Blight] After dedup: ${allRecords.length} unique properties (${inBothFeeds.size} in both feeds)`
    );

    // 4. Convert to DiscoveryRecord[] with signals
    const discoveryRecords: DiscoveryRecord[] = allRecords.map((rec) =>
      this.toDiscoveryRecord(rec, inBothFeeds.has(rec.addressNormalized))
    );

    // 5. Feed into the generic discovery engine
    return discoverRecords(this.slug, this.regionSlug, discoveryRecords);
  }

  // -- Convert a normalized blight record into a DiscoveryRecord with signals --

  private toDiscoveryRecord(
    rec: NormalizedBlightRecord,
    inBoth: boolean
  ): DiscoveryRecord {
    const signals: DiscoverySignalInput[] = [];

    // Signal: Blight level
    signals.push({
      signalType: rec.blightLevel === 'certified' ? 'blight_certified' : 'blight_determined',
      label: `ARA ${rec.blightLevel === 'certified' ? 'Certified' : 'Determined'} Blight`,
      category: 'distress',
      points: blightLevelPoints(rec.blightLevel),
      value: `${rec.blightLevel} blight designation`,
      details: {
        blightLevel: rec.blightLevel,
        dateCertified: rec.dateCertified?.toISOString() || null,
        zoning: rec.zoning,
        lotSize: rec.lotSize,
        buildingSF: rec.buildingSF,
      },
    });

    // Signal: Blight criteria count
    if (rec.blightCriteria) {
      const pts = blightCriteriaPoints(rec.blightCriteria);
      if (pts > 0) {
        signals.push({
          signalType: 'blight_criteria',
          label: 'Blight Criteria',
          category: 'distress',
          points: pts,
          value: `Criteria: ${rec.blightCriteria}`,
          details: {
            criteria: rec.blightCriteria,
            criteriaList: rec.blightCriteria.split(',').map((s) => s.trim()).filter(Boolean),
          },
        });
      }
    }

    // Signal: Certification age
    if (rec.dateCertified) {
      const pts = certificationAgePoints(rec.dateCertified);
      if (pts > 0) {
        signals.push({
          signalType: 'blight_aging',
          label: 'Certification Age',
          category: 'distress',
          points: pts,
          value: `Certified: ${rec.dateCertified.toLocaleDateString()}`,
          details: { dateCertified: rec.dateCertified.toISOString() },
        });
      }
    }

    // Signal: Building age
    if (rec.yearBuilt) {
      const pts = buildingAgePoints(rec.yearBuilt);
      if (pts > 0) {
        signals.push({
          signalType: 'building_age',
          label: 'Building Age',
          category: 'condition',
          points: pts,
          value: `Built ${rec.yearBuilt}`,
          details: { yearBuilt: rec.yearBuilt },
        });
      }
    }

    // Signal: Enforcement keywords in notes
    if (rec.notes) {
      const pts = enforcementKeywordPoints(rec.notes);
      if (pts > 0) {
        signals.push({
          signalType: 'enforcement_notes',
          label: 'Enforcement Notes',
          category: 'distress',
          points: pts,
          value: rec.notes,
          details: { notes: rec.notes },
        });
      }
    }

    // Signal: HARB district
    if (rec.harb) {
      signals.push({
        signalType: 'harb_district',
        label: 'Historic District (HARB)',
        category: 'condition',
        points: harbPoints(rec.harb),
        value: 'In HARB historic district',
      });
    }

    // Signal: In both feeds (cross-confirmed)
    if (inBoth) {
      signals.push({
        signalType: 'blight_cross_confirmed',
        label: 'Cross-Confirmed Blight',
        category: 'distress',
        points: bothFeedsPoints(true),
        value: 'Found in both Certified and Determined blight feeds',
      });
    }

    return {
      address: rec.address,
      city: rec.city,
      state: rec.state,
      zipCode: rec.zipCode,
      latitude: rec.latitude ?? undefined,
      longitude: rec.longitude ?? undefined,
      propertyType: rec.propertyType ?? undefined,
      yearBuilt: rec.yearBuilt ?? undefined,
      signals,
      rawData: rec.rawData,
      externalId: rec.externalId ?? undefined,
    };
  }

  // -- Feed fetching with pagination --

  private async fetchFeed(
    baseUrl: string,
    label: string
  ): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        resultOffset: String(offset),
        resultRecordCount: String(PAGE_SIZE),
        f: 'json',
      });

      const url = `${baseUrl}?${params.toString()}`;
      console.log(`[ARA Blight] Fetching ${label} at offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `ArcGIS ${label} returned ${response.status}: ${response.statusText}`
        );
      }

      const data: ArcGISResponse = await response.json();

      if (!data.features || data.features.length === 0) {
        hasMore = false;
        break;
      }

      allFeatures.push(...data.features);
      console.log(
        `[ARA Blight] ${label}: got ${data.features.length} records (total: ${allFeatures.length})`
      );

      if (data.exceededTransferLimit && data.features.length === PAGE_SIZE) {
        offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return allFeatures;
  }

  // -- Normalize a single ArcGIS feature into our common format --

  private normalizeRecord(
    feature: ArcGISFeature,
    blightLevel: 'certified' | 'determined'
  ): NormalizedBlightRecord | null {
    const a = feature.attributes;
    if (!a) return null;

    const address = a.USER_Blight_Property?.trim();
    if (!address) return null;

    // Normalized address field differs between feeds
    const normalizedField =
      blightLevel === 'certified'
        ? a.USER_BlightProp2
        : a.USER_BlightProperty2 || a.USER_BlightProp2;
    const addressNormalized = (normalizedField || address).toUpperCase().trim();

    // Title-case the display address
    const displayAddress = address
      .split(' ')
      .map((w: string) => {
        if (w.match(/^\d/)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    // Parse date from epoch milliseconds
    let dateCertified: Date | null = null;
    if (a.USER_Date_Certified) {
      dateCertified = new Date(a.USER_Date_Certified);
    }

    // Parse lot size (can be string or number)
    let lotSize: number | null = null;
    if (a.USER_Lot_Size != null) {
      const parsed = parseFloat(String(a.USER_Lot_Size));
      if (!isNaN(parsed)) lotSize = parsed;
    }

    return {
      address: displayAddress,
      addressNormalized,
      city: titleCase(a.USER_City || 'Allentown'),
      state: a.USER_State || 'PA',
      zipCode: a.Postal || '',
      latitude: a.Y || null,
      longitude: a.X || null,
      blightLevel,
      dateCertified,
      propertyType: a.USER_Type || null,
      yearBuilt: a.USER_Date_Built ? parseInt(String(a.USER_Date_Built), 10) || null : null,
      lotSize,
      buildingSF: a.USER_SF ? parseFloat(String(a.USER_SF)) || null : null,
      zoning: a.USER_Zoning || null,
      blightCriteria: a.USER_Criteria || null,
      harb: a.USER_HARB === 'Y',
      notes: a.USER_Notes || null,
      externalId: a.OBJECTID ? String(a.OBJECTID) : null,
      rawData: a,
    };
  }
}

function titleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
