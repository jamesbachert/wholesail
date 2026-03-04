import { prisma } from '../prisma';
import { normalizeAddress } from './address-utils';
import { recalculateScore } from './scoring';
import { syncPropertyFlags } from './import-engine';
import { getConnectorCoverage } from './coverage-registry';

// ============================================================
// CROSS-REFERENCE ENRICHMENT ENGINE
// Searches existing DataSourceRecords for address matches
// and attaches their signals to a manually-created lead.
// Used when the user selects import connectors during lead entry.
// ============================================================

export interface CrossReferenceResult {
  slug: string;
  name: string;
  found: boolean;
  signalsAdded: number;
  error?: string;
}

// Signal definitions per connector kind — what signal to create when matched
const SIGNAL_MAP: Record<string, {
  signalType: string;
  label: string;
  category: string;
  defaultPoints: number;
  buildValue: (rawData: Record<string, any>) => string;
  buildSource: () => string;
  isStackable?: boolean;
}> = {
  sheriff_sale: {
    signalType: 'pre_foreclosure',
    label: 'Pre-Foreclosure',
    category: 'automated',
    defaultPoints: 20,
    buildValue: (raw) => {
      const date = raw.salesDate || raw.saleDate;
      return date ? `Sheriff sale scheduled ${date}` : 'Sheriff sale scheduled';
    },
    buildSource: () => 'Cross-reference enrichment',
  },
  tax_delinquent: {
    signalType: 'tax_delinquent',
    label: 'Tax Delinquent',
    category: 'automated',
    defaultPoints: 18,
    buildValue: (raw) => {
      const date = raw.dateAdded;
      return date
        ? `In repository since ${date}`
        : 'In tax claim repository — years of unpaid taxes';
    },
    buildSource: () => 'Cross-reference enrichment',
  },
  code_violation: {
    signalType: 'code_violation',
    label: 'Code Violation',
    category: 'automated',
    defaultPoints: 22,
    isStackable: true,
    buildValue: (raw) => {
      const parts: string[] = [];
      if (raw.caseNumber) parts.push(raw.caseNumber);
      if (raw.status) parts.push(raw.status);
      return parts.length > 0 ? parts.join(' · ') : 'Code violation on record';
    },
    buildSource: () => 'Cross-reference enrichment',
  },
};

export async function crossReferenceEnrich(
  leadId: string,
  dataSourceSlug: string
): Promise<CrossReferenceResult> {
  const coverage = getConnectorCoverage(dataSourceSlug);
  const connectorName = coverage?.name || dataSourceSlug;

  try {
    // 1. Get the lead and its property
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { property: true, signals: true },
    });

    if (!lead || !lead.property) {
      return { slug: dataSourceSlug, name: connectorName, found: false, signalsAdded: 0, error: 'Lead or property not found' };
    }

    // 2. Get the DataSource record
    const dataSource = await prisma.dataSource.findUnique({
      where: { slug: dataSourceSlug },
    });

    if (!dataSource) {
      return { slug: dataSourceSlug, name: connectorName, found: false, signalsAdded: 0, error: 'Data source not found — run the connector import first' };
    }

    // 3. Search for matching SourceRecords by address
    const normalizedAddr = normalizeAddress(lead.property.address);

    // First: check if SourceRecords are already linked to this property
    let matchingRecords = await prisma.sourceRecord.findMany({
      where: {
        dataSourceId: dataSource.id,
        propertyId: lead.propertyId,
      },
    });

    // If not found via property link, search by address text through linked properties
    if (matchingRecords.length === 0) {
      matchingRecords = await prisma.sourceRecord.findMany({
        where: {
          dataSourceId: dataSource.id,
          property: {
            AND: [
              { city: { equals: lead.property.city, mode: 'insensitive' } },
              { state: lead.property.state },
            ],
            OR: [
              { address: { equals: lead.property.address, mode: 'insensitive' } },
              { address: { equals: normalizedAddr, mode: 'insensitive' } },
            ],
          },
        },
      });

      // Link found records to this property for future lookups
      if (matchingRecords.length > 0) {
        await prisma.sourceRecord.updateMany({
          where: { id: { in: matchingRecords.map((r) => r.id) } },
          data: { propertyId: lead.propertyId },
        });
      }
    }

    if (matchingRecords.length === 0) {
      return { slug: dataSourceSlug, name: connectorName, found: false, signalsAdded: 0 };
    }

    // 4. Extract signals from rawData
    const signalDef = coverage ? SIGNAL_MAP[coverage.connectorKind] : undefined;
    if (!signalDef) {
      return { slug: dataSourceSlug, name: connectorName, found: true, signalsAdded: 0, error: 'No signal mapping for this connector kind' };
    }

    // Get scoring weight from database
    const weightDef = await prisma.scoringWeight.findUnique({
      where: { signalType: signalDef.signalType },
    });
    const basePoints = weightDef?.weight ?? signalDef.defaultPoints;

    let signalsAdded = 0;

    for (const record of matchingRecords) {
      const rawData = record.rawData as Record<string, any>;
      const signalValue = signalDef.buildValue(rawData);

      // Dedup check: for stackable types, match by active value; for others, match by type (any state)
      const existingSignal = signalDef.isStackable
        ? lead.signals.find(
            (s) => s.signalType === signalDef.signalType && s.value === signalValue && s.isActive
          )
        : lead.signals.find(
            (s) => s.signalType === signalDef.signalType
          );

      if (!existingSignal) {
        // For stackable signals, additional ones get 0 points (bonus handled in scoring)
        const existingCount = lead.signals.filter(
          (s) => s.signalType === signalDef.signalType && s.isActive
        ).length;
        const points = (signalDef.isStackable && existingCount > 0) ? 0 : basePoints;

        await prisma.leadSignal.create({
          data: {
            leadId: lead.id,
            signalType: signalDef.signalType,
            label: signalDef.label,
            category: weightDef?.category ?? signalDef.category,
            points,
            value: signalValue,
            source: signalDef.buildSource(),
            isAutomated: true,
            isLocked: true,
            isActive: true,
            eventDate: rawData.salesDate
              ? new Date(rawData.salesDate)
              : rawData.openedDate
                ? new Date(rawData.openedDate)
                : null,
          },
        });
        signalsAdded++;

        // Keep signals list in sync for dedup within the same batch
        lead.signals.push({
          signalType: signalDef.signalType,
          value: signalValue,
          isActive: true,
        } as any);
      } else if (!existingSignal.isActive) {
        // Reactivate previously deactivated non-stackable signal
        await prisma.leadSignal.update({
          where: { id: (existingSignal as any).id },
          data: { isActive: true, value: signalValue, points: basePoints },
        });
        existingSignal.isActive = true;
        signalsAdded++;
      }

      // Non-stackable: only process the first matching record
      if (!signalDef.isStackable && signalsAdded > 0) break;
    }

    // 5. Recalculate score and sync property flags if we added signals
    if (signalsAdded > 0) {
      await recalculateScore(lead.id);
      await syncPropertyFlags(lead.propertyId, [{ signalType: signalDef.signalType }]);

      // Update activity timestamps
      const now = new Date();
      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastActivityAt: now, lastSignalAt: now },
      });
    }

    return { slug: dataSourceSlug, name: connectorName, found: true, signalsAdded };
  } catch (err: any) {
    console.error(`[CrossRef] Error enriching lead ${leadId} with ${dataSourceSlug}:`, err.message);
    return { slug: dataSourceSlug, name: connectorName, found: false, signalsAdded: 0, error: err.message };
  }
}
