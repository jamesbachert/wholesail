'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react';

interface FilterOptions {
  cities: string[];
  zipCodes: string[];
}

interface Filters {
  createdFrom: string;
  createdTo: string;
  activityFrom: string;
  activityTo: string;
  signals: string[];
  cities: string[];
  zipCodes: string[];
  minScore: string;
  maxScore: string;
  minArv: string;
  maxArv: string;
  timeSensitive: boolean;
  needsReview: boolean;
  hasPhone: boolean;
  priority: string;
  minCodeViolations: string;
}

interface AdvancedFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  filterOptions: FilterOptions;
}

const SIGNAL_OPTIONS = [
  { type: 'pre_foreclosure', label: 'Pre-Foreclosure', category: 'distress' },
  { type: 'probate', label: 'Probate / Estate', category: 'distress' },
  { type: 'tax_delinquent', label: 'Tax Delinquent', category: 'distress' },
  { type: 'upset_sale', label: 'Upset Sale', category: 'distress' },
  { type: 'bankruptcy', label: 'Bankruptcy', category: 'financial' },
  { type: 'divorce', label: 'Divorce', category: 'distress' },
  { type: 'code_violation', label: 'Code Violation', category: 'distress' },
  { type: 'liens_judgments', label: 'Liens / Judgments', category: 'distress' },
  { type: 'owner_deceased', label: 'Owner Deceased', category: 'ownership' },
  { type: 'inherited', label: 'Inherited', category: 'ownership' },
  { type: 'absentee_owner', label: 'Absentee Owner', category: 'ownership' },
  { type: 'tired_landlord', label: 'Tired Landlord', category: 'ownership' },
  { type: 'out_of_state_owner', label: 'Out-of-State Owner', category: 'ownership' },
  { type: 'job_loss_income_drop', label: 'Job Loss / Income Drop', category: 'financial' },
  { type: 'high_equity', label: 'High Equity (50%+)', category: 'financial' },
  { type: 'free_and_clear', label: 'Owned Free & Clear', category: 'financial' },
  { type: 'vacant_property', label: 'Vacant Property', category: 'condition' },
  { type: 'rental_property', label: 'Rental Property', category: 'condition' },
  { type: 'fire_flood_damage', label: 'Fire / Flood Damage', category: 'condition' },
  { type: 'deferred_maintenance', label: 'Deferred Maintenance', category: 'condition' },
];

const emptyFilters: Filters = {
  createdFrom: '',
  createdTo: '',
  activityFrom: '',
  activityTo: '',
  signals: [],
  cities: [],
  zipCodes: [],
  minScore: '',
  maxScore: '',
  minArv: '',
  maxArv: '',
  timeSensitive: false,
  needsReview: false,
  hasPhone: false,
  priority: '',
  minCodeViolations: '',
};

export function AdvancedFilters({ filters, onChange, filterOptions }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = countActiveFilters(filters);

  function countActiveFilters(f: Filters): number {
    let count = 0;
    if (f.createdFrom || f.createdTo) count++;
    if (f.activityFrom || f.activityTo) count++;
    if (f.signals.length > 0) count++;
    if (f.cities.length > 0) count++;
    if (f.zipCodes.length > 0) count++;
    if (f.minScore || f.maxScore) count++;
    if (f.minArv || f.maxArv) count++;
    if (f.timeSensitive) count++;
    if (f.needsReview) count++;
    if (f.hasPhone) count++;
    if (f.priority) count++;
    if (f.minCodeViolations) count++;
    return count;
  }

  function handleClearAll() {
    onChange(emptyFilters);
  }

  function toggleSignal(signalType: string) {
    const current = filters.signals;
    const updated = current.includes(signalType)
      ? current.filter((s) => s !== signalType)
      : [...current, signalType];
    onChange({ ...filters, signals: updated });
  }

  function toggleCity(city: string) {
    const current = filters.cities;
    const updated = current.includes(city)
      ? current.filter((c) => c !== city)
      : [...current, city];
    onChange({ ...filters, cities: updated });
  }

  function toggleZip(zip: string) {
    const current = filters.zipCodes;
    const updated = current.includes(zip)
      ? current.filter((z) => z !== zip)
      : [...current, zip];
    onChange({ ...filters, zipCodes: updated });
  }

  return (
    <div className="ws-card overflow-hidden">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: 'var(--text-primary)' }}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} style={{ color: 'var(--brand-deep)' }} />
          <span className="text-sm font-medium">Advanced Filters</span>
          {activeCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
              style={{ backgroundColor: 'var(--brand-deep)' }}
            >
              {activeCount}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div
          className="px-4 pb-4 border-t space-y-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {/* Clear All */}
          {activeCount > 0 && (
            <div className="flex justify-end pt-3">
              <button
                onClick={handleClearAll}
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: 'var(--danger)' }}
              >
                <X size={12} />
                Clear All Filters
              </button>
            </div>
          )}

          {/* Row 1: Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                Created Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.createdFrom}
                  onChange={(e) => onChange({ ...filters, createdFrom: e.target.value })}
                  className="ws-input text-xs"
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
                <input
                  type="date"
                  value={filters.createdTo}
                  onChange={(e) => onChange({ ...filters, createdTo: e.target.value })}
                  className="ws-input text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                Last Activity
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.activityFrom}
                  onChange={(e) => onChange({ ...filters, activityFrom: e.target.value })}
                  className="ws-input text-xs"
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>to</span>
                <input
                  type="date"
                  value={filters.activityTo}
                  onChange={(e) => onChange({ ...filters, activityTo: e.target.value })}
                  className="ws-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Distress Signals */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Distress Signals
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SIGNAL_OPTIONS.map((signal) => (
                <button
                  key={signal.type}
                  onClick={() => toggleSignal(signal.type)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    filters.signals.includes(signal.type) ? 'text-white' : ''
                  }`}
                  style={{
                    backgroundColor: filters.signals.includes(signal.type)
                      ? 'var(--brand-deep)'
                      : 'transparent',
                    borderColor: filters.signals.includes(signal.type)
                      ? 'var(--brand-deep)'
                      : 'var(--border-primary)',
                    color: filters.signals.includes(signal.type)
                      ? '#ffffff'
                      : 'var(--text-secondary)',
                  }}
                >
                  {signal.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Location + Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* City */}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                City
              </label>
              <div
                className="max-h-32 overflow-y-auto rounded-lg border p-2 space-y-1"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                {filterOptions.cities.map((city) => (
                  <label key={city} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.cities.includes(city)}
                      onChange={() => toggleCity(city)}
                      className="rounded"
                    />
                    <span style={{ color: 'var(--text-primary)' }}>{city}</span>
                  </label>
                ))}
                {filterOptions.cities.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No cities found</span>
                )}
              </div>
            </div>

            {/* Zip Code */}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                Zip Code
              </label>
              <div
                className="max-h-32 overflow-y-auto rounded-lg border p-2 space-y-1"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                {filterOptions.zipCodes.map((zip) => (
                  <label key={zip} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.zipCodes.includes(zip)}
                      onChange={() => toggleZip(zip)}
                      className="rounded"
                    />
                    <span style={{ color: 'var(--text-primary)' }}>{zip}</span>
                  </label>
                ))}
                {filterOptions.zipCodes.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No zips found</span>
                )}
              </div>
            </div>

            {/* Score + ARV + Code Violations */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Score Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.minScore}
                    onChange={(e) => onChange({ ...filters, minScore: e.target.value })}
                    className="ws-input text-xs"
                    placeholder="Min"
                    min="0"
                  />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>–</span>
                  <input
                    type="number"
                    value={filters.maxScore}
                    onChange={(e) => onChange({ ...filters, maxScore: e.target.value })}
                    className="ws-input text-xs"
                    placeholder="Max"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  ARV Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.minArv}
                    onChange={(e) => onChange({ ...filters, minArv: e.target.value })}
                    className="ws-input text-xs"
                    placeholder="Min $"
                  />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>–</span>
                  <input
                    type="number"
                    value={filters.maxArv}
                    onChange={(e) => onChange({ ...filters, maxArv: e.target.value })}
                    className="ws-input text-xs"
                    placeholder="Max $"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Code Violations (min)
                </label>
                <select
                  value={filters.minCodeViolations}
                  onChange={(e) => onChange({ ...filters, minCodeViolations: e.target.value })}
                  className="ws-input text-xs py-1 w-full"
                >
                  <option value="">Any</option>
                  <option value="1">1+ violations</option>
                  <option value="2">2+ violations</option>
                  <option value="3">3+ violations</option>
                  <option value="5">5+ violations</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 4: Quick toggles */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={filters.timeSensitive}
                onChange={(e) => onChange({ ...filters, timeSensitive: e.target.checked })}
                className="rounded"
              />
              <span style={{ color: 'var(--text-primary)' }}>Time Sensitive Only</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={filters.needsReview}
                onChange={(e) => onChange({ ...filters, needsReview: e.target.checked })}
                className="rounded"
              />
              <span style={{ color: 'var(--text-primary)' }}>Needs Review</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasPhone}
                onChange={(e) => onChange({ ...filters, hasPhone: e.target.checked })}
                className="rounded"
              />
              <span style={{ color: 'var(--text-primary)' }}>Has Phone Number</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Priority:</span>
              <select
                value={filters.priority}
                onChange={(e) => onChange({ ...filters, priority: e.target.value })}
                className="ws-input text-xs py-1 w-auto"
              >
                <option value="">All</option>
                <option value="urgent">🔥 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="normal">🟡 Normal</option>
                <option value="low">🔵 Low</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { emptyFilters };
export type { Filters, FilterOptions };
