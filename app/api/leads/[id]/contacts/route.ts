import { NextRequest, NextResponse } from 'next/server';
import { addContactLog } from '@/lib/db';
import { ContactType, ContactOutcome } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.type) {
      return NextResponse.json({ error: 'Contact type is required' }, { status: 400 });
    }

    const contact = await addContactLog({
      leadId: id,
      type: body.type as ContactType,
      outcome: body.outcome as ContactOutcome | undefined,
      duration: body.duration,
      message: body.message,
      notes: body.notes,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('Error logging contact:', error);
    return NextResponse.json({ error: 'Failed to log contact' }, { status: 500 });
  }
}
