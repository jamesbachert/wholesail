import { NextRequest, NextResponse } from 'next/server';
import { getConnectorWithMode, parsedToDiscoveryRecords } from '@/lib/connectors';
import { discoverRecords } from '@/lib/connectors/discovery-engine';

// POST /api/discovery/manual-import — import manually pasted data for a connector
export async function POST(request: NextRequest) {
  try {
    const { connectorSlug, data } = await request.json();

    if (!connectorSlug) {
      return NextResponse.json({ error: 'connectorSlug is required' }, { status: 400 });
    }
    if (!data || typeof data !== 'string' || data.trim().length === 0) {
      return NextResponse.json({ error: 'data is required (pasted text)' }, { status: 400 });
    }

    const registered = getConnectorWithMode(connectorSlug);
    if (!registered || registered.mode !== 'manual_import') {
      return NextResponse.json(
        { error: `Connector "${connectorSlug}" not found or does not support manual import` },
        { status: 404 }
      );
    }

    const connector = registered.connector;
    if (!connector.parseManualInput) {
      return NextResponse.json(
        { error: `Connector "${connectorSlug}" does not implement parseManualInput` },
        { status: 400 }
      );
    }

    console.log(`[Manual Import] Parsing pasted data for ${connector.name}...`);
    const parsed = connector.parseManualInput(data);

    if (parsed.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        newCount: 0,
        updatedCount: 0,
        errors: 0,
        errorMessages: ['No records could be parsed from the pasted data. Check the format and try again.'],
        duration: 0,
      });
    }

    // Convert to discovery records and feed into the discovery engine
    const discoveryRecs = parsedToDiscoveryRecords(parsed, connectorSlug);
    const result = await discoverRecords(connectorSlug, connector.regionSlug, discoveryRecs);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Manual import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
