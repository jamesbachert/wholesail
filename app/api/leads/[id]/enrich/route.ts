import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConnectorCoverage } from '@/lib/connectors/coverage-registry';
import { enrichLeadWithConnectors } from '@/lib/connectors/enrich-lead';

// POST /api/leads/[id]/enrich
// Runs selected connectors against a lead to enrich it with signals.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { connectorSlugs } = await request.json();

    if (!connectorSlugs || !Array.isArray(connectorSlugs) || connectorSlugs.length === 0) {
      return NextResponse.json({ error: 'connectorSlugs array is required' }, { status: 400 });
    }

    const { results, totalSignalsAdded } = await enrichLeadWithConnectors(id, connectorSlugs);

    // Log enrichment results for history
    if (results.length > 0) {
      await prisma.enrichmentLog.createMany({
        data: results.map((r) => {
          const coverage = getConnectorCoverage(r.slug);
          return {
            leadId: id,
            connectorSlug: r.slug,
            connectorName: r.name,
            enrichmentMode: coverage?.enrichmentMode || 'unknown',
            found: r.found,
            signalsAdded: r.signalsAdded,
            error: r.error || null,
          };
        }),
      });
    }

    return NextResponse.json({
      leadId: id,
      results,
      totalSignalsAdded,
    });
  } catch (error: any) {
    console.error('Enrich API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
