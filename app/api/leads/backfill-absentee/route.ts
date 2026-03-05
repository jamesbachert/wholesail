import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeAddress } from '@/lib/connectors/address-utils';

// POST /api/leads/backfill-absentee
// Scans all leads with mailing address data and creates absentee_owner
// signals where the mailing address differs from the property address.
export async function POST(request: NextRequest) {
  try {
    // Get the absentee_owner scoring weight
    const weight = await prisma.scoringWeight.findUnique({
      where: { signalType: 'absentee_owner' },
    });

    if (!weight) {
      return NextResponse.json(
        { error: 'absentee_owner scoring weight not found' },
        { status: 500 }
      );
    }

    // Find all leads with their property data where mailing address exists
    const leads = await prisma.lead.findMany({
      where: {
        property: {
          ownerMailingAddress: { not: null },
        },
      },
      include: {
        property: true,
        signals: {
          where: { signalType: 'absentee_owner' },
        },
      },
    });

    let created = 0;
    let reactivated = 0;
    let skippedAlreadyActive = 0;
    let skippedSameAddress = 0;
    let errors = 0;

    for (const lead of leads) {
      const property = lead.property;
      if (!property?.ownerMailingAddress || !property.address) {
        skippedSameAddress++;
        continue;
      }

      // Compare addresses
      const normalizedMailing = normalizeAddress(property.ownerMailingAddress.trim());
      const normalizedSite = normalizeAddress(property.address.trim());

      if (!normalizedMailing || normalizedMailing === normalizedSite) {
        skippedSameAddress++;
        continue;
      }

      // Check street numbers
      const mailingNum = normalizedMailing.match(/^(\d+)/)?.[1];
      const siteNum = normalizedSite.match(/^(\d+)/)?.[1];
      const isDifferent =
        (mailingNum && siteNum && mailingNum !== siteNum) ||
        normalizedMailing !== normalizedSite;

      if (!isDifferent) {
        skippedSameAddress++;
        continue;
      }

      // Check existing signal
      const existingSignal = lead.signals[0];

      if (existingSignal?.isActive) {
        skippedAlreadyActive++;
        continue;
      }

      try {
        if (existingSignal && !existingSignal.isActive) {
          // Reactivate inactive signal
          await prisma.leadSignal.update({
            where: { id: existingSignal.id },
            data: {
              isActive: true,
              value: `Mailing: ${property.ownerMailingAddress}`,
              source: 'Address Backfill',
            },
          });
          reactivated++;
        } else {
          // Create new signal
          await prisma.leadSignal.create({
            data: {
              leadId: lead.id,
              signalType: 'absentee_owner',
              label: weight.label,
              category: weight.category,
              points: weight.weight,
              source: 'Address Backfill',
              isAutomated: true,
              isLocked: true,
              isActive: true,
              value: `Mailing: ${property.ownerMailingAddress}`,
            },
          });
          created++;
        }

        // Sync property field
        await prisma.property.update({
          where: { id: property.id },
          data: { isAbsenteeOwner: true },
        });

        // Recalculate lead score
        await recalculateLeadScore(lead.id);

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            lastActivityAt: new Date(),
            lastSignalAt: new Date(),
          },
        });
      } catch (err) {
        console.error(`[Backfill] Error processing lead ${lead.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      totalLeadsScanned: leads.length,
      created,
      reactivated,
      skippedAlreadyActive,
      skippedSameAddress,
      errors,
    });
  } catch (error: any) {
    console.error('[Backfill] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function recalculateLeadScore(leadId: string) {
  const signals = await prisma.leadSignal.findMany({
    where: { leadId, isActive: true },
  });

  let automatedScore = 0;
  let manualScore = 0;
  let distressCount = 0;

  for (const signal of signals) {
    if (signal.isAutomated) {
      automatedScore += signal.points;
    } else {
      manualScore += signal.points;
    }
    if (signal.category === 'distress') {
      distressCount++;
    }
  }

  let stackingBonus = 0;
  if (distressCount >= 3) stackingBonus = 20;
  else if (distressCount >= 2) stackingBonus = 10;

  const totalScore = automatedScore + manualScore + stackingBonus;

  let priority = 'normal';
  if (totalScore >= 100) priority = 'urgent';
  else if (totalScore >= 70) priority = 'high';
  else if (totalScore >= 40) priority = 'normal';
  else priority = 'low';

  await prisma.lead.update({
    where: { id: leadId },
    data: { automatedScore, manualScore, totalScore, priority },
  });
}
