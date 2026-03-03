import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConnectorCoverage, getZipLabel } from '@/lib/connectors/coverage-registry';
import { getConnectorInfo } from '@/lib/connectors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get coverage info (supported zip codes) from the code registry
    const coverage = getConnectorCoverage(slug);

    // Get connector name from the connector registry
    const connectorInfo = getConnectorInfo().find((c) => c.slug === slug);

    // Get all active regions for the checkboxes
    const allRegions = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });

    // Get current assignments for this connector
    const assignments = await prisma.connectorRegionAssignment.findMany({
      where: { connectorSlug: slug },
      include: { region: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({
      connectorSlug: slug,
      connectorName: connectorInfo?.name || slug,
      description: connectorInfo?.description || '',
      supportedZipCodes: (coverage?.supportedZipCodes || []).map((zip) => ({
        zip,
        label: getZipLabel(zip),
      })),
      assignments,
      allRegions,
    });
  } catch (error: any) {
    console.error('Error fetching connector regions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { regionIds } = await request.json();

    if (!Array.isArray(regionIds)) {
      return NextResponse.json({ error: 'regionIds must be an array' }, { status: 400 });
    }

    // Disable all existing assignments for this connector
    await prisma.connectorRegionAssignment.updateMany({
      where: { connectorSlug: slug },
      data: { isEnabled: false },
    });

    // Upsert enabled assignments
    for (const regionId of regionIds) {
      await prisma.connectorRegionAssignment.upsert({
        where: {
          connectorSlug_regionId: { connectorSlug: slug, regionId },
        },
        update: { isEnabled: true },
        create: { connectorSlug: slug, regionId, isEnabled: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating connector regions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
