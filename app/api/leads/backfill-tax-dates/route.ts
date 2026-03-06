import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/leads/backfill-tax-dates
// Scans all tax_delinquent signals with null eventDate and extracts
// the date from the value text ("In repository since M/D/YY").
export async function POST(request: NextRequest) {
  try {
    // Find all tax_delinquent signals missing eventDate
    const signals = await prisma.leadSignal.findMany({
      where: {
        signalType: 'tax_delinquent',
        isActive: true,
        eventDate: null,
      },
    });

    let updated = 0;
    let skippedNoDate = 0;
    let errors = 0;

    for (const signal of signals) {
      // Extract date from value like "In repository since 6/26/25"
      const dateMatch = signal.value?.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);

      if (!dateMatch) {
        skippedNoDate++;
        continue;
      }

      const parsed = parseDateStr(dateMatch[1]);
      if (!parsed) {
        skippedNoDate++;
        continue;
      }

      try {
        await prisma.leadSignal.update({
          where: { id: signal.id },
          data: { eventDate: parsed },
        });
        updated++;
      } catch (err) {
        console.error(`[Backfill Tax Dates] Error updating signal ${signal.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      totalSignalsScanned: signals.length,
      updated,
      skippedNoDate,
      errors,
    });
  } catch (error: any) {
    console.error('[Backfill Tax Dates] Fatal error:', error);
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
