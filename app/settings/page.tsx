'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sliders,
  MapPin,
  Database,
  Bell,
  Key,
  Plus,
  Check,
  RefreshCw,
  AlertCircle,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  UserCircle,
  FileText,
  Pencil,
} from 'lucide-react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/lib/hooks';
import { useRegion } from '@/components/shared/RegionProvider';
import { useWorkspace, type Workspace } from '@/components/shared/WorkspaceProvider';

type SettingsTab = 'account' | 'scoring' | 'regions' | 'sources' | 'scripts' | 'notifications' | 'apikeys';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: UserCircle },
    { id: 'scoring' as const, label: 'Scoring Weights', icon: Sliders },
    { id: 'regions' as const, label: 'Regions', icon: MapPin },
    { id: 'sources' as const, label: 'Data Sources', icon: Database },
    { id: 'scripts' as const, label: 'Scripts & Templates', icon: FileText },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'apikeys' as const, label: 'API Keys', icon: Key },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Configure your WholeSail experience
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shrink-0 w-full text-left"
                  style={
                    isActive
                      ? { backgroundColor: 'var(--brand-deep)', color: '#FFFFFF' }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'scoring' && <ScoringSettings />}
          {activeTab === 'regions' && <RegionSettings />}
          {activeTab === 'sources' && <SourceSettings />}
          {activeTab === 'scripts' && <ScriptsTemplatesSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'apikeys' && <ApiKeysSettings />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DATA SOURCE SETTINGS — connector configuration
// ============================================================

function SourceSettings() {
  const { activeRegion } = useRegion();
  const activeRegionSlug = activeRegion?.slug || 'lehigh-valley';
  const { data: connectorData, loading, refetch } = useApi<any>(
    `/api/connectors/status?region=${activeRegionSlug}`
  );
  const [configModalSlug, setConfigModalSlug] = useState<string | null>(null);

  const connectors = connectorData?.connectors || [];

  return (
    <div className="space-y-4">
      <div className="ws-card">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Data Source Connectors
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Configure connectors and their regional availability
            </p>
          </div>
          <button onClick={() => refetch()} className="ws-btn-ghost text-xs">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading connectors...
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {connectors.length > 0 ? (
              connectors.map((source: any) => (
                <div key={source.slug} className="flex items-center gap-4 px-5 py-4 ws-table-row">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <Database
                      size={18}
                      style={{
                        color: source.status === 'ERROR' ? 'var(--danger)' : 'var(--brand-deep)',
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {source.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {source.description}
                      {source.regionName && (
                        <span className="ml-2 ws-tag ws-tag-info text-[10px]">{source.regionName}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {source.lastRun && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          <Clock size={10} /> Last run: {new Date(source.lastRun).toLocaleString()}
                        </span>
                      )}
                      {source.recordsFound > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {source.recordsFound} records
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {source.status === 'ACTIVE' && (
                      <span className="ws-tag ws-tag-success text-[10px]">Active</span>
                    )}
                    {source.status === 'ERROR' && (
                      <span className="ws-tag ws-tag-danger text-[10px]">
                        <AlertCircle size={10} /> Error
                      </span>
                    )}
                    {source.status === 'PENDING' && (
                      <span className="ws-tag ws-tag-neutral text-[10px]">Ready</span>
                    )}
                    <button
                      onClick={() => setConfigModalSlug(source.slug)}
                      className="ws-btn-ghost p-2 rounded-lg"
                      title="Configure regions"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No connectors available for this region.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cron setup info */}
      <div className="ws-card p-5">
        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Automatic Scheduling
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          To run connectors automatically, set up a free cron job at{' '}
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand-ocean)' }}
          >
            cron-job.org
          </a>
          {' '}pointing to each connector URL. Each connector only imports leads for its assigned region.
        </p>
        <div
          className="mt-2 p-3 rounded-lg text-xs font-mono break-all"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          GET https://your-app.vercel.app/api/connectors/run/lehigh-sheriff-sales?secret=wholesail-run-2026
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Recommended: every 6-12 hours. Update the secret in your .env for production.
        </p>
      </div>

      {/* Connector Config Modal */}
      {configModalSlug && (
        <ConnectorConfigModal
          connectorSlug={configModalSlug}
          onClose={() => {
            setConfigModalSlug(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function ConnectorConfigModal({
  connectorSlug,
  onClose,
}: {
  connectorSlug: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectorName, setConnectorName] = useState('');
  const [description, setDescription] = useState('');
  const [supportedZips, setSupportedZips] = useState<Array<{ zip: string; label: string }>>([]);
  const [allRegions, setAllRegions] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [enabledRegionIds, setEnabledRegionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/connectors/${connectorSlug}/regions`)
      .then((res) => res.json())
      .then((data) => {
        setConnectorName(data.connectorName || connectorSlug);
        setDescription(data.description || '');
        setSupportedZips(data.supportedZipCodes || []);
        setAllRegions(data.allRegions || []);
        const enabled = (data.assignments || [])
          .filter((a: any) => a.isEnabled)
          .map((a: any) => a.regionId);
        setEnabledRegionIds(new Set(enabled));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [connectorSlug]);

  const toggleRegion = (regionId: string) => {
    setSaved(false);
    setEnabledRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/connectors/${connectorSlug}/regions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionIds: Array.from(enabledRegionIds) }),
      });
      setSaved(true);
    } catch {
      // Silent fail — user can retry
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="ws-card relative z-10 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {connectorName}
            </h3>
            {description && (
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {description}
              </p>
            )}
          </div>
          <button onClick={onClose} className="ws-btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Supported Zip Codes */}
            {supportedZips.length > 0 && (
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Supported Zip Codes ({supportedZips.length})
                </p>
                <div
                  className="rounded-lg border overflow-y-auto"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-sunken)',
                    maxHeight: '10.5rem',
                  }}
                >
                  {supportedZips.map(({ zip, label }, i) => (
                    <div
                      key={zip}
                      className="flex items-center gap-3 px-3 py-1.5 text-xs"
                      style={{
                        borderBottom: i < supportedZips.length - 1 ? '1px solid var(--border-primary)' : undefined,
                      }}
                    >
                      <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                        {zip}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Region Assignment */}
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Assigned Regions
              </p>
              <div className="space-y-2">
                {allRegions.map((region) => {
                  const isChecked = enabledRegionIds.has(region.id);
                  return (
                    <label
                      key={region.id}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-elevated)]"
                      style={{
                        backgroundColor: isChecked ? 'rgba(10, 126, 140, 0.08)' : undefined,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRegion(region.id)}
                        className="w-4 h-4 rounded accent-[var(--brand-deep)]"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {region.name}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {region.slug}
                        </p>
                      </div>
                      {isChecked && (
                        <Check size={14} style={{ color: 'var(--brand-deep)' }} />
                      )}
                    </label>
                  );
                })}
                {allRegions.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    No regions available. Add regions in Settings &gt; Regions.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {saved && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
                  <CheckCircle2 size={14} /> Saved
                </span>
              )}
              {!saved && <span />}
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="ws-btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="ws-btn-primary text-xs"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ============================================================
// SCORING SETTINGS — matches SignalsTab categories & colors
// ============================================================

// Same 4 categories + colors as SignalsTab
const SCORING_CATEGORIES = [
  {
    key: 'distress',
    label: 'Distress Signals',
    icon: AlertCircle,
    color: '#ef4444',
    signals: [
      { signalType: 'pre_foreclosure', label: 'Pre-Foreclosure / NOD',  defaultWeight: 45, description: 'Property is in pre-foreclosure or has received NOD' },
      { signalType: 'probate',         label: 'Probate / Estate',        defaultWeight: 38, description: 'Owner deceased, property in probate' },
      { signalType: 'tax_delinquent',  label: 'Tax Delinquent',          defaultWeight: 32, description: 'Property has delinquent taxes' },
      { signalType: 'divorce',         label: 'Recent Divorce',          defaultWeight: 28, description: 'Owner has a recent divorce filing' },
      { signalType: 'code_violation',  label: 'Code Violation',          defaultWeight: 22, description: 'Municipal code violations (stackable — each instance adds points)' },
      { signalType: 'liens_judgments', label: 'Liens / Judgments',       defaultWeight: 18, description: 'Property has liens or judgments filed against it' },
    ],
  },
  {
    key: 'ownership',
    label: 'Ownership',
    icon: Globe,
    color: '#3b82f6',
    signals: [
      { signalType: 'owner_deceased',     label: 'Owner Deceased',       defaultWeight: 35, description: 'Owner is deceased' },
      { signalType: 'inherited',           label: 'Inherited',            defaultWeight: 25, description: 'Owner confirmed they inherited the property' },
      { signalType: 'absentee_owner',      label: 'Absentee Owner',       defaultWeight: 22, description: 'Owner does not live at the property' },
      { signalType: 'out_of_state_owner',  label: 'Out-of-State Owner',   defaultWeight: 15, description: 'Owner lives in a different state' },
      { signalType: 'tired_landlord',      label: 'Tired Landlord',       defaultWeight: 18, description: 'Owner is a tired/overwhelmed landlord' },
      { signalType: 'rental_property',     label: 'Rental Property',      defaultWeight: 8,  description: 'Property is a rental' },
    ],
  },
  {
    key: 'financial',
    label: 'Financial',
    icon: Sliders,
    color: '#10b981',
    signals: [
      { signalType: 'bankruptcy',      label: 'Bankruptcy',            defaultWeight: 30, description: 'Owner has a bankruptcy filing' },
      { signalType: 'high_equity',     label: 'High Equity (50%+)',    defaultWeight: 16, description: 'Estimated equity above 50% of value' },
      { signalType: 'free_and_clear',  label: 'Owned Free & Clear',    defaultWeight: 12, description: 'Property has no mortgage' },
      { signalType: 'job_loss',        label: 'Job Loss / Income Drop', defaultWeight: 20, description: 'Owner experienced job loss or income reduction' },
    ],
  },
  {
    key: 'condition',
    label: 'Condition',
    icon: AlertCircle,
    color: '#6b7280',
    signals: [
      { signalType: 'vacant',               label: 'Vacant Property',       defaultWeight: 25, description: 'Property appears to be vacant' },
      { signalType: 'fire_flood_damage',     label: 'Fire / Flood Damage',   defaultWeight: 20, description: 'Property suffered fire or flood damage' },
      { signalType: 'deferred_maintenance',  label: 'Deferred Maintenance',  defaultWeight: 12, description: 'Significant deferred maintenance visible' },
    ],
  },
];

// Signals from the old system not shown on the Signals tab
const HIDDEN_SIGNALS = [
  { signalType: 'expired_listing', label: 'Expired Listing',        defaultWeight: 8,  description: 'Property had an expired or withdrawn MLS listing' },
  { signalType: 'long_ownership',  label: 'Long-Term Ownership',    defaultWeight: 5,  description: 'Owned for 15+ years' },
  { signalType: 'low_saturation',  label: 'Low Zip Saturation',     defaultWeight: 6,  description: 'Zip code has low wholesaler competition' },
];

type WeightMap = Record<string, number>;

function ScoringSettings() {
  const [weights, setWeights] = useState<WeightMap>({});
  const [savedWeights, setSavedWeights] = useState<WeightMap>({});
  const [loadingWeights, setLoadingWeights] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // Load weights from API on mount
  useEffect(() => {
    fetch('/api/scoring-weights')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map: WeightMap = {};
          for (const w of data) {
            map[w.signalType] = w.weight;
          }
          setWeights(map);
          setSavedWeights(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingWeights(false));
  }, []);

  const getWeight = (signalType: string, defaultWeight: number) =>
    weights[signalType] ?? defaultWeight;

  const updateWeight = (signalType: string, value: number) => {
    setWeights((prev) => ({ ...prev, [signalType]: value }));
    setSaveMessage(null);
  };

  const isDirty = JSON.stringify(weights) !== JSON.stringify(savedWeights);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    const allSignals = [
      ...SCORING_CATEGORIES.flatMap((c, ci) =>
        c.signals.map((s, si) => ({
          signalType: s.signalType,
          label: s.label,
          category: c.key,
          weight: getWeight(s.signalType, s.defaultWeight),
          description: s.description,
          sortOrder: ci * 100 + si,
        }))
      ),
      ...HIDDEN_SIGNALS.map((s, i) => ({
        signalType: s.signalType,
        label: s.label,
        category: 'hidden',
        weight: getWeight(s.signalType, s.defaultWeight),
        description: s.description,
        sortOrder: 900 + i,
      })),
    ];

    try {
      const res = await fetch('/api/scoring-weights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: allSignals }),
      });

      if (res.ok) {
        setSavedWeights({ ...weights });
        setSaveMessage({ type: 'success', text: 'Scoring weights saved. New scores apply to future signal changes.' });
      } else {
        const err = await res.json();
        setSaveMessage({ type: 'error', text: err.error || 'Failed to save' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error — could not save' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults: WeightMap = {};
    for (const cat of SCORING_CATEGORIES) {
      for (const s of cat.signals) {
        defaults[s.signalType] = s.defaultWeight;
      }
    }
    for (const s of HIDDEN_SIGNALS) {
      defaults[s.signalType] = s.defaultWeight;
    }
    setWeights(defaults);
    setSaveMessage(null);
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="ws-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Lead Scoring Weights
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="ws-btn-ghost text-xs"
              title="Reset all weights to defaults"
            >
              <RefreshCw size={14} /> Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="ws-btn-primary text-xs"
              style={{ opacity: saving || !isDirty ? 0.5 : 1 }}
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : (
                <><Check size={14} /> Save Changes</>
              )}
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Adjust the point value for each signal. Higher points = more impact on the lead&apos;s total score.
          Changes apply when signals are next added or toggled.
        </p>

        {saveMessage && (
          <div
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
            style={{
              backgroundColor: saveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: saveMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {saveMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {saveMessage.text}
          </div>
        )}
      </div>

      {loadingWeights ? (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading scoring weights...
        </div>
      ) : (
        <>
          {/* Category Sections */}
          {SCORING_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.key} className="ws-card overflow-hidden">
                {/* Category Header — same style as SignalsTab */}
                <div
                  className="flex items-center gap-2 px-5 py-3 border-b"
                  style={{ borderColor: category.color, borderBottomWidth: '2px' }}
                >
                  <Icon size={16} style={{ color: category.color }} />
                  <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: category.color }}>
                    {category.label}
                  </h4>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {category.signals.length} signal{category.signals.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {category.signals.map((signal) => (
                    <WeightSlider
                      key={signal.signalType}
                      label={signal.label}
                      description={signal.description}
                      value={getWeight(signal.signalType, signal.defaultWeight)}
                      categoryColor={category.color}
                      onChange={(v) => updateWeight(signal.signalType, v)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Hidden Signals — collapsible */}
          {HIDDEN_SIGNALS.length > 0 && (
            <div className="ws-card overflow-hidden">
              <button
                onClick={() => setShowHidden(!showHidden)}
                className="flex items-center gap-2 px-5 py-3 w-full text-left border-b transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <EyeOff size={16} style={{ color: 'var(--text-tertiary)' }} />
                <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  Hidden Signals
                </h4>
                <span className="text-[10px] ml-auto mr-2" style={{ color: 'var(--text-tertiary)' }}>
                  {HIDDEN_SIGNALS.length} signal{HIDDEN_SIGNALS.length !== 1 ? 's' : ''} · not shown on Signals tab
                </span>
                {showHidden ? (
                  <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} />
                ) : (
                  <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                )}
              </button>

              {showHidden && (
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {HIDDEN_SIGNALS.map((signal) => (
                    <WeightSlider
                      key={signal.signalType}
                      label={signal.label}
                      description={signal.description}
                      value={getWeight(signal.signalType, signal.defaultWeight)}
                      categoryColor="var(--text-tertiary)"
                      onChange={(v) => updateWeight(signal.signalType, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stacking Bonuses Info */}
          <div className="ws-card p-5">
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Stacking Bonuses
            </h4>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Automatic bonus points when multiple signals combine — not individually configurable.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Distress Stacking</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>2 active distress signals = +10 pts · 3+ = +20 pts</p>
                </div>
                <span className="text-sm font-bold" style={{ color: '#ef4444' }}>+10 / +20</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Multi-Violation</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>2+ active code violation signals = +10 pts</p>
                </div>
                <span className="text-sm font-bold" style={{ color: '#ef4444' }}>+10</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WeightSlider({
  label,
  description,
  value,
  categoryColor,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  categoryColor: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
          {description && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>}
        </div>
        <span className="text-sm font-bold min-w-[50px] text-right" style={{ color: categoryColor }}>
          {value} pts
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={50}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${categoryColor} 0%, ${categoryColor} ${(value / 50) * 100}%, var(--border-primary) ${(value / 50) * 100}%, var(--border-primary) 100%)`,
        }}
      />
    </div>
  );
}

// ============================================================
// REGION SETTINGS (unchanged)
// ============================================================

function RegionSettings() {
  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Active Regions</h3>
          <button className="ws-btn-secondary text-xs"><Plus size={14} /> Add Region</button>
        </div>
        <div className="p-4 rounded-lg border-2" style={{ borderColor: 'var(--brand-deep)', backgroundColor: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin size={16} style={{ color: 'var(--brand-deep)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Greater Lehigh Valley</span>
            </div>
            <span className="ws-tag ws-tag-success text-[10px]">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div><p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>State</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>Pennsylvania</p></div>
            <div><p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Counties</p><p className="text-sm" style={{ color: 'var(--text-primary)' }}>Lehigh, Northampton</p></div>
          </div>
        </div>
        <button className="w-full mt-3 p-4 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:bg-[var(--bg-elevated)]" style={{ borderColor: 'var(--border-primary)' }}>
          <Globe size={16} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Add another region to scale your operation</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION SETTINGS (unchanged)
// ============================================================

function NotificationSettings() {
  const [settings, setSettings] = useState({
    newHighScore: true, timeSensitive: true, inboundReply: true, followUpDue: true, handoffResponse: true, minScoreAlert: 70,
  });
  const toggleSetting = (key: keyof typeof settings) => { setSettings((prev) => ({ ...prev, [key]: !prev[key] })); };

  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Notification Preferences</h3>
        <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>Choose which events trigger notifications</p>
        <div className="space-y-3">
          <ToggleRow label="New High-Score Leads" description="Alert when a lead scores above your threshold" checked={settings.newHighScore} onChange={() => toggleSetting('newHighScore')} />
          <ToggleRow label="Time-Sensitive Events" description="Sheriff sales, probate filings, foreclosure deadlines" checked={settings.timeSensitive} onChange={() => toggleSetting('timeSensitive')} />
          <ToggleRow label="Inbound Replies" description="When a lead responds to your text or email" checked={settings.inboundReply} onChange={() => toggleSetting('inboundReply')} />
          <ToggleRow label="Follow-Up Reminders" description="Reminder when a scheduled follow-up is due" checked={settings.followUpDue} onChange={() => toggleSetting('followUpDue')} />
          <ToggleRow label="Hand-Off Responses" description="When a partner accepts or rejects a hand-off" checked={settings.handoffResponse} onChange={() => toggleSetting('handoffResponse')} />
        </div>
        <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Score Alert Threshold</h4>
          <div className="flex items-center gap-4">
            <input type="range" min={30} max={95} step={5} value={settings.minScoreAlert}
              onChange={(e) => setSettings((prev) => ({ ...prev, minScoreAlert: parseInt(e.target.value) }))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, var(--brand-deep) 0%, var(--brand-deep) ${((settings.minScoreAlert - 30) / 65) * 100}%, var(--border-primary) ${((settings.minScoreAlert - 30) / 65) * 100}%, var(--border-primary) 100%)` }}
            />
            <span className="text-sm font-bold min-w-[50px] text-right" style={{ color: 'var(--brand-deep)' }}>{settings.minScoreAlert}+</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Only notify for leads scoring {settings.minScoreAlert} or higher</p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
      <button onClick={onChange} className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ml-3"
        style={{ backgroundColor: checked ? 'var(--brand-deep)' : 'var(--border-primary)' }}>
        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

// ============================================================
// API KEYS SETTINGS
// ============================================================

function ApiKeysSettings() {
  const [keys, setKeys] = useState<Record<string, { configured: boolean; maskedValue: string }>>({});
  const [loading, setLoading] = useState(true);
  const [geoapifyKey, setGeoapifyKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch current key statuses
  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/api-keys');
      const data = await res.json();
      setKeys(data.keys || {});
    } catch {
      // Silently fail — keys just won't show as configured
    } finally {
      setLoading(false);
    }
  }

  async function saveGeoapifyKey() {
    if (!geoapifyKey.trim()) return;
    setSaving(true);
    setSaveMessage('');
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'geoapify', value: geoapifyKey.trim() }),
      });
      if (res.ok) {
        setSaveMessage('API key saved successfully.');
        setGeoapifyKey('');
        setShowKey(false);
        await fetchKeys();
      } else {
        const err = await res.json();
        setSaveMessage(`Error: ${err.error}`);
      }
    } catch {
      setSaveMessage('Failed to save key.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGeoapifyKey() {
    setSaving(true);
    setSaveMessage('');
    setTestResult(null);
    try {
      await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'geoapify' }),
      });
      setSaveMessage('API key removed.');
      await fetchKeys();
    } catch {
      setSaveMessage('Failed to remove key.');
    } finally {
      setSaving(false);
    }
  }

  async function testGeoapifyKey() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/geocode/autocomplete?q=123+Main+St');
      const data = await res.json();
      if (data.error) {
        setTestResult({ success: false, message: data.error });
      } else if (data.suggestions && data.suggestions.length > 0) {
        setTestResult({ success: true, message: `Working — returned ${data.suggestions.length} result(s)` });
      } else {
        setTestResult({ success: true, message: 'Connected (no results for test query, but API key is valid)' });
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to reach autocomplete endpoint' });
    } finally {
      setTesting(false);
    }
  }

  const isConfigured = keys.geoapify?.configured;

  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <div className="mb-1">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            API Keys
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Manage external service API keys used by WholeSail
          </p>
        </div>
      </div>

      {/* Geoapify */}
      <div className="ws-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Geoapify
              </h4>
              {loading ? (
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
              ) : isConfigured ? (
                <span className="ws-tag ws-tag-success text-[10px]">Active</span>
              ) : (
                <span className="ws-tag ws-tag-neutral text-[10px]">Not configured</span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Used for address autocomplete when adding leads.
              Free tier includes 3,000 requests/day.
            </p>
          </div>
          <a
            href="https://myprojects.geoapify.com/register"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium shrink-0"
            style={{ color: 'var(--brand-ocean)' }}
          >
            Get a free key <ExternalLink size={12} />
          </a>
        </div>

        {/* Current key display */}
        {isConfigured && (
          <div
            className="flex items-center justify-between p-3 rounded-lg mb-3"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center gap-2">
              <Key size={14} style={{ color: 'var(--brand-deep)' }} />
              <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                {keys.geoapify.maskedValue}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={testGeoapifyKey}
                disabled={testing}
                className="ws-btn-secondary text-xs"
              >
                {testing ? (
                  <><Loader2 size={12} className="animate-spin" /> Testing...</>
                ) : (
                  'Test'
                )}
              </button>
              <button
                onClick={deleteGeoapifyKey}
                disabled={saving}
                className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                title="Remove API key"
              >
                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
              </button>
            </div>
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3"
            style={{
              backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: testResult.success ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {testResult.message}
          </div>
        )}

        {/* Save message */}
        {saveMessage && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3"
            style={{
              backgroundColor: saveMessage.startsWith('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: saveMessage.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {saveMessage.startsWith('Error') ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
            {saveMessage}
          </div>
        )}

        {/* Input for new/update key */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={geoapifyKey}
              onChange={(e) => setGeoapifyKey(e.target.value)}
              placeholder={isConfigured ? 'Enter new key to replace...' : 'Paste your Geoapify API key...'}
              className="ws-input text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey
                ? <EyeOff size={14} style={{ color: 'var(--text-tertiary)' }} />
                : <Eye size={14} style={{ color: 'var(--text-tertiary)' }} />
              }
            </button>
          </div>
          <button
            onClick={saveGeoapifyKey}
            disabled={!geoapifyKey.trim() || saving}
            className="ws-btn-primary text-xs shrink-0"
          >
            {saving ? (
              <><Loader2 size={12} className="animate-spin" /> Saving...</>
            ) : (
              <><Check size={14} /> Save</>
            )}
          </button>
        </div>

        <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Sign up at{' '}
          <a
            href="https://www.geoapify.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--brand-ocean)' }}
          >
            geoapify.com
          </a>
          {' '}to get a free API key (no credit card required). The free tier supports up to 3,000 autocomplete requests per day.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ACCOUNT SETTINGS — workspace management
// ============================================================

function AccountSettings() {
  const { activeWorkspace, workspaces, setActiveWorkspace, refetchWorkspaces, loading } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await apiPost<Workspace>('/api/workspaces', { name: newName.trim() });
      if (res) {
        setActiveWorkspace(res);
        refetchWorkspaces();
        setNewName('');
        setCreating(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Workspace
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Select which workspace you belong to. All team members in the same
          workspace share leads, scripts, signal weights, and settings.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading workspaces...
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((ws) => {
            const isActive = activeWorkspace?.id === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className="ws-card p-4 w-full text-left flex items-center gap-3 transition-all"
                style={{
                  borderColor: isActive ? 'var(--brand-deep)' : undefined,
                  borderWidth: isActive ? '2px' : undefined,
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    backgroundColor: isActive ? 'var(--brand-deep)' : 'var(--bg-elevated)',
                    color: isActive ? '#fff' : 'var(--text-tertiary)',
                  }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {ws.name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {ws.slug}
                  </p>
                </div>
                {isActive && (
                  <Check size={18} style={{ color: 'var(--brand-deep)' }} className="shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {creating ? (
        <div className="ws-card p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="ws-input text-sm"
            placeholder="Workspace name (e.g. Homerun Home Solutions)"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="ws-btn-primary text-xs"
            >
              {saving ? <><Loader2 size={12} className="animate-spin" /> Creating...</> : <><Check size={14} /> Create</>}
            </button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="ws-btn-secondary text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="ws-btn-secondary text-xs">
          <Plus size={14} /> Create Workspace
        </button>
      )}

      <div className="ws-card p-4">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Team Access
        </h4>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          User accounts and invite links are coming soon. For now, all users on the same deployment share workspace data.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// SCRIPTS & TEMPLATES SETTINGS
// ============================================================

interface ScriptItem {
  id: string;
  title: string;
  slug: string;
  body: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  workspaceId: string | null;
  language?: string;
}

function ScriptsTemplatesSettings() {
  const { activeWorkspace } = useWorkspace();
  const [subTab, setSubTab] = useState<'call' | 'sms'>('call');

  return (
    <div className="space-y-4">
      <div className="ws-card p-5">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Scripts & Templates
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage call scripts and SMS templates for your workspace.
        </p>
        <div className="flex gap-1 mt-3">
          {(['call', 'sms'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={
                subTab === tab
                  ? { backgroundColor: 'var(--brand-deep)', color: '#fff' }
                  : { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }
              }
            >
              {tab === 'call' ? 'Call Scripts' : 'SMS Templates'}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'call' ? (
        <ScriptsList workspaceId={activeWorkspace?.id || null} type="call" />
      ) : (
        <ScriptsList workspaceId={activeWorkspace?.id || null} type="sms" />
      )}
    </div>
  );
}

function ScriptsList({ workspaceId, type }: { workspaceId: string | null; type: 'call' | 'sms' }) {
  const apiBase = type === 'call' ? '/api/scripts' : '/api/sms-templates';
  const fetchUrl = workspaceId ? `${apiBase}?workspaceId=${workspaceId}` : apiBase;
  const { data, loading, refetch } = useApi<ScriptItem[]>(fetchUrl);

  const [editingItem, setEditingItem] = useState<ScriptItem | null>(null);
  const [creating, setCreating] = useState(false);

  const items = data || [];
  const preBuilt = items.filter((s) => !s.workspaceId);
  const custom = items.filter((s) => s.workspaceId);

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await apiDelete(`${apiBase}/${id}`);
    refetch();
  }

  async function handleSetDefault(id: string) {
    await apiPatch(`${apiBase}/${id}`, { isDefault: true });
    refetch();
  }

  return (
    <div className="space-y-4">
      {/* Custom (workspace) items */}
      <div className="ws-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Your {type === 'call' ? 'Scripts' : 'Templates'}
            </h4>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Custom {type === 'call' ? 'scripts' : 'templates'} for your workspace
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="ws-btn-primary text-xs"
            disabled={!workspaceId}
          >
            <Plus size={14} /> New {type === 'call' ? 'Script' : 'Template'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : custom.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FileText size={24} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-2" />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              No custom {type === 'call' ? 'scripts' : 'templates'} yet.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {custom.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                    {item.isDefault && <span className="ws-tag ws-tag-success text-[10px]">Default</span>}
                    {type === 'sms' && item.language && (
                      <span className="ws-tag ws-tag-neutral text-[10px]">{item.language === 'es' ? 'ES' : 'EN'}</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!item.isDefault && (
                    <button onClick={() => handleSetDefault(item.id)} className="ws-btn-ghost text-[10px] px-2 py-1">
                      Set Default
                    </button>
                  )}
                  <button onClick={() => setEditingItem(item)} className="ws-btn-ghost p-1.5">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="ws-btn-ghost p-1.5">
                    <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pre-built items */}
      {preBuilt.length > 0 && (
        <div className="ws-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Pre-Built {type === 'call' ? 'Scripts' : 'Templates'}
            </h4>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Available to all workspaces (read-only)
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {preBuilt.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                    {item.isDefault && <span className="ws-tag ws-tag-success text-[10px]">Default</span>}
                    <span className="ws-tag ws-tag-info text-[10px]">Pre-built</span>
                  </div>
                  {item.description && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {(creating || editingItem) && (
        <ScriptEditorModal
          item={editingItem}
          type={type}
          workspaceId={workspaceId}
          onClose={() => { setCreating(false); setEditingItem(null); }}
          onSaved={() => { refetch(); setCreating(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

function ScriptEditorModal({
  item,
  type,
  workspaceId,
  onClose,
  onSaved,
}: {
  item: ScriptItem | null;
  type: 'call' | 'sms';
  workspaceId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!item;
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [body, setBody] = useState(item?.body || '');
  const [language, setLanguage] = useState(item?.language || 'en');
  const [saving, setSaving] = useState(false);

  const apiBase = type === 'call' ? '/api/scripts' : '/api/sms-templates';

  async function handleSave() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      if (isEditing) {
        await apiPatch(`${apiBase}/${item.id}`, {
          title: title.trim(),
          body: body.trim(),
          description: description.trim() || null,
          ...(type === 'sms' && { language }),
        });
      } else {
        await apiPost(apiBase, {
          title: title.trim(),
          body: body.trim(),
          description: description.trim() || null,
          workspaceId,
          ...(type === 'sms' && { language }),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="ws-card flex flex-col overflow-hidden w-full max-w-2xl mx-4"
        style={{ backgroundColor: 'var(--bg-surface)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? 'Edit' : 'New'} {type === 'call' ? 'Call Script' : 'SMS Template'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="ws-input text-sm"
              placeholder={type === 'call' ? 'e.g. Warm Follow-Up Script' : 'e.g. Initial Outreach'}
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ws-input text-sm"
              placeholder="Brief description of when to use this"
            />
          </div>

          {type === 'sms' && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Language</label>
              <div className="flex rounded-lg overflow-hidden border w-fit" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  onClick={() => setLanguage('en')}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: language === 'en' ? 'var(--brand-deep)' : 'transparent',
                    color: language === 'en' ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  English
                </button>
                <button
                  onClick={() => setLanguage('es')}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: language === 'es' ? 'var(--brand-deep)' : 'transparent',
                    color: language === 'es' ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Espa&ntilde;ol
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="ws-input text-sm min-h-[300px] resize-y"
              placeholder="Write your script or template here..."
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Available placeholders: [Owner Name], [Address], [Your Name]
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-5 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <button onClick={onClose} className="ws-btn-secondary text-xs flex-1 justify-center py-2.5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !body.trim() || saving}
            className="ws-btn-primary text-xs flex-1 justify-center py-2.5"
          >
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : <><Check size={14} /> {isEditing ? 'Save Changes' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
