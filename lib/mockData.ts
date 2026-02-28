// ============================================================
// MOCK DATA - WholeSail Prototype
// Realistic Lehigh Valley area properties and leads
// This will be replaced by real database queries once Supabase is connected
// ============================================================

export interface MockProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  assessedValue: number;
  estimatedValue: number;
  estimatedEquity: number;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  isAbsenteeOwner: boolean;
  ownershipLengthMonths: number;
  isVacant: boolean;
}

export interface MockSignal {
  signalType: string;
  label: string;
  category: 'automated' | 'manual';
  points: number;
  value?: string;
  source?: string;
}

export interface MockLead {
  id: string;
  property: MockProperty;
  automatedScore: number;
  manualScore: number;
  totalScore: number;
  status: string;
  priority: string;
  isTimeSensitive: boolean;
  timeSensitiveReason?: string;
  firstDiscovered: string;
  lastContacted?: string;
  nextFollowUp?: string;
  signals: MockSignal[];
  contactHistory: MockContact[];
  notes: MockNote[];
}

export interface MockContact {
  id: string;
  type: string;
  outcome?: string;
  message?: string;
  notes?: string;
  duration?: number;
  createdAt: string;
}

export interface MockNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface MockNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  leadId?: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================
// SCORING WEIGHTS (configurable)
// ============================================================

export const defaultScoringWeights = [
  { signalType: 'pre_foreclosure', label: 'Pre-Foreclosure', category: 'automated', weight: 20, description: 'Property is in pre-foreclosure or has received NOD' },
  { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', weight: 18, description: 'Property has delinquent taxes' },
  { signalType: 'probate', label: 'Probate / Estate', category: 'automated', weight: 20, description: 'Owner deceased, property in probate' },
  { signalType: 'divorce', label: 'Divorce Filing', category: 'automated', weight: 16, description: 'Owner has a recent divorce filing' },
  { signalType: 'code_violation', label: 'Code Violation', category: 'automated', weight: 10, description: 'Property has municipal code violations' },
  { signalType: 'absentee_owner', label: 'Absentee Owner', category: 'automated', weight: 8, description: 'Owner does not live at the property' },
  { signalType: 'high_equity', label: 'High Equity', category: 'automated', weight: 12, description: 'Estimated equity above 40% of value' },
  { signalType: 'vacant', label: 'Vacant Property', category: 'automated', weight: 10, description: 'Property appears to be vacant' },
  { signalType: 'expired_listing', label: 'Expired Listing', category: 'automated', weight: 8, description: 'Property had an expired or withdrawn MLS listing' },
  { signalType: 'lien_stacking', label: 'Multiple Liens', category: 'automated', weight: 14, description: 'Property has multiple liens filed against it' },
  { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', weight: 5, description: 'Owned for 15+ years' },
  { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', weight: 6, description: 'Zip code has low wholesaler competition' },
  // Manual signals
  { signalType: 'owner_willing', label: 'Owner Willing to Sell', category: 'manual', weight: 25, description: 'Owner expressed willingness to sell during contact' },
  { signalType: 'owner_timeline', label: 'Urgent Timeline', category: 'manual', weight: 20, description: 'Owner has urgent need to sell (moving, health, etc.)' },
  { signalType: 'owner_life_event', label: 'Life Event Confirmed', category: 'manual', weight: 15, description: 'Confirmed life event: job loss, illness, relocation, etc.' },
  { signalType: 'property_condition', label: 'Poor Property Condition', category: 'manual', weight: 10, description: 'Property confirmed to be in poor condition' },
  { signalType: 'owner_responsive', label: 'Owner Responsive', category: 'manual', weight: 8, description: 'Owner is responsive to calls/texts' },
  { signalType: 'inherited', label: 'Inherited Property', category: 'manual', weight: 18, description: 'Owner confirmed they inherited the property' },
];

// ============================================================
// MOCK LEADS
// ============================================================

export const mockLeads: MockLead[] = [
  {
    id: 'lead-001',
    property: {
      id: 'prop-001',
      address: '1247 Turner St',
      city: 'Allentown',
      state: 'PA',
      zipCode: '18102',
      county: 'Lehigh',
      propertyType: 'Single Family',
      bedrooms: 3,
      bathrooms: 1.5,
      sqft: 1420,
      yearBuilt: 1952,
      assessedValue: 89000,
      estimatedValue: 142000,
      estimatedEquity: 118000,
      ownerName: 'Margaret Kowalski',
      ownerPhone: '(610) 555-0142',
      ownerEmail: 'm.kowalski@email.com',
      isAbsenteeOwner: false,
      ownershipLengthMonths: 384,
      isVacant: false,
    },
    automatedScore: 72,
    manualScore: 25,
    totalScore: 92,
    status: 'HOT',
    priority: 'urgent',
    isTimeSensitive: true,
    timeSensitiveReason: 'Probate filing discovered 3 days ago',
    firstDiscovered: '2026-02-25T10:30:00Z',
    lastContacted: '2026-02-27T14:15:00Z',
    nextFollowUp: '2026-03-01T10:00:00Z',
    signals: [
      { signalType: 'probate', label: 'Probate / Estate', category: 'automated', points: 20, value: 'Filed 2026-02-22', source: 'Lehigh County Prothonotary' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '83% equity', source: 'County Assessor' },
      { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', points: 18, value: '$4,200 owed', source: 'Lehigh County Tax Claim' },
      { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', points: 5, value: '32 years', source: 'County Records' },
      { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', points: 6, value: '18102 — Low competition' },
      { signalType: 'inherited', label: 'Inherited Property', category: 'manual', points: 18, value: 'Confirmed — husband passed Nov 2025' },
      { signalType: 'owner_responsive', label: 'Owner Responsive', category: 'manual', points: 8, value: 'Picked up on first call' },
    ],
    contactHistory: [
      { id: 'c-001', type: 'CALL_OUTBOUND', outcome: 'CONNECTED', duration: 340, notes: 'Spoke with Margaret. Husband passed in Nov. She inherited the home, overwhelmed with maintenance and tax bills. Open to hearing an offer.', createdAt: '2026-02-27T14:15:00Z' },
      { id: 'c-002', type: 'SMS_OUTBOUND', outcome: 'DELIVERED', message: 'Hi Margaret, this is regarding your property at 1247 Turner St. Would you be open to discussing a quick sale? No pressure at all.', createdAt: '2026-02-26T09:00:00Z' },
    ],
    notes: [
      { id: 'n-001', content: 'High-priority lead. Margaret is elderly, recently widowed. Property needs roof and HVAC work. She mentioned wanting to move closer to her daughter in Reading. Very motivated — follow up within 48 hours.', createdAt: '2026-02-27T14:30:00Z' },
    ],
  },
  {
    id: 'lead-002',
    property: {
      id: 'prop-002',
      address: '834 Brodhead Ave',
      city: 'Bethlehem',
      state: 'PA',
      zipCode: '18015',
      county: 'Northampton',
      propertyType: 'Single Family',
      bedrooms: 4,
      bathrooms: 2,
      sqft: 1860,
      yearBuilt: 1965,
      assessedValue: 145000,
      estimatedValue: 215000,
      estimatedEquity: 156000,
      ownerName: 'James & Linda Petroski',
      ownerPhone: '(484) 555-0287',
      isAbsenteeOwner: true,
      ownershipLengthMonths: 216,
      isVacant: true,
    },
    automatedScore: 78,
    manualScore: 0,
    totalScore: 78,
    status: 'NEW',
    priority: 'high',
    isTimeSensitive: true,
    timeSensitiveReason: 'Sheriff sale scheduled in 45 days',
    firstDiscovered: '2026-02-27T08:00:00Z',
    signals: [
      { signalType: 'pre_foreclosure', label: 'Pre-Foreclosure', category: 'automated', points: 20, value: 'Sheriff sale scheduled 04/14/2026', source: 'Northampton County Sheriff' },
      { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', points: 18, value: '$7,850 owed (2 years)', source: 'Northampton County Tax' },
      { signalType: 'absentee_owner', label: 'Absentee Owner', category: 'automated', points: 8, value: 'Owner address: Easton, PA', source: 'County Assessor' },
      { signalType: 'vacant', label: 'Vacant Property', category: 'automated', points: 10, value: 'USPS vacancy flag since Aug 2025', source: 'USPS Data' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '73% equity', source: 'County Assessor' },
      { signalType: 'lien_stacking', label: 'Multiple Liens', category: 'automated', points: 14, value: '3 liens totaling $12,400', source: 'County Prothonotary' },
    ],
    contactHistory: [],
    notes: [],
  },
  {
    id: 'lead-003',
    property: {
      id: 'prop-003',
      address: '562 Main St',
      city: 'Easton',
      state: 'PA',
      zipCode: '18042',
      county: 'Northampton',
      propertyType: 'Townhouse',
      bedrooms: 2,
      bathrooms: 1,
      sqft: 980,
      yearBuilt: 1935,
      assessedValue: 62000,
      estimatedValue: 105000,
      estimatedEquity: 72000,
      ownerName: 'Robert Garcia',
      ownerPhone: '(610) 555-0391',
      isAbsenteeOwner: false,
      ownershipLengthMonths: 60,
      isVacant: false,
    },
    automatedScore: 52,
    manualScore: 15,
    totalScore: 64,
    status: 'CONTACTED',
    priority: 'normal',
    isTimeSensitive: false,
    firstDiscovered: '2026-02-20T12:00:00Z',
    lastContacted: '2026-02-25T11:30:00Z',
    nextFollowUp: '2026-03-04T10:00:00Z',
    signals: [
      { signalType: 'divorce', label: 'Divorce Filing', category: 'automated', points: 16, value: 'Filed 2026-01-10', source: 'Northampton County Court' },
      { signalType: 'code_violation', label: 'Code Violation', category: 'automated', points: 10, value: 'Exterior maintenance violation', source: 'City of Easton' },
      { signalType: 'expired_listing', label: 'Expired Listing', category: 'automated', points: 8, value: 'Listed at $119K, expired Dec 2025', source: 'MLS' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '69% equity' },
      { signalType: 'owner_life_event', label: 'Life Event Confirmed', category: 'manual', points: 15, value: 'Going through divorce, needs to sell to split assets' },
    ],
    contactHistory: [
      { id: 'c-003', type: 'CALL_OUTBOUND', outcome: 'CONNECTED', duration: 180, notes: 'Robert answered. Going through divorce. Needs to sell to split assets with ex-wife. Not in a huge rush but wants to get it done in the next 2-3 months.', createdAt: '2026-02-25T11:30:00Z' },
      { id: 'c-004', type: 'SMS_OUTBOUND', outcome: 'REPLIED', message: 'Hi Robert, reaching out about your property at 562 Main St. Are you considering selling?', createdAt: '2026-02-23T09:00:00Z' },
    ],
    notes: [
      { id: 'n-002', content: 'Decent lead but not urgent. Previous listing expired — he may have unrealistic price expectations. Tread carefully on price discussion.', createdAt: '2026-02-25T11:45:00Z' },
    ],
  },
  {
    id: 'lead-004',
    property: {
      id: 'prop-004',
      address: '2105 Walbert Ave',
      city: 'Allentown',
      state: 'PA',
      zipCode: '18104',
      county: 'Lehigh',
      propertyType: 'Single Family',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1650,
      yearBuilt: 1978,
      assessedValue: 162000,
      estimatedValue: 238000,
      estimatedEquity: 238000,
      ownerName: 'Dorothy Fischer',
      ownerPhone: '(610) 555-0564',
      isAbsenteeOwner: true,
      ownershipLengthMonths: 480,
      isVacant: true,
    },
    automatedScore: 58,
    manualScore: 0,
    totalScore: 58,
    status: 'NEW',
    priority: 'normal',
    isTimeSensitive: false,
    firstDiscovered: '2026-02-26T16:00:00Z',
    signals: [
      { signalType: 'absentee_owner', label: 'Absentee Owner', category: 'automated', points: 8, value: 'Owner in Whitehall Township', source: 'County Assessor' },
      { signalType: 'vacant', label: 'Vacant Property', category: 'automated', points: 10, value: 'Vacant since Apr 2025', source: 'USPS Data' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '100% equity — owned free and clear' },
      { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', points: 5, value: '40 years' },
      { signalType: 'code_violation', label: 'Code Violation', category: 'automated', points: 10, value: 'Grass/weeds violation, broken window reported', source: 'City of Allentown' },
      { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', points: 6, value: '18104 — Low competition' },
    ],
    contactHistory: [],
    notes: [],
  },
  {
    id: 'lead-005',
    property: {
      id: 'prop-005',
      address: '419 Raspberry St',
      city: 'Bethlehem',
      state: 'PA',
      zipCode: '18018',
      county: 'Northampton',
      propertyType: 'Multi Family',
      bedrooms: 6,
      bathrooms: 3,
      sqft: 2400,
      yearBuilt: 1928,
      assessedValue: 128000,
      estimatedValue: 195000,
      estimatedEquity: 62000,
      ownerName: 'Michael Torres',
      ownerPhone: '(484) 555-0712',
      isAbsenteeOwner: true,
      ownershipLengthMonths: 96,
      isVacant: false,
    },
    automatedScore: 46,
    manualScore: 0,
    totalScore: 46,
    status: 'NEW',
    priority: 'normal',
    isTimeSensitive: false,
    firstDiscovered: '2026-02-24T09:00:00Z',
    signals: [
      { signalType: 'code_violation', label: 'Code Violation', category: 'automated', points: 10, value: 'Multiple violations: plumbing, electrical', source: 'City of Bethlehem' },
      { signalType: 'absentee_owner', label: 'Absentee Owner', category: 'automated', points: 8, value: 'Owner in Phillipsburg, NJ', source: 'County Assessor' },
      { signalType: 'tax_delinquent', label: 'Tax Delinquent', category: 'automated', points: 18, value: '$3,100 owed', source: 'Northampton County Tax' },
      { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', points: 6, value: '18018 — Moderate competition' },
    ],
    contactHistory: [],
    notes: [],
  },
  {
    id: 'lead-006',
    property: {
      id: 'prop-006',
      address: '1538 Linden St',
      city: 'Allentown',
      state: 'PA',
      zipCode: '18102',
      county: 'Lehigh',
      propertyType: 'Single Family',
      bedrooms: 3,
      bathrooms: 1,
      sqft: 1150,
      yearBuilt: 1940,
      assessedValue: 58000,
      estimatedValue: 95000,
      estimatedEquity: 95000,
      ownerName: 'Estate of Harold Weiss',
      ownerPhone: '(610) 555-0823',
      isAbsenteeOwner: false,
      ownershipLengthMonths: 540,
      isVacant: true,
    },
    automatedScore: 68,
    manualScore: 0,
    totalScore: 68,
    status: 'NEW',
    priority: 'high',
    isTimeSensitive: true,
    timeSensitiveReason: 'Probate filing — estate executor listed',
    firstDiscovered: '2026-02-28T07:00:00Z',
    signals: [
      { signalType: 'probate', label: 'Probate / Estate', category: 'automated', points: 20, value: 'Filed 2026-02-20, Executor: Susan Weiss-Miller', source: 'Lehigh County Prothonotary' },
      { signalType: 'vacant', label: 'Vacant Property', category: 'automated', points: 10, value: 'Confirmed vacant', source: 'USPS Data' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '100% equity — free and clear' },
      { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', points: 5, value: '45 years' },
      { signalType: 'code_violation', label: 'Code Violation', category: 'automated', points: 10, value: 'Structural deterioration noted', source: 'City of Allentown' },
      { signalType: 'low_saturation', label: 'Low Zip Saturation', category: 'automated', points: 6, value: '18102 — Low competition' },
    ],
    contactHistory: [],
    notes: [],
  },
  {
    id: 'lead-007',
    property: {
      id: 'prop-007',
      address: '729 Spring Garden St',
      city: 'Easton',
      state: 'PA',
      zipCode: '18042',
      county: 'Northampton',
      propertyType: 'Single Family',
      bedrooms: 2,
      bathrooms: 1,
      sqft: 900,
      yearBuilt: 1948,
      assessedValue: 72000,
      estimatedValue: 118000,
      estimatedEquity: 84000,
      ownerName: 'Patricia Novak',
      ownerPhone: '(610) 555-0456',
      isAbsenteeOwner: false,
      ownershipLengthMonths: 240,
      isVacant: false,
    },
    automatedScore: 34,
    manualScore: 0,
    totalScore: 34,
    status: 'CONTACTED',
    priority: 'low',
    isTimeSensitive: false,
    firstDiscovered: '2026-02-15T14:00:00Z',
    lastContacted: '2026-02-22T10:00:00Z',
    signals: [
      { signalType: 'expired_listing', label: 'Expired Listing', category: 'automated', points: 8, value: 'Listed $135K, withdrawn Oct 2025', source: 'MLS' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '71% equity' },
      { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', points: 5, value: '20 years' },
    ],
    contactHistory: [
      { id: 'c-005', type: 'CALL_OUTBOUND', outcome: 'NOT_INTERESTED', duration: 45, notes: 'Said she\'s not interested in selling right now. Tried listing last year, didn\'t get her price. Maybe revisit in 6 months.', createdAt: '2026-02-22T10:00:00Z' },
    ],
    notes: [],
  },
  {
    id: 'lead-008',
    property: {
      id: 'prop-008',
      address: '305 E 4th St',
      city: 'Bethlehem',
      state: 'PA',
      zipCode: '18015',
      county: 'Northampton',
      propertyType: 'Townhouse',
      bedrooms: 3,
      bathrooms: 1.5,
      sqft: 1320,
      yearBuilt: 1955,
      assessedValue: 98000,
      estimatedValue: 165000,
      estimatedEquity: 110000,
      ownerName: 'Thomas Brennan',
      ownerPhone: '(484) 555-0199',
      isAbsenteeOwner: false,
      ownershipLengthMonths: 144,
      isVacant: false,
    },
    automatedScore: 44,
    manualScore: 20,
    totalScore: 60,
    status: 'WARM',
    priority: 'normal',
    isTimeSensitive: false,
    firstDiscovered: '2026-02-18T11:00:00Z',
    lastContacted: '2026-02-26T16:00:00Z',
    nextFollowUp: '2026-03-05T10:00:00Z',
    signals: [
      { signalType: 'divorce', label: 'Divorce Filing', category: 'automated', points: 16, value: 'Filed 2025-12-01', source: 'Northampton County Court' },
      { signalType: 'high_equity', label: 'High Equity', category: 'automated', points: 12, value: '67% equity' },
      { signalType: 'long_ownership', label: 'Long-Term Ownership', category: 'automated', points: 5, value: '12 years' },
      { signalType: 'owner_willing', label: 'Owner Willing to Sell', category: 'manual', points: 25, value: 'Wants to sell within 60 days' },
    ],
    contactHistory: [
      { id: 'c-006', type: 'CALL_OUTBOUND', outcome: 'INTERESTED', duration: 420, notes: 'Tom is going through a divorce. Needs to sell the house as part of the settlement. Wants a quick close within 60 days. Open to an offer around $130K.', createdAt: '2026-02-26T16:00:00Z' },
      { id: 'c-007', type: 'SMS_OUTBOUND', outcome: 'REPLIED', message: 'Hi Thomas, this is regarding your property at 305 E 4th St in Bethlehem. Would you have a few minutes to chat about a potential sale?', createdAt: '2026-02-24T09:00:00Z' },
    ],
    notes: [
      { id: 'n-003', content: 'Solid lead. Tom wants to move fast due to divorce settlement deadline. He mentioned $130K — ARV is $165K so there is room for a deal. Schedule in-person meeting.', createdAt: '2026-02-26T16:15:00Z' },
    ],
  },
];

// ============================================================
// MOCK NOTIFICATIONS
// ============================================================

export const mockNotifications: MockNotification[] = [
  {
    id: 'notif-001',
    type: 'TIME_SENSITIVE_EVENT',
    title: 'New Probate Filing',
    message: '1538 Linden St, Allentown — Estate of Harold Weiss. Executor listed. Score: 68',
    leadId: 'lead-006',
    isRead: false,
    createdAt: '2026-02-28T07:00:00Z',
  },
  {
    id: 'notif-002',
    type: 'NEW_HIGH_SCORE_LEAD',
    title: 'High-Score Lead Discovered',
    message: '834 Brodhead Ave, Bethlehem — Pre-foreclosure + vacant + multiple liens. Score: 78',
    leadId: 'lead-002',
    isRead: false,
    createdAt: '2026-02-27T08:00:00Z',
  },
  {
    id: 'notif-003',
    type: 'FOLLOW_UP_DUE',
    title: 'Follow-Up Due Tomorrow',
    message: '1247 Turner St, Allentown — Margaret Kowalski. Follow up scheduled for March 1st.',
    leadId: 'lead-001',
    isRead: true,
    createdAt: '2026-02-27T18:00:00Z',
  },
  {
    id: 'notif-004',
    type: 'INBOUND_REPLY',
    title: 'SMS Reply Received',
    message: 'Thomas Brennan replied: "Yes, I\'d be open to chatting. Call me after 4pm."',
    leadId: 'lead-008',
    isRead: true,
    createdAt: '2026-02-24T14:22:00Z',
  },
];

// ============================================================
// DASHBOARD STATS
// ============================================================

export const mockDashboardStats = {
  totalLeads: 847,
  newThisWeek: 23,
  contacted: 312,
  warm: 45,
  hot: 8,
  underContract: 3,
  handedOff: 12,
  closed: 6,
  callsMadeToday: 14,
  textsSentToday: 28,
  responsesReceived: 5,
  followUpsDueToday: 4,
  avgResponseRate: 18.4,
  avgTimeToContact: 4.2, // hours
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getScoreColor(score: number): string {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'medium';
  return 'cold';
}

export function getScoreColorHex(score: number): string {
  if (score >= 80) return '#0A7E8C';
  if (score >= 60) return '#1B98A8';
  if (score >= 40) return '#F59E0B';
  return '#94A3B8';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: 'New',
    CONTACTED: 'Contacted',
    WARM: 'Warm',
    HOT: 'Hot',
    UNDER_CONTRACT: 'Under Contract',
    HANDED_OFF: 'Handed Off',
    CLOSED: 'Closed',
    DEAD: 'Dead',
    DO_NOT_CONTACT: 'Do Not Contact',
  };
  return map[status] || status;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    NEW: 'info',
    CONTACTED: 'info',
    WARM: 'warning',
    HOT: 'danger',
    UNDER_CONTRACT: 'success',
    HANDED_OFF: 'info',
    CLOSED: 'success',
    DEAD: 'neutral',
    DO_NOT_CONTACT: 'neutral',
  };
  return map[status] || 'neutral';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getSignalTagColor(signalType: string): string {
  const urgentSignals = ['pre_foreclosure', 'probate', 'tax_delinquent', 'lien_stacking', 'owner_willing', 'owner_timeline'];
  const warningSignals = ['divorce', 'code_violation', 'inherited', 'owner_life_event', 'property_condition'];
  const infoSignals = ['absentee_owner', 'vacant', 'expired_listing', 'owner_responsive'];

  if (urgentSignals.includes(signalType)) return 'danger';
  if (warningSignals.includes(signalType)) return 'warning';
  if (infoSignals.includes(signalType)) return 'info';
  return 'neutral';
}
