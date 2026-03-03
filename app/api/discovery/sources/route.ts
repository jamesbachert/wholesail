import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDiscoveryCapableConnectors, getLookupConnectorsForRegion } from '@/lib/connectors';

// GET /api/discovery/sources?region=lehigh-valley — data source status for a region
// Returns discovery connectors (mode: 'discovery' or 'both') + enrichment connectors (lookup)
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

        // Get count of signals from this connector
        const signalCount = await prisma.discoverySignal.count({
          where: {
            connectorSlug: connector.slug,
            discoveredLead: { sourceRegion: region },
          },
        });

        return {
          name: connector.name,
          slug: connector.slug,
          description: connector.description,
          regionSlug: connector.regionSlug,
          mode: connector.mode,
          type: connector.type,
          signalCount,
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

    // Enrichment connectors (lookup-based)
    const lookupConnectors = getLookupConnectorsForRegion(region);

    const enrichmentSources = await Promise.all(
      lookupConnectors.map(async (connector) => {
        const lastSync = await prisma.dataSourceSync.findFirst({
          where: { connectorSlug: connector.slug, region },
          orderBy: { createdAt: 'desc' },
        });

        const signalCount = await prisma.discoverySignal.count({
          where: {
            connectorSlug: connector.slug,
            discoveredLead: { sourceRegion: region },
          },
        });

        return {
          name: connector.name,
          slug: connector.slug,
          description: connector.description,
          regionSlug: connector.regionSlug,
          mode: 'enrichment' as const,
          type: connector.type,
          signalCount,
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

    return NextResponse.json({ sources, enrichmentSources });
  } catch (error: any) {
    console.error('Discovery sources GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
