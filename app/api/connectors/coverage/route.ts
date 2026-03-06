import { NextRequest, NextResponse } from 'next/server';
import { getConnectorsForZip } from '@/lib/connectors/coverage-registry';
import { prisma } from '@/lib/prisma';

// GET /api/connectors/coverage?zip=18101
// Returns which connectors are available for a given zip code,
// including whether import connectors have existing data to cross-reference.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip');

    if (!zip) {
      return NextResponse.json({ error: 'zip parameter is required' }, { status: 400 });
    }

    let connectors = getConnectorsForZip(zip);

    if (connectors.length === 0) {
      return NextResponse.json({ connectors: [], zip });
    }

    // Filter out disabled connectors
    const regionSlugs = [...new Set(connectors.map((c) => c.regionSlug))];
    const regions = await prisma.region.findMany({
      where: { slug: { in: regionSlugs } },
      select: { id: true, slug: true },
    });
    const regionIdMap = new Map(regions.map((r) => [r.slug, r.id]));
    const disabledAssignments = await prisma.connectorRegionAssignment.findMany({
      where: { isEnabled: false },
      select: { connectorSlug: true, regionId: true },
    });
    const disabledSet = new Set(
      disabledAssignments.map((a) => `${a.connectorSlug}:${a.regionId}`)
    );
    connectors = connectors.filter((c) => {
      const regionId = regionIdMap.get(c.regionSlug);
      return !regionId || !disabledSet.has(`${c.slug}:${regionId}`);
    });

    // For import connectors (cross_reference mode), check if we have existing
    // SourceRecords for this zip so the UI can show "has data" indicators
    const importSlugs = connectors
      .filter((c) => c.enrichmentMode === 'cross_reference')
      .map((c) => c.slug);

    let sourceRecordCounts: Record<string, number> = {};

    if (importSlugs.length > 0) {
      // Get DataSource IDs for these slugs
      const dataSources = await prisma.dataSource.findMany({
        where: { slug: { in: importSlugs } },
        select: { id: true, slug: true },
      });

      if (dataSources.length > 0) {
        // Count SourceRecords by DataSource where linked property is in this zip
        const counts = await prisma.sourceRecord.groupBy({
          by: ['dataSourceId'],
          where: {
            dataSourceId: { in: dataSources.map((ds) => ds.id) },
            property: { zipCode: zip },
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

    // Build response
    const result = connectors.map((c) => ({
      slug: c.slug,
      name: c.name,
      type: c.type,
      connectorKind: c.connectorKind,
      description: c.description,
      enrichmentMode: c.enrichmentMode,
      hasExistingData: (sourceRecordCounts[c.slug] || 0) > 0,
      existingRecordCount: sourceRecordCounts[c.slug] || 0,
    }));

    result.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ connectors: result, zip });
  } catch (error: any) {
    console.error('Coverage API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
