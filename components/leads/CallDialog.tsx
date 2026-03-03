'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  X,
  ChevronRight,
  ChevronLeft,
  Clock,
  Copy,
  Check,
  FileText,
} from 'lucide-react';

interface CallScript {
  id: string;
  title: string;
  slug: string;
  body: string;
  isDefault: boolean;
}

interface CallDialogProps {
  leadId: string;
  ownerName: string;
  address: string;
  phoneNumber: string | null;
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

export function CallDialog({
  leadId,
  ownerName,
  address,
  phoneNumber,
  onClose,
  onCallLogged,
}: CallDialogProps) {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [showScript, setShowScript] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [calling, setCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch scripts
  useEffect(() => {
    fetch('/api/scripts')
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
  }, []);

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

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function handleStartCall() {
    setCalling(true);
    setCallDuration(0);
  }

  function handleEndCall() {
    setCalling(false);
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
      navigator.clipboard.writeText(phoneNumber);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="ws-card flex overflow-hidden w-full max-w-4xl mx-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          maxHeight: '85vh',
        }}
      >
        {/* Left Panel — Dialer & Notes */}
        <div className="flex-1 p-6 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                Call {ownerName || 'Unknown'}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {address}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Phone Number */}
          <div
            className="flex items-center gap-3 p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <Phone size={18} style={{ color: 'var(--brand-deep)' }} />
            <span className="font-mono text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {phoneNumber || 'No phone number'}
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
                onClick={handleStartCall}
                className="ws-btn-primary flex-1 justify-center py-3"
                disabled={!phoneNumber}
              >
                <Phone size={18} />
                Start Call
              </button>
            ) : (
              <>
                <div
                  className="flex items-center gap-2 flex-1 justify-center py-3 rounded-lg font-mono text-xl font-bold"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--success)' }}
                >
                  <Clock size={18} />
                  {formatDuration(callDuration)}
                </div>
                <button
                  onClick={handleEndCall}
                  className="px-6 py-3 rounded-lg font-medium text-sm text-white transition-all"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  <PhoneOff size={18} />
                </button>
              </>
            )}
          </div>

          {/* Call Outcome */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Call Outcome
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-left ${
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
          <div className="flex-1 mb-4">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Call Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="ws-input h-full min-h-[100px] resize-none"
              placeholder="What was discussed? Any follow-up needed?"
            />
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveCall}
              disabled={!outcome || saving}
              className="ws-btn-primary flex-1 justify-center py-3"
            >
              {saving ? 'Saving...' : 'Log Call & Close'}
            </button>
            <button
              onClick={() => setShowScript(!showScript)}
              className="ws-btn-secondary py-3 md:hidden"
            >
              <FileText size={16} />
            </button>
          </div>
        </div>

        {/* Right Panel — Call Script (expandable) */}
        <div
          className={`border-l transition-all duration-300 flex flex-col ${
            showScript ? 'w-[380px]' : 'w-[44px]'
          } hidden md:flex`}
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setShowScript(!showScript)}
            className="p-3 flex items-center gap-2 border-b"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            {showScript ? (
              <>
                <ChevronRight size={16} />
                <span className="text-sm font-medium">Script</span>
              </>
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>

          {showScript && (
            <div className="flex-1 flex flex-col overflow-hidden p-4">
              {/* Script Selector */}
              <select
                value={selectedScript}
                onChange={(e) => setSelectedScript(e.target.value)}
                className="ws-input mb-3 text-sm"
              >
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              {/* Script Content */}
              <div
                className="flex-1 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                }}
              >
                {renderedScript || 'No script selected'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
