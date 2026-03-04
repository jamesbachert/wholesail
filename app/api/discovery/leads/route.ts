import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/discovery/leads — list discovered leads with filtering, sorting, pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const region = searchParams.get('region') || 'lehigh-valley';
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const source = searchParams.get('source'); // Filter by connector slug
    const minSources = searchParams.get('minSources'); // Min sourceCount
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');
    const sortBy = searchParams.get('sortBy') || 'discoveryScore';
    const sortDir = searchParams.get('sortDir') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build where clause
    const where: any = {
      sourceRegion: region,
    };

    if (status) {
      where.status = status;
    } else {
      // By default, exclude promoted leads — they live in the pipeline now
      where.status = { not: 'in_pipeline' };
    }

    if (search) {
      where.address = { contains: search, mode: 'insensitive' };
    }

    // Filter by source (connector slug) via signals relation
    // Exclude 0-point informational signals (e.g. "no rental license") so filtering
    // by a source only shows leads with real findings from that connector
    if (source) {
      where.signals = {
        some: { connectorSlug: source, points: { gt: 0 } },
      };
    }

    // Filter by minimum source count
    if (minSources) {
      where.sourceCount = { gte: parseInt(minSources, 10) };
    }

    if (minScore || maxScore) {
      where.discoveryScore = {};
      if (minScore) where.discoveryScore.gte = parseFloat(minScore);
      if (maxScore) where.discoveryScore.lte = parseFloat(maxScore);
    }

    // Build sort
    const validSorts = ['discoveryScore', 'sourceCount', 'address', 'lastSeenAt', 'createdAt'];
    const orderField = validSorts.includes(sortBy) ? sortBy : 'discoveryScore';
    const orderDir = sortDir === 'asc' ? 'asc' : 'desc';

    const [leads, total] = await Promise.all([
      prisma.discoveredLead.findMany({
        where,
        include: {
          signals: {
            orderBy: { points: 'desc' },
          },
        },
        orderBy: { [orderField]: orderDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.discoveredLead.count({ where }),
    ]);

    // Get distinct connector slugs for source filter dropdown
    // Only include connectors that have real (non-zero) signals
    const distinctSources = await prisma.discoverySignal.findMany({
      where: {
        discoveredLead: { sourceRegion: region },
        points: { gt: 0 },
      },
      select: { connectorSlug: true },
      distinct: ['connectorSlug'],
    });

    const filterOptions = {
      sources: distinctSources.map((s) => s.connectorSlug),
    };

    return NextResponse.json({
      leads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filterOptions,
    });
  } catch (error: any) {
    console.error('Discovery leads GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
