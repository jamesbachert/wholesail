import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_STATUSES = ['new', 'viewed', 'needs_review', 'dismissed'];

// PATCH /api/discovery/leads/status — update status for one or more discovered leads
export async function PATCH(request: NextRequest) {
  try {
    const { leadIds, status } = await request.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required' }, { status: 400 });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Don't overwrite in_pipeline or dismissed with viewed (auto-mark shouldn't downgrade)
    const protectedStatuses = status === 'viewed' ? ['in_pipeline', 'dismissed', 'needs_review', 'viewed'] : ['in_pipeline'];

    const result = await prisma.discoveredLead.updateMany({
      where: {
        id: { in: leadIds },
        status: { notIn: protectedStatuses },
      },
      data: { status },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    console.error('Discovery status update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
