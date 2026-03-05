import { prisma } from '../prisma';
import { getLookupConnectorForZip, getRentalLicenseSupportedZipCodes } from './lookup-registry';
import { recalculateScore } from './scoring';
import { RentalLicenseLookupResult } from './lookup-types';

// ============================================================
// RENTAL LICENSE LOOKUP ENGINE
// Checks individual leads or runs bulk lookups against
// rental license databases (e.g. Allentown).
// ============================================================

export interface RentalCheckResult {
  found: boolean;
  licenseNumber?: string;
  expirationDate?: Date;
  status?: string;
  error?: string;
}

export async function checkRentalLicense(leadId: string): Promise<RentalCheckResult> {
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
  const connector = getLookupConnectorForZip(zipCode, 'rental_license');
  if (!connector) {
    return { found: false, error: `No rental license connector supports zip code ${zipCode}` };
  }

  // Look up the address
  const result = (await connector.lookupByAddress(property.address, zipCode)) as RentalLicenseLookupResult;

  if (result.found) {
    // Update property fields
    await prisma.property.update({
      where: { id: property.id },
      data: {
        isRentalProperty: true,
        rentalLicenseExpiration: result.expirationDate ?? null,
        rentalLicenseNumber: result.licenseNumber ?? null,
      },
    });

    // Get scoring weights
    const weightDef = await prisma.scoringWeight.findUnique({
      where: { signalType: 'rental_property' },
    });
    const points = weightDef?.weight ?? 8;

    // Add or update the rental_property signal (find ANY existing, active or not, to avoid duplicates)
    const existingSignal = lead.signals.find(
      (s) => s.signalType === 'rental_property'
    );

    // Build signal value text — units only (expiration stored as eventDate)
    const signalValue = result.numberOfUnits
      ? `${result.numberOfUnits} unit${result.numberOfUnits > 1 ? 's' : ''}`
      : 'Active rental license';

    if (!existingSignal) {
      await prisma.leadSignal.create({
        data: {
          leadId: lead.id,
          signalType: 'rental_property',
          label: 'Rental Property',
          category: weightDef?.category ?? 'automated',
          points,
          value: signalValue,
          source: connector.name,
          isAutomated: true,
          isLocked: true,
          isActive: true,
          eventDate: result.expirationDate ?? null,
        },
      });
    } else {
      // Reactivate and update existing signal (handles previously deactivated signals)
      // Re-lock and re-mark as automated since this is a fresh enrichment result
      await prisma.leadSignal.update({
        where: { id: existingSignal.id },
        data: { value: signalValue, isActive: true, isLocked: true, isAutomated: true, points, eventDate: result.expirationDate ?? null },
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

    return {
      found: true,
      licenseNumber: result.licenseNumber,
      expirationDate: result.expirationDate,
      status: result.status,
    };
  }

  // Not found — mark as not a rental
  await prisma.property.update({
    where: { id: property.id },
    data: {
      isRentalProperty: false,
      rentalLicenseExpiration: null,
      rentalLicenseNumber: null,
    },
  });

  return { found: false };
}

export async function bulkCheckRentalLicenses(): Promise<{
  checked: number;
  found: number;
  errors: number;
  duration: number;
}> {
  const startTime = Date.now();
  const supportedZips = getRentalLicenseSupportedZipCodes();

  if (supportedZips.length === 0) {
    return { checked: 0, found: 0, errors: 0, duration: Date.now() - startTime };
  }

  // Find leads where:
  // - property zip is in supported list
  // - AND (isRentalProperty is null OR rentalLicenseExpiration has passed)
  const now = new Date();
  const leads = await prisma.lead.findMany({
    where: {
      property: {
        zipCode: { in: supportedZips },
        OR: [
          { isRentalProperty: null },
          { rentalLicenseExpiration: { lt: now } },
        ],
      },
    },
    select: { id: true },
  });

  console.log(`[Rental Bulk] Found ${leads.length} leads to check across zips: ${supportedZips.join(', ')}`);

  let checked = 0;
  let found = 0;
  let errors = 0;

  for (const lead of leads) {
    try {
      const result = await checkRentalLicense(lead.id);
      checked++;
      if (result.found) found++;
    } catch (err: any) {
      errors++;
      console.error(`[Rental Bulk] Error checking lead ${lead.id}:`, err.message);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[Rental Bulk] Complete: ${checked} checked, ${found} found, ${errors} errors (${duration}ms)`);

  // Create notification
  if (found > 0) {
    await prisma.notification.create({
      data: {
        type: 'NEW_HIGH_SCORE_LEAD',
        title: `${found} rental license${found > 1 ? 's' : ''} found`,
        message: `Rental license check: ${found} found out of ${checked} checked (${errors} errors).`,
      },
    });
  }

  return { checked, found, errors, duration };
}
