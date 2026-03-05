import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConnectorCoverage } from '@/lib/connectors/coverage-registry';
import { enrichLeadWithConnector } from '@/lib/connectors/enrich-lead';
import { CrossReferenceResult } from '@/lib/connectors/cross-reference-engine';

const BULK_ENRICH_LIMIT = 50;

interface ConnectorSummary {
  slug: string;
  name: string;
  leadsChecked: number;
  found: number;
  signalsAdded: number;
  errors: number;
}

// POST /api/leads/bulk-enrich
// Runs selected connectors against multiple leads with server-side zip filtering.
export async function POST(request: NextRequest) {
  try {
    const { leadIds, connectorSlugs } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array is required' }, { status: 400 });
    }
    if (!connectorSlugs || !Array.isArray(connectorSlugs) || connectorSlugs.length === 0) {
      return NextResponse.json({ error: 'connectorSlugs array is required' }, { status: 400 });
    }
    if (leadIds.length > BULK_ENRICH_LIMIT) {
      return NextResponse.json(
        { error: `Maximum ${BULK_ENRICH_LIMIT} leads per batch` },
        { status: 400 }
      );
    }

    // Resolve connector coverage for each slug
    const connectorCoverages = connectorSlugs
      .map((slug) => ({ slug, coverage: getConnectorCoverage(slug) }))
      .filter((c): c is { slug: string; coverage: NonNullable<ReturnType<typeof getConnectorCoverage>> } =>
        c.coverage != null
      );

    if (connectorCoverages.length === 0) {
      return NextResponse.json({ error: 'No valid connectors provided' }, { status: 400 });
    }

    // Fetch all leads with their property zip codes
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: {
        id: true,
        property: { select: { zipCode: true } },
      },
    });

    // Build per-lead work plan: which connectors apply to each lead based on zip
    const leadWorkPlan = new Map<string, Array<{ slug: string; coverage: typeof connectorCoverages[0]['coverage'] }>>();
    let leadsSkipped = 0;

    for (const lead of leads) {
      const zip = lead.property?.zipCode;
      if (!zip) {
        leadsSkipped++;
        continue;
      }

      const applicableConnectors = connectorCoverages.filter((c) =>
        c.coverage.supportedZipCodes.includes(zip)
      );

      if (applicableConnectors.length === 0) {
        leadsSkipped++;
        continue;
      }

      leadWorkPlan.set(lead.id, applicableConnectors);
    }

    // Process leads sequentially to avoid hammering external APIs
    const connectorSummaries = new Map<string, ConnectorSummary>();
    const allErrors: Array<{ leadId: string; slug: string; error: string }> = [];
    let totalSignalsAdded = 0;

    // Initialize summaries
    for (const { slug, coverage } of connectorCoverages) {
      connectorSummaries.set(slug, {
        slug,
        name: coverage.name,
        leadsChecked: 0,
        found: 0,
        signalsAdded: 0,
        errors: 0,
      });
    }

    for (const [leadId, connectors] of leadWorkPlan) {
      const leadResults: CrossReferenceResult[] = [];

      for (const { slug, coverage } of connectors) {
        const result = await enrichLeadWithConnector(leadId, slug, coverage);
        leadResults.push(result);

        // Update connector summary
        const summary = connectorSummaries.get(slug)!;
        summary.leadsChecked++;
        if (result.found) summary.found++;
        summary.signalsAdded += result.signalsAdded;
        if (result.error) {
          summary.errors++;
          allErrors.push({ leadId, slug, error: result.error });
        }

        totalSignalsAdded += result.signalsAdded;
      }

      // Log enrichment results for this lead
      if (leadResults.length > 0) {
        await prisma.enrichmentLog.createMany({
          data: leadResults.map((r) => {
            const cov = getConnectorCoverage(r.slug);
            return {
              leadId,
              connectorSlug: r.slug,
              connectorName: r.name,
              enrichmentMode: cov?.enrichmentMode || 'unknown',
              found: r.found,
              signalsAdded: r.signalsAdded,
              error: r.error || null,
            };
          }),
        });
      }
    }

    return NextResponse.json({
      totalLeads: leads.length,
      leadsProcessed: leadWorkPlan.size,
      leadsSkipped,
      totalSignalsAdded,
      connectorResults: Array.from(connectorSummaries.values()),
      errors: allErrors.slice(0, 20), // Cap error details to avoid huge responses
    });
  } catch (error: any) {
    console.error('Bulk enrich API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
