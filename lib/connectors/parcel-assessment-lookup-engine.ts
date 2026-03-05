import { prisma } from '../prisma';
import { getLookupConnectorForZip } from './lookup-registry';
import { recalculateScore } from './scoring';
import { ParcelAssessmentLookupResult } from './lookup-types';

// ============================================================
// PARCEL ASSESSMENT LOOKUP ENGINE
// Generic enrichment engine for parcel assessment connectors.
// Any connector that returns ParcelAssessmentLookupResult can
// populate these fields — Berks County, Lehigh County, etc.
// ============================================================

export interface ParcelAssessmentCheckResult {
  found: boolean;
  parcelId?: string;
  ownerName?: string;
  isAbsenteeOwner?: boolean;
  assessedValue?: number;
  propertyType?: string;
  error?: string;
}

export async function checkParcelAssessment(leadId: string): Promise<ParcelAssessmentCheckResult> {
  // Get the lead with property
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { property: true, signals: true },
  });

  if (!lead || !lead.property) {
    return { found: false, error: 'Lead or property not found' };
  }

  const { property } = lead;
  const zipCode = property.zipCode;

  // Find the right connector for this zip
  const connector = getLookupConnectorForZip(zipCode, 'parcel_assessment');
  if (!connector) {
    return { found: false, error: `No parcel assessment connector supports zip code ${zipCode}` };
  }

  // Look up the address
  const result = (await connector.lookupByAddress(property.address, zipCode)) as ParcelAssessmentLookupResult;

  if (!result.found) {
    return { found: false };
  }

  // ============================================================
  // Map lookup result → Property fields
  // Only overwrite if the lookup has a value and the property
  // field is empty (don't clobber user-edited data).
  // ============================================================
  const propertyUpdates: Record<string, any> = {};

  // Owner information
  if (result.ownerName && !property.ownerName) {
    propertyUpdates.ownerName = result.ownerName;
  }
  if (result.ownerMailingAddress && !property.ownerMailingAddress) {
    propertyUpdates.ownerMailingAddress = result.ownerMailingAddress;
  }
  if (result.ownerCity && !property.ownerCity) {
    propertyUpdates.ownerCity = result.ownerCity;
  }
  if (result.ownerState && !property.ownerState) {
    propertyUpdates.ownerState = result.ownerState;
  }
  if (result.ownerZip && !property.ownerZip) {
    propertyUpdates.ownerZip = result.ownerZip;
  }
  if (result.isAbsenteeOwner != null) {
    propertyUpdates.isAbsenteeOwner = result.isAbsenteeOwner;
  }

  // Property details
  if (result.propertyType && !property.propertyType) {
    propertyUpdates.propertyType = result.propertyType;
  }
  if (result.acreage != null && !property.lotSize) {
    propertyUpdates.lotSize = result.acreage;
  }

  // Valuation
  if (result.assessedValue != null) {
    propertyUpdates.assessedValue = result.assessedValue;
  }

  // Purchase/deed info
  if (result.lastSaleDate && !property.purchaseDate) {
    propertyUpdates.purchaseDate = new Date(result.lastSaleDate);
  }
  if (result.lastSalePrice != null && !property.purchasePrice) {
    propertyUpdates.purchasePrice = result.lastSalePrice;
  }
  if (result.deedBook && !property.deedBook) {
    propertyUpdates.deedBook = result.deedBook;
  }
  if (result.deedPage && !property.deedPage) {
    propertyUpdates.deedPage = result.deedPage;
  }

  // Parcel ID
  if (result.parcelId) {
    propertyUpdates.parcelNumber = result.parcelId;
  }

  if (Object.keys(propertyUpdates).length > 0) {
    await prisma.property.update({
      where: { id: property.id },
      data: propertyUpdates,
    });
  }

  // If absentee owner detected, create/update signal
  if (result.isAbsenteeOwner) {
    const weightDef = await prisma.scoringWeight.findUnique({
      where: { signalType: 'absentee_owner' },
    });
    const points = weightDef?.weight ?? 22;

    const existingSignal = lead.signals.find(
      (s) => s.signalType === 'absentee_owner' && s.isActive
    );

    // Build a descriptive signal value from parsed mailing components
    const mailingParts = [result.ownerMailingAddress, result.ownerCity, result.ownerState, result.ownerZip]
      .filter(Boolean);
    const signalValue = mailingParts.length > 0
      ? `Mailing: ${mailingParts.join(', ')}`
      : 'Mailing address differs from site address';

    if (!existingSignal) {
      await prisma.leadSignal.create({
        data: {
          leadId: lead.id,
          signalType: 'absentee_owner',
          label: 'Absentee Owner',
          category: weightDef?.category ?? 'ownership',
          points,
          value: signalValue,
          source: connector.name,
          isAutomated: true,
          isLocked: true,
          isActive: true,
        },
      });
    } else {
      // Re-lock and re-mark as automated since this is a fresh enrichment result
      await prisma.leadSignal.update({
        where: { id: existingSignal.id },
        data: { value: signalValue, isActive: true, isLocked: true, isAutomated: true, points },
      });
    }

    // Recalculate lead score
    await recalculateScore(lead.id);

    // Update lead activity timestamps
    const now = new Date();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: now, lastSignalAt: now },
    });
  }

  return {
    found: true,
    parcelId: result.parcelId,
    ownerName: result.ownerName,
    isAbsenteeOwner: result.isAbsenteeOwner,
    assessedValue: result.assessedValue,
    propertyType: result.propertyType,
  };
}
