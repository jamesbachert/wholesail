'use client';

import { useState } from 'react';
import { X, Home, MapPin } from 'lucide-react';

// ============================================================
// ABSENTEE SIGNAL DIALOG
// Shown when a user saves a mailing address that differs from the
// property address. Lets them toggle Absentee Owner and/or
// Rental Property signals with the same visual style as SignalsTab.
// ============================================================

interface AbsenteeSignalDialogProps {
  propertyAddress: string;
  mailingAddress: string;
  onSave: (selected: string[]) => void;
  onSkip: () => void;
}

const OWNERSHIP_COLOR = '#3b82f6';

const SIGNAL_OPTIONS = [
  {
    type: 'absentee_owner',
    label: 'Absentee Owner',
    description: 'Owner lives at a different address than the property',
  },
  {
    type: 'rental_property',
    label: 'Rental Property',
    description: 'Property is being rented out to tenants',
  },
];

export function AbsenteeSignalDialog({
  propertyAddress,
  mailingAddress,
  onSave,
  onSkip,
}: AbsenteeSignalDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['absentee_owner']));

  const toggle = (type: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="ws-card flex flex-col overflow-hidden w-full max-w-md mx-4"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <MapPin size={18} style={{ color: OWNERSHIP_COLOR }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Address Mismatch Detected
            </h2>
          </div>
          <button
            onClick={onSkip}
            className="p-1 rounded-md transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Address comparison */}
          <div className="space-y-2">
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                Property:
              </span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{propertyAddress}</span>
            </div>
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: `${OWNERSHIP_COLOR}08` }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                Mailing:
              </span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{mailingAddress}</span>
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            The mailing address differs from the property address. Would you like to mark any of
            these ownership signals?
          </p>

          {/* Signal toggles — same visual style as SignalsTab */}
          <div>
            <div
              className="flex items-center gap-2 mb-2 pb-1.5 border-b"
              style={{ borderColor: OWNERSHIP_COLOR }}
            >
              <Home size={16} style={{ color: OWNERSHIP_COLOR }} />
              <h3
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: OWNERSHIP_COLOR }}
              >
                Ownership
              </h3>
            </div>

            <div className="space-y-0.5">
              {SIGNAL_OPTIONS.map((signal) => {
                const isActive = selected.has(signal.type);

                return (
                  <button
                    key={signal.type}
                    onClick={() => toggle(signal.type)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 w-full text-left"
                    style={{
                      backgroundColor: isActive ? `${OWNERSHIP_COLOR}08` : 'transparent',
                    }}
                  >
                    {/* Toggle Circle */}
                    <span
                      className="w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150 flex items-center justify-center hover:scale-110"
                      style={{
                        borderColor: isActive ? OWNERSHIP_COLOR : 'var(--border-primary)',
                        backgroundColor: isActive ? OWNERSHIP_COLOR : 'transparent',
                      }}
                    >
                      {isActive && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M2 5L4.5 7.5L8 3"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-sm font-medium block"
                        style={{
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {signal.label}
                      </span>
                      <span
                        className="text-[11px] block"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {signal.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onSkip}
            className="text-xs font-medium px-4 py-2 rounded-md transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Skip
          </button>
          <button
            onClick={() => onSave(Array.from(selected))}
            disabled={selected.size === 0}
            className="ws-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-40"
          >
            Apply {selected.size > 0 ? `${selected.size} Signal${selected.size > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
