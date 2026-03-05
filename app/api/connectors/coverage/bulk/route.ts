import { NextRequest, NextResponse } from 'next/server';
import { getConnectorsForZips } from '@/lib/connectors/coverage-registry';
import { prisma } from '@/lib/prisma';

// POST /api/connectors/coverage/bulk
// Returns which connectors are available for a set of zip codes,
// with lead counts per connector for bulk enrichment UI.
export async function POST(request: NextRequest) {
  try {
    const { zipCodes, leadCountsByZip } = await request.json();

    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      return NextResponse.json({ error: 'zipCodes array is required' }, { status: 400 });
    }

    const entries = getConnectorsForZips(zipCodes);

    // For cross-reference connectors, check if we have existing data
    const crossRefSlugs = entries
      .filter((e) => e.coverage.enrichmentMode === 'cross_reference')
      .map((e) => e.coverage.slug);

    let sourceRecordCounts: Record<string, number> = {};

    if (crossRefSlugs.length > 0) {
      const dataSources = await prisma.dataSource.findMany({
        where: { slug: { in: crossRefSlugs } },
        select: { id: true, slug: true },
      });

      if (dataSources.length > 0) {
        const counts = await prisma.sourceRecord.groupBy({
          by: ['dataSourceId'],
          where: {
            dataSourceId: { in: dataSources.map((ds) => ds.id) },
            property: { zipCode: { in: zipCodes } },
          },
          _count: true,
        });

        for (const count of counts) {
          const ds = dataSources.find((d) => d.id === count.dataSourceId);
          if (ds) {
            sourceRecordCounts[ds.slug] = count._count;
          }
        }
      }
    }

    // Build response with lead counts per connector
    const counts = leadCountsByZip || {};
    const connectors = entries.map((e) => {
      const matchingLeadCount = e.matchingZips.reduce(
        (sum: number, zip: string) => sum + (counts[zip] || 0),
        0
      );

      return {
        slug: e.coverage.slug,
        name: e.coverage.name,
        type: e.coverage.type,
        connectorKind: e.coverage.connectorKind,
        description: e.coverage.description,
        enrichmentMode: e.coverage.enrichmentMode,
        matchingZipCodes: e.matchingZips,
        matchingLeadCount,
        hasExistingData: (sourceRecordCounts[e.coverage.slug] || 0) > 0,
      };
    });

    // Sort by matching lead count descending
    connectors.sort((a, b) => b.matchingLeadCount - a.matchingLeadCount);

    return NextResponse.json({ connectors });
  } catch (error: any) {
    console.error('Bulk coverage API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
