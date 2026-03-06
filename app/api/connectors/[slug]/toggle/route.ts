import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/connectors/[slug]/toggle
// Toggles a connector's enabled state for a given region.
// Body: { regionSlug: string, isEnabled: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { regionSlug, isEnabled } = await request.json();

    if (!regionSlug || typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'regionSlug and isEnabled (boolean) are required' },
        { status: 400 }
      );
    }

    const region = await prisma.region.findUnique({
      where: { slug: regionSlug },
    });

    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    // Upsert the assignment
    const assignment = await prisma.connectorRegionAssignment.upsert({
      where: {
        connectorSlug_regionId: {
          connectorSlug: slug,
          regionId: region.id,
        },
      },
      update: { isEnabled },
      create: {
        connectorSlug: slug,
        regionId: region.id,
        isEnabled,
      },
    });

    return NextResponse.json({ success: true, isEnabled: assignment.isEnabled });
  } catch (error: any) {
    console.error('Toggle connector error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
