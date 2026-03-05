'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  X,
  Clock,
  Copy,
  Check,
  CalendarClock,
  Home,
  BookOpen,
} from 'lucide-react';
import { formatPhone } from '@/lib/phone';
import { useWorkspace } from '@/components/shared/WorkspaceProvider';
import { PropertyStoryTimeline } from '@/components/leads/PropertyStoryTimeline';

interface CallScript {
  id: string;
  title: string;
  slug: string;
  body: string;
  isDefault: boolean;
}

interface CallModeProps {
  leadId: string;
  ownerName: string;
  address: string;
  phoneNumber: string | null;
  property: {
    city: string;
    state: string;
    zipCode: string;
    propertyType?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sqft?: number | null;
    yearBuilt?: number | null;
    purchaseDate?: string | Date | null;
    purchasePrice?: number | null;
    assessedValue?: number | null;
    estimatedValue?: number | null;
  };
  signals: Array<{
    signalType: string;
    label: string;
    category: string;
    value: string | null;
    eventDate: string | Date | null;
    isActive: boolean;
    points: number;
  }>;
  totalScore: number;
  priority: string;
  onClose: () => void;
  onCallLogged: () => void;
}

const OUTCOMES = [
  { value: 'CONNECTED', label: 'Connected', color: 'var(--success)' },
  { value: 'NO_ANSWER', label: 'No Answer', color: 'var(--text-tertiary)' },
  { value: 'VOICEMAIL', label: 'Left Voicemail', color: 'var(--brand-ocean)' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number', color: 'var(--warning)' },
  { value: 'CALLBACK', label: 'Busy / Callback', color: 'var(--brand-cyan)' },
  { value: 'INTERESTED', label: 'Interested!', color: 'var(--success)' },
  { value: 'NOT_INTERESTED', label: 'Not Interested', color: 'var(--text-tertiary)' },
  { value: 'DO_NOT_CALL', label: 'Do Not Call', color: 'var(--danger)' },
];

const FOLLOW_UP_CHIPS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 183 },
  { label: '1yr', days: 365 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const PRIORITY_DISPLAY: Record<string, { emoji: string; label: string; color: string }> = {
  urgent: { emoji: '\uD83D\uDD25', label: 'Priority', color: '#ef4444' },
  high: { emoji: '\uD83D\uDFE0', label: 'Hot', color: '#f97316' },
  normal: { emoji: '\uD83D\uDFE1', label: 'Warm', color: '#eab308' },
  low: { emoji: '\uD83D\uDD35', label: 'Cold', color: '#3b82f6' },
};

export function CallMode({
  leadId,
  ownerName,
  address,
  phoneNumber,
  property,
  signals,
  totalScore,
  priority,
  onClose,
  onCallLogged,
}: CallModeProps) {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [calling, setCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [activeChip, setActiveChip] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { activeWorkspace } = useWorkspace();

  // Fetch scripts
  useEffect(() => {
    const url = activeWorkspace
      ? `/api/scripts?workspaceId=${activeWorkspace.id}`
      : '/api/scripts';
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setScripts(data);
          const defaultScript = data.find((s: CallScript) => s.isDefault);
          if (defaultScript) setSelectedScript(defaultScript.id);
          else if (data.length > 0) setSelectedScript(data[0].id);
        }
      })
      .catch(() => {});
  }, [activeWorkspace]);

  // Timer
  useEffect(() => {
    if (calling) {
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [calling]);

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function handleChipClick(chip: typeof FOLLOW_UP_CHIPS[number], index: number) {
    if (activeChip === index) {
      setFollowUpDate('');
      setActiveChip(null);
    } else {
      setFollowUpDate(addDays(chip.days));
      setActiveChip(index);
    }
  }

  function handleDateChange(value: string) {
    setFollowUpDate(value);
    if (activeChip !== null && value !== addDays(FOLLOW_UP_CHIPS[activeChip].days)) {
      setActiveChip(null);
    }
  }

  async function handleSaveCall() {
    if (!outcome) {
      alert('Please select a call outcome');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/leads/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          outcome,
          duration: callDuration || null,
          notes: notes || null,
          scriptUsed: selectedScript || null,
          followUpDate: followUpDate || null,
        }),
      });
      if (res.ok) {
        onCallLogged();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to log call');
      }
    } finally {
      setSaving(false);
    }
  }

  function copyPhone() {
    if (phoneNumber) {
      navigator.clipboard.writeText(phoneNumber.replace(/\D/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Replace script placeholders
  const currentScript = scripts.find((s) => s.id === selectedScript);
  const renderedScript = currentScript?.body
    .replace(/\[Owner Name\]/g, ownerName || '[Owner Name]')
    .replace(/\[Address\]/g, address || '[Address]')
    .replace(/\[Your Name\]/g, '[Your Name]');

  const priorityInfo = PRIORITY_DISPLAY[priority] || PRIORITY_DISPLAY.normal;

  const hasPropertyDetails = !!(
    property.propertyType ||
    property.bedrooms != null ||
    property.bathrooms != null ||
    property.sqft != null ||
    property.yearBuilt != null ||
    property.assessedValue != null ||
    property.purchasePrice != null ||
    property.estimatedValue != null
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-surface)' }}>
      {/* ═══════════ Header Bar ═══════════ */}
      <div
        className="flex items-center gap-4 px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
      >
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {ownerName || 'Unknown Owner'}
            </h2>
            <span className="text-sm hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>—</span>
            <span className="text-sm truncate hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
              {address}, {property.city} {property.state}
            </span>
          </div>
        </div>
        {/* Score Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: priorityInfo.color }}
          >
            {Math.round(totalScore)}
          </div>
          <span className="text-sm font-medium hidden sm:inline" style={{ color: priorityInfo.color }}>
            {priorityInfo.emoji} {priorityInfo.label}
          </span>
        </div>
      </div>

      {/* ═══════════ Main Content ═══════════ */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ─── Left Column: Dialer Controls (~35%) ─── */}
        <div
          className="md:w-[38%] lg:w-[35%] p-5 overflow-y-auto border-b md:border-b-0 md:border-r flex flex-col"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {/* Phone Number */}
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-3"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <Phone size={16} style={{ color: 'var(--brand-deep)' }} />
            <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {phoneNumber ? formatPhone(phoneNumber) : 'No phone number'}
            </span>
            {phoneNumber && (
              <button onClick={copyPhone} className="ml-auto p-1.5 rounded-md" style={{ color: 'var(--text-tertiary)' }}>
                {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            )}
          </div>

          {/* Call Timer / Start-End */}
          <div className="flex items-center gap-3 mb-4">
            {!calling ? (
              <button
                onClick={() => { setCalling(true); setCallDuration(0); }}
                className="ws-btn-primary flex-1 justify-center py-2.5"
                disabled={!phoneNumber}
              >
                <Phone size={16} />
                Start Call
              </button>
            ) : (
              <>
                <div
                  className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded-lg font-mono text-lg font-bold"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--success)' }}
                >
                  <Clock size={16} />
                  {formatDuration(callDuration)}
                </div>
                <button
                  onClick={() => setCalling(false)}
                  className="px-5 py-2.5 rounded-lg font-medium text-sm text-white transition-all"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  <PhoneOff size={16} />
                </button>
              </>
            )}
          </div>

          {/* Call Outcome */}
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Outcome
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(outcome === o.value ? '' : o.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all text-left ${
                    outcome === o.value ? 'ring-2' : ''
                  }`}
                  style={{
                    borderColor: outcome === o.value ? o.color : 'var(--border-primary)',
                    backgroundColor: outcome === o.value ? `${o.color}10` : 'transparent',
                    color: outcome === o.value ? o.color : 'var(--text-primary)',
                    outlineColor: o.color,
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="ws-input min-h-[70px] resize-none text-sm"
              placeholder="What was discussed?"
            />
          </div>

          {/* Follow-Up Date */}
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-tertiary)' }}>
              <CalendarClock size={12} />
              Follow-Up
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="ws-input text-sm mb-2"
            />
            <div className="flex flex-wrap gap-1">
              {FOLLOW_UP_CHIPS.map((chip, i) => (
                <button
                  key={chip.days}
                  onClick={() => handleChipClick(chip, i)}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
                  style={{
                    borderColor: activeChip === i ? 'var(--brand-deep)' : 'var(--border-primary)',
                    backgroundColor: activeChip === i ? 'var(--brand-deep)' : 'transparent',
                    color: activeChip === i ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-auto pt-3">
            <button
              onClick={handleSaveCall}
              disabled={!outcome || saving}
              className="ws-btn-primary w-full justify-center py-3"
            >
              {saving ? 'Saving...' : 'Log Call & Close'}
            </button>
          </div>
        </div>

        {/* ─── Right Column: Intel & Reference (~65%) ─── */}
        {/* No outer scroll — Property Story & Details are fixed height, Call Script fills remaining space */}
        <div className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
          {/* Property Story — shrink-to-fit, never scrolls */}
          <div className="shrink-0">
            <PropertyStoryTimeline property={property} signals={signals} />
          </div>

          {/* Property Quick Reference — only shown when there's data */}
          {hasPropertyDetails && (
            <div className="ws-card p-4 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Home size={14} style={{ color: 'var(--text-tertiary)' }} />
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Property Details
                </h3>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {property.propertyType && (
                  <QuickRefItem label="Type" value={property.propertyType} />
                )}
                {property.bedrooms != null && (
                  <QuickRefItem label="Beds" value={String(property.bedrooms)} />
                )}
                {property.bathrooms != null && (
                  <QuickRefItem label="Baths" value={String(property.bathrooms)} />
                )}
                {property.sqft != null && (
                  <QuickRefItem label="SqFt" value={property.sqft.toLocaleString()} />
                )}
                {property.yearBuilt != null && (
                  <QuickRefItem label="Built" value={String(property.yearBuilt)} />
                )}
                {property.assessedValue != null && (
                  <QuickRefItem label="Assessed" value={`$${Math.round(property.assessedValue / 1000)}k`} />
                )}
                {property.purchasePrice != null && (
                  <QuickRefItem label="Purchased" value={`$${Math.round(property.purchasePrice / 1000)}k`} />
                )}
                {property.estimatedValue != null && (
                  <QuickRefItem label="ARV" value={`$${Math.round(property.estimatedValue / 1000)}k`} />
                )}
              </div>
            </div>
          )}

          {/* Call Script — fills remaining space, scrolls internally */}
          <div className="ws-card p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <BookOpen size={14} style={{ color: 'var(--text-tertiary)' }} />
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Call Script
              </h3>
              {scripts.length > 1 && (
                <select
                  value={selectedScript}
                  onChange={(e) => setSelectedScript(e.target.value)}
                  className="ws-input ml-auto text-xs py-1 px-2"
                  style={{ maxWidth: '200px' }}
                >
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap p-3 rounded-lg flex-1 overflow-y-auto"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
              }}
            >
              {renderedScript || 'No script available'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickRefItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
