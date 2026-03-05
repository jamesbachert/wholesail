import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/leads/[id]/enrichment-logs
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const logs = await prisma.enrichmentLog.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Enrichment logs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
