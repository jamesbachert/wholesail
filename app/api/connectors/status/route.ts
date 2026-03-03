import { NextRequest, NextResponse } from 'next/server';
import { getConnectorInfo } from '@/lib/connectors';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const regionSlug = searchParams.get('region') || undefined;

    // Get all registered connectors
    let connectors = getConnectorInfo();

    // Filter by region assignments from the database (if region specified)
    if (regionSlug) {
      const region = await prisma.region.findUnique({
        where: { slug: regionSlug },
      });

      if (region) {
        // Get enabled connector-region assignments for this region
        const assignments = await prisma.connectorRegionAssignment.findMany({
          where: { regionId: region.id, isEnabled: true },
        });
        const enabledSlugs = new Set(assignments.map((a) => a.connectorSlug));

        // Filter to only connectors assigned to this region
        connectors = connectors.filter((c) => enabledSlugs.has(c.slug));
      }
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

    result.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ connectors: result });
  } catch (error: any) {
    console.error('Error fetching connector status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
