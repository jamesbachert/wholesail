import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeAddress } from '@/lib/connectors/address-utils';
import { recalculateScore } from '@/lib/connectors/scoring';
import { getNewLeadThresholdDays } from '@/lib/settings';

// POST /api/leads — create a new lead manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, city, state, zipCode, county, ownerName, ownerPhone, ownerEmail,
            propertyType, bedrooms, bathrooms, sqft, yearBuilt, signals } = body;

    // Validate required fields
    if (!address || !city || !state || !zipCode) {
      return NextResponse.json(
        { error: 'Address, city, state, and zip code are required' },
        { status: 400 }
      );
    }

    // Normalize address for dedup
    const normalizedAddr = normalizeAddress(address);

    // Check for duplicate property
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
      return NextResponse.json(
        {
          duplicate: true,
          leadId: existingProperty.lead.id,
          address: existingProperty.address,
          city: existingProperty.city,
        },
        { status: 409 }
      );
    }

    // Auto-assign region by zip code
    const region = await prisma.region.findFirst({
      where: { zipCodes: { has: zipCode }, isActive: true },
    });

    if (!region) {
      return NextResponse.json(
        { error: `Zip code ${zipCode} is not in a supported region yet` },
        { status: 400 }
      );
    }

    // Build property data
    const propertyData: any = {
      address,
      city,
      state,
      zipCode,
    };
    if (county) propertyData.county = county;
    if (ownerName) propertyData.ownerName = ownerName;
    if (ownerPhone) propertyData.ownerPhone = ownerPhone;
    if (ownerEmail) propertyData.ownerEmail = ownerEmail;
    if (propertyType) propertyData.propertyType = propertyType;
    if (bedrooms) propertyData.bedrooms = parseInt(bedrooms);
    if (bathrooms) propertyData.bathrooms = parseInt(bathrooms);
    if (sqft) propertyData.sqft = parseInt(sqft);
    if (yearBuilt) propertyData.yearBuilt = parseInt(yearBuilt);

    // Create property (or reuse existing one without a lead)
    const property = existingProperty || await prisma.property.create({ data: propertyData });

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        propertyId: property.id,
        regionId: region.id,
        status: 'COLD',
      },
    });

    // Add any manually-selected signals
    if (signals && Array.isArray(signals) && signals.length > 0) {
      // Get scoring weights for proper point values
      const weights = await prisma.scoringWeight.findMany({ where: { isActive: true } });
      const weightMap = new Map(weights.map((w) => [w.signalType, w]));

      // Fallback labels/weights for signal types not yet in the ScoringWeight table
      const FALLBACK: Record<string, { label: string; weight: number; category: string }> = {
        pre_foreclosure:     { label: 'Pre-Foreclosure',        weight: 20, category: 'distress' },
        probate:             { label: 'Probate / Estate',        weight: 20, category: 'distress' },
        tax_delinquent:      { label: 'Tax Delinquent',          weight: 18, category: 'distress' },
        divorce:             { label: 'Divorce',                 weight: 16, category: 'distress' },
        code_violation:      { label: 'Code Violation',          weight: 10, category: 'distress' },
        liens_judgments:     { label: 'Liens / Judgments',       weight: 14, category: 'distress' },
        owner_deceased:      { label: 'Owner Deceased',          weight: 18, category: 'ownership' },
        inherited:           { label: 'Inherited',               weight: 18, category: 'ownership' },
        absentee_owner:      { label: 'Absentee Owner',          weight: 8,  category: 'ownership' },
        out_of_state_owner:  { label: 'Out-of-State Owner',      weight: 8,  category: 'ownership' },
        tired_landlord:      { label: 'Tired Landlord',          weight: 10, category: 'ownership' },
        rental_property:     { label: 'Rental Property',         weight: 8,  category: 'ownership' },
        bankruptcy:          { label: 'Bankruptcy',              weight: 16, category: 'financial' },
        high_equity:         { label: 'High Equity (50%+)',      weight: 12, category: 'financial' },
        free_and_clear:      { label: 'Owned Free & Clear',      weight: 10, category: 'financial' },
        job_loss:            { label: 'Job Loss / Income Drop',  weight: 12, category: 'financial' },
        vacant:              { label: 'Vacant Property',         weight: 10, category: 'condition' },
        fire_flood_damage:   { label: 'Fire / Flood Damage',     weight: 14, category: 'condition' },
        deferred_maintenance:{ label: 'Deferred Maintenance',    weight: 8,  category: 'condition' },
      };

      for (const signalType of signals) {
        const weight = weightMap.get(signalType);
        const fallback = FALLBACK[signalType];
        if (!weight && !fallback) continue; // Unknown signal type

        await prisma.leadSignal.create({
          data: {
            leadId: lead.id,
            signalType,
            label: weight?.label ?? fallback?.label ?? signalType,
            category: weight?.category ?? fallback?.category ?? 'manual',
            points: weight?.weight ?? fallback?.weight ?? 10,
            source: 'Manual entry',
            isAutomated: false,
            isLocked: false,
            isActive: true,
          },
        });
      }

      await recalculateScore(lead.id);
    }

    return NextResponse.json({ lead: { id: lead.id, propertyId: property.id } }, { status: 201 });
  } catch (error: any) {
    console.error('Create lead error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/leads — list leads with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Region filter
    const regionSlug = searchParams.get('region');

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
    const needsReviewOnly = searchParams.get('needsReview');
    const hasPhone = searchParams.get('hasPhone');
    const priority = searchParams.get('priority');
    const minCodeViolations = parseInt(searchParams.get('minCodeViolations') || '0');

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    const propertyWhere: any = {};

    // Region filter — scope leads to the active region
    if (regionSlug) {
      where.region = { slug: regionSlug };
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Exclude archived unless specifically requested, filtering by archive status, or filtering by needsReview
    if (!searchParams.get('includeArchived') && status !== 'ARCHIVE' && needsReviewOnly !== 'true') {
      where.archivedAt = null;
      // Also exclude by status for legacy leads that were archived before archivedAt was tracked
      if (!where.status) {
        where.status = { not: 'ARCHIVE' };
      }
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

    // Needs review
    if (needsReviewOnly === 'true') {
      where.needsReview = true;
      where.needsReviewDismissedAt = null;
    }

    // "New" computed filter — leads that haven't been viewed or were recently created
    const isNew = searchParams.get('isNew');
    let thresholdDays = 14;
    if (isNew === 'true') {
      thresholdDays = await getNewLeadThresholdDays();
      const newCutoff = new Date();
      newCutoff.setDate(newCutoff.getDate() - thresholdDays);
      where.OR = [
        { firstViewedAt: null },
        { createdAt: { gte: newCutoff } },
      ];
    }

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
    const prioritizeTS = searchParams.get('prioritizeTimeSensitive') === 'true';
    let orderBy: any;

    if (prioritizeTS) {
      // Multi-field sort: time-sensitive leads first, then by score/field
      const secondary: any = {};
      if (sortBy === 'createdAt') secondary.createdAt = sortDir;
      else if (sortBy === 'lastActivityAt') secondary.lastActivityAt = sortDir;
      else if (sortBy === 'address') secondary.property = { address: sortDir };
      else secondary.totalScore = sortDir;
      orderBy = [{ isTimeSensitive: 'desc' }, secondary];
    } else {
      orderBy = {};
      if (sortBy === 'createdAt') orderBy.createdAt = sortDir;
      else if (sortBy === 'lastActivityAt') orderBy.lastActivityAt = sortDir;
      else if (sortBy === 'address') orderBy.property = { address: sortDir };
      else orderBy.totalScore = sortDir;
    }

    // When filtering by code violation count, fetch all matching leads first
    // then post-filter (Prisma can't do HAVING on related record counts)
    const usePostFilter = minCodeViolations > 0;

    let [leads, total] = await Promise.all([
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
        skip: usePostFilter ? undefined : skip,
        take: usePostFilter ? undefined : limit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Post-filter by code violation count
    if (usePostFilter) {
      leads = leads.filter((lead) => {
        const cvCount = lead.signals.filter(
          (s) => s.signalType === 'code_violation'
        ).length;
        return cvCount >= minCodeViolations;
      });
      total = leads.length;
      leads = leads.slice(skip, skip + limit);
    }

    // Get distinct cities and zip codes for filter dropdowns (scoped to region)
    // Use `is` for one-to-one relation filtering (Prisma doesn't allow mixing isNot with nested relations)
    const filterWhere: any = { lead: { isNot: null } };
    if (regionSlug) {
      filterWhere.lead = { is: { region: { slug: regionSlug } } };
    }
    const filterOptions = await prisma.property.findMany({
  where: filterWhere,
  select: { city: true, zipCode: true },
});

// Dedupe cities case-insensitively: normalize to title case, trim whitespace
const citySet = new Map<string, string>();
for (const p of filterOptions) {
  if (!p.city) continue;
  const key = p.city.trim().toLowerCase();
  if (!citySet.has(key)) {
    // Store the title-cased version
    citySet.set(key, key.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  }
}
const availableCities = [...citySet.values()].sort();
const availableZipCodes = [...new Set(filterOptions.map((p) => p.zipCode))]
  .filter(Boolean)
  .sort();

    // Always include threshold for "New" badge computation client-side
    if (!thresholdDays || thresholdDays === 14) {
      thresholdDays = await getNewLeadThresholdDays();
    }

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
      newLeadThresholdDays: thresholdDays,
    });
  } catch (error: any) {
    console.error('Leads API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
