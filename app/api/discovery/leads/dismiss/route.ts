import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/discovery/leads/dismiss — dismiss selected leads
export async function POST(request: NextRequest) {
  try {
    const { leadIds } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required' }, { status: 400 });
    }

    const result = await prisma.discoveredLead.updateMany({
      where: {
        id: { in: leadIds },
        status: { not: 'in_pipeline' }, // Can't dismiss already-promoted leads
      },
      data: { status: 'dismissed' },
    });

    return NextResponse.json({ dismissed: result.count });
  } catch (error: any) {
    console.error('Dismiss error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
