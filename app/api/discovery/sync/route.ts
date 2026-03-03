import { NextRequest, NextResponse } from 'next/server';
import {
  getDiscoveryConnector,
  getConnectorWithMode,
  parsedToDiscoveryRecords,
} from '@/lib/connectors';
import { discoverRecords } from '@/lib/connectors/discovery-engine';

// POST /api/discovery/sync — trigger a sync for a discovery connector
// Supports:
//   1. Pure discovery connectors (have their own sync() method)
//   2. Import connectors with mode 'discovery' (fetchAndParse → adapter → discoverRecords)
export async function POST(request: NextRequest) {
  try {
    const { connectorSlug } = await request.json();

    if (!connectorSlug) {
      return NextResponse.json({ error: 'connectorSlug is required' }, { status: 400 });
    }

    // Try pure discovery connector first
    const discoveryConnector = getDiscoveryConnector(connectorSlug);
    if (discoveryConnector) {
      console.log(`[Discovery Sync] Starting sync for ${discoveryConnector.name}...`);
      const result = await discoveryConnector.sync();
      return NextResponse.json(result);
    }

    // Try import connector with mode 'discovery' (uses fetchAndParse → adapter → discoverRecords)
    const registered = getConnectorWithMode(connectorSlug);
    if (registered && (registered.mode === 'discovery' || registered.mode === 'both')) {
      const connector = registered.connector;
      console.log(`[Discovery Sync] Starting discovery sync for import connector ${connector.name}...`);

      // Fetch and parse using the import connector's existing method
      const parsed = await connector.fetchAndParse();

      // Convert to discovery records via adapter
      const discoveryRecs = parsedToDiscoveryRecords(parsed, connectorSlug);

      // Feed into the generic discovery engine
      const result = await discoverRecords(connectorSlug, connector.regionSlug, discoveryRecs);

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown or non-discovery connector: ${connectorSlug}` }, { status: 404 });
  } catch (error: any) {
    console.error('Discovery sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
