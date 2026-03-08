import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/leads/[id]/clear-stale-contacts
 *
 * Clears contact fields (phone, phone2, email) that were not updated
 * during enrichment and may belong to a previous owner. Also dismisses
 * the "Needs Review" banner.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!lead || !lead.property) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Parse the structured review reason to know which fields are stale
    let staleFields: string[] = [];
    if (lead.needsReviewReason) {
      try {
        const reviewData = JSON.parse(lead.needsReviewReason);
        staleFields = reviewData.stale || [];
      } catch {
        // Legacy plain-text format — clear all contact fields to be safe
        staleFields = ['Phone', 'Phone 2', 'Email'];
      }
    }

    // Map display names → property field names
    const fieldMap: Record<string, string> = {
      'Phone': 'ownerPhone',
      'Phone 2': 'ownerPhone2',
      'Email': 'ownerEmail',
    };

    const propertyUpdates: Record<string, null> = {};
    const clearedFields: string[] = [];

    for (const field of staleFields) {
      const dbField = fieldMap[field];
      if (dbField) {
        propertyUpdates[dbField] = null;
        clearedFields.push(field);
      }
    }

    if (Object.keys(propertyUpdates).length > 0) {
      await prisma.property.update({
        where: { id: lead.property.id },
        data: propertyUpdates,
      });
    }

    // Dismiss the review banner
    await prisma.lead.update({
      where: { id },
      data: { needsReviewDismissedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      clearedFields,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
