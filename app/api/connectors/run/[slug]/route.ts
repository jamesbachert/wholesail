import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/connectors';
import { importRecords } from '@/lib/connectors/import-engine';
import { NorthamptonSheriffSalesConnector } from '@/lib/connectors/northampton-sheriff-sales';

// Secret key to prevent unauthorized triggers
const CONNECTOR_SECRET = process.env.CONNECTOR_SECRET || 'wholesail-run-2026';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Check authorization
    const authHeader = request.headers.get('x-connector-secret');
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get('secret');

    if (authHeader !== CONNECTOR_SECRET && querySecret !== CONNECTOR_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the connector
    const connector = getConnector(slug);
    if (!connector) {
      return NextResponse.json(
        { error: `Unknown connector: ${slug}` },
        { status: 404 }
      );
    }

    console.log(`[Connector] Running: ${connector.name}`);

    let records;

    // Check if manual data was provided in the body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // No JSON body — that's fine for auto-fetch connectors
    }

    if (body.data && connector instanceof NorthamptonSheriffSalesConnector) {
      // Manual import mode for Northampton
      console.log(`[Connector] Manual import mode for ${connector.name}`);
      records = connector.parseManualInput(body.data);
    } else {
      // Auto-fetch mode
      records = await connector.fetchAndParse();
    }

    console.log(`[Connector] Parsed ${records.length} records from ${connector.name}`);

    // Import into database
    const result = await importRecords(records, slug);
    console.log(
      `[Connector] Import complete: ${result.newLeads} new, ${result.updatedLeads} updated, ${result.errors} errors (${result.duration}ms)`
    );

    return NextResponse.json({
      connector: connector.name,
      ...result,
    });
  } catch (error: any) {
    console.error('[Connector] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Connector failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for cron services
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return POST(request, { params });
}
