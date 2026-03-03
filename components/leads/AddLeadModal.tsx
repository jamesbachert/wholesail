'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Home,
  DollarSign,
  Wrench,
  Database,
  Wifi,
  ExternalLink,
} from 'lucide-react';
import { apiPost } from '@/lib/hooks';

// ============================================================
// SIGNAL OPTIONS — for manual selection during lead entry
// Signal types must match the SignalsTab CATEGORIES + FALLBACK_WEIGHTS
// ============================================================

// Category config matches SignalsTab CATEGORIES exactly — icons, colors, labels
const CATEGORY_CONFIG = [
  { key: 'Distress', label: 'Distress Signals', icon: AlertTriangle, color: '#ef4444' },
  { key: 'Ownership', label: 'Ownership', icon: Home, color: '#3b82f6' },
  { key: 'Financial', label: 'Financial', icon: DollarSign, color: '#10b981' },
  { key: 'Condition', label: 'Condition', icon: Wrench, color: '#6b7280' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Distress: '#ef4444',
  Ownership: '#3b82f6',
  Financial: '#10b981',
  Condition: '#6b7280',
};

// Convert hex color to rgba for lighter pill backgrounds
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SIGNAL_OPTIONS = [
  { type: 'pre_foreclosure', label: 'Pre-Foreclosure', category: 'Distress' },
  { type: 'probate', label: 'Probate / Estate', category: 'Distress' },
  { type: 'tax_delinquent', label: 'Tax Delinquent', category: 'Distress' },
  { type: 'divorce', label: 'Divorce', category: 'Distress' },
  { type: 'code_violation', label: 'Code Violation', category: 'Distress' },
  { type: 'liens_judgments', label: 'Liens / Judgments', category: 'Distress' },
  { type: 'owner_deceased', label: 'Owner Deceased', category: 'Ownership' },
  { type: 'inherited', label: 'Inherited', category: 'Ownership' },
  { type: 'absentee_owner', label: 'Absentee Owner', category: 'Ownership' },
  { type: 'out_of_state_owner', label: 'Out-of-State Owner', category: 'Ownership' },
  { type: 'tired_landlord', label: 'Tired Landlord', category: 'Ownership' },
  { type: 'rental_property', label: 'Rental Property', category: 'Ownership' },
  { type: 'bankruptcy', label: 'Bankruptcy', category: 'Financial' },
  { type: 'high_equity', label: 'High Equity (50%+)', category: 'Financial' },
  { type: 'free_and_clear', label: 'Owned Free & Clear', category: 'Financial' },
  { type: 'job_loss', label: 'Job Loss / Income Drop', category: 'Financial' },
  { type: 'vacant', label: 'Vacant Property', category: 'Condition' },
  { type: 'fire_flood_damage', label: 'Fire / Flood Damage', category: 'Condition' },
  { type: 'deferred_maintenance', label: 'Deferred Maintenance', category: 'Condition' },
];

const PROPERTY_TYPES = [
  'Single Family',
  'Multi-Family',
  'Condo',
  'Townhouse',
  'Duplex',
  'Triplex',
  'Quadplex',
  'Vacant Land',
  'Commercial',
  'Other',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC',
];

// ============================================================
// ADDRESS AUTOCOMPLETE
// Uses Geoapify via server-side proxy (/api/geocode/autocomplete)
// API key managed in Settings → API Keys
// ============================================================

interface AddressSuggestion {
  display: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

// ============================================================
// TYPES
// ============================================================

interface ConnectorOption {
  slug: string;
  name: string;
  type: 'import' | 'lookup';
  connectorKind: string;
  description: string;
  enrichmentMode: 'cross_reference' | 'live_lookup';
  hasExistingData: boolean;
  existingRecordCount: number;
}

interface EnrichResult {
  slug: string;
  name: string;
  found: boolean;
  signalsAdded: number;
  error?: string;
}

interface AddLeadModalProps {
  onClose: () => void;
  onLeadCreated: () => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function AddLeadModal({ onClose, onLeadCreated }: AddLeadModalProps) {
  const router = useRouter();

  // Form fields
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [county, setCounty] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Signals
  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(new Set());
  const [showSignals, setShowSignals] = useState(false);

  // Connector enrichment
  const [connectors, setConnectors] = useState<ConnectorOption[]>([]);
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [loadingConnectors, setLoadingConnectors] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [hasConnectors, setHasConnectors] = useState(false);

  // Submission state
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState('');
  const [duplicateLead, setDuplicateLead] = useState<{ leadId: string; address: string } | null>(null);
  const [enrichResults, setEnrichResults] = useState<EnrichResult[] | null>(null);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

  // ============================================================
  // ADDRESS AUTOCOMPLETE (Geoapify via server-side proxy)
  // ============================================================

  useEffect(() => {
    if (address.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      // Abort any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/geocode/autocomplete?q=${encodeURIComponent(address)}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        // If API key not configured, silently disable (no error shown)
        if (data.error || !data.suggestions) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        setSuggestions(data.suggestions);
        setShowSuggestions(data.suggestions.length > 0);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [address]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addressRef.current && !addressRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectSuggestion(s: AddressSuggestion) {
    setAddress(s.street);
    setCity(s.city);
    setState(s.state);
    setZipCode(s.zip);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  // ============================================================
  // FETCH CONNECTORS ON ZIP CHANGE
  // ============================================================

  useEffect(() => {
    if (zipCode.length !== 5) {
      setConnectors([]);
      setSelectedConnectors(new Set());
      setHasConnectors(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingConnectors(true);
      try {
        const res = await fetch(`/api/connectors/coverage?zip=${zipCode}`);
        const data = await res.json();
        if (data.connectors && data.connectors.length > 0) {
          setConnectors(data.connectors);
          setHasConnectors(true);
          // Pre-select live lookup connectors and import connectors with existing data
          const preSelected = new Set<string>();
          for (const c of data.connectors) {
            if (c.enrichmentMode === 'live_lookup' || c.hasExistingData) {
              preSelected.add(c.slug);
            }
          }
          setSelectedConnectors(preSelected);
        } else {
          setConnectors([]);
          setSelectedConnectors(new Set());
          setHasConnectors(false);
        }
      } catch {
        setConnectors([]);
        setHasConnectors(false);
      } finally {
        setLoadingConnectors(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [zipCode]);

  // ============================================================
  // TOGGLES
  // ============================================================

  function toggleSignal(signalType: string) {
    setSelectedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(signalType)) next.delete(signalType);
      else next.add(signalType);
      return next;
    });
  }

  function toggleConnector(slug: string) {
    setSelectedConnectors((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAllConnectors() {
    if (selectedConnectors.size === connectors.length) {
      setSelectedConnectors(new Set());
    } else {
      setSelectedConnectors(new Set(connectors.map((c) => c.slug)));
    }
  }

  // ============================================================
  // SUBMIT
  // ============================================================

  async function handleSubmit() {
    setError('');
    setDuplicateLead(null);

    // Validate
    if (!address.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setError('Address, city, state, and zip code are required.');
      return;
    }

    setSaving(true);

    try {
      // Create the lead (use fetch directly to handle 409 duplicate)
      const createRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          county: county.trim() || undefined,
          ownerName: ownerName.trim() || undefined,
          ownerPhone: ownerPhone.trim() || undefined,
          ownerEmail: ownerEmail.trim() || undefined,
          propertyType: propertyType || undefined,
          signals: Array.from(selectedSignals),
        }),
      });

      const res = await createRes.json();

      if (createRes.status === 409 && res.duplicate) {
        setDuplicateLead({ leadId: res.leadId, address: res.address });
        setSaving(false);
        return;
      }

      if (!createRes.ok) {
        throw new Error(res.error || 'Failed to create lead');
      }

      const leadId = res.lead.id;
      setCreatedLeadId(leadId);

      // Run enrichment if any connectors selected
      const slugsToEnrich = Array.from(selectedConnectors);
      if (slugsToEnrich.length > 0) {
        setEnriching(true);
        try {
          const enrichRes: any = await apiPost(`/api/leads/${leadId}/enrich`, {
            connectorSlugs: slugsToEnrich,
          });
          setEnrichResults(enrichRes.results || []);
        } catch (enrichErr: any) {
          console.error('Enrichment error:', enrichErr);
          setEnrichResults([]);
        } finally {
          setEnriching(false);
        }
      }

      // Notify parent to refresh
      onLeadCreated();

      // Navigate to the new lead
      setSaving(false);
      router.push(`/leads/${leadId}`);
      onClose();
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('409')) {
        // Handled above via response body
      } else if (err.message?.includes('not in a supported region')) {
        setError(`Zip code ${zipCode} is not in a supported region yet.`);
      } else {
        setError(err.message || 'Failed to create lead');
      }
      setSaving(false);
    }
  }

  const isSubmitting = saving || enriching;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        className="ws-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-2">
            <Plus size={18} style={{ color: 'var(--brand-deep)' }} />
            <h2 className="text-lg font-bold font-display" style={{ color: 'var(--text-primary)' }}>
              Add Lead
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Error / Duplicate Messages */}
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--danger-bg, #fef2f2)', color: 'var(--danger)' }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {duplicateLead && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--warning-bg, #fffbeb)', color: 'var(--warning, #d97706)' }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                A lead already exists at this address.
              </div>
              <a
                href={`/leads/${duplicateLead.leadId}`}
                className="flex items-center gap-1 font-medium underline"
                style={{ color: 'var(--brand-deep)' }}
              >
                View Lead <ExternalLink size={14} />
              </a>
            </div>
          )}

          {/* === PROPERTY ADDRESS === */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Property Address
            </h3>
            <div className="space-y-3">
              {/* Address with autocomplete */}
              <div ref={addressRef} className="relative">
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Street Address *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Start typing an address..."
                    className="ws-input text-sm w-full"
                    autoFocus
                    autoComplete="off"
                  />
                  {loadingSuggestions && (
                    <Loader2
                      size={14}
                      className="animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                  )}
                </div>

                {/* Autocomplete dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    className="absolute z-20 w-full mt-1 rounded-lg border shadow-lg overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-primary)' }}
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 transition-colors border-b last:border-b-0"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
                      >
                        {s.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Allentown"
                    className="ws-input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    State *
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="ws-input text-sm w-full"
                    style={{
                      color: state ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      height: '38px',
                    }}
                  >
                    <option value="" style={{ color: 'var(--text-tertiary)' }}>Select...</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s} style={{ color: 'var(--text-primary)' }}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Zip Code *
                  </label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="18101"
                    className="ws-input text-sm w-full"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* === MORE DETAILS (collapsible) === */}
          <div>
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--brand-deep)' }}
            >
              {showMoreDetails
                ? <ChevronUp size={14} />
                : <ChevronRight size={14} />}
              Owner & Property Details
            </button>

            {showMoreDetails && (
              <div className="mt-3 space-y-3">
                {/* Owner Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Owner Name
                    </label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="John Smith"
                      className="ws-input text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Owner Phone
                    </label>
                    <input
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="ws-input text-sm w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Owner Email
                    </label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@email.com"
                      className="ws-input text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                      County
                    </label>
                    <input
                      type="text"
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      placeholder="Lehigh"
                      className="ws-input text-sm w-full"
                    />
                  </div>
                </div>
                {/* Property Details */}
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Property Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="ws-input text-sm w-full"
                  >
                    <option value="">Select type...</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* === KNOWN SIGNALS (collapsible) === */}
          <div>
            <button
              type="button"
              onClick={() => setShowSignals(!showSignals)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--brand-deep)' }}
            >
              {showSignals
                ? <ChevronUp size={14} />
                : <ChevronRight size={14} />}
              Known Distress Signals
              {selectedSignals.size > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full text-white ml-1"
                  style={{ backgroundColor: 'var(--brand-deep)' }}
                >
                  {selectedSignals.size}
                </span>
              )}
            </button>

            {showSignals && (
              <div className="mt-3">
                <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                  Select any signals you already know about this property.
                </p>
                {CATEGORY_CONFIG.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.key} className="mb-4">
                      {/* Category header — icon + label + colored bottom border (matches SignalsTab) */}
                      <div
                        className="flex items-center gap-2 mb-2 pb-1.5 border-b"
                        style={{ borderColor: cat.color }}
                      >
                        <Icon size={14} style={{ color: cat.color }} />
                        <span
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: cat.color }}
                        >
                          {cat.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SIGNAL_OPTIONS.filter((s) => s.category === cat.key).map((signal) => {
                          const isSelected = selectedSignals.has(signal.type);
                          return (
                            <button
                              key={signal.type}
                              type="button"
                              onClick={() => toggleSignal(signal.type)}
                              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
                              style={
                                isSelected
                                  ? {
                                      backgroundColor: hexToRgba(cat.color, 0.1),
                                      borderColor: hexToRgba(cat.color, 0.25),
                                      color: cat.color,
                                    }
                                  : {
                                      backgroundColor: 'transparent',
                                      borderColor: 'var(--border-primary)',
                                      color: 'var(--text-secondary)',
                                    }
                              }
                            >
                              {signal.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* === CONNECTOR ENRICHMENT (collapsible) === */}
          {zipCode.length === 5 && (hasConnectors || loadingConnectors) && (
            <div>
              <button
                type="button"
                onClick={() => setShowConnectors(!showConnectors)}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: 'var(--brand-deep)' }}
              >
                {showConnectors
                  ? <ChevronUp size={14} />
                  : <ChevronRight size={14} />}
                Data Enrichment
                {selectedConnectors.size > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full text-white ml-1"
                    style={{ backgroundColor: 'var(--brand-deep)' }}
                  >
                    {selectedConnectors.size}
                  </span>
                )}
                {loadingConnectors && (
                  <Loader2 size={12} className="animate-spin ml-1" style={{ color: 'var(--brand-deep)' }} />
                )}
              </button>

              {showConnectors && (
                <div
                  className="mt-3 rounded-lg border p-3"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  {connectors.length > 0 ? (
                    <>
                      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                        These data sources cover zip code {zipCode}. Select which to run against this lead.
                      </p>

                      {/* Select All */}
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer mb-2 pb-2 border-b" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={selectedConnectors.size === connectors.length}
                          onChange={toggleAllConnectors}
                          className="rounded"
                        />
                        Select All ({connectors.length})
                      </label>

                      <div className="space-y-2">
                        {connectors.map((c) => (
                          <label
                            key={c.slug}
                            className="flex items-start gap-2 text-xs cursor-pointer py-1"
                          >
                            <input
                              type="checkbox"
                              checked={selectedConnectors.has(c.slug)}
                              onChange={() => toggleConnector(c.slug)}
                              className="rounded mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {c.name}
                                </span>
                                {c.enrichmentMode === 'live_lookup' ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: 'var(--brand-deep)', color: '#ffffff' }}
                                  >
                                    <Wifi size={8} /> Live Lookup
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={{
                                      backgroundColor: c.hasExistingData ? 'var(--success)' : 'var(--bg-primary)',
                                      color: c.hasExistingData ? '#ffffff' : 'var(--text-tertiary)',
                                      border: c.hasExistingData ? 'none' : '1px solid var(--border-primary)',
                                    }}
                                  >
                                    <Database size={8} />
                                    {c.hasExistingData
                                      ? `${c.existingRecordCount} records`
                                      : 'No data yet'}
                                  </span>
                                )}
                              </div>
                              <span style={{ color: 'var(--text-tertiary)' }}>{c.description}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : !loadingConnectors ? (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No data sources available for zip code {zipCode} yet.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* === ENRICHMENT RESULTS (shown after submit) === */}
          {enrichResults && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Enrichment Results
              </h4>
              <div className="space-y-1">
                {enrichResults.map((r) => (
                  <div key={r.slug} className="flex items-center gap-2 text-xs">
                    {r.found ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    ) : (
                      <AlertCircle size={14} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                    <span style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {r.found
                        ? `${r.signalsAdded} signal${r.signalsAdded !== 1 ? 's' : ''} added`
                        : r.error || 'No matching data'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t sticky bottom-0"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-surface)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="ws-btn-secondary text-sm"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="ws-btn-primary text-sm flex items-center gap-2"
            disabled={isSubmitting || !address.trim() || !city.trim() || !zipCode.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {enriching ? 'Enriching...' : 'Saving...'}
              </>
            ) : selectedConnectors.size > 0 ? (
              <>
                <Plus size={14} />
                Save & Enrich Lead
              </>
            ) : (
              <>
                <Plus size={14} />
                Save Lead
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
