import { NextRequest, NextResponse } from 'next/server';
import { getConnectorCoverage } from '@/lib/connectors/coverage-registry';
import { crossReferenceEnrich, CrossReferenceResult } from '@/lib/connectors/cross-reference-engine';
import { checkRentalLicense } from '@/lib/connectors/rental-lookup-engine';

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

    const results: CrossReferenceResult[] = [];

    for (const slug of connectorSlugs) {
      const coverage = getConnectorCoverage(slug);
      if (!coverage) {
        results.push({ slug, name: slug, found: false, signalsAdded: 0, error: 'Unknown connector' });
        continue;
      }

      if (coverage.enrichmentMode === 'live_lookup') {
        // Live lookup connectors (e.g. rental licenses)
        if (coverage.connectorKind === 'rental_license') {
          try {
            const result = await checkRentalLicense(id);
            results.push({
              slug,
              name: coverage.name,
              found: result.found,
              signalsAdded: result.found ? 1 : 0,
              error: result.error,
            });
          } catch (err: any) {
            results.push({ slug, name: coverage.name, found: false, signalsAdded: 0, error: err.message });
          }
        }
      } else if (coverage.enrichmentMode === 'cross_reference') {
        // Cross-reference against existing DataSourceRecords
        const result = await crossReferenceEnrich(id, slug);
        results.push(result);
      }
    }

    const totalSignals = results.reduce((sum, r) => sum + r.signalsAdded, 0);

    return NextResponse.json({
      leadId: id,
      results,
      totalSignalsAdded: totalSignals,
    });
  } catch (error: any) {
    console.error('Enrich API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
