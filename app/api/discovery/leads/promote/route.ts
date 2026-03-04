import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeAddress } from '@/lib/connectors/address-utils';
import { recalculateScore } from '@/lib/connectors/scoring';

// ============================================================
// Discovery Signal → Pipeline Signal Mapping
// Maps discovery signal types to pipeline LeadSignal types.
// ============================================================

interface SignalMapping {
  pipelineSignalType: string;
}

const SIGNAL_MAP: Record<string, SignalMapping> = {
  blight_certified:       { pipelineSignalType: 'code_violation' },
  blight_determined:      { pipelineSignalType: 'code_violation' },
  blight_criteria:        { pipelineSignalType: 'deferred_maintenance' },
  sheriff_sale:           { pipelineSignalType: 'pre_foreclosure' },
  code_violation:         { pipelineSignalType: 'code_violation' },
  tax_delinquent:         { pipelineSignalType: 'tax_delinquent' },
  absentee_owner:         { pipelineSignalType: 'absentee_owner' },
};

// Conditional mappings checked via signal details/value
const CONDITIONAL_MAPS: Array<{
  signalType: string;
  check: (signal: any) => boolean;
  pipelineSignalType: string;
}> = [
  {
    signalType: 'enforcement_notes',
    check: (s) => {
      const val = (s.value || '').toLowerCase();
      return val.includes('vacant') || val.includes('unoccupied') || val.includes('boarded');
    },
    pipelineSignalType: 'vacant',
  },
  {
    signalType: 'enforcement_notes',
    check: (s) => {
      const val = (s.value || '').toLowerCase();
      return val.includes('lien') || val.includes('fees due') || val.includes('rental fees');
    },
    pipelineSignalType: 'liens_judgments',
  },
  {
    signalType: 'blight_criteria',
    check: (s) => {
      const details = s.details as any;
      const criteriaList = details?.criteriaList || [];
      return criteriaList.includes('12');
    },
    pipelineSignalType: 'fire_flood_damage',
  },
];

const FALLBACK_WEIGHTS: Record<string, { label: string; weight: number; category: string }> = {
  code_violation:       { label: 'Code Violation',        weight: 22, category: 'distress' },
  deferred_maintenance: { label: 'Deferred Maintenance',  weight: 12, category: 'condition' },
  vacant:               { label: 'Vacant Property',       weight: 25, category: 'condition' },
  liens_judgments:      { label: 'Liens / Judgments',      weight: 18, category: 'distress' },
  fire_flood_damage:    { label: 'Fire / Flood Damage',   weight: 20, category: 'condition' },
  pre_foreclosure:      { label: 'Pre-Foreclosure',       weight: 30, category: 'distress' },
  tax_delinquent:       { label: 'Tax Delinquent',        weight: 15, category: 'financial' },
  absentee_owner:       { label: 'Absentee Owner',        weight: 22, category: 'ownership' },
};

/**
 * Derive pipeline signals from discovery signals (deduplicated by pipeline signal type).
 */
function deriveSignals(discoverySignals: any[]): Array<{ signalType: string; value: string; source: string }> {
  const mapped = new Map<string, { signalType: string; value: string; source: string }>();

  for (const ds of discoverySignals) {
    // Direct mapping
    const direct = SIGNAL_MAP[ds.signalType];
    if (direct && !mapped.has(direct.pipelineSignalType)) {
      mapped.set(direct.pipelineSignalType, {
        signalType: direct.pipelineSignalType,
        value: `${ds.label}: ${ds.value || ''}`.trim(),
        source: `Discovery: ${ds.connectorSlug}`,
      });
    }

    // Conditional mappings
    for (const cm of CONDITIONAL_MAPS) {
      if (ds.signalType === cm.signalType && cm.check(ds) && !mapped.has(cm.pipelineSignalType)) {
        mapped.set(cm.pipelineSignalType, {
          signalType: cm.pipelineSignalType,
          value: `${ds.label}: ${ds.value || ''}`.trim(),
          source: `Discovery: ${ds.connectorSlug}`,
        });
      }
    }
  }

  return Array.from(mapped.values());
}

// POST /api/discovery/leads/promote — promote discovered leads to the pipeline
export async function POST(request: NextRequest) {
  try {
    const { leadIds } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required' }, { status: 400 });
    }

    // Get scoring weights from DB
    const weights = await prisma.scoringWeight.findMany({ where: { isActive: true } });
    const weightMap = new Map(weights.map((w) => [w.signalType, w]));

    let promoted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const id of leadIds) {
      try {
        const discovered = await prisma.discoveredLead.findUnique({
          where: { id },
          include: { signals: true },
        });
        if (!discovered) {
          errors.push(`Lead ${id} not found`);
          continue;
        }

        if (discovered.status === 'in_pipeline') {
          skipped++;
          continue;
        }

        // Check for existing property by address
        const normalizedAddr = normalizeAddress(discovered.address);
        const existingProperty = await prisma.property.findFirst({
          where: {
            AND: [
              { city: { equals: discovered.city, mode: 'insensitive' } },
              { state: discovered.state },
            ],
            OR: [
              { address: { equals: discovered.address, mode: 'insensitive' } },
              { address: { equals: normalizedAddr, mode: 'insensitive' } },
            ],
          },
          include: { lead: true },
        });

        // Skip if already a lead in pipeline
        if (existingProperty?.lead) {
          await prisma.discoveredLead.update({
            where: { id },
            data: { status: 'in_pipeline', promotedLeadId: existingProperty.lead.id },
          });
          skipped++;
          continue;
        }

        // Look up region by zip code
        const region = await prisma.region.findFirst({
          where: { zipCodes: { has: discovered.zipCode || '' }, isActive: true },
        });

        if (!region) {
          errors.push(`${discovered.address}: No region for zip ${discovered.zipCode}`);
          continue;
        }

        // Derive county from region (first county in the list)
        const county = (region.counties as string[])?.[0] || region.state;

        // ============================================================
        // Extract property data from rawData
        // rawData is connector-agnostic: any connector can populate
        // these standardized keys and they'll flow into the Property.
        // ============================================================
        const raw = (discovered.rawData as Record<string, any>) || {};

        const isAbsentee = raw.isAbsenteeOwner === true || discovered.signals.some(
          (s) => s.signalType === 'absentee_owner'
        );

        // Parse mailing address — supports "STREET  CITY STATE ZIP" format (double-space separator)
        let ownerMailingAddress: string | undefined;
        let ownerCity: string | undefined;
        let ownerState: string | undefined;
        let ownerZip: string | undefined;
        if (raw.mailingAddress) {
          const fullMailing = (raw.mailingAddress as string).trim();
          const dblSpaceIdx = fullMailing.indexOf('  ');
          if (dblSpaceIdx > 0) {
            ownerMailingAddress = fullMailing.substring(0, dblSpaceIdx).trim();
            const rest = fullMailing.substring(dblSpaceIdx).trim();
            const zipMatch = rest.match(/(\d{5}(?:-\d{4})?)$/);
            if (zipMatch) {
              ownerZip = zipMatch[1];
              const beforeZip = rest.substring(0, rest.length - zipMatch[0].length).trim();
              const stateMatch = beforeZip.match(/\s([A-Z]{2})$/);
              if (stateMatch) {
                ownerState = stateMatch[1];
                ownerCity = beforeZip.substring(0, beforeZip.length - stateMatch[0].length).trim();
              } else {
                ownerCity = beforeZip;
              }
            } else {
              ownerCity = rest;
            }
          } else {
            ownerMailingAddress = fullMailing;
          }
        }

        // Create or reuse property
        const property = existingProperty || await prisma.property.create({
          data: {
            address: discovered.address,
            city: discovered.city,
            state: discovered.state,
            zipCode: discovered.zipCode || '',
            county,
            // Property details
            propertyType: raw.landUseDescription || discovered.propertyType || undefined,
            yearBuilt: discovered.yearBuilt || undefined,
            lotSize: raw.acreage ? Number(raw.acreage) : undefined,
            latitude: discovered.latitude || undefined,
            longitude: discovered.longitude || undefined,
            // Owner info
            ownerName: raw.ownerName || undefined,
            ownerMailingAddress,
            ownerCity,
            ownerState,
            ownerZip,
            isAbsenteeOwner: isAbsentee,
            // Valuation
            assessedValue: raw.assessedTotal ? Number(raw.assessedTotal) : undefined,
            // Flags
            hasCodeViolations: discovered.signals.some(
              (s) => ['blight_certified', 'blight_determined', 'code_violation'].includes(s.signalType)
            ),
          },
        });

        // Create lead
        const lead = await prisma.lead.create({
          data: {
            propertyId: property.id,
            regionId: region.id,
            status: 'NEW',
          },
        });

        // Map discovery signals → pipeline signals
        const pipelineSignals = deriveSignals(discovered.signals);

        // Get existing signal types on this lead (for dedup)
        const existingSignalTypes = new Set(
          (await prisma.leadSignal.findMany({
            where: { leadId: lead.id },
            select: { signalType: true },
          })).map((s) => s.signalType)
        );

        for (const sig of pipelineSignals) {
          if (existingSignalTypes.has(sig.signalType)) continue;

          const w = weightMap.get(sig.signalType);
          const fb = FALLBACK_WEIGHTS[sig.signalType];

          await prisma.leadSignal.create({
            data: {
              leadId: lead.id,
              signalType: sig.signalType,
              label: w?.label ?? fb?.label ?? sig.signalType,
              category: w?.category ?? fb?.category ?? 'distress',
              points: w?.weight ?? fb?.weight ?? 10,
              value: sig.value,
              source: sig.source,
              isAutomated: true,
              isLocked: true,
              isActive: true,
            },
          });
        }

        // Recalculate score
        await recalculateScore(lead.id);

        // Mark discovered lead as promoted
        await prisma.discoveredLead.update({
          where: { id },
          data: { status: 'in_pipeline', promotedLeadId: lead.id },
        });

        promoted++;
      } catch (err: any) {
        errors.push(`Lead ${id}: ${err.message}`);
      }
    }

    return NextResponse.json({ promoted, skipped, errors });
  } catch (error: any) {
    console.error('Promote error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
