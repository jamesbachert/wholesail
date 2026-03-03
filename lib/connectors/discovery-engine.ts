// ============================================================
// GENERIC DISCOVERY ENGINE
// Central orchestrator for writing discovery data from any
// connector. Handles address dedup, signal upsert, and
// composite scoring across multiple data sources.
// ============================================================

import { prisma } from '@/lib/prisma';
import { normalizeAddress } from './address-utils';
import { calculateDiscoveryScore } from './discovery-scoring';

// -- Public types --

export interface DiscoverySignalInput {
  signalType: string;    // "blight_certified", "sheriff_sale", "code_violation"
  label: string;         // "ARA Certified Blight"
  category: string;      // "distress" | "ownership" | "financial" | "condition"
  points: number;        // Raw signal points (before cross-source bonuses)
  value?: string;        // Freeform context
  details?: any;         // Source-specific JSON (blight criteria, sale amount, etc.)
  sourceUrl?: string;
}

export interface DiscoveryRecord {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  yearBuilt?: number;
  signals: DiscoverySignalInput[];
  rawData?: Record<string, any>;
  externalId?: string;
}

export interface DiscoverySyncResult {
  success: boolean;
  total: number;
  newCount: number;
  updatedCount: number;
  errors: number;
  errorMessages: string[];
  duration: number;
}

// -- Main engine function --

/**
 * Ingest an array of discovery records from a single connector.
 * Handles address dedup, signal upserts, and composite scoring.
 *
 * @param connectorSlug - Identifier for the connector (e.g. "ara-blight")
 * @param regionSlug - Region identifier (e.g. "lehigh-valley")
 * @param records - Array of discovery records to process
 */
export async function discoverRecords(
  connectorSlug: string,
  regionSlug: string,
  records: DiscoveryRecord[]
): Promise<DiscoverySyncResult> {
  const start = Date.now();
  const errors: string[] = [];

  // Create sync record
  const syncRecord = await prisma.dataSourceSync.create({
    data: {
      connectorSlug,
      region: regionSlug,
      status: 'syncing',
    },
  });

  let newCount = 0;
  let updatedCount = 0;

  try {
    for (const record of records) {
      try {
        const addressNormalized = normalizeAddress(record.address);
        if (!addressNormalized) {
          errors.push(`Empty address after normalization: ${record.address}`);
          continue;
        }

        // 1. Upsert DiscoveredLead by unique [addressNormalized, sourceRegion]
        const existing = await prisma.discoveredLead.findUnique({
          where: {
            addressNormalized_sourceRegion: {
              addressNormalized,
              sourceRegion: regionSlug,
            },
          },
        });

        let leadId: string;

        if (existing) {
          // Update existing — DON'T reset user-set statuses
          await prisma.discoveredLead.update({
            where: { id: existing.id },
            data: {
              address: record.address,
              city: record.city,
              state: record.state,
              zipCode: record.zipCode,
              latitude: record.latitude ?? existing.latitude,
              longitude: record.longitude ?? existing.longitude,
              propertyType: record.propertyType ?? existing.propertyType,
              yearBuilt: record.yearBuilt ?? existing.yearBuilt,
              externalId: record.externalId ?? existing.externalId,
              rawData: record.rawData ?? (existing.rawData as any) ?? undefined,
              lastSeenAt: new Date(),
              syncedAt: new Date(),
            },
          });
          leadId = existing.id;
          updatedCount++;
        } else {
          // Create new
          const created = await prisma.discoveredLead.create({
            data: {
              address: record.address,
              addressNormalized,
              city: record.city,
              state: record.state,
              zipCode: record.zipCode,
              latitude: record.latitude,
              longitude: record.longitude,
              propertyType: record.propertyType,
              yearBuilt: record.yearBuilt,
              sourceRegion: regionSlug,
              externalId: record.externalId,
              rawData: record.rawData,
            },
          });
          leadId = created.id;
          newCount++;
        }

        // 2. Upsert signals for this connector
        for (const signal of record.signals) {
          await prisma.discoverySignal.upsert({
            where: {
              discoveredLeadId_connectorSlug_signalType: {
                discoveredLeadId: leadId,
                connectorSlug,
                signalType: signal.signalType,
              },
            },
            create: {
              discoveredLeadId: leadId,
              connectorSlug,
              signalType: signal.signalType,
              label: signal.label,
              category: signal.category,
              points: signal.points,
              value: signal.value,
              details: signal.details,
              sourceUrl: signal.sourceUrl,
            },
            update: {
              label: signal.label,
              category: signal.category,
              points: signal.points,
              value: signal.value,
              details: signal.details,
              sourceUrl: signal.sourceUrl,
              lastSeenAt: new Date(),
            },
          });
        }

        // 3. Recalculate sourceCount + discoveryScore
        const allSignals = await prisma.discoverySignal.findMany({
          where: { discoveredLeadId: leadId },
        });

        // Only count connectors that contributed real (non-zero) signals toward sourceCount
        // so informational-only lookups (e.g. "no rental license") don't inflate cross-source bonuses
        const distinctSlugs = new Set(
          allSignals.filter((s) => s.points > 0).map((s) => s.connectorSlug)
        );
        const sourceCount = distinctSlugs.size;
        const discoveryScore = calculateDiscoveryScore(allSignals, sourceCount);

        await prisma.discoveredLead.update({
          where: { id: leadId },
          data: { sourceCount, discoveryScore },
        });
      } catch (err: any) {
        errors.push(`${record.address}: ${err.message}`);
      }
    }

    // Update sync record
    await prisma.dataSourceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: 'success',
        recordCount: records.length,
        newCount,
        updatedCount,
        completedAt: new Date(),
      },
    });

    const duration = Date.now() - start;
    console.log(
      `[Discovery Engine] ${connectorSlug}: ${newCount} new, ${updatedCount} updated, ${errors.length} errors (${duration}ms)`
    );

    return {
      success: true,
      total: records.length,
      newCount,
      updatedCount,
      errors: errors.length,
      errorMessages: errors.slice(0, 10),
      duration,
    };
  } catch (err: any) {
    await prisma.dataSourceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: 'error',
        errorMessage: err.message,
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      total: 0,
      newCount: 0,
      updatedCount: 0,
      errors: 1,
      errorMessages: [err.message],
      duration: Date.now() - start,
    };
  }
}
