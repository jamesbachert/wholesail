import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/leads/calls — log a call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, outcome, duration, notes, scriptUsed, followUpDate } = body;

    if (!leadId || !outcome) {
      return NextResponse.json(
        { error: 'leadId and outcome are required' },
        { status: 400 }
      );
    }

    const contact = await prisma.contactLog.create({
      data: {
        leadId,
        type: 'CALL_OUTBOUND',
        outcome,
        duration: duration || null,
        notes: notes || null,
        scriptUsed: scriptUsed || null,
      },
    });

    // Update lead dates
    const now = new Date();
    const updateData: any = {
      lastActivityAt: now,
      lastContacted: now,
    };

    // Set follow-up date if provided
    if (followUpDate) {
      updateData.nextFollowUp = new Date(followUpDate);
    }

    // Auto-update status based on outcome
    if (outcome === 'CONNECTED' || outcome === 'INTERESTED') {
      updateData.status = outcome === 'INTERESTED' ? 'WARM' : 'CONTACTED';
    } else if (outcome === 'DO_NOT_CALL') {
      updateData.status = 'DO_NOT_CONTACT';
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
