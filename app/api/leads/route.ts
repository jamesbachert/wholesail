import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/leads — list leads with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Basic filters
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'totalScore';
    const sortDir = searchParams.get('sortDir') || 'desc';

    // Advanced filters
    const createdFrom = searchParams.get('createdFrom');
    const createdTo = searchParams.get('createdTo');
    const activityFrom = searchParams.get('activityFrom');
    const activityTo = searchParams.get('activityTo');
    const signals = searchParams.get('signals'); // comma-separated signal types
    const cities = searchParams.get('cities'); // comma-separated
    const zipCodes = searchParams.get('zipCodes'); // comma-separated
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');
    const minArv = searchParams.get('minArv');
    const maxArv = searchParams.get('maxArv');
    const timeSensitiveOnly = searchParams.get('timeSensitive');
    const hasPhone = searchParams.get('hasPhone');
    const priority = searchParams.get('priority');

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    const propertyWhere: any = {};

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Exclude archived unless specifically requested
    if (!searchParams.get('includeArchived')) {
      where.archivedAt = null;
    }

    // Date filters
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo) where.createdAt.lte = new Date(createdTo);
    }

    if (activityFrom || activityTo) {
      where.lastActivityAt = {};
      if (activityFrom) where.lastActivityAt.gte = new Date(activityFrom);
      if (activityTo) where.lastActivityAt.lte = new Date(activityTo);
    }

    // Score range
    if (minScore) where.totalScore = { ...where.totalScore, gte: parseFloat(minScore) };
    if (maxScore) where.totalScore = { ...where.totalScore, lte: parseFloat(maxScore) };

    // Priority
    if (priority) where.priority = priority;

    // Time sensitive
    if (timeSensitiveOnly === 'true') where.isTimeSensitive = true;

    // City filter (on property)
    if (cities) {
      const cityList = cities.split(',').map((c) => c.trim());
      propertyWhere.city = { in: cityList, mode: 'insensitive' };
    }

    // Zip code filter (on property)
    if (zipCodes) {
      const zipList = zipCodes.split(',').map((z) => z.trim());
      propertyWhere.zipCode = { in: zipList };
    }

    // ARV filter (on property)
    if (minArv || maxArv) {
      propertyWhere.estimatedValue = {};
      if (minArv) propertyWhere.estimatedValue.gte = parseFloat(minArv);
      if (maxArv) propertyWhere.estimatedValue.lte = parseFloat(maxArv);
    }

    // Phone filter
    if (hasPhone === 'true') {
      propertyWhere.ownerPhone = { not: null };
    }

    // Search (address or owner name)
    if (search) {
      propertyWhere.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply property filters
    if (Object.keys(propertyWhere).length > 0) {
      where.property = propertyWhere;
    }

    // Signal type filter — leads that have ANY of the specified signal types active
    if (signals) {
      const signalTypes = signals.split(',').map((s) => s.trim());
      where.signals = {
        some: {
          signalType: { in: signalTypes },
          isActive: true,
        },
      };
    }

    // Sort mapping
    const orderBy: any = {};
    if (sortBy === 'createdAt') orderBy.createdAt = sortDir;
    else if (sortBy === 'lastActivityAt') orderBy.lastActivityAt = sortDir;
    else if (sortBy === 'address') orderBy.property = { address: sortDir };
    else orderBy.totalScore = sortDir;

    // Query
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          property: true,
          signals: {
            where: { isActive: true },
            orderBy: { points: 'desc' },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Get distinct cities and zip codes for filter dropdowns
    const filterOptions = await prisma.property.findMany({
      where: { lead: { isNot: null } },
      select: { city: true, zipCode: true },
      distinct: ['city', 'zipCode'],
    });

    const availableCities = [...new Set(filterOptions.map((p) => p.city))].sort();
    const availableZipCodes = [...new Set(filterOptions.map((p) => p.zipCode))].sort();

    return NextResponse.json({
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filterOptions: {
        cities: availableCities,
        zipCodes: availableZipCodes,
      },
    });
  } catch (error: any) {
    console.error('Leads API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
