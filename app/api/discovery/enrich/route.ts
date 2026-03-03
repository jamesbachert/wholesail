import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLookupConnector } from '@/lib/connectors';
import { calculateDiscoveryScore } from '@/lib/connectors/discovery-scoring';

// POST /api/discovery/enrich — run enrichment (lookup) connector against existing leads
export async function POST(request: NextRequest) {
  try {
    const { connectorSlug, leadIds } = await request.json();

    if (!connectorSlug) {
      return NextResponse.json({ error: 'connectorSlug is required' }, { status: 400 });
    }

    const connector = getLookupConnector(connectorSlug);
    if (!connector) {
      return NextResponse.json({ error: `Unknown lookup connector: ${connectorSlug}` }, { status: 404 });
    }

    const region = connector.regionSlug;
    const start = Date.now();

    // Create sync record for tracking
    const syncRecord = await prisma.dataSourceSync.create({
      data: {
        connectorSlug,
        region,
        status: 'syncing',
      },
    });

    // Find leads to enrich: in supported zip codes, not already enriched by this connector
    const alreadyEnriched = await prisma.discoverySignal.findMany({
      where: { connectorSlug },
      select: { discoveredLeadId: true },
    });
    const enrichedIds = new Set(alreadyEnriched.map((s) => s.discoveredLeadId));

    const whereClause: any = {
      sourceRegion: region,
      zipCode: { in: connector.supportedZipCodes },
    };
    if (leadIds?.length) {
      whereClause.id = { in: leadIds };
    }

    const leads = await prisma.discoveredLead.findMany({
      where: whereClause,
      select: { id: true, address: true, zipCode: true },
    });

    // Filter out already-enriched leads (unless specific leadIds were requested for re-enrichment)
    const toEnrich = leadIds?.length
      ? leads
      : leads.filter((l) => !enrichedIds.has(l.id));

    let enrichedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const lead of toEnrich) {
      try {
        const result = await connector.lookupByAddress(lead.address, lead.zipCode || '');

        if (!result.found) {
          // No license found — add a "no rental license" signal for leads in supported zips
          await prisma.discoverySignal.upsert({
            where: {
              discoveredLeadId_connectorSlug_signalType: {
                discoveredLeadId: lead.id,
                connectorSlug,
                signalType: 'no_rental_license',
              },
            },
            create: {
              discoveredLeadId: lead.id,
              connectorSlug,
              signalType: 'no_rental_license',
              label: 'No Rental License',
              category: 'condition',
              points: 0,
              value: 'No active rental license found in city records',
            },
            update: {
              lastSeenAt: new Date(),
            },
          });
          enrichedCount++;
        } else {
          // Determine if active or expired (cast to any since result type varies by connector)
          const r = result as any;
          const isExpired = r.expirationDate && r.expirationDate < new Date();
          const signalType = isExpired ? 'rental_license_expired' : 'rental_license';
          const label = isExpired ? 'Expired Rental License' : 'Active Rental License';
          const points = isExpired ? 12 : 8;

          const valueParts = [
            r.licenseNumber ? `License #${r.licenseNumber}` : null,
            r.expirationDate ? `Expires ${r.expirationDate.toLocaleDateString()}` : null,
            r.numberOfUnits ? `${r.numberOfUnits} unit${r.numberOfUnits !== 1 ? 's' : ''}` : null,
            r.status ? `Status: ${r.status}` : null,
          ].filter(Boolean);

          await prisma.discoverySignal.upsert({
            where: {
              discoveredLeadId_connectorSlug_signalType: {
                discoveredLeadId: lead.id,
                connectorSlug,
                signalType,
              },
            },
            create: {
              discoveredLeadId: lead.id,
              connectorSlug,
              signalType,
              label,
              category: isExpired ? 'distress' : 'condition',
              points,
              value: valueParts.join(' · '),
              details: {
                licenseNumber: r.licenseNumber,
                expirationDate: r.expirationDate?.toISOString(),
                issuedDate: r.issuedDate?.toISOString(),
                status: r.status,
                numberOfUnits: r.numberOfUnits,
                parcelNumber: r.parcelNumber,
              },
            },
            update: {
              label,
              category: isExpired ? 'distress' : 'condition',
              points,
              value: valueParts.join(' · '),
              details: {
                licenseNumber: r.licenseNumber,
                expirationDate: r.expirationDate?.toISOString(),
                issuedDate: r.issuedDate?.toISOString(),
                status: r.status,
                numberOfUnits: r.numberOfUnits,
                parcelNumber: r.parcelNumber,
              },
              lastSeenAt: new Date(),
            },
          });
          enrichedCount++;
        }

        // Recalculate score for this lead
        const allSignals = await prisma.discoverySignal.findMany({
          where: { discoveredLeadId: lead.id },
        });
        // Only count connectors that contributed real (non-zero) signals toward sourceCount
        // so informational-only lookups (e.g. "no rental license") don't inflate cross-source bonuses
        const distinctSlugs = new Set(
          allSignals.filter((s) => s.points > 0).map((s) => s.connectorSlug)
        );
        const sourceCount = distinctSlugs.size;
        const discoveryScore = calculateDiscoveryScore(allSignals, sourceCount);

        await prisma.discoveredLead.update({
          where: { id: lead.id },
          data: { sourceCount, discoveryScore },
        });
      } catch (err: any) {
        errorCount++;
        errors.push(`${lead.address}: ${err.message}`);
      }
    }

    skippedCount = leads.length - toEnrich.length;
    const duration = Date.now() - start;

    // Update sync record
    await prisma.dataSourceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: errorCount > 0 && enrichedCount === 0 ? 'error' : 'success',
        recordCount: toEnrich.length,
        newCount: enrichedCount,
        updatedCount: 0,
        completedAt: new Date(),
        errorMessage: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      },
    });

    console.log(
      `[Enrichment] ${connectorSlug}: ${enrichedCount} enriched, ${skippedCount} skipped, ${errorCount} errors (${duration}ms)`
    );

    return NextResponse.json({
      success: true,
      enrichedCount,
      skippedCount,
      errorCount,
      errorMessages: errors.slice(0, 5),
      duration,
    });
  } catch (error: any) {
    console.error('Enrichment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
