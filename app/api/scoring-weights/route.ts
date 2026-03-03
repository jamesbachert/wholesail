import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/scoring-weights — return all scoring weights
export async function GET() {
  try {
    const weights = await prisma.scoringWeight.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(weights);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/scoring-weights — upsert scoring weights
// Body: { weights: Array<{ signalType, label, category, weight, description? }> }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const incoming = body.weights as Array<{
      signalType: string;
      label: string;
      category: string;
      weight: number;
      description?: string;
      sortOrder?: number;
    }>;

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return NextResponse.json({ error: 'Missing weights array' }, { status: 400 });
    }

    // Upsert each weight in a transaction
    const results = await prisma.$transaction(
      incoming.map((w, idx) =>
        prisma.scoringWeight.upsert({
          where: { signalType: w.signalType },
          create: {
            signalType: w.signalType,
            label: w.label,
            category: w.category,
            weight: w.weight,
            description: w.description || null,
            sortOrder: w.sortOrder ?? idx,
            isActive: true,
          },
          update: {
            label: w.label,
            category: w.category,
            weight: w.weight,
            description: w.description || null,
            sortOrder: w.sortOrder ?? idx,
          },
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error('PUT /api/scoring-weights error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
