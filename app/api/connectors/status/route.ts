import { NextRequest, NextResponse } from 'next/server';
import { getConnectorInfo } from '@/lib/connectors';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const regionSlug = searchParams.get('region') || undefined;

    // Get all registered connectors
    let connectors = getConnectorInfo();

    // Build a map of connector slug → isEnabled from assignments
    let enabledMap = new Map<string, boolean>();

    if (regionSlug) {
      // Filter to connectors matching this region
      connectors = connectors.filter((c) => c.regionSlug === regionSlug);

      const region = await prisma.region.findUnique({
        where: { slug: regionSlug },
      });

      if (region) {
        // Get all assignments for this region (enabled and disabled)
        const assignments = await prisma.connectorRegionAssignment.findMany({
          where: { regionId: region.id },
        });
        for (const a of assignments) {
          enabledMap.set(a.connectorSlug, a.isEnabled);
        }
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
      // Default to enabled if no assignment exists
      const isEnabled = enabledMap.has(c.slug) ? enabledMap.get(c.slug)! : true;
      return {
        ...c,
        isEnabled,
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
