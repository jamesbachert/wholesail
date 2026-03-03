// ============================================================
// UNIFIED CONNECTOR COVERAGE REGISTRY
// Maps zip codes → available connectors (import + lookup).
// Used by manual lead entry to suggest applicable data sources.
// ============================================================

export interface ConnectorCoverage {
  slug: string;
  name: string;
  type: 'import' | 'lookup';
  connectorKind: string; // 'sheriff_sale', 'code_violation', 'rental_license', 'tax_delinquent'
  description: string;
  regionSlug: string;
  supportedZipCodes: string[];
  enrichmentMode: 'cross_reference' | 'live_lookup';
  // cross_reference = search existing DataSourceRecords for address matches
  // live_lookup = call external API in real time
}

// ============================================================
// COVERAGE DECLARATIONS
// Zip codes sourced from county/municipal boundary data.
// When adding new connectors, add their coverage here too.
// ============================================================

// Complete Lehigh County zip codes (standard delivery, excl. PO-Box-only)
// Source: USPS, ArcGIS Lehigh Valley Zip Codes FeatureServer
const LEHIGH_COUNTY_ZIPS = [
  '18011', // Alburtis
  '18015', // Bethlehem (Lehigh side), Fountain Hill
  '18017', // Bethlehem Twp, Hanover Twp
  '18018', // Bethlehem (west)
  '18031', // Breinigsville, Upper Macungie
  '18032', // Catasauqua, North Catasauqua
  '18034', // Center Valley, Upper Saucon
  '18036', // Coopersburg, Lower Milford
  '18037', // Coplay
  '18041', // East Greenville (Lehigh portion)
  '18046', // East Texas, Lower Macungie
  '18049', // Emmaus
  '18051', // Fogelsville, Upper Macungie
  '18052', // Whitehall Twp
  '18053', // Laurys Station
  '18058', // Germansville, Lynn Twp
  '18059', // Limeport, Lower Milford
  '18062', // Macungie, Lower/Upper Macungie, Upper Milford
  '18065', // Neffs, North Whitehall
  '18066', // New Tripoli, Lynn, Lowhill, Weisenberg
  '18069', // Orefield, South Whitehall
  '18078', // Schnecksville, North Whitehall
  '18079', // Slatedale, Washington Twp
  '18080', // Slatington, Heidelberg, Washington
  '18087', // Trexlertown, Lower Macungie
  '18092', // Zionsville, Upper Milford
  '18101', // Allentown (downtown)
  '18102', // Allentown (east)
  '18103', // Allentown (south), Salisbury Twp
  '18104', // Allentown (west), South Whitehall
  '18106', // Wescosville, South Whitehall
  '18109', // Allentown (north)
];

// Complete Northampton County zip codes (standard delivery, excl. PO-Box-only)
// Source: USPS, ArcGIS Lehigh Valley Zip Codes FeatureServer
const NORTHAMPTON_COUNTY_ZIPS = [
  '18013', // Bangor
  '18014', // Bath, Moore Twp, East Allen Twp
  '18015', // Bethlehem (Northampton side), Lower Saucon
  '18017', // Bethlehem Twp, Freemansburg
  '18018', // Bethlehem (south)
  '18020', // Bethlehem Twp (east), Lower Nazareth
  '18032', // North Catasauqua (Northampton side)
  '18035', // Cherryville, Moore Twp
  '18038', // Danielsville, Lehigh Twp
  '18040', // Easton (Forks Twp)
  '18042', // Easton, Wilson, Williams, Glendon, West Easton
  '18045', // Palmer Twp, Easton
  '18055', // Hellertown, Lower Saucon
  '18063', // Martins Creek, Lower Mt. Bethel
  '18064', // Nazareth, Lower/Upper Nazareth
  '18067', // Northampton Boro, Lehigh/Allen Twp
  '18072', // Pen Argyl, Plainfield Twp
  '18077', // Riegelsville, Durham Twp
  '18083', // Stockertown
  '18085', // Tatamy
  '18086', // Treichlers
  '18088', // Walnutport, Lehigh Twp
  '18091', // Wind Gap, Bushkill Twp, Slate Belt
  '18343', // Mount Bethel, Lower Mt. Bethel Twp
  '18351', // Portland
];

// City of Allentown municipal zip codes
const ALLENTOWN_ZIPS = ['18101', '18102', '18103', '18104', '18109'];

const COVERAGE: ConnectorCoverage[] = [
  // Pennsylvania — Lehigh County
  {
    slug: 'lehigh-sheriff-sales',
    name: 'Lehigh County Sheriff Sales',
    type: 'import',
    connectorKind: 'sheriff_sale',
    description: 'Foreclosure properties scheduled for sheriff sale in Lehigh County.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'cross_reference',
    supportedZipCodes: LEHIGH_COUNTY_ZIPS,
  },
  {
    slug: 'lehigh-tax-repository',
    name: 'Lehigh County Tax Claim Repository',
    type: 'import',
    connectorKind: 'tax_delinquent',
    description: 'Properties unsold at Judicial Sale — deeply distressed, years of unpaid taxes.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'cross_reference',
    supportedZipCodes: LEHIGH_COUNTY_ZIPS,
  },
  // Pennsylvania — Northampton County
  {
    slug: 'northampton-sheriff-sales',
    name: 'Northampton County Sheriff Sales',
    type: 'import',
    connectorKind: 'sheriff_sale',
    description: 'Foreclosure properties scheduled for sheriff sale in Northampton County.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'cross_reference',
    supportedZipCodes: NORTHAMPTON_COUNTY_ZIPS,
  },
  // Pennsylvania — Allentown specific
  {
    slug: 'allentown-code-violations',
    name: 'Allentown Code Violations',
    type: 'import',
    connectorKind: 'code_violation',
    description: 'Open code enforcement cases from the City of Allentown.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'live_lookup',
    supportedZipCodes: ALLENTOWN_ZIPS,
  },
  {
    slug: 'allentown-rental-licenses',
    name: 'Allentown Rental Licenses',
    type: 'lookup',
    connectorKind: 'rental_license',
    description: 'Active rental licenses from the City of Allentown.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'live_lookup',
    supportedZipCodes: ALLENTOWN_ZIPS,
  },
  {
    slug: 'allentown-ara-blight',
    name: 'Allentown ARA Blight',
    type: 'import',
    connectorKind: 'blight',
    description: 'ARA certified and determined blight properties in the City of Allentown.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'cross_reference',
    supportedZipCodes: ALLENTOWN_ZIPS,
  },
];

// ============================================================
// ZIP CODE → CITY/STATE LABELS (for display in UI)
// ============================================================

const ZIP_LABELS: Record<string, string> = {
  // Lehigh County
  '18011': 'Alburtis, PA',
  '18015': 'Bethlehem, PA',
  '18017': 'Bethlehem, PA',
  '18018': 'Bethlehem, PA',
  '18020': 'Bethlehem, PA',
  '18031': 'Breinigsville, PA',
  '18032': 'Catasauqua, PA',
  '18034': 'Center Valley, PA',
  '18035': 'Cherryville, PA',
  '18036': 'Coopersburg, PA',
  '18037': 'Coplay, PA',
  '18038': 'Danielsville, PA',
  '18040': 'Easton, PA',
  '18041': 'East Greenville, PA',
  '18042': 'Easton, PA',
  '18045': 'Easton, PA',
  '18046': 'East Texas, PA',
  '18049': 'Emmaus, PA',
  '18051': 'Fogelsville, PA',
  '18052': 'Whitehall, PA',
  '18053': 'Laurys Station, PA',
  '18055': 'Hellertown, PA',
  '18058': 'Germansville, PA',
  '18059': 'Limeport, PA',
  '18062': 'Macungie, PA',
  '18063': 'Martins Creek, PA',
  '18064': 'Nazareth, PA',
  '18065': 'Neffs, PA',
  '18066': 'New Tripoli, PA',
  '18067': 'Northampton, PA',
  '18069': 'Orefield, PA',
  '18072': 'Pen Argyl, PA',
  '18077': 'Riegelsville, PA',
  '18078': 'Schnecksville, PA',
  '18079': 'Slatedale, PA',
  '18080': 'Slatington, PA',
  '18083': 'Stockertown, PA',
  '18085': 'Tatamy, PA',
  '18086': 'Treichlers, PA',
  '18087': 'Trexlertown, PA',
  '18088': 'Walnutport, PA',
  '18091': 'Wind Gap, PA',
  '18092': 'Zionsville, PA',
  '18101': 'Allentown, PA',
  '18102': 'Allentown, PA',
  '18103': 'Allentown, PA',
  '18104': 'Allentown, PA',
  '18106': 'Wescosville, PA',
  '18109': 'Allentown, PA',
  '18343': 'Mount Bethel, PA',
  '18351': 'Portland, PA',
  // Northampton County (Bethlehem east)
  '18013': 'Bangor, PA',
  '18014': 'Bath, PA',
};

/** Get the city/state label for a zip code */
export function getZipLabel(zip: string): string {
  return ZIP_LABELS[zip] || `${zip}`;
}

/** Get all zip labels as { zip, label } pairs for a given connector */
export function getZipLabelsForConnector(slug: string): Array<{ zip: string; label: string }> {
  const coverage = slugToConnector.get(slug);
  if (!coverage) return [];
  return coverage.supportedZipCodes.map((zip) => ({
    zip,
    label: ZIP_LABELS[zip] || 'PA',
  }));
}

// ============================================================
// LOOKUP INDEXES (built at module load time)
// ============================================================

const zipToConnectors = new Map<string, ConnectorCoverage[]>();
const slugToConnector = new Map<string, ConnectorCoverage>();

for (const c of COVERAGE) {
  slugToConnector.set(c.slug, c);
  for (const zip of c.supportedZipCodes) {
    const existing = zipToConnectors.get(zip) || [];
    existing.push(c);
    zipToConnectors.set(zip, existing);
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/** Get all connectors that cover a given zip code */
export function getConnectorsForZip(zipCode: string): ConnectorCoverage[] {
  return zipToConnectors.get(zipCode) || [];
}

/** Get a specific connector's coverage entry by slug */
export function getConnectorCoverage(slug: string): ConnectorCoverage | undefined {
  return slugToConnector.get(slug);
}

/** Get all registered coverage entries */
export function getAllCoverage(): ConnectorCoverage[] {
  return [...COVERAGE];
}
