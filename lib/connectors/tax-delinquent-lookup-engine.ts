import { prisma } from '../prisma';
import { getLookupConnectorForZip } from './lookup-registry';
import { recalculateScore } from './scoring';
import { flagTimeSensitiveIfNewDistress } from './flag-time-sensitive';
import { flagArchivedLeadIfNewSignal } from './flag-archived-reactivation';
import { TaxDelinquentLookupResult } from './lookup-types';
import { LehighEliteRevenueTaxConnector } from './pa/lehigh-valley/elite-revenue-tax-lookup';

// ============================================================
// TAX DELINQUENT LOOKUP ENGINE
// Checks individual leads against tax delinquent databases
// (e.g. Elite Revenue Solutions for Lehigh County).
// Creates/updates tax_delinquent signals with dollar amounts.
//
// Parcel number resolution:
//   Property model has no parcelNumber field, but imported
//   SourceRecords store it in rawData.parcelNumber. We check
//   SourceRecords first for a reliable parcel-based lookup,
//   falling back to address-based search when unavailable.
// ============================================================

export interface TaxDelinquentCheckResult {
  found: boolean;
  totalDelinquent?: number;
  yearsDelinquent?: number[];
  parcelNumber?: string;
  error?: string;
}

/**
 * Elite Revenue parcel format: NN-NNNNNNNNNNNN-NNNNNNN
 * (2-digit district, dash, 12+ digit parcel, dash, 7-digit sequence)
 *
 * Different connectors store parcels in different formats:
 *   - Upset sale / Repository: full format (e.g. "01-546374239647-0000001") ✅
 *   - Sheriff sales: raw format  (e.g. "549791044641 1")            ❌
 * We only use parcels that match the Elite Revenue format for
 * direct lookup; others fall back to address-based search.
 */
const ELITE_REVENUE_PARCEL_RE = /^\d{2}-\d{12,}-\d{7}$/;

/**
 * Try to find a parcel number from the property's SourceRecords.
 * Connectors like sheriff sales, upset sale, and tax repository
 * store parcelNumber in rawData when they import records.
 * Only returns parcels in the full Elite Revenue format.
 */
async function findParcelFromSourceRecords(
  propertyId: string
): Promise<string | null> {
  const sourceRecords = await prisma.sourceRecord.findMany({
    where: { propertyId },
    select: { rawData: true },
    take: 10,
  });

  for (const record of sourceRecords) {
    const rawData = record.rawData as Record<string, any> | null;
    if (rawData?.parcelNumber && typeof rawData.parcelNumber === 'string') {
      const parcel = rawData.parcelNumber.trim();
      // Only use parcels in the full Elite Revenue format
      if (ELITE_REVENUE_PARCEL_RE.test(parcel)) {
        return parcel;
      }
    }
  }

  return null;
}

export async function checkTaxDelinquent(
  leadId: string
): Promise<TaxDelinquentCheckResult> {
  // 1. Get the lead with property and existing signals
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { property: true, signals: true },
  });

  if (!lead || !lead.property) {
    return { found: false, error: 'Lead or property not found' };
  }

  const { property } = lead;
  const zipCode = property.zipCode;

  // 2. Find the right connector for this zip
  const connector = getLookupConnectorForZip(zipCode, 'tax_delinquent');
  if (!connector) {
    return {
      found: false,
      error: `No tax delinquent connector supports zip code ${zipCode}`,
    };
  }

  // 3. Try to find a parcel number from imported SourceRecords
  let result: TaxDelinquentLookupResult;
  const parcelNumber = await findParcelFromSourceRecords(property.id);

  if (
    parcelNumber &&
    connector instanceof LehighEliteRevenueTaxConnector
  ) {
    // Parcel-based lookup — more reliable
    result = await connector.lookupByParcel(parcelNumber);
  } else {
    // Address-based lookup — works for all leads
    result = (await connector.lookupByAddress(
      property.address,
      zipCode
    )) as TaxDelinquentLookupResult;
  }

  if (result.found && result.totalDelinquent && result.totalDelinquent > 0) {
    // 4. Build signal value text
    const years =
      result.delinquentYears?.map((y) => y.year).sort() || [];
    const yearText = years.length > 0 ? ` (${years.join(', ')})` : '';
    const signalValue = `Delinquent taxes: $${result.totalDelinquent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${yearText}`;

    // 5. Get scoring weight from database
    const weightDef = await prisma.scoringWeight.findUnique({
      where: { signalType: 'tax_delinquent' },
    });
    const points = weightDef?.weight ?? 32;

    // 6. Check for existing tax_delinquent signal (dedup)
    const existingSignal = lead.signals.find(
      (s) => s.signalType === 'tax_delinquent'
    );

    if (!existingSignal) {
      await prisma.leadSignal.create({
        data: {
          leadId: lead.id,
          signalType: 'tax_delinquent',
          label: 'Tax Delinquent',
          category: weightDef?.category ?? 'distress',
          points,
          value: signalValue,
          source: 'Lehigh County Tax Claim Bureau (Elite Revenue)',
          isAutomated: true,
          isLocked: true,
          isActive: true,
          eventDate: null, // Ongoing — no single event date
        },
      });

      // Flag lead as time-sensitive for new distress signal
      await flagTimeSensitiveIfNewDistress(
        lead.id,
        weightDef?.category ?? 'distress',
        'Tax Delinquent',
        signalValue,
        'tax_delinquent',
      );

      // Flag archived leads for reactivation review
      await flagArchivedLeadIfNewSignal(lead.id, 'Tax Delinquent');
    } else {
      // Update existing signal with fresh data
      await prisma.leadSignal.update({
        where: { id: existingSignal.id },
        data: {
          value: signalValue,
          isActive: true,
          isLocked: true,
          isAutomated: true,
          points,
        },
      });
    }

    // 7. If we got owner name and property doesn't have one, save it
    if (result.ownerName && !property.ownerName) {
      await prisma.property.update({
        where: { id: property.id },
        data: { ownerName: result.ownerName },
      });
    }

    // 8. Recalculate lead score
    await recalculateScore(lead.id);

    // 9. Update activity timestamps
    const now = new Date();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: now, lastSignalAt: now },
    });

    return {
      found: true,
      totalDelinquent: result.totalDelinquent,
      yearsDelinquent: years,
      parcelNumber: result.parcelNumber,
    };
  }

  // Not found — no delinquent taxes
  return { found: false };
}
