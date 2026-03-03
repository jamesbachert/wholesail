import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDiscoveryCapableConnectors } from '@/lib/connectors';

// GET /api/discovery/sources?region=lehigh-valley — data source status for a region
// Returns all connectors that can feed Discovery (mode: 'discovery' or 'both')
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'lehigh-valley';

    const connectors = getDiscoveryCapableConnectors(region);

    const sources = await Promise.all(
      connectors.map(async (connector) => {
        // Get latest sync
        const lastSync = await prisma.dataSourceSync.findFirst({
          where: { connectorSlug: connector.slug, region },
          orderBy: { createdAt: 'desc' },
        });

        // Get total discovered leads count for this region
        const recordCount = await prisma.discoveredLead.count({
          where: { sourceRegion: region },
        });

        // Get count of signals from this connector
        const signalCount = await prisma.discoverySignal.count({
          where: {
            connectorSlug: connector.slug,
            discoveredLead: { sourceRegion: region },
          },
        });

        // Get status counts
        const statusCounts = await prisma.discoveredLead.groupBy({
          by: ['status'],
          where: { sourceRegion: region },
          _count: true,
        });

        const counts: Record<string, number> = {};
        for (const sc of statusCounts) {
          counts[sc.status] = sc._count;
        }

        return {
          name: connector.name,
          slug: connector.slug,
          description: connector.description,
          regionSlug: connector.regionSlug,
          mode: connector.mode,
          type: connector.type,
          recordCount,
          signalCount,
          statusCounts: counts,
          lastSync: lastSync
            ? {
                status: lastSync.status,
                recordCount: lastSync.recordCount,
                newCount: lastSync.newCount,
                updatedCount: lastSync.updatedCount,
                errorMessage: lastSync.errorMessage,
                startedAt: lastSync.startedAt,
                completedAt: lastSync.completedAt,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ sources });
  } catch (error: any) {
    console.error('Discovery sources GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
