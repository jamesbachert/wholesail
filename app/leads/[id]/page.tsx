'use client';

import { use, useState } from 'react';
import Link from 'next/link';
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
  ExternalLink,
  PhoneCall,
  MessageCircle,
  FileText,
  Copy,
} from 'lucide-react';
import {
  mockLeads,
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  formatCurrency,
  formatDate,
  formatDateTime,
  timeAgo,
  type MockLead,
} from '@/lib/mockData';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lead = mockLeads.find((l) => l.id === id);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'notes'>('overview');
  const [newNote, setNewNote] = useState('');

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

  const { property } = lead;
  const automatedSignals = lead.signals.filter((s) => s.category === 'automated');
  const manualSignals = lead.signals.filter((s) => s.category === 'manual');
  const totalPoints = lead.signals.reduce((sum, s) => sum + s.points, 0);

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
              <h1
                className="text-xl md:text-2xl font-bold font-display"
                style={{ color: 'var(--text-primary)' }}
              >
                {property.address}
              </h1>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
              >
                {lead.totalScore}
              </div>
              {lead.isTimeSensitive && (
                <span className="ws-tag ws-tag-danger">
                  <AlertTriangle size={12} /> Time Sensitive
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {property.city}, {property.state} {property.zipCode} · {property.county} County
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-0 md:ml-11">
          <button className="ws-btn-primary text-xs">
            <Phone size={14} /> Call
          </button>
          <button className="ws-btn-secondary text-xs">
            <MessageSquare size={14} /> Text
          </button>
          <button className="ws-btn-secondary text-xs">
            <Mail size={14} /> Email
          </button>
          <button className="ws-btn-secondary text-xs">
            <Send size={14} /> Hand Off
          </button>
          <div className="flex-1" />
          <span
            className={`ws-status ws-status-${lead.status.toLowerCase()} text-sm font-medium`}
            style={{ color: 'var(--text-primary)' }}
          >
            {getStatusLabel(lead.status)}
          </span>
        </div>
      </div>

      {/* Time Sensitive Banner */}
      {lead.isTimeSensitive && lead.timeSensitiveReason && (
        <div
          className="ws-card p-4 border-l-4 ml-0 md:ml-11"
          style={{ borderLeftColor: 'var(--danger)' }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Time-Sensitive Lead
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {lead.timeSensitiveReason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        className="flex items-center gap-1 border-b ml-0 md:ml-11"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {(['overview', 'timeline', 'notes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px capitalize"
            style={{
              borderColor: activeTab === tab ? 'var(--brand-deep)' : 'transparent',
              color: activeTab === tab ? 'var(--brand-deep)' : 'var(--text-secondary)',
            }}
          >
            {tab}
            {tab === 'timeline' && lead.contactHistory.length > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
              >
                {lead.contactHistory.length}
              </span>
            )}
            {tab === 'notes' && lead.notes.length > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
              >
                {lead.notes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="ml-0 md:ml-11">
        {activeTab === 'overview' && <OverviewTab lead={lead} />}
        {activeTab === 'timeline' && <TimelineTab lead={lead} />}
        {activeTab === 'notes' && (
          <NotesTab lead={lead} newNote={newNote} setNewNote={setNewNote} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================

function OverviewTab({ lead }: { lead: MockLead }) {
  const { property } = lead;
  const automatedSignals = lead.signals.filter((s) => s.category === 'automated');
  const manualSignals = lead.signals.filter((s) => s.category === 'manual');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Left Column - Property + Owner */}
      <div className="lg:col-span-2 space-y-4">
        {/* Property Details */}
        <div className="ws-card p-5">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <Home size={16} style={{ color: 'var(--brand-deep)' }} />
            Property Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailItem label="Type" value={property.propertyType} />
            <DetailItem label="Bedrooms" value={`${property.bedrooms}`} />
            <DetailItem label="Bathrooms" value={`${property.bathrooms}`} />
            <DetailItem label="Sq Ft" value={property.sqft.toLocaleString()} />
            <DetailItem label="Year Built" value={`${property.yearBuilt}`} />
            <DetailItem label="County" value={property.county || 'N/A'} />
            <DetailItem label="Zip Code" value={property.zipCode} />
            <DetailItem
              label="Vacant"
              value={property.isVacant ? 'Yes' : 'No'}
              highlight={property.isVacant}
            />
            <DetailItem
              label="Absentee Owner"
              value={property.isAbsenteeOwner ? 'Yes' : 'No'}
              highlight={property.isAbsenteeOwner}
            />
          </div>
        </div>

        {/* Financial */}
        <div className="ws-card p-5">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <DollarSign size={16} style={{ color: 'var(--brand-deep)' }} />
            Financial
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailItem label="Assessed Value" value={formatCurrency(property.assessedValue)} />
            <DetailItem label="Estimated ARV" value={formatCurrency(property.estimatedValue)} />
            <DetailItem
              label="Estimated Equity"
              value={formatCurrency(property.estimatedEquity)}
              highlight
            />
            <DetailItem
              label="Equity %"
              value={`${Math.round((property.estimatedEquity / property.estimatedValue) * 100)}%`}
              highlight
            />
            <DetailItem
              label="Ownership"
              value={`${Math.round(property.ownershipLengthMonths / 12)} years`}
            />
          </div>
        </div>

        {/* Owner Info */}
        <div className="ws-card p-5">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <User size={16} style={{ color: 'var(--brand-deep)' }} />
            Owner Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailItem label="Name" value={property.ownerName} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                Phone
              </p>
              <a
                href={`tel:${property.ownerPhone}`}
                className="text-sm font-medium flex items-center gap-1.5 transition-colors hover:underline"
                style={{ color: 'var(--brand-ocean)' }}
              >
                <Phone size={12} /> {property.ownerPhone}
              </a>
            </div>
            {property.ownerEmail && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Email
                </p>
                <a
                  href={`mailto:${property.ownerEmail}`}
                  className="text-sm font-medium flex items-center gap-1.5 transition-colors hover:underline"
                  style={{ color: 'var(--brand-ocean)' }}
                >
                  <Mail size={12} /> {property.ownerEmail}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Score Breakdown */}
      <div className="space-y-4">
        {/* Score Summary */}
        <div className="ws-card p-5">
          <h3
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <TrendingUp size={16} style={{ color: 'var(--brand-deep)' }} />
            Score Breakdown
          </h3>

          {/* Score Circle */}
          <div className="flex items-center justify-center mb-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
            >
              {lead.totalScore}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div
              className="text-center p-2.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Automated
              </p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {lead.automatedScore}
              </p>
            </div>
            <div
              className="text-center p-2.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Manual
              </p>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {lead.manualScore}
              </p>
            </div>
          </div>

          {/* Signal List */}
          {automatedSignals.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Automated Signals
              </p>
              <div className="space-y-2">
                {automatedSignals.map((s, i) => (
                  <SignalRow key={i} signal={s} />
                ))}
              </div>
            </div>
          )}

          {manualSignals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Manual Signals
              </p>
              <div className="space-y-2">
                {manualSignals.map((s, i) => (
                  <SignalRow key={i} signal={s} />
                ))}
              </div>
            </div>
          )}

          {manualSignals.length === 0 && (
            <button
              className="w-full mt-2 ws-btn-ghost text-xs justify-center border border-dashed"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <Plus size={14} /> Add Manual Signal
            </button>
          )}
        </div>

        {/* Key Dates */}
        <div className="ws-card p-5">
          <h3
            className="text-sm font-semibold mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <Calendar size={16} style={{ color: 'var(--brand-deep)' }} />
            Key Dates
          </h3>
          <div className="space-y-2.5">
            <DateRow label="Discovered" value={formatDate(lead.firstDiscovered)} />
            {lead.lastContacted && (
              <DateRow label="Last Contacted" value={formatDate(lead.lastContacted)} />
            )}
            {lead.nextFollowUp && (
              <DateRow label="Next Follow-Up" value={formatDate(lead.nextFollowUp)} highlight />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TIMELINE TAB
// ============================================================

function TimelineTab({ lead }: { lead: MockLead }) {
  const getContactIcon = (type: string) => {
    switch (type) {
      case 'CALL_OUTBOUND':
      case 'CALL_INBOUND':
        return PhoneCall;
      case 'SMS_OUTBOUND':
      case 'SMS_INBOUND':
        return MessageCircle;
      case 'EMAIL_OUTBOUND':
      case 'EMAIL_INBOUND':
        return Mail;
      default:
        return FileText;
    }
  };

  const getContactLabel = (type: string) => {
    const map: Record<string, string> = {
      CALL_OUTBOUND: 'Outbound Call',
      CALL_INBOUND: 'Inbound Call',
      SMS_OUTBOUND: 'Text Sent',
      SMS_INBOUND: 'Text Received',
      EMAIL_OUTBOUND: 'Email Sent',
      EMAIL_INBOUND: 'Email Received',
      VOICEMAIL: 'Voicemail',
      NOTE: 'Note',
    };
    return map[type] || type;
  };

  const getOutcomeTag = (outcome: string) => {
    const colorMap: Record<string, string> = {
      CONNECTED: 'success',
      INTERESTED: 'success',
      REPLIED: 'success',
      DELIVERED: 'info',
      SENT: 'info',
      NO_ANSWER: 'neutral',
      VOICEMAIL: 'neutral',
      NOT_INTERESTED: 'warning',
      WRONG_NUMBER: 'warning',
      DO_NOT_CALL: 'danger',
      BOUNCED: 'danger',
    };
    return colorMap[outcome] || 'neutral';
  };

  if (lead.contactHistory.length === 0) {
    return (
      <div className="ws-card p-8 text-center">
        <Phone size={32} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-3" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          No contact history yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Make your first call or send a text to start tracking interactions
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="ws-btn-primary text-xs">
            <Phone size={14} /> Call Now
          </button>
          <button className="ws-btn-secondary text-xs">
            <MessageSquare size={14} /> Send Text
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Log new contact button */}
      <div className="flex items-center gap-2">
        <button className="ws-btn-primary text-xs">
          <Plus size={14} /> Log Contact
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-5 top-0 bottom-0 w-px"
          style={{ backgroundColor: 'var(--border-primary)' }}
        />

        <div className="space-y-4">
          {lead.contactHistory.map((contact) => {
            const Icon = getContactIcon(contact.type);
            return (
              <div key={contact.id} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '2px solid var(--border-primary)',
                  }}
                >
                  <Icon size={16} style={{ color: 'var(--brand-deep)' }} />
                </div>

                {/* Content */}
                <div className="ws-card flex-1 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {getContactLabel(contact.type)}
                      </span>
                      {contact.outcome && (
                        <span className={`ws-tag ws-tag-${getOutcomeTag(contact.outcome)} text-[10px]`}>
                          {contact.outcome.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(contact.createdAt)}
                    </span>
                  </div>

                  {contact.duration && (
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      Duration: {Math.floor(contact.duration / 60)}m {contact.duration % 60}s
                    </p>
                  )}

                  {contact.message && (
                    <div
                      className="text-sm p-3 rounded-lg mt-2"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {contact.message}
                    </div>
                  )}

                  {contact.notes && (
                    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                      {contact.notes}
                    </p>
                  )}
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

function NotesTab({
  lead,
  newNote,
  setNewNote,
}: {
  lead: MockLead;
  newNote: string;
  setNewNote: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="ws-card p-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this lead..."
          rows={3}
          className="ws-input resize-none"
        />
        <div className="flex justify-end mt-2">
          <button className="ws-btn-primary text-xs" disabled={!newNote.trim()}>
            <Plus size={14} /> Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {lead.notes.length > 0 ? (
        <div className="space-y-3">
          {lead.notes.map((note) => (
            <div key={note.id} className="ws-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {formatDateTime(note.createdAt)}
                </span>
                <button className="ws-btn-ghost text-xs p-1">
                  <Pencil size={12} />
                </button>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {note.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="ws-card p-8 text-center">
          <FileText size={32} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No notes yet. Add your first note above.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED SUB-COMPONENTS
// ============================================================

function DetailItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="text-sm font-medium"
        style={{ color: highlight ? 'var(--brand-deep)' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function SignalRow({ signal }: { signal: any }) {
  return (
    <div
      className="flex items-center justify-between p-2 rounded-lg"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`ws-tag ws-tag-${getSignalTagColor(signal.signalType)} text-[10px]`}>
          {signal.label}
        </span>
        {signal.value && (
          <span className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
            {signal.value}
          </span>
        )}
      </div>
      <span
        className="text-xs font-bold shrink-0 ml-2"
        style={{ color: 'var(--brand-deep)' }}
      >
        +{signal.points}
      </span>
    </div>
  );
}

function DateRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: highlight ? 'var(--brand-deep)' : 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
