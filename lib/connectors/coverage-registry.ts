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
// Zip codes derived from each connector's city→zip mappings.
// When adding new connectors, add their coverage here too.
// ============================================================

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
    supportedZipCodes: [
      '18011', // Alburtis
      '18015', // Bethlehem, Fountain Hill
      '18031', // Breinigsville
      '18032', // Catasauqua
      '18036', // Coopersburg
      '18037', // Coplay
      '18041', // East Greenville
      '18049', // Emmaus
      '18052', // Whitehall
      '18058', // Germansville
      '18062', // Macungie
      '18066', // New Tripoli
      '18069', // Orefield
      '18078', // Schnecksville
      '18080', // Slatington
      '18101', '18102', '18103', '18104', '18109', // Allentown
    ],
  },
  {
    slug: 'lehigh-tax-repository',
    name: 'Lehigh County Tax Claim Repository',
    type: 'import',
    connectorKind: 'tax_delinquent',
    description: 'Properties unsold at Judicial Sale — deeply distressed, years of unpaid taxes.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'cross_reference',
    supportedZipCodes: [
      '18011', // Alburtis
      '18015', // Bethlehem, Fountain Hill
      '18017', // Hanover Twp
      '18031', // Breinigsville, Upper Macungie
      '18032', // Catasauqua
      '18034', // Center Valley, Upper Saucon
      '18036', // Coopersburg, Lower Milford
      '18037', // Coplay
      '18049', // Emmaus
      '18052', // Whitehall
      '18062', // Macungie, Lower/Upper Macungie, Upper Milford
      '18066', // New Tripoli, Lynn, Lowhill, Weisenberg
      '18078', // Schnecksville, North Whitehall
      '18080', // Slatington, Heidelberg, Washington
      '18101', '18102', '18103', '18104', '18109', // Allentown, South Whitehall, Salisbury
    ],
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
    supportedZipCodes: [
      '18013', // Bangor
      '18014', // Bath, Moore, East Allen
      '18015', // Bethlehem (Northampton side), Lower Saucon
      '18017', // Freemansburg
      '18040', // Forks Township
      '18042', // Easton, Wilson, Williams, Glendon, West Easton
      '18045', // Palmer Township
      '18055', // Hellertown
      '18064', // Nazareth, Lower/Upper Nazareth
      '18067', // Northampton Boro, Lehigh/Allen Twp
      '18072', // Plainfield, Pen Argyl
      '18080', // Slate
      '18083', // Stockertown
      '18085', // Tatamy
      '18088', // Walnutport
      '18091', // Slate Belt, Wind Gap, Bushkill
    ],
  },
  // Pennsylvania — Allentown specific
  {
    slug: 'allentown-code-violations',
    name: 'Allentown Code Violations',
    type: 'import',
    connectorKind: 'code_violation',
    description: 'Open code enforcement cases from the City of Allentown.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'cross_reference',
    supportedZipCodes: ['18101', '18102', '18103', '18104', '18109'],
  },
  {
    slug: 'allentown-rental-licenses',
    name: 'Allentown Rental Licenses',
    type: 'lookup',
    connectorKind: 'rental_license',
    description: 'Active rental licenses from the City of Allentown.',
    regionSlug: 'lehigh-valley',
    enrichmentMode: 'live_lookup',
    supportedZipCodes: ['18101', '18102', '18103', '18104', '18109'],
  },
];

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
