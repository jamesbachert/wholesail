import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/leads/signals — add, toggle, lock, unlock, remove, update_details
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, leadId, signalId, signalType, value, eventDate, syncProperty } = body;

    // --------------------------------------------------------
    // TOGGLE (flip isActive on existing signal)
    // --------------------------------------------------------
    if (action === 'toggle' && signalId) {
      const signal = await prisma.leadSignal.findUnique({
        where: { id: signalId },
        include: { lead: true },
      });

      if (!signal) {
        return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
      }

      if (signal.isLocked) {
        return NextResponse.json(
          { error: 'Signal is locked. Unlock it first to toggle.' },
          { status: 403 }
        );
      }

      const newActive = !signal.isActive;

      const updated = await prisma.leadSignal.update({
        where: { id: signalId },
        data: { isActive: newActive },
      });

      if (syncProperty) {
        await syncPropertyField(signal.lead.propertyId, syncProperty, newActive);
      }

      await recalculateLeadScore(signal.leadId);

      await prisma.lead.update({
        where: { id: signal.leadId },
        data: { lastActivityAt: new Date() },
      });

      return NextResponse.json(updated);
    }

    // --------------------------------------------------------
    // UNLOCK
    // --------------------------------------------------------
    if (action === 'unlock' && signalId) {
      const updated = await prisma.leadSignal.update({
        where: { id: signalId },
        data: { isLocked: false },
      });
      return NextResponse.json(updated);
    }

    // --------------------------------------------------------
    // LOCK
    // --------------------------------------------------------
    if (action === 'lock' && signalId) {
      const updated = await prisma.leadSignal.update({
        where: { id: signalId },
        data: { isLocked: true },
      });
      return NextResponse.json(updated);
    }

    // --------------------------------------------------------
    // ADD (new manual signal — activates instantly, details optional)
    // --------------------------------------------------------
    if (action === 'add' && leadId && signalType) {
      const weight = await prisma.scoringWeight.findUnique({
        where: { signalType },
      });

      if (!weight) {
        return NextResponse.json(
          { error: `Unknown signal type: ${signalType}` },
          { status: 400 }
        );
      }

      // Check for existing active signal
      const existing = await prisma.leadSignal.findFirst({
        where: { leadId, signalType, isActive: true },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Signal already active on this lead' },
          { status: 409 }
        );
      }

      // Check for inactive version — reactivate
      const inactive = await prisma.leadSignal.findFirst({
        where: { leadId, signalType, isActive: false },
      });

      let signal;
      if (inactive) {
        signal = await prisma.leadSignal.update({
          where: { id: inactive.id },
          data: {
            isActive: true,
            isLocked: false,
            value: value || inactive.value,
            eventDate: eventDate ? new Date(eventDate) : inactive.eventDate,
            source: 'Manual',
          },
        });
      } else {
        signal = await prisma.leadSignal.create({
          data: {
            leadId,
            signalType: weight.signalType,
            label: weight.label,
            category: weight.category,
            points: weight.weight,
            source: 'Manual',
            isAutomated: false,
            isLocked: false,
            isActive: true,
            value: value || null,
            eventDate: eventDate ? new Date(eventDate) : null,
          },
        });
      }

      // Sync property record
      if (syncProperty) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) {
          await syncPropertyField(lead.propertyId, syncProperty, true);
        }
      }

      await recalculateLeadScore(leadId);

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          lastActivityAt: new Date(),
          lastSignalAt: new Date(),
        },
      });

      return NextResponse.json(signal, { status: 201 });
    }

    // --------------------------------------------------------
    // UPDATE DETAILS (date/notes on an existing signal)
    // --------------------------------------------------------
    if (action === 'update_details' && signalId) {
      const signal = await prisma.leadSignal.findUnique({
        where: { id: signalId },
      });

      if (!signal) {
        return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
      }

      const updated = await prisma.leadSignal.update({
        where: { id: signalId },
        data: {
          ...(value !== undefined && { value }),
          ...(eventDate !== undefined && {
            eventDate: eventDate ? new Date(eventDate) : null,
          }),
        },
      });

      await prisma.lead.update({
        where: { id: signal.leadId },
        data: { lastActivityAt: new Date() },
      });

      return NextResponse.json(updated);
    }

    // --------------------------------------------------------
    // REMOVE (hard delete manual signal only)
    // --------------------------------------------------------
    if (action === 'remove' && signalId) {
      const signal = await prisma.leadSignal.findUnique({
        where: { id: signalId },
        include: { lead: true },
      });

      if (!signal) {
        return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
      }

      if (signal.isAutomated) {
        return NextResponse.json(
          { error: 'Cannot remove automated signals. Toggle them off instead.' },
          { status: 403 }
        );
      }

      await prisma.leadSignal.delete({ where: { id: signalId } });

      if (syncProperty) {
        await syncPropertyField(signal.lead.propertyId, syncProperty, false);
      }

      await recalculateLeadScore(signal.leadId);

      await prisma.lead.update({
        where: { id: signal.leadId },
        data: { lastActivityAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Signal API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// PROPERTY RECORD SYNC
// ============================================================

async function syncPropertyField(propertyId: string, fieldName: string, value: boolean) {
  try {
    await prisma.property.update({
      where: { id: propertyId },
      data: { [fieldName]: value },
    });
  } catch (err) {
    console.error(`Failed to sync property field ${fieldName}:`, err);
  }
}

// ============================================================
// SCORE RECALCULATION
// ============================================================

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
