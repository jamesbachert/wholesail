import { NextRequest, NextResponse } from 'next/server';
import { addManualSignal, removeSignal } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.signalType || !body.label || body.points === undefined) {
      return NextResponse.json(
        { error: 'signalType, label, and points are required' },
        { status: 400 }
      );
    }

    const signal = await addManualSignal({
      leadId: id,
      signalType: body.signalType,
      label: body.label,
      value: body.value,
      points: body.points,
    });

    return NextResponse.json(signal, { status: 201 });
  } catch (error) {
    console.error('Error adding signal:', error);
    return NextResponse.json({ error: 'Failed to add signal' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const signalId = searchParams.get('signalId');

    if (!signalId) {
      return NextResponse.json({ error: 'signalId is required' }, { status: 400 });
    }

    const signal = await removeSignal(signalId);
    return NextResponse.json({ success: true, signal });
  } catch (error) {
    console.error('Error removing signal:', error);
    return NextResponse.json({ error: 'Failed to remove signal' }, { status: 500 });
  }
}
