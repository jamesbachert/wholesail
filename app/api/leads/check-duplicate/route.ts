import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeAddress } from '@/lib/connectors/address-utils';

// GET /api/leads/check-duplicate?address=...&city=...&state=...
// Checks both pipeline (Property/Lead) and Discovery (DiscoveredLead) for duplicates.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const city = searchParams.get('city');
    const state = searchParams.get('state');

    if (!address || !city || !state) {
      return NextResponse.json(
        { error: 'address, city, and state are required' },
        { status: 400 }
      );
    }

    const normalizedAddr = normalizeAddress(address);

    // 1. Check pipeline (Property → Lead)
    const existingProperty = await prisma.property.findFirst({
      where: {
        AND: [
          { city: { equals: city, mode: 'insensitive' } },
          { state },
        ],
        OR: [
          { address: { equals: address, mode: 'insensitive' } },
          { address: { equals: normalizedAddr, mode: 'insensitive' } },
        ],
      },
      include: { lead: true },
    });

    if (existingProperty?.lead) {
      return NextResponse.json({
        duplicate: true,
        source: 'pipeline',
        leadId: existingProperty.lead.id,
        address: existingProperty.address,
        status: existingProperty.lead.status,
      });
    }

    // 2. Check Discovery (DiscoveredLead)
    const discoveredLead = await prisma.discoveredLead.findFirst({
      where: {
        addressNormalized: normalizedAddr,
      },
    });

    if (discoveredLead) {
      return NextResponse.json({
        duplicate: true,
        source: 'discovery',
        discoveredLeadId: discoveredLead.id,
        address: discoveredLead.address,
        status: discoveredLead.status,
      });
    }

    // No duplicate found
    return NextResponse.json({ duplicate: false, source: null });
  } catch (error: any) {
    console.error('Check duplicate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
