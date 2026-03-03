import { NextResponse } from 'next/server';
import { getRentalLicenseSupportedZipCodes } from '@/lib/connectors/lookup-registry';

export async function GET() {
  return NextResponse.json({
    zipCodes: getRentalLicenseSupportedZipCodes(),
  });
}
