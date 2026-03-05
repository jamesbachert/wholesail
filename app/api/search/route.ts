import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/search — unified search across Pipeline Leads and Discovery
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q')?.trim();
    const region = searchParams.get('region');
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 10);

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!region) {
      return NextResponse.json(
        { error: 'Region is required' },
        { status: 400 }
      );
    }

    // --- Leads query (via Property relation) ---
    const leadsWhere: any = {
      archivedAt: null,
      region: { slug: region },
      property: {
        OR: [
          { address: { contains: q, mode: 'insensitive' } },
          { ownerName: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { zipCode: { startsWith: q } },
        ],
      },
    };

    // --- Discovery query ---
    const discoveryWhere: any = {
      sourceRegion: region,
      status: { notIn: ['in_pipeline', 'dismissed'] },
      OR: [
        { address: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { zipCode: { startsWith: q } },
      ],
    };

    // Run all four queries in parallel
    const [leads, leadsTotal, discovery, discoveryTotal] = await Promise.all([
      prisma.lead.findMany({
        where: leadsWhere,
        include: {
          property: {
            select: {
              address: true,
              city: true,
              state: true,
              zipCode: true,
              ownerName: true,
            },
          },
        },
        orderBy: { totalScore: 'desc' },
        take: limit,
      }),
      prisma.lead.count({ where: leadsWhere }),
      prisma.discoveredLead.findMany({
        where: discoveryWhere,
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          discoveryScore: true,
          sourceCount: true,
          status: true,
        },
        orderBy: { discoveryScore: 'desc' },
        take: limit,
      }),
      prisma.discoveredLead.count({ where: discoveryWhere }),
    ]);

    return NextResponse.json({
      leads: leads.map((l) => ({
        id: l.id,
        address: l.property?.address || '',
        city: l.property?.city || '',
        state: l.property?.state || '',
        zipCode: l.property?.zipCode || '',
        ownerName: l.property?.ownerName || null,
        totalScore: l.totalScore,
        status: l.status,
      })),
      discovery: discovery.map((d) => ({
        id: d.id,
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        zipCode: d.zipCode || '',
        discoveryScore: d.discoveryScore,
        sourceCount: d.sourceCount,
        status: d.status,
      })),
      counts: {
        leads: leadsTotal,
        discovery: discoveryTotal,
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    );
  }
}
