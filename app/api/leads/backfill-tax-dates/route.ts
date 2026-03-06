import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/leads/backfill-tax-dates
// Fixes tax_delinquent signals:
//   1. Backfills missing eventDate from value text ("In repository since M/D/YY")
//   2. Normalizes labels to "Tax Delinquent" (removes old "(Repository)" suffix)
export async function POST(request: NextRequest) {
  try {
    // Find all active tax_delinquent signals
    const signals = await prisma.leadSignal.findMany({
      where: {
        signalType: 'tax_delinquent',
        isActive: true,
      },
    });

    let datesUpdated = 0;
    let labelsUpdated = 0;
    let skippedNoDate = 0;
    let errors = 0;

    for (const signal of signals) {
      const updates: Record<string, any> = {};

      // Fix missing eventDate
      if (!signal.eventDate) {
        const dateMatch = signal.value?.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (dateMatch) {
          const parsed = parseDateStr(dateMatch[1]);
          if (parsed) {
            updates.eventDate = parsed;
            datesUpdated++;
          } else {
            skippedNoDate++;
          }
        } else {
          skippedNoDate++;
        }
      }

      // Normalize label — remove "(Repository)" suffix
      if (signal.label !== 'Tax Delinquent') {
        updates.label = 'Tax Delinquent';
        labelsUpdated++;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await prisma.leadSignal.update({
            where: { id: signal.id },
            data: updates,
          });
        } catch (err) {
          console.error(`[Backfill Tax] Error updating signal ${signal.id}:`, err);
          errors++;
        }
      }
    }

    return NextResponse.json({
      totalSignalsScanned: signals.length,
      datesUpdated,
      labelsUpdated,
      skippedNoDate,
      errors,
    });
  } catch (error: any) {
    console.error('[Backfill Tax] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseDateStr(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  let [, monthStr, dayStr, yearStr] = match;
  let year = parseInt(yearStr);
  if (year < 100) {
    year += year > 50 ? 1900 : 2000;
  }

  const d = new Date(year, parseInt(monthStr) - 1, parseInt(dayStr));
  return isNaN(d.getTime()) ? null : d;
}
