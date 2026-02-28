import { NextRequest, NextResponse } from 'next/server';
import { getConnectorInfo } from '@/lib/connectors';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const regionSlug = searchParams.get('region') || undefined;

    // Get registered connectors, optionally filtered by region
    let connectors = getConnectorInfo();
    if (regionSlug) {
      connectors = connectors.filter((c) => c.regionSlug === regionSlug);
    }

    // Get data source records from DB for status info
    const dataSources = await prisma.dataSource.findMany({
      include: {
        region: true,
        _count: { select: { records: true } },
      },
    });

    // Merge connector info with DB status
    const result = connectors.map((c) => {
      const ds = dataSources.find((d) => d.slug === c.slug);
      return {
        ...c,
        status: ds?.status || 'PENDING',
        lastRun: ds?.lastRun || null,
        lastSuccess: ds?.lastSuccess || null,
        recordsFound: ds?.recordsFound || 0,
        errorMessage: ds?.errorMessage || null,
        regionName: ds?.region?.name || null,
      };
    });

    return NextResponse.json({ connectors: result });
  } catch (error: any) {
    console.error('Error fetching connector status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
