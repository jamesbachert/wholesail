import { prisma } from '../prisma';
import { ConnectorResult, ParsedRecord } from './types';
import { recalculateScore } from './scoring';
import { normalizeAddress } from './address-utils';

// Signal types that allow multiple instances per lead (dedup by value, not type)
const STACKABLE_SIGNAL_TYPES = ['code_violation'];

// ============================================================
// IMPORT ENGINE
// Takes parsed records from any connector and imports them
// into the database as properties, leads, and signals.
// Handles deduplication by address matching.
// Supports signal stacking with distress bonuses.
// Syncs property flags (hasCodeViolations, isVacant, isAbsenteeOwner).
// ============================================================

export async function importRecords(
  records: ParsedRecord[],
  dataSourceSlug: string
): Promise<ConnectorResult> {
  const startTime = Date.now();
  let newLeads = 0;
  let updatedLeads = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  // Get the region for Lehigh Valley
  const region = await prisma.region.findFirst({
    where: { slug: 'lehigh-valley', isActive: true },
  });

  if (!region) {
    return {
      success: false,
      newLeads: 0,
      updatedLeads: 0,
      errors: 1,
      errorMessages: ['No active Lehigh Valley region found. Run prisma db seed first.'],
      rawRecords: records.length,
      duration: Date.now() - startTime,
    };
  }

  // Get or create the data source record
  let dataSource = await prisma.dataSource.findUnique({
    where: { slug: dataSourceSlug },
  });

  if (!dataSource) {
    dataSource = await prisma.dataSource.create({
      data: {
        name: dataSourceSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: dataSourceSlug,
        type: 'automated',
        regionId: region.id,
        status: 'ACTIVE',
      },
    });
  }

  // Get scoring weights for auto-scoring
  const weights = await prisma.scoringWeight.findMany({ where: { isActive: true } });
  const weightMap = new Map(weights.map((w) => [w.signalType, w]));

  const now = new Date();

  for (const record of records) {
    try {
      // Normalize address for dedup
      const normalizedAddress = normalizeAddress(record.address);

      // Check if property already exists
      let property = await prisma.property.findFirst({
        where: {
          AND: [
            { city: { equals: record.city, mode: 'insensitive' } },
            { state: record.state },
          ],
          OR: [
            { address: { equals: record.address, mode: 'insensitive' } },
            { address: { equals: normalizedAddress, mode: 'insensitive' } },
          ],
        },
        include: { lead: { include: { signals: true } } },
      });

      if (property && property.lead) {
        // Property exists with a lead — check for new signals to stack
        let signalsAdded = false;

        for (const signal of record.signals) {
          // For stackable signal types (like code_violation), dedup by value (case number)
          // instead of just signal type, so multiple cases on one property each get their own signal
          const isStackable = STACKABLE_SIGNAL_TYPES.includes(signal.signalType);

          const existingSignal = isStackable
            ? property.lead.signals.find(
                (s) => s.signalType === signal.signalType && s.value === signal.value && s.isActive
              )
            : property.lead.signals.find(
                (s) => s.signalType === signal.signalType && s.isActive
              );

          if (!existingSignal) {
            // New signal — for stackable types, only the first gets full points
            const weightDef = weightMap.get(signal.signalType);
            let points = weightDef?.weight ?? signal.points;

            if (isStackable) {
              const existingCount = property.lead.signals.filter(
                (s) => s.signalType === signal.signalType && s.isActive
              ).length;
              if (existingCount > 0) {
                points = 0; // Additional stackable signals score 0 pts individually
              }
            }

            await prisma.leadSignal.create({
              data: {
                leadId: property.lead.id,
                signalType: signal.signalType,
                label: signal.label,
                category: weightDef?.category ?? signal.category,
                points,
                value: signal.value,
                source: signal.source,
                isAutomated: true,
                isLocked: true,
                isActive: true,
                eventDate: record.saleDate ? new Date(record.saleDate) : null,
              },
            });
            signalsAdded = true;
          } else {
            // Signal exists — update value if changed (e.g. new case number)
            if (existingSignal.value !== signal.value && signal.value) {
              await prisma.leadSignal.update({
                where: { id: existingSignal.id },
                data: {
                  value: signal.value,
                  eventDate: record.saleDate ? new Date(record.saleDate) : existingSignal.eventDate,
                },
              });
            }
          }
        }

        if (signalsAdded) {
          await recalculateScore(property.lead.id);
          await syncPropertyFlags(property.id, record.signals);
          await prisma.lead.update({
            where: { id: property.lead.id },
            data: {
              lastActivityAt: now,
              lastSignalAt: now,
            },
          });
          updatedLeads++;
        }

        // Update owner name if we have one and property doesn't
        if (record.ownerName && !property.ownerName) {
          await prisma.property.update({
            where: { id: property.id },
            data: { ownerName: record.ownerName },
          });
        }
      } else if (property && !property.lead) {
        // Property exists but no lead — create one
        const lead = await prisma.lead.create({
          data: {
            propertyId: property.id,
            regionId: region.id,
            status: 'NEW',
            isTimeSensitive: !!record.saleDate,
            timeSensitiveReason: record.saleDate
              ? `Event scheduled: ${record.saleDate}`
              : undefined,
            lastActivityAt: now,
            lastSignalAt: now,
          },
        });

        for (const signal of record.signals) {
          const weightDef = weightMap.get(signal.signalType);
          const points = weightDef?.weight ?? signal.points;
          await prisma.leadSignal.create({
            data: {
              leadId: lead.id,
              signalType: signal.signalType,
              label: signal.label,
              category: weightDef?.category ?? signal.category,
              points,
              value: signal.value,
              source: signal.source,
              isAutomated: true,
              isLocked: true,
              isActive: true,
              eventDate: record.saleDate ? new Date(record.saleDate) : null,
            },
          });
        }

        await recalculateScore(lead.id);
        await syncPropertyFlags(property.id, record.signals);
        newLeads++;
      } else {
        // Brand new property + lead
        const newProperty = await prisma.property.create({
          data: {
            address: record.address,
            city: record.city,
            state: record.state,
            zipCode: record.zipCode,
            county: record.county,
            ownerName: record.ownerName,
          },
        });
        property = newProperty as any;

        const lead = await prisma.lead.create({
          data: {
            propertyId: newProperty.id,
            regionId: region.id,
            status: 'NEW',
            isTimeSensitive: !!record.saleDate,
            timeSensitiveReason: record.saleDate
              ? `Event scheduled: ${record.saleDate}`
              : undefined,
            lastActivityAt: now,
            lastSignalAt: now,
          },
        });

        for (const signal of record.signals) {
          const weightDef = weightMap.get(signal.signalType);
          const points = weightDef?.weight ?? signal.points;
          await prisma.leadSignal.create({
            data: {
              leadId: lead.id,
              signalType: signal.signalType,
              label: signal.label,
              category: weightDef?.category ?? signal.category,
              points,
              value: signal.value,
              source: signal.source,
              isAutomated: true,
              isLocked: true,
              isActive: true,
              eventDate: record.saleDate ? new Date(record.saleDate) : null,
            },
          });
        }

        await recalculateScore(lead.id);
        await syncPropertyFlags(newProperty.id, record.signals);

        // Audit trail
        await prisma.sourceRecord.create({
          data: {
            dataSourceId: dataSource.id,
            propertyId: newProperty.id,
            rawData: record.rawData as any,
            processedAt: now,
          },
        });

        newLeads++;
      }
    } catch (err: any) {
      errors++;
      errorMessages.push(
        `Error importing ${record.address}: ${err.message}`
      );
      console.error(`Import error for ${record.address}:`, err);
    }
  }

  // Update data source status
  await prisma.dataSource.update({
    where: { id: dataSource.id },
    data: {
      lastRun: now,
      lastSuccess: errors === 0 ? now : undefined,
      recordsFound: records.length,
      status: errors === 0 ? 'ACTIVE' : errors === records.length ? 'ERROR' : 'ACTIVE',
      errorMessage:
        errorMessages.length > 0
          ? errorMessages.slice(0, 3).join('; ')
          : null,
    },
  });

  // Notification for new leads
  if (newLeads > 0) {
    await prisma.notification.create({
      data: {
        type: 'NEW_HIGH_SCORE_LEAD',
        title: `${newLeads} new lead${newLeads > 1 ? 's' : ''} imported`,
        message: `${dataSource.name}: ${newLeads} new, ${updatedLeads} updated from ${records.length} records.`,
      },
    });
  }

  return {
    success: errors === 0,
    newLeads,
    updatedLeads,
    errors,
    errorMessages,
    rawRecords: records.length,
    duration: Date.now() - startTime,
  };
}

// recalculateScore is imported from ./scoring

// ============================================================
// PROPERTY FLAG SYNC
// Sets boolean flags on Property based on imported signal types.
// Called after each lead's signals are imported.
// ============================================================

export async function syncPropertyFlags(
  propertyId: string,
  signals: Array<{ signalType: string }>
) {
  const flagMap: Record<string, string> = {
    code_violation: 'hasCodeViolations',
    vacant_property: 'isVacant',
    absentee_owner: 'isAbsenteeOwner',
    rental_property: 'isRentalProperty',
  };

  const updates: Record<string, boolean> = {};

  for (const signal of signals) {
    const field = flagMap[signal.signalType];
    if (field) {
      updates[field] = true;
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.property.update({
      where: { id: propertyId },
      data: updates,
    });
  }
}

// normalizeAddress is imported from ./address-utils
