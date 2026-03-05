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
// Streams NDJSON progress events as each lead is enriched.
export async function POST(request: NextRequest) {
  // ── Validation (returns normal JSON errors before streaming starts) ──

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { leadIds, connectorSlugs } = body;

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
    .map((slug: string) => ({ slug, coverage: getConnectorCoverage(slug) }))
    .filter(
      (c: any): c is { slug: string; coverage: NonNullable<ReturnType<typeof getConnectorCoverage>> } =>
        c.coverage != null
    );

  if (connectorCoverages.length === 0) {
    return NextResponse.json({ error: 'No valid connectors provided' }, { status: 400 });
  }

  // ── Prep work (fetch leads, build work plan) ──

  let leads: Array<{ id: string; property: { zipCode: string | null; address: string | null } | null }>;
  try {
    leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: {
        id: true,
        property: { select: { zipCode: true, address: true } },
      },
    });
  } catch (error: any) {
    console.error('Bulk enrich API error fetching leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build per-lead work plan: which connectors apply to each lead based on zip
  const leadWorkPlan = new Map<
    string,
    Array<{ slug: string; coverage: (typeof connectorCoverages)[0]['coverage'] }>
  >();
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

  // Address lookup for progress events
  const leadAddressMap = new Map<string, string>();
  for (const lead of leads) {
    leadAddressMap.set(lead.id, lead.property?.address || 'Unknown address');
  }

  // ── Stream the enrichment as NDJSON ──

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      }

      try {
        // Initialize connector summaries
        const connectorSummaries = new Map<string, ConnectorSummary>();
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

        const allErrors: Array<{ leadId: string; slug: string; error: string }> = [];
        let totalSignalsAdded = 0;
        let leadsProcessed = 0;
        const leadsToProcess = leadWorkPlan.size;

        // Send start event
        send({
          type: 'start',
          totalLeads: leads.length,
          leadsToProcess,
          leadsSkipped,
        });

        // Process leads sequentially to avoid hammering external APIs
        for (const [leadId, connectors] of leadWorkPlan) {
          // Check for client abort between leads
          if (request.signal.aborted) break;

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

          leadsProcessed++;

          // Send progress event after each lead completes
          send({
            type: 'progress',
            leadsProcessed,
            leadsToProcess,
            totalSignalsAdded,
            currentAddress: leadAddressMap.get(leadId) || 'Unknown',
          });
        }

        // Send final complete event (same shape as old JSON response)
        send({
          type: 'complete',
          totalLeads: leads.length,
          leadsProcessed: leadWorkPlan.size,
          leadsSkipped,
          totalSignalsAdded,
          connectorResults: Array.from(connectorSummaries.values()),
          errors: allErrors.slice(0, 20),
        });

        controller.close();
      } catch (error: any) {
        console.error('Bulk enrich streaming error:', error);
        try {
          send({ type: 'error', error: error.message || 'Enrichment failed' });
        } catch {
          // Client may have disconnected — nothing we can do
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
