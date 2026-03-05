import { prisma } from './prisma';
import { LeadStatus, ContactType, ContactOutcome } from '@prisma/client';

// ============================================================
// LEADS
// ============================================================

export async function getLeads(options?: {
  status?: LeadStatus;
  regionSlug?: string;
  search?: string;
  sortBy?: 'totalScore' | 'firstDiscovered' | 'lastContacted';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}) {
  const {
    status,
    regionSlug,
    search,
    sortBy = 'totalScore',
    sortDir = 'desc',
    limit = 50,
    offset = 0,
  } = options || {};

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (regionSlug) {
    where.region = { slug: regionSlug };
  }

  if (search) {
    where.OR = [
      { property: { address: { contains: search, mode: 'insensitive' } } },
      { property: { city: { contains: search, mode: 'insensitive' } } },
      { property: { ownerName: { contains: search, mode: 'insensitive' } } },
      { property: { zipCode: { contains: search } } },
    ];
  }

  const orderBy: any = {};
  if (sortBy === 'totalScore') orderBy.totalScore = sortDir;
  else if (sortBy === 'firstDiscovered') orderBy.firstDiscovered = sortDir;
  else if (sortBy === 'lastContacted') orderBy.lastContacted = sortDir;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        property: true,
        signals: true,
        region: true,
        contacts: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { contacts: true, notes: true } },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total };
}

export async function getLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      property: true,
      signals: { orderBy: { points: 'desc' } },
      contacts: { orderBy: { createdAt: 'desc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      region: true,
      handoffs: { include: { partner: true }, orderBy: { createdAt: 'desc' } },
      _count: { select: { enrichmentLogs: true } },
    },
  });
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  return prisma.lead.update({
    where: { id },
    data: { status },
  });
}

export async function updateLeadScore(leadId: string) {
  // Recalculate score from signals
  const signals = await prisma.leadSignal.findMany({ where: { leadId } });
  const weights = await prisma.scoringWeight.findMany();

  let automatedScore = 0;
  let manualScore = 0;

  for (const signal of signals) {
    if (signal.category === 'automated') automatedScore += signal.points;
    else manualScore += signal.points;
  }

  // Cap at 100
  const totalScore = Math.min(automatedScore + manualScore, 100);

  return prisma.lead.update({
    where: { id: leadId },
    data: { automatedScore, manualScore, totalScore },
  });
}

// ============================================================
// LEADS - CREATE (for importing from data sources)
// ============================================================

export async function createLeadFromProperty(data: {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  assessedValue?: number;
  estimatedValue?: number;
  estimatedEquity?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  isAbsenteeOwner?: boolean;
  ownershipLength?: number;
  isVacant?: boolean;
  regionId: string;
  signals?: Array<{
    signalType: string;
    label: string;
    category: string;
    points: number;
    value?: string;
    source?: string;
  }>;
}) {
  const { signals, regionId, ...propertyData } = data;

  // Check if property already exists at this address
  const existing = await prisma.property.findFirst({
    where: {
      address: { equals: data.address, mode: 'insensitive' },
      city: { equals: data.city, mode: 'insensitive' },
      state: data.state,
    },
    include: { lead: true },
  });

  if (existing?.lead) {
    // Property and lead already exist — add any new signals
    if (signals) {
      for (const signal of signals) {
        const existingSignal = await prisma.leadSignal.findFirst({
          where: { leadId: existing.lead.id, signalType: signal.signalType },
        });
        if (!existingSignal) {
          await prisma.leadSignal.create({
            data: { ...signal, leadId: existing.lead.id },
          });
        }
      }
      await updateLeadScore(existing.lead.id);
    }
    return existing.lead;
  }

  // Create property
  const property = existing || await prisma.property.create({ data: propertyData });

  // Create lead
  const lead = await prisma.lead.create({
    data: {
      propertyId: property.id,
      regionId,
      status: 'NEW',
    },
  });

  // Add signals
  if (signals) {
    await prisma.leadSignal.createMany({
      data: signals.map((s) => ({ ...s, leadId: lead.id })),
    });
    await updateLeadScore(lead.id);
  }

  return lead;
}

// ============================================================
// PROPERTY UPDATES
// ============================================================

export async function updateProperty(propertyId: string, data: {
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  county?: string;
  isVacant?: boolean;
  isAbsenteeOwner?: boolean;
  isRentalProperty?: boolean | null;
  rentalLicenseExpiration?: Date | null;
  rentalLicenseNumber?: string | null;
  ownerName?: string;
  ownerPhone?: string;
  ownerPhone2?: string;
  ownerEmail?: string;
  ownerMailingAddress?: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
}) {
  return prisma.property.update({
    where: { id: propertyId },
    data,
  });
}

// ============================================================
// CONTACTS
// ============================================================

export async function addContactLog(data: {
  leadId: string;
  type: ContactType;
  outcome?: ContactOutcome;
  duration?: number;
  message?: string;
  notes?: string;
}) {
  const contact = await prisma.contactLog.create({ data });

  // Update lead's lastContacted
  await prisma.lead.update({
    where: { id: data.leadId },
    data: { lastContacted: new Date() },
  });

  // If outcome indicates interest, potentially upgrade status
  if (data.outcome === 'INTERESTED') {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (lead && (lead.status === 'NEW' || lead.status === 'CONTACTED')) {
      await prisma.lead.update({
        where: { id: data.leadId },
        data: { status: 'WARM' },
      });
    }
  }

  // If outcome is DO_NOT_CALL, update status
  if (data.outcome === 'DO_NOT_CALL') {
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { status: 'DO_NOT_CONTACT' },
    });
  }

  // If first contact, move from NEW to CONTACTED
  if (await lead_is_new(data.leadId)) {
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { status: 'CONTACTED' },
    });
  }

  return contact;
}

async function lead_is_new(leadId: string): Promise<boolean> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  return lead?.status === 'NEW';
}

// ============================================================
// NOTES
// ============================================================

export async function addNote(data: { leadId: string; content: string }) {
  return prisma.leadNote.create({ data });
}

export async function updateNote(id: string, content: string) {
  return prisma.leadNote.update({ where: { id }, data: { content } });
}

export async function deleteNote(id: string) {
  return prisma.leadNote.delete({ where: { id } });
}

// ============================================================
// SIGNALS (manual enrichment)
// ============================================================

export async function addManualSignal(data: {
  leadId: string;
  signalType: string;
  label: string;
  value?: string;
  points: number;
}) {
  const signal = await prisma.leadSignal.create({
    data: {
      ...data,
      category: 'manual',
    },
  });

  await updateLeadScore(data.leadId);
  return signal;
}

export async function removeSignal(id: string) {
  const signal = await prisma.leadSignal.findUnique({ where: { id } });
  if (!signal) return null;

  await prisma.leadSignal.delete({ where: { id } });
  await updateLeadScore(signal.leadId);
  return signal;
}

// ============================================================
// SCORING WEIGHTS
// ============================================================

export async function getScoringWeights() {
  return prisma.scoringWeight.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function updateScoringWeight(signalType: string, weight: number) {
  return prisma.scoringWeight.update({
    where: { signalType },
    data: { weight },
  });
}

// ============================================================
// REGIONS
// ============================================================

export async function getRegions() {
  return prisma.region.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { leads: true, dataSources: true } },
    },
  });
}

export async function getActiveRegion() {
  return prisma.region.findFirst({ where: { isActive: true } });
}

// ============================================================
// DATA SOURCES
// ============================================================

export async function getDataSources(regionId?: string) {
  const where: any = {};
  if (regionId) where.regionId = regionId;

  return prisma.dataSource.findMany({
    where,
    include: {
      region: true,
      _count: { select: { records: true } },
    },
    orderBy: { name: 'asc' },
  });
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function getNotifications(unreadOnly = false) {
  const where: any = { isDismissed: false };
  if (unreadOnly) where.isRead = false;

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

// ============================================================
// WHOLESALE PARTNERS
// ============================================================

export async function getPartners() {
  return prisma.wholesalePartner.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { handoffs: true } },
    },
    orderBy: { name: 'asc' },
  });
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getDashboardStats(regionId?: string) {
  const where: any = {};
  if (regionId) where.regionId = regionId;

  // Single grouped query instead of 8 separate count() calls
  const statusCounts = await prisma.lead.groupBy({
    by: ['status'],
    where,
    _count: true,
  });

  const countByStatus = (status: string) =>
    statusCounts.find((s) => s.status === status)?._count ?? 0;

  const totalLeads = statusCounts.reduce((sum, s) => sum + s._count, 0);

  // Today's activity — single grouped query instead of 3 separate count() calls
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [activityCounts, followUpsDue] = await Promise.all([
    prisma.contactLog.groupBy({
      by: ['type'],
      where: { createdAt: { gte: todayStart } },
      _count: true,
    }),
    prisma.lead.count({
      where: {
        ...where,
        nextFollowUp: { gte: todayStart, lte: todayEnd },
      },
    }),
  ]);

  const countByType = (types: string[]) =>
    activityCounts
      .filter((a) => types.includes(a.type))
      .reduce((sum, a) => sum + a._count, 0);

  return {
    totalLeads,
    newThisWeek: countByStatus('NEW'),
    contacted: countByStatus('CONTACTED'),
    warm: countByStatus('WARM'),
    hot: countByStatus('HOT'),
    underContract: countByStatus('UNDER_CONTRACT'),
    handedOff: countByStatus('HANDED_OFF'),
    closed: countByStatus('CLOSED'),
    callsMadeToday: countByType(['CALL_OUTBOUND']),
    textsSentToday: countByType(['SMS_OUTBOUND']),
    responsesReceived: countByType(['SMS_INBOUND', 'CALL_INBOUND']),
    followUpsDueToday: followUpsDue,
  };
}
