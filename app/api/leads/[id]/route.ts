import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLeadStatus, updateProperty } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { LeadStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lead = await getLeadById(id);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Track first view timestamp (fire-and-forget, don't block response)
    if (!lead.firstViewedAt) {
      prisma.lead.update({
        where: { id },
        data: { firstViewedAt: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

const ALLOWED_PROPERTY_FIELDS = new Set([
  'address', 'city', 'state', 'zipCode', 'county',
  'propertyType', 'bedrooms', 'bathrooms', 'sqft', 'yearBuilt',
  'isVacant', 'isAbsenteeOwner', 'isRentalProperty',
  'rentalLicenseExpiration', 'rentalLicenseNumber',
  'ownerName', 'ownerPhone', 'ownerPhone2', 'ownerEmail',
  'ownerMailingAddress', 'ownerCity', 'ownerState', 'ownerZip',
  'estimatedValue', 'estimatedRepairCost', 'offerPrice',
  'purchaseDate', 'purchasePrice', 'deedBook', 'deedPage',
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Handle status update
    if (body.status) {
      const lead = await updateLeadStatus(id, body.status as LeadStatus);
      return NextResponse.json(lead);
    }

    // Handle lead-level field updates (offerStatus, leadSource)
    const hasLeadFields = body.offerStatus !== undefined || body.leadSource !== undefined;
    if (hasLeadFields) {
      const leadUpdate: Record<string, any> = {};
      if (body.offerStatus !== undefined) leadUpdate.offerStatus = body.offerStatus;
      if (body.leadSource !== undefined) leadUpdate.leadSource = body.leadSource;
      await prisma.lead.update({ where: { id }, data: leadUpdate });
    }

    // Handle property updates
    if (body.property) {
      const lead = await getLeadById(id);
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      // Filter to only allowed fields
      const propertyUpdate: Record<string, any> = {};
      for (const [key, value] of Object.entries(body.property)) {
        if (ALLOWED_PROPERTY_FIELDS.has(key)) {
          propertyUpdate[key] = value;
        }
      }

      if (Object.keys(propertyUpdate).length === 0) {
        return NextResponse.json({ error: 'No valid property fields to update' }, { status: 400 });
      }

      await updateProperty(lead.propertyId, propertyUpdate);
      const updated = await getLeadById(id);
      return NextResponse.json(updated);
    }

    // If only lead-level fields were updated (no property payload)
    if (hasLeadFields) {
      const updated = await getLeadById(id);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}
