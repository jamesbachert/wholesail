import { NextRequest, NextResponse } from 'next/server';
import { getNewLeadThresholdDays, setNewLeadThresholdDays } from '@/lib/settings';

export async function GET() {
  const newLeadThresholdDays = await getNewLeadThresholdDays();
  return NextResponse.json({ newLeadThresholdDays });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { newLeadThresholdDays } = body;

  if (
    typeof newLeadThresholdDays !== 'number' ||
    newLeadThresholdDays < 1 ||
    newLeadThresholdDays > 365
  ) {
    return NextResponse.json(
      { error: 'newLeadThresholdDays must be a number between 1 and 365' },
      { status: 400 }
    );
  }

  await setNewLeadThresholdDays(newLeadThresholdDays);
  return NextResponse.json({ success: true, newLeadThresholdDays });
}
