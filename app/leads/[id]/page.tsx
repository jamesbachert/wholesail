'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  Send,
  MapPin,
  Home,
  Calendar,
  Clock,
  AlertTriangle,
  Plus,
  User,
  DollarSign,
  TrendingUp,
  Pencil,
  PhoneCall,
  MessageCircle,
  FileText,
  Loader2,
  Zap,
  Check,
  X,
  Search,
  Trash2,
  Calculator,
  ChevronDown,
} from 'lucide-react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/lib/hooks';
import {
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
} from '@/lib/mockData';
import { SignalsTab } from '@/components/leads/SignalsTab';
import { EnrichmentTab } from '@/components/leads/EnrichmentTab';
import { CallMode } from '@/components/leads/CallMode';
import { TextDialog } from '@/components/leads/TextDialog';
import { PropertyStoryTimeline } from '@/components/leads/PropertyStoryTimeline';
import { StreetViewButton } from '@/components/leads/StreetViewModal';
import { AbsenteeSignalDialog } from '@/components/leads/AbsenteeSignalDialog';
import { isMailingDifferent } from '@/lib/address-compare';
import { formatPhone, formatPhoneInput, stripPhone } from '@/lib/phone';

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'WARM', label: 'Warm' },
  { value: 'HOT', label: 'Hot' },
  { value: 'UNDER_CONTRACT', label: 'Under Contract' },
  { value: 'HANDED_OFF', label: 'Handed Off' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVE', label: 'Archived' },
  { value: 'DO_NOT_CONTACT', label: 'Do Not Contact' },
];

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: lead, loading, refetch } = useApi<any>(`/api/leads/${id}`);

  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'activity-log' | 'notes' | 'enrichment'>('overview');
  const [prevTab, setPrevTab] = useState<string>('overview');
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [liveSignalCount, setLiveSignalCount] = useState<number | null>(null);

  // Keep signal count badge in sync with fresh lead data (e.g. after enrichment refetch)
  useEffect(() => {
    if (lead?.signals) {
      const count = lead.signals.filter((s: any) => s.isActive !== false).length;
      setLiveSignalCount(count);
    }
  }, [lead]);

  // Refetch when navigating AWAY from signals tab (not on every click)
  const handleTabChange = (tab: typeof activeTab) => {
    if (activeTab === 'signals' && tab !== 'signals') {
      refetch();
    }
    setPrevTab(activeTab);
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex items-center justify-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 size={20} className="animate-spin" /> Loading lead...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>Lead not found</p>
        <Link href="/leads" className="ws-btn-primary mt-4 inline-flex">
          <ArrowLeft size={16} /> Back to Leads
        </Link>
      </div>
    );
  }

  // Normalize data shape
  const property = lead.property || lead;
  const signals = lead.signals || [];
  const contactHistory = lead.contacts || [];
  const notes = lead.notes || [];

  // Signal summary for overview tab
  const activeSignals = signals.filter((s: any) => s.isActive !== false);
  const distressSignals = activeSignals.filter((s: any) => s.category === 'distress');

  // Time-sensitive: only show if the deadline/event is in the future
  const isTimeSensitiveCurrent = (() => {
    if (!lead.isTimeSensitive) return false;
    // Check explicit deadline field first
    if (lead.timeSensitiveDeadline) {
      return new Date(lead.timeSensitiveDeadline) >= new Date();
    }
    // Parse date from reason string like "Event scheduled: 2026-02-09"
    const match = lead.timeSensitiveReason?.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return new Date(match[1]) >= new Date(new Date().toISOString().split('T')[0]);
    }
    // No date to check — show it
    return true;
  })();

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await apiPost(`/api/leads/${id}/notes`, { content: newNote.trim() });
      setNewNote('');
      refetch();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await apiPatch(`/api/leads/${id}`, { status: newStatus });
      refetch();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                {property.address}
              </h1>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
              >
                {lead.totalScore}
              </div>
              {isTimeSensitiveCurrent && (
                <span className="ws-tag ws-tag-danger"><AlertTriangle size={12} /> Time Sensitive</span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {property.city}, {property.state} {property.zipCode}
              {property.county ? ` · ${property.county} County` : ''}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-0 md:ml-11">
          <button onClick={() => setShowCallDialog(true)} className="ws-btn-primary text-xs">
            <Phone size={14} /> Call
          </button>
          <button onClick={() => setShowTextDialog(true)} className="ws-btn-secondary text-xs"><MessageSquare size={14} /> Text</button>
          <button className="ws-btn-secondary text-xs"><Mail size={14} /> Email</button>
          <button className="ws-btn-secondary text-xs"><Send size={14} /> Hand Off</button>
          <div className="flex-1" />
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`ws-status ws-status-${lead.status.toLowerCase()} text-sm font-medium rounded-lg px-3 py-1.5 border cursor-pointer appearance-none bg-no-repeat`}
            style={{
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-elevated)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundPosition: 'right 8px center',
              paddingRight: '28px',
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Time Sensitive Banner — only show for current/future events */}
      {isTimeSensitiveCurrent && lead.timeSensitiveReason && (
        <div className="ws-card p-4 border-l-4 ml-0 md:ml-11" style={{ borderLeftColor: 'var(--danger)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Time-Sensitive Lead</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{lead.timeSensitiveReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation — Overview | Signals | Activity Log | Notes | Enrichment */}
      <div className="flex items-center gap-1 border-b ml-0 md:ml-11 overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--border-primary)' }}>
        {(['overview', 'signals', 'activity-log', 'notes', 'enrichment'] as const).map((tab) => {
          const TAB_LABELS: Record<string, string> = {
            'overview': 'Overview',
            'signals': 'Signals',
            'activity-log': 'Activity Log',
            'notes': 'Notes',
            'enrichment': 'Enrichment',
          };
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap"
              style={{
                borderColor: activeTab === tab ? 'var(--brand-deep)' : 'transparent',
                color: activeTab === tab ? 'var(--brand-deep)' : 'var(--text-secondary)',
              }}
            >
              {tab === 'signals' && <Zap size={14} />}
              {tab === 'enrichment' && <Search size={14} />}
              {TAB_LABELS[tab]}
              {tab === 'signals' && (liveSignalCount ?? signals.length) > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: 'var(--brand-deep)' }}>
                  {liveSignalCount ?? signals.length}
                </span>
              )}
              {tab === 'activity-log' && contactHistory.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>{contactHistory.length}</span>
              )}
              {tab === 'notes' && notes.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}>{notes.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="ml-0 md:ml-11">
        {activeTab === 'overview' && (
          <OverviewTab
            property={property}
            lead={lead}
            signals={activeSignals}
            distressSignals={distressSignals}
            onViewSignals={() => handleTabChange('signals')}
            leadId={id}
            refetch={refetch}
          />
        )}
        {activeTab === 'signals' && (
          <SignalsTab
            leadId={lead.id}
            signals={signals}
            totalScore={lead.totalScore}
            priority={lead.priority || 'normal'}
            onUpdate={() => {}} // Sync happens when leaving the signals tab
            onCountChange={setLiveSignalCount}
          />
        )}
        {activeTab === 'activity-log' && (
          <TimelineTab contactHistory={contactHistory} />
        )}
        {activeTab === 'notes' && (
          <NotesTab
            notes={notes}
            newNote={newNote}
            setNewNote={setNewNote}
            onAddNote={handleAddNote}
            saving={savingNote}
            leadId={id}
            refetch={refetch}
          />
        )}
        {activeTab === 'enrichment' && (
          <EnrichmentTab
            leadId={id}
            zipCode={property.zipCode || ''}
            refetch={refetch}
          />
        )}
      </div>

      {/* Call Mode — Full-screen dashboard */}
      {showCallDialog && (
        <CallMode
          leadId={lead.id}
          ownerName={property.ownerName || ''}
          address={property.address}
          phoneNumber={property.ownerPhone || null}
          property={{
            city: property.city,
            state: property.state,
            zipCode: property.zipCode,
            propertyType: property.propertyType,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            sqft: property.sqft,
            yearBuilt: property.yearBuilt,
            purchaseDate: property.purchaseDate,
            purchasePrice: property.purchasePrice,
            assessedValue: property.assessedValue,
            estimatedValue: property.estimatedValue,
          }}
          signals={signals}
          totalScore={lead.totalScore}
          priority={lead.priority || 'normal'}
          onClose={() => setShowCallDialog(false)}
          onCallLogged={() => refetch()}
        />
      )}

      {/* Text Dialog */}
      {showTextDialog && (
        <TextDialog
          leadId={lead.id}
          ownerName={property.ownerName || ''}
          address={property.address}
          city={property.city}
          state={property.state}
          zipCode={property.zipCode}
          phoneNumber={property.ownerPhone || null}
          onClose={() => setShowTextDialog(false)}
          onTextLogged={() => refetch()}
        />
      )}
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================

function OverviewTab({ property, lead, signals, distressSignals, onViewSignals, leadId, refetch }: any) {
  const [editingProperty, setEditingProperty] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAbsenteeDialog, setShowAbsenteeDialog] = useState(false);
  const [pendingMailingDisplay, setPendingMailingDisplay] = useState('');

  // Property Details edit state
  const [propForm, setPropForm] = useState({
    address: property.address || '',
    city: property.city || '',
    state: property.state || '',
    zipCode: property.zipCode || '',
    county: property.county || '',
    propertyType: property.propertyType || '',
    bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
    bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
    sqft: property.sqft != null ? String(property.sqft) : '',
    yearBuilt: property.yearBuilt != null ? String(property.yearBuilt) : '',
  });

  // Owner Info edit state
  const [ownerForm, setOwnerForm] = useState({
    ownerName: property.ownerName || '',
    ownerPhone: property.ownerPhone || '',
    ownerEmail: property.ownerEmail || '',
    ownerMailingAddress: property.ownerMailingAddress || '',
    ownerCity: property.ownerCity || '',
    ownerState: property.ownerState || '',
    ownerZip: property.ownerZip || '',
  });

  const handleSaveProperty = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/leads/${leadId}`, {
        property: {
          address: propForm.address || null,
          city: propForm.city || null,
          state: propForm.state || null,
          zipCode: propForm.zipCode || null,
          county: propForm.county || null,
          propertyType: propForm.propertyType || null,
          bedrooms: propForm.bedrooms ? parseInt(propForm.bedrooms) : null,
          bathrooms: propForm.bathrooms ? parseFloat(propForm.bathrooms) : null,
          sqft: propForm.sqft ? parseInt(propForm.sqft) : null,
          yearBuilt: propForm.yearBuilt ? parseInt(propForm.yearBuilt) : null,
        },
      });
      setEditingProperty(false);
      refetch();
    } catch (err) {
      console.error('Failed to update property:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOwner = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/leads/${leadId}`, {
        property: {
          ownerName: ownerForm.ownerName || null,
          ownerPhone: ownerForm.ownerPhone || null,
          ownerEmail: ownerForm.ownerEmail || null,
          ownerMailingAddress: ownerForm.ownerMailingAddress || null,
          ownerCity: ownerForm.ownerCity || null,
          ownerState: ownerForm.ownerState || null,
          ownerZip: ownerForm.ownerZip || null,
        },
      });
      setEditingOwner(false);

      // Check if mailing address differs from property address
      const mailingStreet = ownerForm.ownerMailingAddress?.trim();
      if (mailingStreet && isMailingDifferent(mailingStreet, property.address)) {
        // Only prompt if absentee_owner signal isn't already active
        const hasActiveAbsentee = (lead.signals || []).some(
          (s: any) => s.signalType === 'absentee_owner' && s.isActive
        );
        if (!hasActiveAbsentee) {
          const parts = [mailingStreet, [ownerForm.ownerCity, ownerForm.ownerState].filter(Boolean).join(', '), ownerForm.ownerZip].filter(Boolean);
          setPendingMailingDisplay(parts.join(' '));
          setShowAbsenteeDialog(true);
        } else {
          refetch();
        }
      } else {
        refetch();
      }
    } catch (err) {
      console.error('Failed to update owner:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAbsenteeSignalSave = async (selectedTypes: string[]) => {
    setShowAbsenteeDialog(false);
    for (const signalType of selectedTypes) {
      try {
        const syncMap: Record<string, string> = {
          absentee_owner: 'isAbsenteeOwner',
          rental_property: 'isRentalProperty',
        };
        await fetch('/api/leads/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            leadId: lead.id,
            signalType,
            syncProperty: syncMap[signalType],
            value: signalType === 'absentee_owner' ? `Mailing: ${ownerForm.ownerMailingAddress}` : undefined,
          }),
        });
      } catch (err) {
        console.error(`Failed to add ${signalType} signal:`, err);
      }
    }
    refetch();
  };

  const cancelPropertyEdit = () => {
    setPropForm({
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zipCode || '',
      county: property.county || '',
      propertyType: property.propertyType || '',
      bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
      bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
      sqft: property.sqft != null ? String(property.sqft) : '',
      yearBuilt: property.yearBuilt != null ? String(property.yearBuilt) : '',
    });
    setEditingProperty(false);
  };

  const cancelOwnerEdit = () => {
    setOwnerForm({
      ownerName: property.ownerName || '',
      ownerPhone: property.ownerPhone || '',
      ownerEmail: property.ownerEmail || '',
      ownerMailingAddress: property.ownerMailingAddress || '',
      ownerCity: property.ownerCity || '',
      ownerState: property.ownerState || '',
      ownerZip: property.ownerZip || '',
    });
    setEditingOwner(false);
  };

  // Deal Analysis edit state
  const [editingDeal, setEditingDeal] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [dealForm, setDealForm] = useState({
    estimatedValue: property.estimatedValue != null ? String(property.estimatedValue) : '',
    estimatedRepairCost: property.estimatedRepairCost != null ? String(property.estimatedRepairCost) : '',
    offerPrice: property.offerPrice != null ? String(property.offerPrice) : '',
  });

  // MAO percentage — load from localStorage, default 70%
  const [maoPercentage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wholesail-mao-percentage');
      return saved ? Number(saved) : 70;
    }
    return 70;
  });

  // Calculate MAO and profit from current values (works in both view and edit mode)
  const calcArv = editingDeal ? (dealForm.estimatedValue ? parseFloat(dealForm.estimatedValue) : null) : property.estimatedValue;
  const calcRepairs = editingDeal ? (dealForm.estimatedRepairCost ? parseFloat(dealForm.estimatedRepairCost) : null) : property.estimatedRepairCost;
  const calcOffer = editingDeal ? (dealForm.offerPrice ? parseFloat(dealForm.offerPrice) : null) : property.offerPrice;
  const calcMao = calcArv != null && calcRepairs != null ? calcArv * (maoPercentage / 100) - calcRepairs : null;
  const calcDealEquity = calcArv != null && calcRepairs != null && calcOffer != null ? calcArv - calcRepairs - calcOffer : null;
  const calcAssignmentFee = calcMao != null && calcOffer != null ? calcMao - calcOffer : null;

  const handleSaveDeal = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/leads/${leadId}`, {
        property: {
          estimatedValue: dealForm.estimatedValue ? parseFloat(dealForm.estimatedValue) : null,
          estimatedRepairCost: dealForm.estimatedRepairCost ? parseFloat(dealForm.estimatedRepairCost) : null,
          offerPrice: dealForm.offerPrice ? parseFloat(dealForm.offerPrice) : null,
        },
      });
      setEditingDeal(false);
      refetch();
    } catch (err) {
      console.error('Failed to update deal analysis:', err);
    } finally {
      setSaving(false);
    }
  };

  const cancelDealEdit = () => {
    setDealForm({
      estimatedValue: property.estimatedValue != null ? String(property.estimatedValue) : '',
      estimatedRepairCost: property.estimatedRepairCost != null ? String(property.estimatedRepairCost) : '',
      offerPrice: property.offerPrice != null ? String(property.offerPrice) : '',
    });
    setEditingDeal(false);
  };

  // Helper to format mailing address
  const formatMailingAddress = () => {
    const addr = property.ownerMailingAddress;
    const city = property.ownerCity;
    const state = property.ownerState;
    const zip = property.ownerZip;
    if (!addr && !city && !state && !zip) return null;
    const parts = [addr, [city, state].filter(Boolean).join(', '), zip].filter(Boolean);
    return parts.join(' ');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      <div className="lg:col-span-2 space-y-4">
        {/* Motivation Signals Summary */}
        {signals.length > 0 && (
          <div className="ws-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Zap size={16} style={{ color: 'var(--brand-deep)' }} />
                Motivation Signals
                <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                  ({signals.length} active)
                </span>
              </h3>
              <button
                onClick={onViewSignals}
                className="text-xs font-medium"
                style={{ color: 'var(--brand-ocean)' }}
              >
                View Details →
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Deduplicate pills: show each signal type once */}
              {Array.from(new Map(signals.map((s: any) => [s.signalType, s])).values()).map((s: any, i: number) => (
                <button
                  key={s.id || i}
                  onClick={onViewSignals}
                  className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-xs cursor-pointer hover:opacity-80 transition-opacity`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {distressSignals.length >= 2 && (
              <p className="text-xs mt-2" style={{ color: 'var(--warning)' }}>
                🔥 Stacking bonus active: +{distressSignals.length >= 3 ? 20 : 10} pts ({distressSignals.length} distress signals)
              </p>
            )}
          </div>
        )}

        {/* Property Story Timeline */}
        <PropertyStoryTimeline property={property} signals={lead.signals || []} />

        {/* Property Details */}
        <div className="ws-card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Home size={16} style={{ color: 'var(--brand-deep)' }} /> Property Details
              </h3>
              <StreetViewButton
                address={property.address}
                city={property.city}
                state={property.state}
                zipCode={property.zipCode}
                latitude={property.latitude}
                longitude={property.longitude}
                size={16}
              />
            </div>
            {!editingProperty ? (
              <button
                onClick={() => setEditingProperty(true)}
                className="ws-btn-ghost text-xs p-1.5 rounded-md"
                title="Edit property details"
              >
                <Pencil size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={cancelPropertyEdit} className="ws-btn-ghost text-xs p-1.5 rounded-md" title="Cancel">
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveProperty}
                  disabled={saving}
                  className="ws-btn-primary text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
              </div>
            )}
          </div>
          {editingProperty ? (
            <div className="space-y-4 mt-3">
              {/* Address fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <EditField label="Address" value={propForm.address} onChange={(v) => setPropForm({ ...propForm, address: v })} />
                </div>
                <EditField label="City" value={propForm.city} onChange={(v) => setPropForm({ ...propForm, city: v })} />
                <div className="grid grid-cols-3 gap-3">
                  <EditField label="State" value={propForm.state} onChange={(v) => setPropForm({ ...propForm, state: v })} />
                  <EditField label="Zip" value={propForm.zipCode} onChange={(v) => setPropForm({ ...propForm, zipCode: v })} />
                  <EditField label="County" value={propForm.county} onChange={(v) => setPropForm({ ...propForm, county: v })} />
                </div>
              </div>

              {/* Property attributes */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <EditField label="Type" value={propForm.propertyType} onChange={(v) => setPropForm({ ...propForm, propertyType: v })} />
                <EditField label="Bedrooms" value={propForm.bedrooms} onChange={(v) => setPropForm({ ...propForm, bedrooms: v })} type="number" />
                <EditField label="Bathrooms" value={propForm.bathrooms} onChange={(v) => setPropForm({ ...propForm, bathrooms: v })} type="number" />
                <EditField label="Sq Ft" value={propForm.sqft} onChange={(v) => setPropForm({ ...propForm, sqft: v })} type="number" />
                <EditField label="Year Built" value={propForm.yearBuilt} onChange={(v) => setPropForm({ ...propForm, yearBuilt: v })} type="number" />
                <div title="Update on the Signals tab" className="cursor-help">
                  <DetailItem label="Vacant" value={property.isVacant != null ? (property.isVacant ? 'Yes' : 'No') : '—'} highlight={property.isVacant} />
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Edit on Signals tab</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                {property.address}, {property.city}, {property.state} {property.zipCode}
                {property.county ? ` · ${property.county} County` : ''}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <DetailItem label="Type" value={property.propertyType || '—'} />
                <DetailItem label="Bedrooms" value={property.bedrooms != null ? `${property.bedrooms}` : '—'} />
                <DetailItem label="Bathrooms" value={property.bathrooms != null ? `${property.bathrooms}` : '—'} />
                <DetailItem label="Sq Ft" value={property.sqft != null ? property.sqft.toLocaleString() : '—'} />
                <DetailItem label="Year Built" value={property.yearBuilt != null ? `${property.yearBuilt}` : '—'} />
                <DetailItem label="Vacant" value={property.isVacant != null ? (property.isVacant ? 'Yes' : 'No') : '—'} highlight={property.isVacant} />
              </div>
            </>
          )}
        </div>

        {/* Deal Analysis */}
        <div className="ws-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Calculator size={16} style={{ color: 'var(--brand-deep)' }} /> Deal Analysis
            </h3>
            {!editingDeal ? (
              <button
                onClick={() => setEditingDeal(true)}
                className="ws-btn-ghost text-xs p-1.5 rounded-md"
                title="Edit deal numbers"
              >
                <Pencil size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={cancelDealEdit} className="ws-btn-ghost text-xs p-1.5 rounded-md" title="Cancel">
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveDeal}
                  disabled={saving}
                  className="ws-btn-primary text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
              </div>
            )}
          </div>

          {editingDeal ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>After Repair Value (ARV)</p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                    <input
                      type="number"
                      value={dealForm.estimatedValue}
                      onChange={(e) => setDealForm({ ...dealForm, estimatedValue: e.target.value })}
                      className="ws-input text-sm py-1.5 pl-6 pr-2.5 w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Repair Estimate</p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                    <input
                      type="number"
                      value={dealForm.estimatedRepairCost}
                      onChange={(e) => setDealForm({ ...dealForm, estimatedRepairCost: e.target.value })}
                      className="ws-input text-sm py-1.5 pl-6 pr-2.5 w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    Max Allowable Offer ({maoPercentage}%)
                  </p>
                  <p className="text-sm font-semibold py-1.5" style={{ color: calcMao != null ? 'var(--brand-deep)' : 'var(--text-tertiary)' }}>
                    {calcMao != null ? formatCurrency(calcMao) : '—'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    ARV × {maoPercentage}% − Repairs
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Your Offer</p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                    <input
                      type="number"
                      value={dealForm.offerPrice}
                      onChange={(e) => setDealForm({ ...dealForm, offerPrice: e.target.value })}
                      className="ws-input text-sm py-1.5 pl-6 pr-2.5 w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Live deal calculations while editing */}
              {(calcDealEquity != null || calcAssignmentFee != null) && (
                <div className="grid grid-cols-2 gap-3">
                  {calcDealEquity != null && (
                    <div
                      className="p-3 rounded-lg text-center"
                      style={{ backgroundColor: calcDealEquity >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Deal Equity
                      </p>
                      <p className="text-lg font-bold" style={{ color: calcDealEquity >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(calcDealEquity)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        ARV − Repairs − Offer
                      </p>
                    </div>
                  )}
                  {calcAssignmentFee != null && (
                    <div
                      className="p-3 rounded-lg text-center"
                      style={{ backgroundColor: calcAssignmentFee >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Suggested Assignment Fee
                      </p>
                      <p className="text-lg font-bold" style={{ color: calcAssignmentFee >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(calcAssignmentFee)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        MAO − Offer
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="After Repair Value (ARV)" value={property.estimatedValue != null ? formatCurrency(property.estimatedValue) : '—'} />
                <DetailItem label="Repair Estimate" value={property.estimatedRepairCost != null ? formatCurrency(property.estimatedRepairCost) : '—'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Max Allowable Offer ({maoPercentage}%)
                  </p>
                  <p className="text-sm font-medium" style={{ color: calcMao != null ? 'var(--brand-deep)' : 'var(--text-tertiary)' }}>
                    {calcMao != null ? formatCurrency(calcMao) : '—'}
                  </p>
                </div>
                <DetailItem label="Your Offer" value={property.offerPrice != null ? formatCurrency(property.offerPrice) : '—'} />
              </div>

              {/* Deal calculations display */}
              {(calcDealEquity != null || calcAssignmentFee != null) && (
                <div className="grid grid-cols-2 gap-3">
                  {calcDealEquity != null && (
                    <div
                      className="p-3 rounded-lg text-center"
                      style={{ backgroundColor: calcDealEquity >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Deal Equity
                      </p>
                      <p className="text-lg font-bold" style={{ color: calcDealEquity >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(calcDealEquity)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        ARV − Repairs − Offer
                      </p>
                    </div>
                  )}
                  {calcAssignmentFee != null && (
                    <div
                      className="p-3 rounded-lg text-center"
                      style={{ backgroundColor: calcAssignmentFee >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Suggested Assignment Fee
                      </p>
                      <p className="text-lg font-bold" style={{ color: calcAssignmentFee >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(calcAssignmentFee)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        MAO − Offer
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Reference Data — collapsible */}
              <div>
                <button
                  onClick={() => setShowReference(!showReference)}
                  className="flex items-center gap-1.5 text-xs font-medium w-full"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ChevronDown
                    size={14}
                    className="transition-transform duration-200"
                    style={{ transform: showReference ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                  Reference Data
                </button>
                {showReference && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <DetailItem label="Tax Assessment" value={property.assessedValue != null ? formatCurrency(property.assessedValue) : '—'} />
                    <DetailItem label="Equity" value={property.estimatedEquity != null ? formatCurrency(property.estimatedEquity) : '—'} />
                    <DetailItem label="Ownership" value={property.ownershipLengthMonths != null || property.ownershipLength != null ? `${Math.round((property.ownershipLengthMonths ?? property.ownershipLength) / 12)} years` : '—'} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Owner Info */}
        <div className="ws-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <User size={16} style={{ color: 'var(--brand-deep)' }} /> Owner Information
            </h3>
            {!editingOwner ? (
              <button
                onClick={() => setEditingOwner(true)}
                className="ws-btn-ghost text-xs p-1.5 rounded-md"
                title="Edit owner information"
              >
                <Pencil size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={cancelOwnerEdit} className="ws-btn-ghost text-xs p-1.5 rounded-md" title="Cancel">
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveOwner}
                  disabled={saving}
                  className="ws-btn-primary text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
              </div>
            )}
          </div>

          {editingOwner ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditField label="Name" value={ownerForm.ownerName} onChange={(v) => setOwnerForm({ ...ownerForm, ownerName: v })} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Phone</p>
                <input
                  type="tel"
                  value={formatPhoneInput(ownerForm.ownerPhone)}
                  onChange={(e) => setOwnerForm({ ...ownerForm, ownerPhone: stripPhone(e.target.value) })}
                  className="ws-input text-sm py-1.5 px-2.5 w-full"
                  placeholder="(555) 555-5555"
                />
              </div>
              <EditField label="Email" value={ownerForm.ownerEmail} onChange={(v) => setOwnerForm({ ...ownerForm, ownerEmail: v })} type="email" />
              <div className="md:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Mailing Address</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <EditField label="Street" value={ownerForm.ownerMailingAddress} onChange={(v) => setOwnerForm({ ...ownerForm, ownerMailingAddress: v })} />
                  </div>
                  <EditField label="City" value={ownerForm.ownerCity} onChange={(v) => setOwnerForm({ ...ownerForm, ownerCity: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="State" value={ownerForm.ownerState} onChange={(v) => setOwnerForm({ ...ownerForm, ownerState: v })} />
                    <EditField label="Zip" value={ownerForm.ownerZip} onChange={(v) => setOwnerForm({ ...ownerForm, ownerZip: v })} />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailItem label="Name" value={property.ownerName || '—'} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Phone</p>
                {property.ownerPhone ? (
                  <a href={`tel:${stripPhone(property.ownerPhone)}`} className="text-sm font-medium flex items-center gap-1.5 hover:underline" style={{ color: 'var(--brand-ocean)' }}>
                    <Phone size={12} /> {formatPhone(property.ownerPhone)}
                  </a>
                ) : (
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Email</p>
                {property.ownerEmail ? (
                  <a href={`mailto:${property.ownerEmail}`} className="text-sm font-medium flex items-center gap-1.5 hover:underline" style={{ color: 'var(--brand-ocean)' }}>
                    <Mail size={12} /> {property.ownerEmail}
                  </a>
                ) : (
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Mailing Address</p>
                {formatMailingAddress() ? (
                  <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <MapPin size={12} style={{ color: 'var(--text-tertiary)' }} /> {formatMailingAddress()}
                  </p>
                ) : (
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>—</p>
                )}
              </div>
              <DetailItem label="Absentee Owner" value={property.isAbsenteeOwner ? 'Yes' : '—'} highlight={property.isAbsenteeOwner} />
            </div>
          )}
        </div>

      </div>

      {/* Right Column - Score + Key Dates */}
      <div className="space-y-4">
        <div className="ws-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <TrendingUp size={16} style={{ color: 'var(--brand-deep)' }} /> Score Breakdown
          </h3>
          <div className="flex items-center justify-center mb-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}>
              {lead.totalScore}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Automated</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{lead.automatedScore || 0}</p>
            </div>
            <div className="text-center p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Manual</p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{lead.manualScore || 0}</p>
            </div>
          </div>

          {/* Priority tier */}
          <div className="text-center p-2 rounded-lg mb-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {lead.totalScore >= 100 ? '🔥 Priority — call same day' :
               lead.totalScore >= 70 ? '🟠 Hot — reach out within 24 hrs' :
               lead.totalScore >= 40 ? '🟡 Warm — SMS nurture sequence' :
               '🔵 Cold — monitor only'}
            </p>
          </div>

          <button
            onClick={onViewSignals}
            className="w-full ws-btn-ghost text-xs justify-center border border-dashed"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <Zap size={14} /> View All Signals
          </button>
        </div>

        {/* Key Dates */}
        <div className="ws-card p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Calendar size={16} style={{ color: 'var(--brand-deep)' }} /> Key Dates
          </h3>
          <div className="space-y-2.5">
            <DateRow label="Created" value={lead.createdAt ? formatDate(lead.createdAt) : '—'} />
            <DateRow label="Last Activity" value={lead.lastActivityAt ? formatDate(lead.lastActivityAt) : '—'} />
            <DateRow label="Last Signal" value={lead.lastSignalAt ? formatDate(lead.lastSignalAt) : '—'} />
            <DateRow label="Last Contacted" value={lead.lastContacted ? formatDate(lead.lastContacted) : '—'} />
            <DateRow label="Next Follow-Up" value={lead.nextFollowUp ? formatDate(lead.nextFollowUp) : '—'} highlight={!!lead.nextFollowUp} />
          </div>
        </div>
      </div>

      {/* Absentee Signal Dialog */}
      {showAbsenteeDialog && (
        <AbsenteeSignalDialog
          propertyAddress={property.address}
          mailingAddress={pendingMailingDisplay}
          onSave={(selected) => handleAbsenteeSignalSave(selected)}
          onSkip={() => { setShowAbsenteeDialog(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// TIMELINE TAB
// ============================================================

function TimelineTab({ contactHistory }: { contactHistory: any[] }) {
  const getContactIcon = (type: string) => {
    if (type.includes('CALL')) return PhoneCall;
    if (type.includes('SMS') || type.includes('TEXT')) return MessageCircle;
    if (type.includes('EMAIL')) return Mail;
    return FileText;
  };

  const getContactLabel = (type: string) => {
    const map: Record<string, string> = {
      CALL_OUTBOUND: 'Outbound Call', CALL_INBOUND: 'Inbound Call',
      SMS_OUTBOUND: 'Text Sent', SMS_INBOUND: 'Text Received',
      EMAIL_OUTBOUND: 'Email Sent', EMAIL_INBOUND: 'Email Received',
      VOICEMAIL: 'Voicemail', NOTE: 'Note',
    };
    return map[type] || type;
  };

  const getOutcomeTag = (outcome: string) => {
    const colorMap: Record<string, string> = {
      CONNECTED: 'success', INTERESTED: 'success', REPLIED: 'success',
      DELIVERED: 'info', SENT: 'info',
      NO_ANSWER: 'neutral', VOICEMAIL: 'neutral',
      NOT_INTERESTED: 'warning', WRONG_NUMBER: 'warning',
      DO_NOT_CALL: 'danger', BOUNCED: 'danger',
    };
    return colorMap[outcome] || 'neutral';
  };

  if (contactHistory.length === 0) {
    return (
      <div className="ws-card p-8 text-center">
        <Phone size={32} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-3" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No contact history yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Make your first call or send a text to start tracking interactions</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="ws-btn-primary text-xs"><Phone size={14} /> Call Now</button>
          <button className="ws-btn-secondary text-xs"><MessageSquare size={14} /> Send Text</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="ws-btn-primary text-xs"><Plus size={14} /> Log Contact</button>
      </div>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
        <div className="space-y-4">
          {contactHistory.map((contact: any) => {
            const Icon = getContactIcon(contact.type);
            return (
              <div key={contact.id} className="relative flex gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '2px solid var(--border-primary)' }}>
                  <Icon size={16} style={{ color: 'var(--brand-deep)' }} />
                </div>
                <div className="ws-card flex-1 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{getContactLabel(contact.type)}</span>
                      {contact.outcome && (
                        <span className={`ws-tag ws-tag-${getOutcomeTag(contact.outcome)} text-[10px]`}>{contact.outcome.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDateTime(contact.createdAt)}</span>
                  </div>
                  {contact.duration && (
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Duration: {Math.floor(contact.duration / 60)}m {contact.duration % 60}s</p>
                  )}
                  {contact.message && (
                    <div className="text-sm p-3 rounded-lg mt-2" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{contact.message}</div>
                  )}
                  {contact.notes && <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{contact.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NOTES TAB
// ============================================================

function NotesTab({ notes, newNote, setNewNote, onAddNote, saving, leadId, refetch }: any) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEditNote = async (noteId: string) => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      await apiPatch(`/api/leads/${leadId}/notes`, { noteId, content: editContent.trim() });
      setEditingNoteId(null);
      refetch();
    } catch (err) {
      console.error('Failed to update note:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    setDeletingId(noteId);
    try {
      await apiDelete(`/api/leads/${leadId}/notes?noteId=${noteId}`);
      refetch();
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="ws-card p-4">
        <textarea
          value={newNote}
          onChange={(e: any) => setNewNote(e.target.value)}
          placeholder="Add a note about this lead..."
          rows={3}
          className="ws-input resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex-1" />
          <button
            onClick={onAddNote}
            className="ws-btn-primary text-xs"
            disabled={!newNote.trim() || saving}
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Plus size={14} /> Add Note</>}
          </button>
        </div>
      </div>

      {notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note: any) => (
            <div key={note.id} className="ws-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{formatDateTime(note.createdAt)}</span>
                <div className="flex items-center gap-1">
                  {editingNoteId !== note.id && (
                    <>
                      <button
                        onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); }}
                        className="ws-btn-ghost text-xs p-1"
                        title="Edit note"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={deletingId === note.id}
                        className="ws-btn-ghost text-xs p-1"
                        style={{ color: 'var(--danger)' }}
                        title="Delete note"
                      >
                        {deletingId === note.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editingNoteId === note.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="ws-input resize-none text-sm mb-2"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="ws-btn-ghost text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleEditNote(note.id)}
                      disabled={savingEdit || !editContent.trim()}
                      className="ws-btn-primary text-xs"
                    >
                      {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{note.content}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="ws-card p-8 text-center">
          <FileText size={32} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No notes yet. Add your first note above.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED SUB-COMPONENTS
// ============================================================

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const isEmpty = value === '—';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: isEmpty ? 'var(--text-tertiary)' : highlight ? 'var(--brand-deep)' : 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function EditField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ws-input text-sm py-1.5 px-2.5 w-full"
        placeholder="—"
      />
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(!value)}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${value ? '' : ''}`}
          style={{ backgroundColor: value ? 'var(--brand-deep)' : 'var(--border-primary)' }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200"
            style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </button>
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{value ? 'Yes' : 'No'}</span>
      </div>
    </div>
  );
}

function TriStateField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <select
        value={value === null ? '' : value ? 'yes' : 'no'}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v === 'yes');
        }}
        className="ws-input text-sm py-1.5 px-2.5 w-full"
      >
        <option value="">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

function DateRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const isEmpty = value === '—';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: isEmpty ? 'var(--text-tertiary)' : highlight ? 'var(--brand-deep)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
