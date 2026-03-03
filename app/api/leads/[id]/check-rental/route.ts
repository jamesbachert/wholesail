import { NextRequest, NextResponse } from 'next/server';
import { checkRentalLicense } from '@/lib/connectors/rental-lookup-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await checkRentalLicense(id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error checking rental license:', error);
    return NextResponse.json(
      { error: 'Failed to check rental license', message: error.message },
      { status: 500 }
    );
  }
}
