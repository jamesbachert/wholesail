import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLeadStatus, updateProperty } from '@/lib/db';
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

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}
