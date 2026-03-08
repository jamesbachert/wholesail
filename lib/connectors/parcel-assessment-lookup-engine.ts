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

export async function checkParcelAssessment(leadId: string, connectorSlug?: string): Promise<ParcelAssessmentCheckResult> {
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

  // Find the right connector — use specific slug if provided, otherwise fall back to zip-based lookup
  let connector;
  if (connectorSlug) {
    const { getLookupConnector } = await import('./lookup-registry');
    connector = getLookupConnector(connectorSlug);
  } else {
    connector = getLookupConnectorForZip(zipCode, 'parcel_assessment');
  }
  if (!connector) {
    return { found: false, error: `No parcel assessment connector found${connectorSlug ? ` for slug ${connectorSlug}` : ` for zip ${zipCode}`}` };
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

  // Owner information — filled below after sale date check.
  // If a newer sale is detected, we force-update owner fields
  // (new sale = new owner). Otherwise, only fill empty fields.

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

  // Purchase/deed info — always use the most recent sale date
  let saleUpdated = false;
  if (result.lastSaleDate) {
    const connectorDate = new Date(result.lastSaleDate);
    const existingDate = property.purchaseDate ? new Date(property.purchaseDate) : null;

    if (!existingDate || connectorDate > existingDate) {
      propertyUpdates.purchaseDate = connectorDate;
      if (result.lastSalePrice != null) propertyUpdates.purchasePrice = result.lastSalePrice;
      if (result.deedBook) propertyUpdates.deedBook = result.deedBook;
      if (result.deedPage) propertyUpdates.deedPage = result.deedPage;
      saleUpdated = true;
    }
  }
  // Fill empty deed fields even if the sale date didn't change
  if (!saleUpdated) {
    if (result.deedBook && !property.deedBook) {
      propertyUpdates.deedBook = result.deedBook;
    }
    if (result.deedPage && !property.deedPage) {
      propertyUpdates.deedPage = result.deedPage;
    }
  }

  // Also treat as a sale update if the connector has the same sale date but a different owner
  // (e.g. first run updated the date but the owner-update code wasn't in place yet)
  if (!saleUpdated && result.lastSaleDate && result.ownerName) {
    const connectorDate = new Date(result.lastSaleDate);
    const existingDate = property.purchaseDate ? new Date(property.purchaseDate) : null;
    if (existingDate && connectorDate.getTime() === existingDate.getTime()) {
      const existingOwner = (property.ownerName || '').toUpperCase().trim();
      const connectorOwner = result.ownerName.toUpperCase().trim();
      if (existingOwner !== connectorOwner) {
        saleUpdated = true; // Different owner for the same sale → update owner info
      }
    }
  }

  // Owner information — if a newer sale was detected, force-update owner
  // fields (new sale = new owner). Otherwise, only fill empty fields.
  if (saleUpdated) {
    // New sale detected — update owner info even if already populated
    if (result.ownerName) propertyUpdates.ownerName = result.ownerName;
    if (result.ownerMailingAddress) propertyUpdates.ownerMailingAddress = result.ownerMailingAddress;
    if (result.ownerCity) propertyUpdates.ownerCity = result.ownerCity;
    if (result.ownerState) propertyUpdates.ownerState = result.ownerState;
    if (result.ownerZip) propertyUpdates.ownerZip = result.ownerZip;
    if (result.isAbsenteeOwner != null) propertyUpdates.isAbsenteeOwner = result.isAbsenteeOwner;
  } else {
    // No new sale — only fill empty fields, don't overwrite
    if (result.ownerName && !property.ownerName) propertyUpdates.ownerName = result.ownerName;
    if (result.ownerMailingAddress && !property.ownerMailingAddress) propertyUpdates.ownerMailingAddress = result.ownerMailingAddress;
    if (result.ownerCity && !property.ownerCity) propertyUpdates.ownerCity = result.ownerCity;
    if (result.ownerState && !property.ownerState) propertyUpdates.ownerState = result.ownerState;
    if (result.ownerZip && !property.ownerZip) propertyUpdates.ownerZip = result.ownerZip;
    if (result.isAbsenteeOwner != null) propertyUpdates.isAbsenteeOwner = result.isAbsenteeOwner;
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

  // ============================================================
  // Signal maintenance — deactivate signals invalidated by
  // ownership change. A new sale means the previous owner's
  // long-tenure no longer applies to the current owner.
  // ============================================================
  let signalsChanged = false;
  const deactivatedSignalLabels: string[] = [];

  // Deactivate long-term ownership signals when:
  //   1. A new sale was just detected (saleUpdated), OR
  //   2. The current purchase date shows the property was bought
  //      recently enough that "Long-Term Owner" no longer applies.
  //      This catches cases where the sale was detected on a
  //      previous run before this deactivation code existed.
  const ownershipSignalsToDeactivate = ['tired_landlord', 'long_ownership'];
  const currentPurchaseDate = propertyUpdates.purchaseDate
    ? new Date(propertyUpdates.purchaseDate)
    : property.purchaseDate ? new Date(property.purchaseDate) : null;
  const yearsOwned = currentPurchaseDate
    ? (Date.now() - currentPurchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : null;
  const shouldDeactivateLongOwner = saleUpdated || (yearsOwned != null && yearsOwned < 10);

  if (shouldDeactivateLongOwner) {
    const staleSignals = lead.signals.filter(
      (s) => s.isActive && ownershipSignalsToDeactivate.includes(s.signalType)
    );

    for (const signal of staleSignals) {
      await prisma.leadSignal.update({
        where: { id: signal.id },
        data: { isActive: false },
      });
      deactivatedSignalLabels.push(signal.label);
      signalsChanged = true;
    }
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

    signalsChanged = true;
  }

  // Recalculate lead score if any signals were added, updated, or deactivated
  if (signalsChanged) {
    await recalculateScore(lead.id);

    // Update lead activity timestamps
    const now = new Date();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: now, lastSignalAt: now },
    });
  }

  // ============================================================
  // Needs Review — if the sale happened after the lead was
  // created, flag for review with a detailed explanation of
  // what was updated, what wasn't, and what signals changed.
  // ============================================================
  const saleDateForReview = propertyUpdates.purchaseDate
    ? new Date(propertyUpdates.purchaseDate)
    : currentPurchaseDate;

  if (saleUpdated && saleDateForReview && saleDateForReview > lead.createdAt) {
    // Format dates — don't show fake day when connector only had month+year
    const saleDay = saleDateForReview.getUTCDate();
    const saleDateOpts: Intl.DateTimeFormatOptions = saleDay === 1
      ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    const saleFormatted = saleDateForReview.toLocaleDateString('en-US', saleDateOpts);
    const createdFormatted = lead.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

    // Track what was updated
    const updatedFields: string[] = [];
    if (propertyUpdates.ownerName) updatedFields.push('Owner Name');
    if (propertyUpdates.ownerMailingAddress || propertyUpdates.ownerCity) updatedFields.push('Mailing Address');
    if (propertyUpdates.purchasePrice != null) updatedFields.push('Sale Price');
    if (propertyUpdates.deedBook || propertyUpdates.deedPage) updatedFields.push('Deed Info');

    // Track contact fields that were NOT updated (potentially stale)
    const staleFields: string[] = [];
    if (property.ownerPhone) staleFields.push('Phone');
    if (property.ownerPhone2) staleFields.push('Phone 2');
    if (property.ownerEmail) staleFields.push('Email');

    // Store structured JSON so the UI can style each section
    const reviewData = {
      summary: `Property sold ${saleFormatted}, after lead was created ${createdFormatted}.`,
      updated: updatedFields,
      stale: staleFields,
      removed: deactivatedSignalLabels,
    };

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        needsReview: true,
        needsReviewReason: JSON.stringify(reviewData),
        needsReviewDismissedAt: null, // Reset dismissal if re-flagged
      },
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
