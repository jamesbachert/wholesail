'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Zap,
  AlertTriangle,
  Home,
  DollarSign,
  Wrench,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface Signal {
  id: string;
  signalType: string;
  label: string;
  category: string;
  points: number;
  value: string | null;
  source: string | null;
  isAutomated: boolean;
  isLocked: boolean;
  isActive: boolean;
  eventDate: string | null;
  discoveredAt: string;
}

interface ScoringWeight {
  signalType: string;
  label: string;
  category: string;
  weight: number;
  description: string | null;
}

interface SignalsTabProps {
  leadId: string;
  signals: Signal[];
  totalScore: number;
  priority: string;
  onUpdate: () => void;
  onCountChange?: (count: number) => void;
}

// ============================================================
// SIGNAL INLINE DETAIL CONFIG (all optional now)
// ============================================================

type InlineDetailType = 'date' | 'text' | 'date_and_text' | 'none';

const SIGNAL_DETAIL_CONFIG: Record<string, { detailType: InlineDetailType; datePlaceholder?: string; textPlaceholder?: string }> = {
  pre_foreclosure:     { detailType: 'date_and_text', datePlaceholder: 'Filing / sale date', textPlaceholder: 'Case #, court, notes...' },
  probate:             { detailType: 'date_and_text', datePlaceholder: 'Date of death / filing', textPlaceholder: 'Estate #, executor name...' },
  tax_delinquent:      { detailType: 'date_and_text', datePlaceholder: 'Delinquency date', textPlaceholder: 'Amount owed, years...' },
  divorce:             { detailType: 'date',          datePlaceholder: 'Filing date' },
  code_violation:      { detailType: 'text',          textPlaceholder: 'Violation type, case #, details...' },
  rental_property:     { detailType: 'text',          textPlaceholder: 'License #, expiration, # of units...' },
  liens_judgments:     { detailType: 'date_and_text', datePlaceholder: 'Filing date', textPlaceholder: 'Lien type, amount, holder...' },
  owner_deceased:      { detailType: 'date',          datePlaceholder: 'Date of death' },
  inherited:           { detailType: 'text',          textPlaceholder: 'Heir name, relationship...' },
  absentee_owner:      { detailType: 'none' },
  out_of_state_owner:  { detailType: 'text',          textPlaceholder: 'Owner state, mailing address...' },
  tired_landlord:      { detailType: 'text',          textPlaceholder: '# of properties, complaints...' },
  bankruptcy:          { detailType: 'date',          datePlaceholder: 'Filing date' },
  high_equity:         { detailType: 'text',          textPlaceholder: 'Estimated equity amount...' },
  free_and_clear:      { detailType: 'none' },
  job_loss:            { detailType: 'text',          textPlaceholder: 'Source, details...' },
  vacant:              { detailType: 'text',          textPlaceholder: 'How confirmed? (USPS, visual, utility...)' },
  fire_flood_damage:   { detailType: 'date_and_text', datePlaceholder: 'Date of incident', textPlaceholder: 'Type of damage, severity...' },
  deferred_maintenance:{ detailType: 'text',          textPlaceholder: 'Roof, windows, overgrown, boarded...' },
};

// Signals that sync to Property record
const PROPERTY_SYNC_FIELDS: Record<string, string> = {
  vacant: 'isVacant',
  absentee_owner: 'isAbsenteeOwner',
  code_violation: 'hasCodeViolations',
  rental_property: 'isRentalProperty',
};

// ============================================================
// 4 CATEGORIES, 17 SIGNALS
// ============================================================

const CATEGORIES = [
  {
    key: 'distress',
    label: 'Distress Signals',
    icon: AlertTriangle,
    color: '#ef4444',
    signals: ['pre_foreclosure', 'probate', 'tax_delinquent', 'divorce', 'code_violation', 'liens_judgments'],
  },
  {
    key: 'ownership',
    label: 'Ownership',
    icon: Home,
    color: '#3b82f6',
    signals: ['owner_deceased', 'inherited', 'absentee_owner', 'out_of_state_owner', 'tired_landlord', 'rental_property'],
  },
  {
    key: 'financial',
    label: 'Financial',
    icon: DollarSign,
    color: '#10b981',
    signals: ['bankruptcy', 'high_equity', 'free_and_clear', 'job_loss'],
  },
  {
    key: 'condition',
    label: 'Condition',
    icon: Wrench,
    color: '#6b7280',
    signals: ['vacant', 'fire_flood_damage', 'deferred_maintenance'],
  },
];

// Fallback weights if the API hasn't loaded yet
const FALLBACK_WEIGHTS: Record<string, { label: string; weight: number; category: string }> = {
  pre_foreclosure:     { label: 'Pre-Foreclosure / NOD',    weight: 45, category: 'distress' },
  probate:             { label: 'Probate / Estate',          weight: 38, category: 'distress' },
  tax_delinquent:      { label: 'Tax Delinquent',            weight: 32, category: 'distress' },
  divorce:             { label: 'Recent Divorce',            weight: 28, category: 'distress' },
  code_violation:      { label: 'Code Violation',            weight: 22, category: 'distress' },
  liens_judgments:     { label: 'Liens / Judgments',         weight: 18, category: 'distress' },
  owner_deceased:      { label: 'Owner Deceased',            weight: 35, category: 'ownership' },
  inherited:           { label: 'Inherited',                 weight: 25, category: 'ownership' },
  absentee_owner:      { label: 'Absentee Owner',            weight: 22, category: 'ownership' },
  out_of_state_owner:  { label: 'Out-of-State Owner',        weight: 15, category: 'ownership' },
  tired_landlord:      { label: 'Tired Landlord',            weight: 18, category: 'ownership' },
  rental_property:     { label: 'Rental Property',           weight: 8,  category: 'ownership' },
  bankruptcy:          { label: 'Bankruptcy',                weight: 30, category: 'financial' },
  high_equity:         { label: 'High Equity (50%+)',        weight: 16, category: 'financial' },
  free_and_clear:      { label: 'Owned Free & Clear',        weight: 12, category: 'financial' },
  job_loss:            { label: 'Job Loss / Income Drop',    weight: 20, category: 'financial' },
  vacant:              { label: 'Vacant Property',           weight: 25, category: 'condition' },
  fire_flood_damage:   { label: 'Fire / Flood Damage',       weight: 20, category: 'condition' },
  deferred_maintenance:{ label: 'Deferred Maintenance',      weight: 12, category: 'condition' },
};

// ============================================================
// COMPONENT
// ============================================================

export function SignalsTab({ leadId, signals: initialSignals, totalScore: initialScore, priority: initialPriority, onUpdate, onCountChange }: SignalsTabProps) {
  const [allWeights, setAllWeights] = useState<ScoringWeight[]>([]);
  const [localSignals, setLocalSignals] = useState<Signal[]>(initialSignals);
  const [localScore, setLocalScore] = useState(initialScore);
  const [localPriority, setLocalPriority] = useState(initialPriority);
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  // Sync from parent when props change
  useEffect(() => {
    setLocalSignals(initialSignals);
    setLocalScore(initialScore);
    setLocalPriority(initialPriority);
  }, [initialSignals, initialScore, initialPriority]);

  // Fetch scoring weights
  useEffect(() => {
    fetch('/api/scoring-weights')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllWeights(data);
      })
      .catch(() => {});
  }, []);

  // Signal lookup — single map (last wins) for non-stackable signals
  const signalMap = new Map<string, Signal>();
  for (const s of localSignals) {
    signalMap.set(s.signalType, s);
  }

  // Multi-signal map for stackable types (code_violation can have multiple instances)
  const STACKABLE_TYPES = new Set(['code_violation']);
  const signalMultiMap = new Map<string, Signal[]>();
  for (const s of localSignals) {
    if (STACKABLE_TYPES.has(s.signalType)) {
      const existing = signalMultiMap.get(s.signalType) || [];
      existing.push(s);
      signalMultiMap.set(s.signalType, existing);
    }
  }

  // Optimistic score recalc
  const recalcLocal = useCallback((updatedSignals: Signal[]) => {
    let score = 0;
    let distressCount = 0;
    let codeViolationCount = 0;
    let activeCount = 0;

    for (const s of updatedSignals) {
      if (s.isActive) {
        score += s.points;
        activeCount++;
        if (s.category === 'distress') distressCount++;
        if (s.signalType === 'code_violation') codeViolationCount++;
      }
    }

    if (distressCount >= 3) score += 20;
    else if (distressCount >= 2) score += 10;

    // Code violation stacking bonus: +10 for 2+ violations
    if (codeViolationCount >= 2) score += 10;

    setLocalScore(score);
    setLocalPriority(score >= 100 ? 'urgent' : score >= 70 ? 'high' : score >= 40 ? 'normal' : 'low');
    onCountChange?.(activeCount);
  }, [onCountChange]);

  // --------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------

  async function handleActivate(signalType: string) {
    const weightDef = allWeights.find((w) => w.signalType === signalType) || FALLBACK_WEIGHTS[signalType];
    if (!weightDef) return;

    setLoading(signalType);

    // Optimistic
    const newSignal: Signal = {
      id: `temp-${signalType}`,
      signalType,
      label: weightDef.label,
      category: weightDef.category,
      points: weightDef.weight,
      value: null,
      source: 'Manual',
      isAutomated: false,
      isLocked: false,
      isActive: true,
      eventDate: null,
      discoveredAt: new Date().toISOString(),
    };

    const updated = [...localSignals.filter((s) => s.signalType !== signalType), newSignal];
    setLocalSignals(updated);
    recalcLocal(updated);

    try {
      await fetch('/api/leads/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          leadId,
          signalType,
          syncProperty: PROPERTY_SYNC_FIELDS[signalType] || undefined,
        }),
      });
      onUpdate();
    } catch {
      setLocalSignals(initialSignals);
      recalcLocal(initialSignals);
    } finally {
      setLoading(null);
    }
  }

  async function handleDeactivate(signal: Signal) {
    if (signal.isLocked) return;
    setLoading(signal.signalType);

    const updated = localSignals.map((s) =>
      s.signalType === signal.signalType ? { ...s, isActive: false } : s
    );
    setLocalSignals(updated);
    recalcLocal(updated);

    try {
      await fetch('/api/leads/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          signalId: signal.id,
          syncProperty: PROPERTY_SYNC_FIELDS[signal.signalType] || undefined,
        }),
      });
      onUpdate();
    } catch {
      setLocalSignals(initialSignals);
      recalcLocal(initialSignals);
    } finally {
      setLoading(null);
    }
  }

  async function handleReactivate(signal: Signal) {
    if (signal.isLocked) return;
    setLoading(signal.signalType);

    const updated = localSignals.map((s) =>
      s.signalType === signal.signalType ? { ...s, isActive: true } : s
    );
    setLocalSignals(updated);
    recalcLocal(updated);

    try {
      await fetch('/api/leads/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          signalId: signal.id,
          syncProperty: PROPERTY_SYNC_FIELDS[signal.signalType] || undefined,
        }),
      });
      onUpdate();
    } catch {
      setLocalSignals(initialSignals);
      recalcLocal(initialSignals);
    } finally {
      setLoading(null);
    }
  }

  async function handleUnlock(signal: Signal) {
    setLoading(signal.signalType);
    const updated = localSignals.map((s) =>
      s.id === signal.id ? { ...s, isLocked: false } : s
    );
    setLocalSignals(updated);

    try {
      await fetch('/api/leads/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', signalId: signal.id }),
      });
      onUpdate();
    } catch {
      setLocalSignals(initialSignals);
    } finally {
      setLoading(null);
    }
  }

  async function handleLock(signal: Signal) {
    setLoading(signal.signalType);
    const updated = localSignals.map((s) =>
      s.id === signal.id ? { ...s, isLocked: true } : s
    );
    setLocalSignals(updated);

    try {
      await fetch('/api/leads/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', signalId: signal.id }),
      });
      onUpdate();
    } catch {
      setLocalSignals(initialSignals);
    } finally {
      setLoading(null);
    }
  }

  async function handleSaveDetails(signalType: string, date: string, text: string) {
    const existing = signalMap.get(signalType);
    if (!existing) return;

    try {
      await fetch('/api/leads/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          signalId: existing.id,
          value: text || undefined,
          eventDate: date || undefined,
        }),
      });
      onUpdate();
    } catch {
      // Details are optional — silent fail
    }

    setExpandedDetails((prev) => {
      const next = new Set(prev);
      next.delete(signalType);
      return next;
    });
  }

  function toggleDetailExpanded(signalType: string) {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(signalType)) next.delete(signalType);
      else next.add(signalType);
      return next;
    });
  }

  function handleCircleClick(signalType: string) {
    const existing = signalMap.get(signalType);

    if (!existing) {
      handleActivate(signalType);
    } else if (existing.isActive) {
      handleDeactivate(existing);
    } else {
      handleReactivate(existing);
    }
  }

  // Score display
  const activeTotal = localSignals.filter((s) => s.isActive).length;
  const activeDistress = localSignals.filter((s) => s.category === 'distress' && s.isActive).length;
  const activeCodeViolations = localSignals.filter((s) => s.signalType === 'code_violation' && s.isActive).length;

  const priorityDisplay = localScore >= 100
    ? { emoji: '🔥', label: 'Priority — call same day', color: '#ef4444' }
    : localScore >= 70
    ? { emoji: '🟠', label: 'Hot — reach out within 24 hrs', color: '#f97316' }
    : localScore >= 40
    ? { emoji: '🟡', label: 'Warm — SMS nurture sequence', color: '#eab308' }
    : { emoji: '🔵', label: 'Cold — monitor only', color: '#3b82f6' };

  return (
    <div className="space-y-5">
      {/* Score Header */}
      <div className="ws-card p-4">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white transition-all duration-300"
            style={{ backgroundColor: priorityDisplay.color }}
          >
            {localScore}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {priorityDisplay.emoji} {priorityDisplay.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {activeTotal} active signal{activeTotal !== 1 ? 's' : ''}
              {activeDistress >= 2 && (
                <span style={{ color: '#f59e0b' }}>
                  {' '}· Distress stacking: +{activeDistress >= 3 ? 20 : 10} pts
                </span>
              )}
              {activeCodeViolations >= 2 && (
                <span style={{ color: '#ef4444' }}>
                  {' '}· Multi-violation: +10 pts ({activeCodeViolations} cases)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-3 py-2 rounded-lg text-xs"
        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
      >
        <div className="flex items-center gap-1.5">
          <Zap size={12} style={{ color: '#f59e0b' }} />
          <span>Automatically detected by a data source</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={12} />
          <span>Locked — unlock to override</span>
        </div>
      </div>

      {/* Category Sections */}
      {CATEGORIES.map((category) => {
        const Icon = category.icon;

        return (
          <div key={category.key}>
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b" style={{ borderColor: category.color }}>
              <Icon size={16} style={{ color: category.color }} />
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: category.color }}>
                {category.label}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
              {category.signals.map((signalType) => {
                const existing = signalMap.get(signalType);
                const allInstances = signalMultiMap.get(signalType) || [];
                const activeInstances = allInstances.filter((s) => s.isActive);
                const isStackable = STACKABLE_TYPES.has(signalType);
                const isActive = existing?.isActive ?? false;
                const isAutomated = existing?.isAutomated ?? false;
                const isLocked = existing?.isLocked ?? false;
                const isLoading = loading === signalType;
                const detailConfig = SIGNAL_DETAIL_CONFIG[signalType] || { detailType: 'none' };
                const isDetailExpanded = expandedDetails.has(signalType);
                const hasDetails = detailConfig.detailType !== 'none';

                const weightDef = allWeights.find((w) => w.signalType === signalType);
                const fallback = FALLBACK_WEIGHTS[signalType];
                const label = weightDef?.label || fallback?.label || signalType;

                return (
                  <div key={signalType}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                        isLoading ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      style={{
                        backgroundColor: isActive ? `${category.color}08` : 'transparent',
                      }}
                    >
                      {/* Toggle Circle */}
                      <button
                        onClick={() => handleCircleClick(signalType)}
                        disabled={isLocked || isLoading}
                        className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150 flex items-center justify-center ${
                          isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
                        }`}
                        style={{
                          borderColor: isActive ? category.color : 'var(--border-primary)',
                          backgroundColor: isActive ? category.color : 'transparent',
                        }}
                        title={isLocked ? 'Unlock this signal first' : isActive ? 'Deactivate' : 'Activate'}
                      >
                        {isActive && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Label + stackable count badge */}
                      <span
                        className="text-sm font-medium flex-1 select-none flex items-center gap-1.5"
                        style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {label}
                        {isStackable && activeInstances.length > 1 && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white"
                            style={{ backgroundColor: category.color }}
                          >
                            {activeInstances.length}
                          </span>
                        )}
                      </span>

                      {/* Expand details arrow */}
                      {isActive && hasDetails && (
                        <button
                          onClick={() => toggleDetailExpanded(signalType)}
                          className="shrink-0 p-0.5 rounded transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                          title="Add or edit details"
                        >
                          {isDetailExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}

                      {/* Auto-detected bolt */}
                      {isAutomated && (
                        <span
                          title={`Automatically detected${existing?.source ? ` by ${existing.source}` : ''}`}
                          className="shrink-0 cursor-help"
                        >
                          <Zap size={13} style={{ color: '#f59e0b' }} />
                        </span>
                      )}

                      {/* Lock/Unlock */}
                      {isAutomated && isActive && (
                        <button
                          onClick={() => {
                            if (isLocked && existing) handleUnlock(existing);
                            else if (existing) handleLock(existing);
                          }}
                          className="shrink-0 p-0.5 rounded transition-colors"
                          style={{ color: isLocked ? '#f59e0b' : 'var(--text-tertiary)' }}
                          title={isLocked ? 'Click to unlock and allow manual override' : 'Click to lock this signal'}
                          disabled={isLoading}
                        >
                          {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                      )}
                    </div>

                    {/* Compact existing details — stackable signals show all instances */}
                    {isActive && !isDetailExpanded && isStackable && activeInstances.length > 0 && (
                      <div
                        className="ml-8 mr-3 mb-0.5 space-y-0.5 cursor-pointer"
                        onClick={() => toggleDetailExpanded(signalType)}
                      >
                        {activeInstances.map((inst, idx) => (
                          <div
                            key={inst.id}
                            className="px-2.5 py-1 rounded text-[11px] truncate"
                            style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-elevated)' }}
                          >
                            {inst.eventDate && <span>{new Date(inst.eventDate).toLocaleDateString()}</span>}
                            {inst.eventDate && inst.value && <span> · </span>}
                            {inst.value && <span>{inst.value}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Compact existing details — non-stackable signals show single instance */}
                    {isActive && !isDetailExpanded && !isStackable && existing && (existing.value || existing.eventDate) && (
                      <div
                        className="ml-8 mr-3 mb-0.5 px-2.5 py-1 rounded text-[11px] truncate cursor-pointer"
                        style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-elevated)' }}
                        onClick={() => toggleDetailExpanded(signalType)}
                      >
                        {existing.eventDate && <span>{new Date(existing.eventDate).toLocaleDateString()}</span>}
                        {existing.eventDate && existing.value && <span> · </span>}
                        {existing.value && <span>{existing.value}</span>}
                      </div>
                    )}

                    {/* Expanded detail editor */}
                    {isActive && isDetailExpanded && hasDetails && (
                      <InlineDetailEditor
                        config={detailConfig}
                        initialDate={existing?.eventDate || ''}
                        initialText={existing?.value || ''}
                        categoryColor={category.color}
                        onSave={(date, text) => handleSaveDetails(signalType, date, text)}
                        onCancel={() => toggleDetailExpanded(signalType)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// INLINE DETAIL EDITOR
// ============================================================

function InlineDetailEditor({
  config,
  initialDate,
  initialText,
  categoryColor,
  onSave,
  onCancel,
}: {
  config: { detailType: InlineDetailType; datePlaceholder?: string; textPlaceholder?: string };
  initialDate: string;
  initialText: string;
  categoryColor: string;
  onSave: (date: string, text: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initialDate ? initialDate.split('T')[0] : '');
  const [text, setText] = useState(initialText || '');

  return (
    <div
      className="ml-8 mr-3 mb-2 p-2.5 rounded-lg space-y-2"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      {(config.detailType === 'date' || config.detailType === 'date_and_text') && (
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ws-input text-xs"
          placeholder={config.datePlaceholder}
        />
      )}
      {(config.detailType === 'text' || config.detailType === 'date_and_text') && (
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="ws-input text-xs"
          placeholder={config.textPlaceholder}
        />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(date, text)}
          className="text-xs font-medium px-3 py-1 rounded-md text-white transition-colors"
          style={{ backgroundColor: categoryColor }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-xs font-medium px-3 py-1 rounded-md"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
